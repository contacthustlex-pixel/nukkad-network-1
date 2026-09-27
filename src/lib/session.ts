import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "nk_partner";

function secret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "dev";
}

export function partnerCookieName() {
  return COOKIE;
}

export function signPartner(businessId: string) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = `${businessId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function readPartner(token: string | undefined) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [businessId, exp, sig] = parts;
  const expected = createHmac("sha256", secret()).update(`${businessId}.${exp}`).digest("hex");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  if (Number(exp) < Date.now()) return null;
  return businessId;
}
