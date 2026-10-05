// Deletes another user's account, for admins only (see supabase/schemas/40_admins.sql).
//
//   POST /functions/v1/delete-user   Authorization: Bearer <the caller's access token>
//   { "user_id": "<uuid of the user to delete>" }
//   → 200 { "deleted": "<uuid>" }, or { "error": "…" } with 400 / 401 / 403 / 404 / 500
//
// It does what tools/clear-users.sh does for one user: removes their profile photos from the
// `avatars` bucket (Storage files don't cascade), then deletes them from Supabase Auth, which
// takes their `profiles` and `app_state` rows along (`on delete cascade`).
//
// The secret key never leaves this function. Hosted functions get SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY on their own; set SB_SECRET_KEY (`npx supabase secrets set`) to use
// an `sb_secret_…` key instead.
//
// `verify_jwt = false` for this function in config.toml: the token is checked here, against the
// Auth server, which also rejects a caller who has been signed out or deleted.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Browsers (v05) send a preflight first.
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "The function has no secret key" }, 500);
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Who is calling?
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Not signed in" }, 401);
  const { data: caller, error: callerError } = await supabase.auth.getUser(token);
  if (callerError || !caller.user) return json({ error: "Not signed in" }, 401);

  // Are they an admin?
  const { data: admin, error: adminError } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", caller.user.id)
    .maybeSingle();
  if (adminError) return json({ error: adminError.message }, 500);
  if (!admin) return json({ error: "Only admins can delete users" }, 403);

  // Whom to delete? Swift sends UUIDs in uppercase; Storage folders are lowercase.
  const body = await req.json().catch(() => null);
  const target = typeof body?.user_id === "string" ? body.user_id.toLowerCase() : "";
  if (!uuidPattern.test(target)) return json({ error: "user_id must be a UUID" }, 400);
  if (target === caller.user.id) return json({ error: "Admins can't delete themselves" }, 400);

  // Check first, so a wrong id is a 404 and not a half-done delete.
  const { error: targetError } = await supabase.auth.admin.getUserById(target);
  if (targetError) {
    return json({ error: "No such user" }, targetError.status === 404 ? 404 : 500);
  }

  // Photos first: once the user is gone, nothing points at their folder any more.
  const avatars = supabase.storage.from("avatars");
  const { data: files, error: listError } = await avatars.list(target, { limit: 1000 });
  if (listError) return json({ error: `Listing photos failed: ${listError.message}` }, 500);
  if (files.length > 0) {
    const { error: removeError } = await avatars.remove(files.map((f) => `${target}/${f.name}`));
    if (removeError) return json({ error: `Deleting photos failed: ${removeError.message}` }, 500);
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(target);
  if (deleteError) return json({ error: deleteError.message }, deleteError.status ?? 500);

  console.log(`admin ${caller.user.id} deleted user ${target}`);
  return json({ deleted: target });
});
