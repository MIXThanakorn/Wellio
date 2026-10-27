import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const url = Deno.env.get("SUPABASE_URL")!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "Content-Type": "application/json",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: cors });
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
async function hash(token: string) {
  return hex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
  );
}
function equal(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const text = await req.text();
  if (text.length > 4096) return json({ error: "Request too large" }, 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
    if (!body || Array.isArray(body) || typeof body !== "object")
      return json({ error: "Invalid request" }, 400);
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const admin = createClient(
    url,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    options,
  );
  const { data: secret, error: secretError } = await admin.rpc(
    "fitlog_device_admin_secret",
  );
  if (secretError || !secret)
    return json({ error: "Device access is not configured" }, 503);
  const bearer =
    req.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
  const isAdmin = bearer.length >= 32 && equal(bearer, secret);
  async function makeLink(owner: string, minutes: number) {
    const token = hex(crypto.getRandomValues(new Uint8Array(32)));
    const { data: expiresAt, error } = await admin.rpc(
      "create_device_enrollment",
      { p_owner: owner, p_hash: await hash(token), p_minutes: minutes },
    );
    if (error) throw new Error("Cannot create device link");
    return { token, expires_at: expiresAt };
  }
  async function sessionFor(owner: string) {
    const { data: user, error: userError } =
      await admin.auth.admin.getUserById(owner);
    if (userError || !user.user?.email) throw new Error("Account unavailable");
    const { data: link, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: user.user.email,
      });
    if (linkError || link.user?.id !== owner)
      throw new Error("Session could not be created");
    const verifier = createClient(
      url,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      options,
    );
    const { data: verified, error: verifyError } =
      await verifier.auth.verifyOtp({
        type: "email",
        token_hash: link.properties.hashed_token,
      });
    if (verifyError || !verified.session || verified.user?.id !== owner)
      throw new Error("Session could not be verified");
    return {
      session: {
        access_token: verified.session.access_token,
        refresh_token: verified.session.refresh_token,
      },
    };
  }
  async function requestFingerprint(namespace: string) {
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    return hex(
      new Uint8Array(
        await crypto.subtle.sign(
          "HMAC",
          key,
          new TextEncoder().encode(`${namespace}:${ip}`),
        ),
      ),
    );
  }
  try {
    if (body.action === "select-profile") {
      // Intentionally available without a prior session, per the owner's approved access model.
      if (body.slug !== "mix" && body.slug !== "name")
        return json({ error: "กรุณาเลือกมิกหรือเนม" }, 400);
      const { data: allowed, error: rateError } = await admin.rpc(
        "allow_profile_selection",
        { p_fingerprint: await requestFingerprint("profile-selection") },
      );
      if (rateError)
        return json({ error: "ยังเชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง" }, 503);
      if (!allowed)
        return json(
          { error: "เลือกบัญชีบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" },
          429,
        );
      const { data: profile, error } = await admin
        .from("profiles")
        .select("user_id")
        .eq("slug", body.slug)
        .single();
      if (error || !profile)
        return json({ error: "บัญชีนี้ยังไม่พร้อมใช้งาน" }, 503);
      return json(await sessionFor(profile.user_id));
    }
    if (body.action === "enroll") {
      if (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token))
        return json({ error: "ลิงก์เชื่อมอุปกรณ์ไม่ถูกต้อง" }, 401);
      const ip =
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown";
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const fingerprint = hex(
        new Uint8Array(
          await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip)),
        ),
      );
      const { data: owner, error } = await admin.rpc(
        "consume_device_enrollment",
        { p_hash: await hash(body.token), p_fingerprint: fingerprint },
      );
      if (error)
        return json({ error: "เชื่อมอุปกรณ์ไม่สำเร็จ กรุณาลองอีกครั้ง" }, 503);
      if (!owner)
        return json(
          {
            error:
              "ลิงก์หมดอายุ ถูกใช้แล้ว หรือมีการลองบ่อยเกินไป กรุณาขอลิงก์ใหม่",
          },
          401,
        );
      return json(await sessionFor(owner));
    }
    if (body.action === "bootstrap") {
      if (!isAdmin) return json({ error: "Unauthorized" }, 401);
      const accounts = [];
      for (const slug of ["mix", "name"]) {
        let { data: profile, error: profileError } = await admin
          .from("profiles")
          .select("user_id,slug,display_name")
          .eq("slug", slug)
          .maybeSingle();
        if (profileError) throw new Error("Profile lookup failed");
        if (!profile) {
          // Reserved .invalid aliases are internal Auth identifiers, never contact addresses.
          const { data: created, error: createError } =
            await admin.auth.admin.createUser({
              email: `${slug}.${crypto.randomUUID()}@accounts.fitlog.invalid`,
              password: hex(crypto.getRandomValues(new Uint8Array(32))),
              email_confirm: true,
              app_metadata: {
                fitlog_account: slug,
                contact_email_linked: false,
              },
            });
          if (createError)
            throw new Error(
              `Account provisioning failed: ${createError.message}`,
            );
          const { data: bound, error: bindError } = await admin
            .from("profiles")
            .insert({
              user_id: created.user.id,
              slug,
              display_name: slug === "mix" ? "มิก" : "เนม",
            })
            .select("user_id,slug,display_name")
            .single();
          if (bindError) {
            await admin.auth.admin.deleteUser(created.user.id);
            throw new Error(`Account binding failed: ${bindError.message}`);
          }
          profile = bound;
        }
        accounts.push({
          ...profile,
          ...(await makeLink(profile!.user_id, 1440)),
        });
      }
      return json({ accounts });
    }
    if (body.action === "create-link" || body.action === "revoke-links") {
      let owner: string | undefined;
      if (isAdmin && (body.slug === "mix" || body.slug === "name")) {
        const { data } = await admin
          .from("profiles")
          .select("user_id")
          .eq("slug", body.slug)
          .single();
        owner = data?.user_id;
      } else if (bearer) {
        const { data, error } = await admin.auth.getUser(bearer);
        if (!error) {
          const { data: profile } = await admin
            .from("profiles")
            .select("user_id")
            .eq("user_id", data.user.id)
            .maybeSingle();
          owner = profile?.user_id;
        }
      }
      if (!owner) return json({ error: "Unauthorized" }, 401);
      if (body.action === "revoke-links") {
        const { error } = await admin.rpc("revoke_device_enrollments", {
          p_owner: owner,
        });
        if (error) throw new Error("Cannot revoke links");
        return json({ revoked: true });
      }
      return json(await makeLink(owner, 15));
    }
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(
      "Device access failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return json(
      {
        error:
          isAdmin && error instanceof Error
            ? error.message
            : "ดำเนินการไม่สำเร็จ กรุณาลองใหม่หรือติดต่อผู้ดูแล",
      },
      503,
    );
  }
});
