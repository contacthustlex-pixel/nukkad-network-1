import { appOrigin } from "@/lib/site-url";
import { sendSession, sendTemplate } from "@/lib/whatsapp";

type ShopLink = { name: string; url: string };

export async function sendFirstCodeMessage(input: {
  phone: string;
  name: string;
  code: string;
  sourceShop: string;
  shopsLink: string;
  aboutLink: string;
}) {
  const text = [
    `Namaste ${input.name}!`,
    `${input.sourceShop} se aapka Nukkad Network code: ${input.code}`,
    "",
    "Option 1 — 10% discount yahan claim karo:",
    input.shopsLink,
    "",
    "Option 2 — Nukkad Network samjho, network list + video:",
    input.aboutLink,
  ].join("\n");

  await sendTemplate("T1", input.phone, {
    name: input.name,
    code: input.code,
    shops_link: input.shopsLink,
    about_link: input.aboutLink,
  });
  await sendSession(input.phone, text);
}

export async function sendRedemptionMessage(input: {
  phone: string;
  gross: number;
  discount: number;
  netPayable: number;
  nextCode: string;
  shopsLink: string;
  aboutLink: string;
  complaintLink: string;
}) {
  const text = [
    `Aapka total bill ₹${input.gross} tha. 10% discount ₹${input.discount} — ab pay ₹${input.netPayable}.`,
    `Aapka naya code: ${input.nextCode} (doosri shops par).`,
    "",
    "1) Amount sahi thi? Galat ho to complain karo:",
    input.complaintLink,
    "",
    "2) Referral shops (location, Instagram):",
    input.shopsLink,
    "",
    "3) Nukkad Network ke baare mein:",
    input.aboutLink,
  ].join("\n");

  await sendTemplate("T2", input.phone, {
    gross: String(input.gross),
    discount: String(input.discount),
    net_payable: String(input.netPayable),
    next_code: input.nextCode,
    shops_link: input.shopsLink,
    about_link: input.aboutLink,
    complaint_link: input.complaintLink,
  });
  await sendSession(input.phone, text);
}

export function buildShopLinks(origin: string, code: string, shops: ShopLink[]) {
  const list = shops.map((shop) => `• ${shop.name}: ${shop.url}`).join("\n");
  return `${origin}/shops?c=${code}\n${list}`;
}

export function linksForCode(origin: string, code: string) {
  return {
    shops: `${origin}/shops?c=${code}`,
    about: `${origin}/about`,
  };
}

export function complaintLink(origin: string, redemptionId: string) {
  return `${origin}/complaint/${redemptionId}`;
}

export function defaultOrigin(request?: Request) {
  return appOrigin(request);
}
