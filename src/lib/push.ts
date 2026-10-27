import { supabase } from "./supabase";
export async function currentPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return registration?.pushManager.getSubscription() ?? null;
}
export async function disconnectCurrentPush(owner: string) {
  const sub = await currentPushSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  const removed = await sub.unsubscribe();
  if (!removed)
    throw new Error("ยังยกเลิก push ของอุปกรณ์นี้ไม่ได้ กรุณาลองอีกครั้ง");
  const { error } = await supabase!
    .from("push_subscriptions")
    .delete()
    .eq("owner_user_id", owner)
    .eq("endpoint", endpoint);
  if (error)
    console.warn(
      "The local push subscription is disabled. Its stale server record will be disabled after push-service expiry.",
    );
}
export async function disableOtherPushDevices(owner: string) {
  const current = await currentPushSubscription();
  let request = supabase!
    .from("push_subscriptions")
    .update({ enabled: false })
    .eq("owner_user_id", owner);
  if (current) request = request.neq("endpoint", current.endpoint);
  const { error } = await request;
  if (error) throw new Error("ยังปิด push อุปกรณ์อื่นไม่ได้ กรุณาลองอีกครั้ง");
}
