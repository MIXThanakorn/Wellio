import { createClient } from "@supabase/supabase-js";
const [slug, email] = process.argv.slice(2);
if (!["mix", "name"].includes(slug) || !email || !/^\S+@\S+\.\S+$/.test(email))
  throw new Error("Usage: npm run invite -- mix person@example.com (or name)");
const url = process.env.SUPABASE_URL,
  secret = process.env.SUPABASE_SERVICE_ROLE_KEY,
  redirectTo = process.env.FITLOG_APP_URL;
if (!url || !secret || !redirectTo)
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and FITLOG_APP_URL in the shell (server-side only)",
  );
const client = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: existing, error: lookupError } = await client
  .from("profiles")
  .select("user_id")
  .eq("slug", slug)
  .maybeSingle();
if (lookupError) throw lookupError;
if (existing)
  throw new Error(
    "This profile slot is already enrolled. Use the existing email to request a new magic link.",
  );
// The standard admin invitation provisions the Auth identity. An invited identity
// remains unable to access any journal until its profile mapping has been bound.
const { data: created, error: inviteError } =
  await client.auth.admin.inviteUserByEmail(email, { redirectTo });
if (inviteError) throw inviteError;
const { error: bindError } = await client.from("profiles").insert({
  user_id: created.user.id,
  slug,
  display_name: slug === "mix" ? "มิก" : "เนม",
});
if (bindError) {
  throw new Error(
    `Invite sent, but profile binding failed. The identity has NO journal access. Resolve the slot mapping in Supabase: ${bindError.message}`,
  );
}
console.log(
  `Invitation sent for ${slug}. No credentials or tokens were written to disk.`,
);
