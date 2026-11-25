import { db } from "./supabase-client.js";

// Lapisan data notifikasi push. Langganan disimpan lewat RPC; pengaturan kategori lewat tabel milik sendiri.

export async function fetchPrefs() {
  const { data, error } = await db().from("push_prefs").select("category, enabled");
  if (error) throw error;
  return data ?? [];
}

export async function upsertPref(userId, category, enabled) {
  const { error } = await db().from("push_prefs").upsert({ user_id: userId, category, enabled }, { onConflict: "user_id,category" });
  if (error) throw error;
}

export async function rpcSaveSubscription({ endpoint, p256dh, auth, userAgent }) {
  const { error } = await db().rpc("save_push_subscription", { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_ua: userAgent });
  if (error) throw error;
}

export async function rpcRemoveSubscription(endpoint) {
  const { error } = await db().rpc("remove_push_subscription", { p_endpoint: endpoint });
  if (error) throw error;
}
