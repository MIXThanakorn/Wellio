import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import webpush from "npm:web-push@3.6.7";
import { reminderState } from "../_shared/reminders.ts";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function equalToken(a: string, b: string) {
  const x = new TextEncoder().encode(a),
    y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++)
    diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
function allowedEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint);
    return (
      u.protocol === "https:" &&
      (!u.port || u.port === "443") &&
      !u.username &&
      !u.password &&
      /^(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com)$/i.test(
        u.hostname,
      )
    );
  } catch {
    return false;
  }
}
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
  if (token.length < 32) return json({ error: "Unauthorized" }, 401);
  const { data: config, error: configError } =
    await db.rpc("fitlog_push_config");
  if (
    configError ||
    !config?.fitlog_cron_secret ||
    !config?.fitlog_vapid_private
  )
    return json({ error: "Push not configured" }, 503);
  if (!equalToken(token, config.fitlog_cron_secret))
    return json({ error: "Unauthorized" }, 401);
  webpush.setVapidDetails(
    "https://alpbutepoqnbvbbnesit.supabase.co",
    config.fitlog_vapid_public,
    config.fitlog_vapid_private,
  );
  const { data: preferences, error } = await db
    .from("reminder_preferences")
    .select("*")
    .eq("enabled", true);
  if (error) return json({ error: "Preference query failed" }, 500);
  let sent = 0,
    failed = 0,
    skipped = 0;
  for (const p of preferences || []) {
    const { data: meal, error: mealError } = await db
      .from("meal_entries")
      .select("eaten_at")
      .eq("owner_user_id", p.owner_user_id)
      .order("eaten_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (mealError) {
      failed++;
      continue;
    }
    if (reminderState(p, meal?.eaten_at) !== "due") {
      skipped++;
      continue;
    }
    const { data: subscriptions, error: subError } = await db
      .from("push_subscriptions")
      .select("*")
      .eq("owner_user_id", p.owner_user_id)
      .eq("enabled", true);
    if (subError) {
      failed++;
      continue;
    }
    for (const sub of subscriptions || []) {
      if (!allowedEndpoint(sub.endpoint)) {
        failed++;
        continue;
      }
      // The owner + interval + subscription are bound server-side. A new meal/edit/delete
      // changes the effective interval; overlapping jobs can claim it only once.
      const { data: claim, error: claimError } = await db.rpc(
        "claim_reminder",
        {
          p_owner: p.owner_user_id,
          p_subscription: sub.id,
          p_last_meal: meal!.eaten_at,
        },
      );
      if (claimError) {
        failed++;
        continue;
      }
      if (!claim) {
        skipped++;
        continue;
      }
      // Recheck consent and latest meal after claiming, immediately before dispatch.
      const [{ data: freshPref }, { data: freshMeal }, { data: freshSub }] =
        await Promise.all([
          db
            .from("reminder_preferences")
            .select("*")
            .eq("owner_user_id", p.owner_user_id)
            .maybeSingle(),
          db
            .from("meal_entries")
            .select("eaten_at")
            .eq("owner_user_id", p.owner_user_id)
            .order("eaten_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          db
            .from("push_subscriptions")
            .select("enabled")
            .eq("id", sub.id)
            .eq("owner_user_id", p.owner_user_id)
            .maybeSingle(),
        ]);
      if (
        !freshPref ||
        !freshSub?.enabled ||
        freshMeal?.eaten_at !== meal!.eaten_at ||
        reminderState(freshPref, freshMeal?.eaten_at) !== "due"
      ) {
        await db.from("reminder_deliveries").delete().eq("id", claim);
        skipped++;
        continue;
      }
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_secret },
          },
          JSON.stringify({
            title: "FitLog · เพื่อนเตือนเบาๆ",
            body: "ไม่ได้บันทึกมื้ออาหารมาสักพักแล้ว อยากอัปเดตบันทึกไหม?",
          }),
          { TTL: 900, urgency: "normal", timeout: 10000 },
        );
        const { error: markError } = await db
          .from("reminder_deliveries")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", claim);
        if (markError) {
          failed++;
        } else sent++;
      } catch (error) {
        const status =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number(error.statusCode)
            : 0;
        if (status === 404 || status === 410)
          await db
            .from("push_subscriptions")
            .update({ enabled: false })
            .eq("id", sub.id);
        await db
          .from("reminder_deliveries")
          .update({ status: "failed" })
          .eq("id", claim);
        failed++;
      }
    }
  }
  return json({ sent, failed, skipped }, failed ? 207 : 200);
});
