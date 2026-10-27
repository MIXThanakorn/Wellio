import { supabase } from "./supabase";
export async function selectAccount(slug: "mix" | "name") {
  if (!supabase) throw new Error("ยังไม่เชื่อมต่อระบบ");
  const { data, error } = await supabase.functions.invoke("device-access", {
    body: { action: "select-profile", slug },
  });
  if (error || !data?.session) {
    let message = "เปิดบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง";
    if (error && "context" in error && error.context instanceof Response) {
      try {
        const payload = await error.context.json();
        if (typeof payload.error === "string") message = payload.error;
      } catch {
        console.warn("Profile selection returned a non-JSON error");
      }
    }
    throw new Error(message);
  }
  const { error: sessionError } = await supabase.auth.setSession(data.session);
  if (sessionError)
    throw new Error("ยังจำ session บนอุปกรณ์ไม่ได้ กรุณาลองอีกครั้ง");
}
