// Edge Function "send-push": mengirim antrean push_outbox ke perangkat lewat Web Push (VAPID).
// Dipanggil tiap menit oleh pg_cron (public.push_kick) dengan header x-push-secret.
// Deploy dengan "Verify JWT" dimatikan; pemanggil diperiksa lewat rahasia bersama.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function sameSecret(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };
type Msg = { id: number; title: string; body: string; url: string; category: string; subs: Sub[] };

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ code: "METODE_SALAH" }, 405);
  if (!sameSecret(req.headers.get("x-push-secret") ?? "", Deno.env.get("PUSH_SECRET") ?? "")) {
    return json({ code: "TIDAK_DIIZINKAN" }, 401);
  }

  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!pub || !priv || !subject) return json({ code: "VAPID_BELUM_DIISI" }, 500);
  webpush.setVapidDetails(subject, pub, priv);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await db.rpc("push_claim", { p_limit: 50 });
  if (error) return json({ code: "ANTREAN_GAGAL" }, 500);

  const stat = { pesan: 0, terkirim: 0, dibuang: 0, gagal: 0 };
  for (const msg of (data ?? []) as Msg[]) {
    stat.pesan++;
    const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, category: msg.category, id: msg.id });
    let okCount = 0;
    let lastError = "";

    for (const sub of msg.subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: "normal" },
        );
        okCount++;
        stat.terkirim++;
        await db.rpc("push_mark_ok", { p_sub: sub.id });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode ?? 0;
        // 404 dan 410: perangkat sudah mencabut langganan, buang dari daftar.
        if (status === 404 || status === 410) {
          stat.dibuang++;
          await db.rpc("push_drop_subscription", { p_sub: sub.id });
        } else {
          stat.gagal++;
          lastError = `HTTP ${status || "?"}`;
        }
      }
    }

    // Selesai bila ada yang terkirim, atau tidak ada perangkat tersisa. Selain itu dicoba lagi (maksimal 5 kali).
    const transientFail = okCount === 0 && lastError !== "";
    await db.rpc("push_finish", { p_id: msg.id, p_error: transientFail ? lastError : null });
  }
  return json(stat);
});
