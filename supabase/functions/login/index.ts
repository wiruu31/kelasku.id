// Edge Function "login": mengubah nama lengkap, username, email, atau nomor WA menjadi login Supabase.
// Pencarian email dilakukan di sini (service role) supaya email tidak bisa diintip dari browser.
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

// Escape karakter wildcard agar ilike dipakai sebagai perbandingan persis tanpa huruf besar-kecil.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ code: "METODE_SALAH" }, 405);

  let identifier = "";
  let password = "";
  try {
    const body = await req.json();
    identifier = String(body.identifier ?? "").trim();
    password = String(body.password ?? "");
  } catch {
    return json({ code: "KREDENSIAL_SALAH" }, 400);
  }
  if (!identifier || !password || identifier.length > 120 || password.length > 200) {
    return json({ code: "KREDENSIAL_SALAH" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);

  let email: string | null = null;

  const emailOfUser = async (userId: string) => {
    const { data } = await admin.from("profile_contacts").select("email").eq("user_id", userId).maybeSingle();
    return data?.email ?? null;
  };

  if (identifier.includes("@")) {
    email = identifier.toLowerCase();
  } else {
    const { data: byUsername } = await admin
      .from("profiles").select("id").eq("username", identifier.toLowerCase()).maybeSingle();
    if (byUsername) email = await emailOfUser(byUsername.id);

    if (!email && /^\+?[\d\s-]{8,20}$/.test(identifier)) {
      const { data: byWa } = await admin
        .from("profile_contacts").select("email").eq("wa", normalizeWa(identifier)).maybeSingle();
      email = byWa?.email ?? null;
    }

    if (!email) {
      const { data: byName } = await admin
        .from("profiles").select("id").ilike("full_name", escapeLike(identifier.replace(/\s+/g, " "))).limit(2);
      if ((byName?.length ?? 0) > 1) return json({ code: "AMBIGU" }, 409);
      if (byName?.length === 1) email = await emailOfUser(byName[0].id);
    }
  }

  // Identitas tak dikenal dan sandi salah sengaja memberi jawaban yang sama.
  if (!email) return json({ code: "KREDENSIAL_SALAH" }, 401);

  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) return json({ code: "KREDENSIAL_SALAH" }, 401);

  return json({
    session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
  });
});
