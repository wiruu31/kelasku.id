# TASKS - Kelasku.id v1.0.0

## Fase 1: Database (migrasi 004)
- [x] Tabel push_subscriptions, push_prefs, push_outbox, push_settings dengan RLS dan hak akses
- [x] Pemicu pengumuman, tugas, voting, siaran sistem, pendaftar baru
- [x] Pengingat piket dan tenggat dengan dedupe
- [x] Fungsi untuk Edge Function (claim, finish, drop, cleanup) dan jadwal pg_cron
- [x] schema.sql digabung ulang, migrasi aman diulang
- [x] 277 uji database lulus

## Fase 2: Pengiriman
- [x] Edge Function `send-push` (VAPID, rahasia bersama, buang langganan 404 atau 410, coba ulang)
- [x] Service worker: penangan push dan klik notifikasi, versi cache `kelasku-v1.0.0`
- [x] 8 uji unit penangan push

## Fase 3: Aplikasi
- [x] push-repository, push-service (izin, langganan, sinkron, lepas saat keluar)
- [x] Bagian Notifikasi di Profil dengan skeleton, petunjuk diblokir dan iPhone
- [x] Kategori per kebutuhan akun (Pendaftar baru hanya untuk pemegang izin)

## Fase 4: Pengujian dan dokumentasi
- [x] E2E Kelas 55 skenario (14 baru untuk push), E2E Konsol 40 skenario
- [x] PRECACHE 109 berkas
- [x] Checklist `tests/15-push.md`
- [x] Panduan Supabase dari proyek baru, termasuk VAPID dan pg_cron
- [x] Tujuh berkas dokumentasi
- [ ] Uji manual di Supabase asli (checklist 10 sampai 15, terutama Storage dan push)

## Langkah Anda (manual)
- [ ] Buat proyek Supabase baru dan ikuti `docs/SUPABASE_SETUP.md` berurutan (ekstensi, skema, Main Admin, empat Edge Function)
- [ ] Buat kunci VAPID (`npx web-push generate-vapid-keys`), isi empat secret, isi `push_settings`
- [ ] Isi `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `VAPID_PUBLIC_KEY` di `js/core/config.js`
- [ ] Jalankan checklist `tests/10` sampai `tests/15` di perangkat asli
- [ ] Bungkus jadi APK (TWA) setelah semua lolos
- [ ] Simpan titik aman: `git add . && git commit -m "v1.0.0"`; pulihkan dengan `git reset --hard`
