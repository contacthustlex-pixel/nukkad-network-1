/** Secret admin URL segment — not linked from public UI. */
export const ADMIN_PANEL_PATH = process.env.ADMIN_PANEL_PATH || "nukkad-ops";

export function adminPanelHref() {
  return `/${ADMIN_PANEL_PATH}`;
}
