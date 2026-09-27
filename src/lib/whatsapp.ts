export type WhatsAppTemplate = "T1" | "T2" | "T4" | "T5";

/** TODO: send through the EasySocial WhatsApp BSP. Stubs log the payload only. */
export async function sendTemplate(
  template: WhatsAppTemplate,
  to: string,
  params: Record<string, string>,
) {
  console.log("[whatsapp template]", JSON.stringify({ template, to, params }));
  return { template, to, params };
}

/** TODO: send an EasySocial session message inside the 24-hour window. */
export async function sendSession(to: string, text: string) {
  console.log("[whatsapp session]", JSON.stringify({ to, text }));
  return { to, text };
}
