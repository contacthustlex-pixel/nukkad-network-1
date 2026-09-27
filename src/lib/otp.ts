import { createServiceClient } from "@/lib/supabase-server";

/** Mock OTP until MSG91 is wired. TODO: send the code through MSG91 using MSG91_AUTH_KEY. */
export const MOCK_OTP = "1234";

export async function sendOtp(phone: string) {
  const supabase = createServiceClient();
  const { error } = await supabase.rpc("save_otp", { phone, code: MOCK_OTP });
  if (error) {
    throw new Error(error.message);
  }
  return { ok: true as const };
}

export async function verifyOtp(phone: string, code: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("consume_otp", { phone, code });
  if (error) {
    throw new Error(error.message);
  }
  return data === true;
}
