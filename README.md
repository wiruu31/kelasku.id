# Kelasku.id dan Admin Kelasku.id

**Versi:** v1.0.0

Dua aplikasi web (PWA) dalam satu sistem, tanpa framework dan tanpa build.
- **Kelasku.id** (`kelasku.html`): murid dan pengurus kelas. Mading, pengumuman, jadwal, tugas, piket, voting, kas, organigram, foto profil, anggota, role, log kelas, Kabar Sistem, Panel Admin Kelas, dan notifikasi push.
- **Admin Kelasku.id** (`konsol.html`): hanya Main Admin. Dashboard, Ringkasan Sekolah > Kelas > Murid, Atur Role (angkat atau cabut Admin Kelas), Tambah Kelas, Sekolah, Siaran Sistem, Log, Pengaturan.

Peran: Main Admin, Admin Kelas, role kustom, Murid. Penjelasan lengkap di `PRD.md`.

## Struktur Folder
```
kelasku.html, konsol.html        titik masuk
kelasku.webmanifest, konsol.webmanifest
kelasku-sw.js                    satu service worker untuk kedua aplikasi
css/                             gaya aplikasi Kelas (tema Senja Kelas)
css/konsol/                      gaya Konsol (tema Bara)
js/core/                         router, state, galat, format, skeleton
js/data/  js/services/  js/presentation/     aplikasi Kelas (Data, Service, UI)
js/konsol/{data,services,components,views}/  Konsol
icons/                           ikon PWA kedua aplikasi
supabase/migrations/             001 dasar, 002 rombak v0.3.0, 003 fitur kelas v0.4.0, 004 push v1.0.0
supabase/schema.sql              pasang baru (hasil gabungan migrasi)
supabase/functions/              login, admin-reset-password, admin-update-account, send-push
tests/                           checklist 01 sampai 15, db/, e2e/, unit/
docs/SUPABASE_SETUP.md           panduan pasang dan bootstrap Main Admin
BRAINSTORM.md PRD.md UI_UX.md ERD.md ARD.md TASKS.md
```

## Cara Menjalankan
1. Ikuti `docs/SUPABASE_SETUP.md` berurutan: ekstensi, skema, Main Admin, empat Edge Function, kunci VAPID.
2. Isi URL, kunci anon, dan `VAPID_PUBLIC_KEY` di `js/core/config.js`.
3. Sajikan folder ini secara statis, misalnya `npx serve .`, lalu buka `kelasku.html` atau `konsol.html`. Produksi: GitHub Pages.

Upgrade dari v0.4.0: cadangkan dulu, aktifkan pg_cron dan pg_net, jalankan `supabase/migrations/004_push_v100.sql`, lalu ikuti bagian Notifikasi push di panduan. Dari versi lebih lama jalankan migrasi berurutan (002, 003, 004).

## Pengujian
```
PGHOST=/tmp PGPORT=5544 PGUSER=postgres tests/db/jalankan.sh   # aturan database
NODE_PATH=$(npm root -g) node tests/e2e/konsol.mjs             # Konsol
NODE_PATH=$(npm root -g) node tests/e2e/kelas.mjs              # aplikasi Kelas
node tests/unit/sw-push.mjs                                    # penangan push service worker
node tests/check-precache.mjs                                  # daftar cache
node tests/check-precache.mjs --write                          # perbarui bila menambah berkas
```
Uji otomatis memakai supabase-js tiruan dan push tiruan. Auth, Edge Function, Storage, dan pengiriman push sungguhan belum teruji di Supabase asli; ulangi dengan checklist di `tests/`.

## Catatan
- Satu origin berarti satu service worker. Jangan menambah worker kedua.
- Sesi Konsol memakai kunci penyimpanan sendiri, terpisah dari aplikasi Kelas.
- Fitur baru v0.4.0 (piket, voting, kas, organigram) mati untuk Murid sampai Admin Kelas menyalakannya di matriks izin. Pengumuman, jadwal, dan tugas tidak berubah.
- Push: dikirim paling lambat sekitar satu menit setelah kejadian (pg_cron tiap menit). Jadwal pengingat: piket 06.30 WIB, tenggat tugas 16.00 WIB. iPhone butuh aplikasi terpasang di layar utama.
- Foto profil: dikompres di perangkat sampai maksimal 300 KB. Unggah ke Storage belum teruji di Supabase asli.

## Git
Simpan titik aman: `git add . && git commit -m "pesan"`. Pulihkan bila rusak: `git reset --hard`.
