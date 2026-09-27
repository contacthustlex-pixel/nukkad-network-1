import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const schema = readFileSync(new URL("../supabase/migrations/001_schema.sql", import.meta.url), "utf8");
const logic = readFileSync(new URL("../supabase/migrations/002_logic.sql", import.meta.url), "utf8");
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(schema);
await db.exec(logic);

const cafe = (await db.query(`select id from businesses where slug = 'sharma-cafe'`)).rows[0].id;
const salon = (await db.query(`select id from businesses where slug = 'glow-salon'`)).rows[0].id;

const issued = (await db.query(`select issue_code($1, $2, $3) as result`, ["9812345678", "Asha", cafe])).rows[0].result;
const code = issued.code;
if (!/^NK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(code)) {
  throw new Error("bad code " + code);
}

const first = (await db.query(`select redeem_code($1, $2, $3, $4) as result`, [code, salon, 1000, true])).rows[0].result;
if (Number(first.discount) !== 100) throw new Error("salon discount " + first.discount);
if (Number(first.referrer_amt) !== 50) throw new Error("referrer " + first.referrer_amt);
if (Number(first.platform_amt) !== 50) throw new Error("platform " + first.platform_amt);
if (Number(first.net_payable) !== 900) throw new Error("net " + first.net_payable);
if (!first.next_code) throw new Error("missing next code");

let secondFailed = false;
try {
  await db.query(`select redeem_code($1, $2, $3, $4) as result`, [code, salon, 1000, true]);
} catch (error) {
  secondFailed = true;
  console.log("second redeem error:", error.message);
}
if (!secondFailed) throw new Error("second redeem should fail");

const active = await db.query(
  `select code, status, source_business_id, source_redemption_id from referral_codes where status = 'active'`,
);
if (active.rows.length !== 1) throw new Error("expected 1 active code, got " + active.rows.length);
if (active.rows[0].code !== first.next_code) throw new Error("active code is not the next code");
if (active.rows[0].source_business_id !== salon) throw new Error("next code source should be redeeming business");
if (!active.rows[0].source_redemption_id) throw new Error("next code missing source_redemption_id");

const again = (await db.query(`select issue_code($1, $2, $3) as result`, ["9812345678", "Asha", cafe])).rows[0].result;
const statuses = await db.query(`select code, status from referral_codes order by created_at`);
const stillActive = statuses.rows.filter((row) => row.status === "active");
if (stillActive.length !== 1 || stillActive[0].code !== again.code) {
  throw new Error("rescan did not supersede: " + JSON.stringify(statuses.rows));
}

let sourceBlocked = false;
try {
  await db.query(`select redeem_code($1, $2, $3, $4)`, [again.code, cafe, 400, true]);
} catch (error) {
  sourceBlocked = /source/.test(error.message);
  console.log("source redeem error:", error.message);
}
if (!sourceBlocked) throw new Error("source business should reject the code");

let lifetimeBlocked = false;
try {
  await db.query(`select redeem_code($1, $2, $3, $4)`, [again.code, salon, 500, false]);
} catch (error) {
  lifetimeBlocked = /lifetime/.test(error.message);
  console.log("lifetime redeem error:", error.message);
}
if (!lifetimeBlocked) throw new Error("lifetime claim should block a second visit");

const xeroxId = (await db.query(`select id from categories where name = 'Xerox'`)).rows[0].id;
await db.query(
  `insert into businesses (name, slug, phone, category_id) values ('Quick Xerox', 'quick-xerox', '9833333333', $1)`,
  [xeroxId],
);
const xerox = (await db.query(`select id from businesses where slug = 'quick-xerox'`)).rows[0].id;
const xeroxCode = (await db.query(`select issue_code($1, $2, $3) as result`, ["9898989898", "Ravi", cafe])).rows[0].result.code;
let minFailed = false;
try {
  await db.query(`select redeem_code($1, $2, $3, $4)`, [xeroxCode, xerox, 40, true]);
} catch (error) {
  minFailed = /minimum/.test(error.message);
}
if (!minFailed) throw new Error("xerox min bill should fail");
const xeroxRedeem = (await db.query(`select redeem_code($1, $2, $3, $4) as result`, [xeroxCode, xerox, 100, true])).rows[0].result;
if (Number(xeroxRedeem.discount) !== 10) throw new Error("xerox discount " + xeroxRedeem.discount);
if (Number(xeroxRedeem.referrer_amt) !== 5 || Number(xeroxRedeem.platform_amt) !== 5) {
  throw new Error("xerox flats " + JSON.stringify(xeroxRedeem));
}

await db.query("set role anon");
const publicRead = await db.query("select count(*)::int as n from categories");
if (publicRead.rows[0].n !== 5) throw new Error("anon cannot read categories");
let privateBlocked = false;
try {
  await db.query("select * from customers");
} catch (error) {
  privateBlocked = true;
  console.log("anon customers error:", error.message);
}
if (!privateBlocked) throw new Error("anon should not read customers");
let writeBlocked = false;
try {
  await db.query("insert into categories (name) values ('Nope')");
} catch (error) {
  writeBlocked = true;
  console.log("anon write error:", error.message);
}
if (!writeBlocked) throw new Error("anon should not write");
await db.query("reset role");

console.log("OK logic");
await db.close();
