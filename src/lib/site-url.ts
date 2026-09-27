export function appOrigin(request?: Request) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (request) return new URL(request.url).origin;
  return "http://localhost:3000";
}

export function whatsappChatLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return `https://wa.me/91${digits}?text=${encodeURIComponent(text)}`;
}

export const FOLLOWUP_PROMPT =
  "Nukkad Network: Kya aapne referral shop visit kiya? Reply karo — visited / busy / expensive / forgot / behaviour";
