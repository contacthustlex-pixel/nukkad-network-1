/** EasySocial / generic WhatsApp BSP — logs when API env is unset. */
export type WhatsAppTemplate = "T1" | "T2" | "T4" | "T5";

async function postEasySocial(payload: Record<string, unknown>) {
  const base = process.env.EASYSOCIAL_API_URL?.replace(/\/$/, "");
  const key = process.env.EASYSOCIAL_API_KEY;
  if (!base || !key) {
    console.log("[whatsapp stub]", JSON.stringify(payload));
    return payload;
  }
  const response = await fetch(`${base}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("[whatsapp error]", response.status, text);
    throw new Error("WhatsApp send failed");
  }
  return response.json().catch(() => payload);
}

function waPhone(to: string) {
  const digits = to.replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `91${digits}` : to;
}

export async function sendTemplate(
  template: WhatsAppTemplate,
  to: string,
  params: Record<string, string>,
) {
  return postEasySocial({ type: "template", template, to: waPhone(to), params });
}

export async function sendSession(to: string, text: string) {
  return postEasySocial({ type: "session", to: waPhone(to), text });
}
