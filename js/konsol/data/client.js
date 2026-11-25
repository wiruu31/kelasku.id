import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from "../../core/config.js";
import { AppError } from "../../core/errors.js";

let client = null;

// Klien Konsol punya kunci sesi sendiri supaya masuk di sini tidak tercampur dengan aplikasi kelas.
export function db() {
  if (!isConfigured()) throw new AppError("not_configured", "Database belum tersambung. Isi config.js dulu.");
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "kelasku-konsol-auth" },
  });
  return client;
}
