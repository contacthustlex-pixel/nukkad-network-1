import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const migrationsDir = join(root, "supabase", "migrations");
const outPath = join(root, "supabase", "manual", "fresh_install.sql");

/** Remove one CREATE OR REPLACE function block (through closing $$;). */
function stripFunction(sql, functionName) {
  const marker = `create or replace function public.${functionName}(`;
  const start = sql.toLowerCase().indexOf(marker);
  if (start === -1) return sql;
  const end = sql.indexOf("$$;", start);
  if (end === -1) return sql;
  return (sql.slice(0, start) + sql.slice(end + 4)).replace(/\n{3,}/g, "\n\n");
}

function patchFile(name, sql) {
  if (name === "002_logic.sql") {
    return stripFunction(sql, "resolve_dispute");
  }
  if (name === "005_settings_disputes_admin.sql") {
    return ["drop function if exists public.resolve_dispute(uuid, text);", "", sql.trim()].join("\n");
  }
  if (name === "004_partners_chains.sql") {
    let next = stripFunction(sql, "submit_partner_application");
    next = stripFunction(next, "approve_partner_application");
    next = next
      .split("\n")
      .filter((line) => {
        const l = line.trim();
        if (l.includes("submit_partner_application")) return false;
        if (l.includes("approve_partner_application")) return false;
        return true;
      })
      .join("\n");
    return next;
  }
  return sql;
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

const chunks = files.map((file) => patchFile(file, readFileSync(join(migrationsDir, file), "utf8")).trimEnd());

writeFileSync(outPath, `${chunks.join("\n\n")}\n`, "utf8");
console.log(`Wrote ${outPath} (${files.length} migrations)`);
