// Isi dua nilai ini dari Supabase (Project Settings > API). Panduan ada di docs/SUPABASE_SETUP.md.
// Kunci anon memang publik; keamanan data dijaga oleh RLS, bukan oleh kerahasiaan kunci ini.
export const SUPABASE_URL = "https://kckbkpztrrdujwzyemfj.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtja2JrcHp0cnJkdWp3enllbWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1MDg3NzksImV4cCI6MjExMTA4NDc3OX0.yjKGBTYbRuHABWP9ATcmrkMJ2z1ajTNw3fMA5w4tYTo";

// Kunci publik VAPID untuk notifikasi push (pasangannya, kunci privat, hanya ada di secret Edge Function).
// Dibuat dengan `npx web-push generate-vapid-keys`. Kosong = fitur notifikasi disembunyikan.
export const VAPID_PUBLIC_KEY = "BNqFssh3NDT6uG32AsgcJmv9QmLY0_ul6mrcbIFSllaD2NAYQantjWnwsTdEyXWoiKJKylvHlVUqhOjReoxcUNo";

export function isConfigured() {
  return SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20;
}
