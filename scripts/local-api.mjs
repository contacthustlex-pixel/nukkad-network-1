import { createServer } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const PORT = Number(process.env.LOCAL_API_PORT || 54321);
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "local-service-role-key";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "local-anon-key";
const IDENT = /^[a-z_][a-z0-9_]*$/i;

function dataDir() {
  const url = new URL("../.data/pglite/", import.meta.url);
  let path = decodeURIComponent(url.pathname);
  if (path.startsWith("/") && /^[A-Za-z]:/.test(path.slice(1))) path = path.slice(1);
  return path;
}

mkdirSync(dataDir(), { recursive: true });

const db = new PGlite({
  dataDir: dataDir(),
  extensions: { pgcrypto },
});

async function init() {
  const ready = await db.query("select to_regclass('public.businesses') as name");
  if (ready.rows[0]?.name) return;
  const schema = readFileSync(new URL("../supabase/migrations/001_schema.sql", import.meta.url), "utf8");
  const logic = readFileSync(new URL("../supabase/migrations/002_logic.sql", import.meta.url), "utf8");
  await db.exec(schema);
  await db.exec(logic);
}

function isService(req) {
  const key = req.headers.apikey || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  return key === SERVICE_KEY;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function filters(params) {
  const clauses = [];
  const values = [];
  for (const [key, value] of params.entries()) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    if (!IDENT.test(key)) throw new Error("bad column " + key);
    const dot = value.indexOf(".");
    const op = dot === -1 ? "eq" : value.slice(0, dot);
    const raw = decodeURIComponent(dot === -1 ? value : value.slice(dot + 1));
    if (op === "is") {
      clauses.push(`${key} is ${raw === "null" ? "null" : "not null"}`);
      continue;
    }
    if (op === "in") {
      const items = raw.replace(/^\(|\)$/g, "").split(",").filter(Boolean);
      const placeholders = items.map((item) => {
        values.push(item);
        return `$${values.length}`;
      });
      clauses.push(`${key} in (${placeholders.join(", ")})`);
      continue;
    }
    values.push(raw);
    const idx = `$${values.length}`;
    const sqlOp = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike" }[op];
    if (!sqlOp) throw new Error("bad filter " + op);
    clauses.push(`${key} ${sqlOp} ${idx}`);
  }
  return { where: clauses.length ? `where ${clauses.join(" and ")}` : "", values };
}

function orderBy(params) {
  const order = params.get("order");
  if (!order) return "";
  const parts = order.split(",").map((part) => {
    const [column, direction = "asc"] = part.split(".");
    if (!IDENT.test(column)) throw new Error("bad order");
    return `${column} ${direction.toLowerCase() === "desc" ? "desc" : "asc"}`;
  });
  return `order by ${parts.join(", ")}`;
}

function columns(params) {
  const select = params.get("select") || "*";
  if (select === "*") return "*";
  const cols = select.split(",").map((col) => col.trim());
  if (cols.some((col) => !IDENT.test(col))) throw new Error("unsupported select " + select);
  return cols.join(", ");
}

async function withRole(service, run) {
  await db.exec("begin");
  try {
    if (!service) await db.exec("set local role anon");
    const result = await run();
    await db.exec("commit");
    return result;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

async function handle(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,HEAD,OPTIONS",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, "http://127.0.0.1");
  const service = isService(req);
  const headers = {
    "access-control-allow-origin": "*",
    "content-type": "application/json",
    "access-control-expose-headers": "content-range",
  };

  try {
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const fn = url.pathname.slice("/rest/v1/rpc/".length);
      if (!IDENT.test(fn)) throw new Error("bad function");
      const body = await readBody(req);
      const keys = Object.keys(body);
      if (keys.some((key) => !IDENT.test(key))) throw new Error("bad arg");
      const args = keys.map((key, index) => `${key} => $${index + 1}`).join(", ");
      const values = keys.map((key) => body[key]);
      const sql = `select ${fn}(${args}) as result`;
      const query = await withRole(service, () => db.query(sql, values));
      res.writeHead(200, headers);
      res.end(JSON.stringify(query.rows[0]?.result ?? null));
      return;
    }

    const match = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/i);
    if (!match) {
      res.writeHead(404, headers);
      res.end(JSON.stringify({ message: "not found" }));
      return;
    }
    const table = match[1];
    if (!IDENT.test(table)) throw new Error("bad table");
    const { where, values } = filters(url.searchParams);
    const countSql = `select count(*)::int as count from ${table} ${where}`;
    const count = await withRole(service, () => db.query(countSql, values));
    const total = count.rows[0]?.count ?? 0;
    if (req.method === "HEAD" || url.searchParams.get("select") === "count") {
      res.writeHead(200, { ...headers, "content-range": `*/${total}` });
      res.end();
      return;
    }
    const limit = Number(url.searchParams.get("limit") || 1000);
    const offset = Number(url.searchParams.get("offset") || 0);
    const sql = `select ${columns(url.searchParams)} from ${table} ${where} ${orderBy(url.searchParams)} limit ${limit} offset ${offset}`;
    const rows = await withRole(service, () => db.query(sql, values));
    const end = rows.rows.length === 0 ? 0 : offset + rows.rows.length - 1;
    res.writeHead(200, { ...headers, "content-range": `${offset}-${end}/${total}` });
    res.end(JSON.stringify(rows.rows));
  } catch (error) {
    res.writeHead(400, headers);
    res.end(JSON.stringify({ message: error.message, code: error.code || "P0001" }));
  }
}

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: error.message }));
  });
});

await init();
server.listen(PORT, "127.0.0.1", () => {
  console.log(`local api http://127.0.0.1:${PORT}`);
});
