import { db } from "./supabase-client.js";

// Lapisan data auth: hanya bicara dengan Supabase, tanpa aturan bisnis.

export async function registrationError(fields) {
  const { data, error } = await db().rpc("registration_error", {
    p_name: fields.fullName,
    p_username: fields.username,
    p_email: fields.email,
    p_wa: fields.wa,
    p_code: fields.joinCode,
  });
  if (error) throw error;
  return data;
}

export async function signUp({ email, password, meta }) {
  const { data, error } = await db().auth.signUp({ email, password, options: { data: meta } });
  if (error) throw error;
  return data;
}

// Edge Function mencari email dari identitas lalu masuk di sisi server.
// Hasilnya {code} saat gagal atau {session} saat berhasil.
export async function resolveLogin(identifier, password) {
  const { data, error } = await db().functions.invoke("login", { body: { identifier, password } });
  if (!error) return data;
  const body = await error.context?.json?.().catch(() => null);
  if (body?.code) return body;
  throw error;
}

export async function adoptSession({ access_token, refresh_token }) {
  const { error } = await db().auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await db().auth.signOut();
  if (error) throw error;
}

export async function currentSession() {
  const { data, error } = await db().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback) {
  const { data } = db().auth.onAuthStateChange((event, session) => callback(event, session));
  return () => data.subscription.unsubscribe();
}
