import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// A service key must never be accepted by a browser build.
function safePublicKey(value: string): boolean {
  if (value?.startsWith("sb_secret_")) return false;
  try {
    if (value?.startsWith("ey"))
      return JSON.parse(atob(value.split(".")[1])).role === "anon";
  } catch {
    return false;
  }
  return Boolean(value?.startsWith("sb_publishable_"));
}
export const supabase =
  url && safePublicKey(key)
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      })
    : null;
