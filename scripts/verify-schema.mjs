import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const sql = readFileSync(new URL("../supabase/migrations/001_schema.sql", import.meta.url), "utf8");
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(sql);
const { rows } = await db.query(`
  select c.name,
         r.discount_pct::float8 as discount_pct,
         r.discount_cap::float8 as discount_cap,
         r.referrer_mode,
         r.referrer_pct::float8 as referrer_pct,
         r.referrer_flat::float8 as referrer_flat,
         r.platform_mode,
         r.platform_pct::float8 as platform_pct,
         r.platform_flat::float8 as platform_flat,
         r.min_bill::float8 as min_bill
  from rate_cards r
  join categories c on c.id = r.category_id
  order by c.name
`);
console.log(JSON.stringify(rows, null, 2));
if (rows.length !== 5) {
  console.error("EXPECTED 5 rate cards, got " + rows.length);
  process.exit(1);
}
const expected = {
  Cafe: { discount_cap: 80, referrer_mode: "pct", referrer_pct: 5, platform_pct: 5, min_bill: 0 },
  Salon: { discount_cap: 200, referrer_mode: "pct", referrer_pct: 5, platform_pct: 5, min_bill: 0 },
  Laundry: { discount_cap: 60, referrer_mode: "pct", referrer_pct: 5, platform_pct: 5, min_bill: 0 },
  Gym: { discount_cap: 150, referrer_mode: "pct", referrer_pct: 5, platform_pct: 5, min_bill: 0 },
  Xerox: { discount_cap: 20, referrer_mode: "flat", referrer_flat: 5, platform_flat: 5, min_bill: 50 },
};
for (const row of rows) {
  const want = expected[row.name];
  if (!want) throw new Error("unexpected category " + row.name);
  if (Number(row.discount_pct) !== 10) throw new Error(row.name + " pct");
  if (Number(row.discount_cap) !== want.discount_cap) throw new Error(row.name + " cap");
  if (row.referrer_mode !== want.referrer_mode) throw new Error(row.name + " mode");
  if (want.referrer_pct != null && Number(row.referrer_pct) !== want.referrer_pct) throw new Error(row.name + " ref pct");
  if (want.referrer_flat != null && Number(row.referrer_flat) !== want.referrer_flat) throw new Error(row.name + " ref flat");
  if (want.platform_pct != null && Number(row.platform_pct) !== want.platform_pct) throw new Error(row.name + " plat pct");
  if (want.platform_flat != null && Number(row.platform_flat) !== want.platform_flat) throw new Error(row.name + " plat flat");
  if (Number(row.min_bill) !== want.min_bill) throw new Error(row.name + " min");
}
const biz = await db.query("select slug from businesses order by slug");
if (biz.rows.map((r) => r.slug).join(",") !== "glow-salon,sharma-cafe") {
  throw new Error("seed businesses mismatch");
}
console.log("OK 5 rate cards");
await db.close();
