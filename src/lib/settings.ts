import type { SupabaseClient } from "@supabase/supabase-js";

export async function getFollowupAuto(supabase: SupabaseClient): Promise<boolean> {
  const envDefault = process.env.FOLLOWUP_AUTO === "true";
  const { data, error } = await supabase.rpc("get_setting", { setting_key: "followup_auto" });
  if (error) return envDefault;
  if (data === true || data === false) return data;
  if (typeof data === "string") return data === "true";
  return envDefault;
}
