// Edge Function "admin-reset-password": admin kelas atau pemilik platform membuat sandi sementara.
// Siapa boleh mereset siapa diputuskan di database (authorize_password_reset); fungsi ini hanya
// memverifikasi pemanggil, menetapkan sandi, dan mencatat log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Tanpa huruf yang mirip (O/0, I/1/l) agar mudah dibacakan.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function tempPassword(length = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ code: "METODE_SALAH" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ code: "TIDAK_DIIZINKAN" }, 401);

  let target = "";
  try {
    target = String((await req.json()).userId ?? "");
  } catch {
    return json({ code: "TIDAK_DIIZINKAN" }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(target)) return json({ code: "TIDAK_DIIZINKAN" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || !who.user) return json({ code: "TIDAK_DIIZINKAN" }, 401);
  const caller = who.user.id;

  const { error: denied } = await admin.rpc("authorize_password_reset", { p_caller: caller, p_target: target });
  if (denied) return json({ code: "TIDAK_DIIZINKAN" }, 403);

  const password = tempPassword();
  const { error: updateErr } = await admin.auth.admin.updateUserById(target, { password });
  if (updateErr) return json({ code: "GAGAL_RESET" }, 500);

  await admin.rpc("record_password_reset", { p_caller: caller, p_target: target });
  return json({ password });
});
