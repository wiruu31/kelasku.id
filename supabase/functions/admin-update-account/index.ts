// Edge Function "admin-update-account": Main Admin atau Admin Kelas mengubah data akun murid.
// Siapa boleh mengubah siapa diputuskan di database (authorize_account_edit); fungsi ini
// memverifikasi pemanggil, menulis ke Auth dan tabel, lalu mencatat log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function normalizeWa(input: string) {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  else if (d.startsWith("8")) d = `62${d}`;
  return d;
}

const clean = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ code: "METODE_SALAH" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ code: "TIDAK_DIIZINKAN" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ code: "TIDAK_DIIZINKAN" }, 400);
  }
  const target = String(body.userId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(target)) return json({ code: "TIDAK_DIIZINKAN" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: who, error: whoErr } = await admin.auth.getUser(token);
  if (whoErr || !who.user) return json({ code: "TIDAK_DIIZINKAN" }, 401);
  const caller = who.user.id;

  const { error: denied } = await admin.rpc("authorize_account_edit", { p_caller: caller, p_target: target });
  if (denied) return json({ code: "TIDAK_DIIZINKAN" }, 403);

  const patch: { fullName?: string; username?: string; email?: string; wa?: string; jenisKelamin?: string | null; password?: string } = {};
  const changed: string[] = [];
  if (body.fullName !== undefined) {
    patch.fullName = clean(body.fullName);
    if (patch.fullName.length < 3) return json({ code: "NAMA_TIDAK_VALID" }, 400);
    changed.push("nama");
  }
  if (body.username !== undefined) {
    patch.username = clean(body.username).toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(patch.username)) return json({ code: "USERNAME_TIDAK_VALID" }, 400);
    changed.push("username");
  }
  if (body.email !== undefined) {
    patch.email = clean(body.email).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(patch.email)) return json({ code: "EMAIL_TIDAK_VALID" }, 400);
    changed.push("email");
  }
  if (body.wa !== undefined) {
    patch.wa = normalizeWa(clean(body.wa));
    if (!/^62\d{8,13}$/.test(patch.wa)) return json({ code: "WA_TIDAK_VALID" }, 400);
    changed.push("wa");
  }
  if (body.jenisKelamin !== undefined) {
    const v = body.jenisKelamin === null || body.jenisKelamin === "" ? null : String(body.jenisKelamin);
    if (v !== null && v !== "L" && v !== "P") return json({ code: "TIDAK_DIIZINKAN" }, 400);
    patch.jenisKelamin = v;
    changed.push("jenis kelamin");
  }
  if (body.password !== undefined) {
    patch.password = String(body.password);
    if (patch.password.length < 8 || patch.password.length > 200) return json({ code: "SANDI_TIDAK_VALID" }, 400);
    changed.push("kata sandi");
  }
  if (!changed.length) return json({ code: "TIDAK_ADA_PERUBAHAN" }, 400);

  // Kesalahan unik (username, email, WA, nama di kelas) diterjemahkan ke kode yang dipahami klien.
  const uniqueCode = (message: string, fallback: string) => {
    const m = message.toLowerCase();
    if (m.includes("username")) return "USERNAME_SUDAH_DIPAKAI";
    if (m.includes("email")) return "EMAIL_SUDAH_DIPAKAI";
    if (m.includes("wa")) return "WA_SUDAH_DIPAKAI";
    if (m.includes("display_name") || m.includes("class_members")) return "NAMA_SUDAH_ADA_DI_KELAS";
    return fallback;
  };

  if (patch.fullName !== undefined || patch.username !== undefined) {
    const row: Record<string, string> = {};
    if (patch.fullName !== undefined) row.full_name = patch.fullName;
    if (patch.username !== undefined) row.username = patch.username;
    const { error } = await admin.from("profiles").update(row).eq("id", target);
    if (error) return json({ code: error.code === "23505" ? uniqueCode(error.message, "USERNAME_SUDAH_DIPAKAI") : "GAGAL_UBAH" }, error.code === "23505" ? 409 : 500);
  }
  if (patch.fullName !== undefined) {
    const { error } = await admin.from("class_members").update({ display_name: patch.fullName }).eq("user_id", target);
    if (error) return json({ code: error.code === "23505" ? "NAMA_SUDAH_ADA_DI_KELAS" : "GAGAL_UBAH" }, error.code === "23505" ? 409 : 500);
  }
  if (patch.email !== undefined || patch.wa !== undefined) {
    const row: Record<string, string> = {};
    if (patch.email !== undefined) row.email = patch.email;
    if (patch.wa !== undefined) row.wa = patch.wa;
    const { error } = await admin.from("profile_contacts").update(row).eq("user_id", target);
    if (error) return json({ code: error.code === "23505" ? uniqueCode(error.message, "EMAIL_SUDAH_DIPAKAI") : "GAGAL_UBAH" }, error.code === "23505" ? 409 : 500);
  }
  if (patch.jenisKelamin !== undefined) {
    const { error } = await admin.from("class_members").update({ jenis_kelamin: patch.jenisKelamin }).eq("user_id", target);
    if (error) return json({ code: "GAGAL_UBAH" }, 500);
  }
  if (patch.email !== undefined || patch.password !== undefined) {
    const auth: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (patch.email !== undefined) {
      auth.email = patch.email;
      auth.email_confirm = true;
    }
    if (patch.password !== undefined) auth.password = patch.password;
    const { error } = await admin.auth.admin.updateUserById(target, auth);
    if (error) return json({ code: "GAGAL_UBAH" }, 500);
  }

  await admin.rpc("record_account_edit", { p_caller: caller, p_target: target, p_action: "akun.ubah", p_fields: changed });
  return json({ ok: true, changed });
});
