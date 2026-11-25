# Architecture Reference Document (ARD) - Kelasku.id dan Admin Kelasku.id

**Versi:** v1.0.0

## 1. Gambaran Sistem
Dua aplikasi front-end statis di satu origin, satu backend Supabase.

```
kelasku.html  --> js/main.js        (aplikasi murid dan Admin Kelas)
konsol.html   --> js/konsol/main.js (aplikasi Main Admin)
        |                 |
        +---- supabase-js 2.45.4 (jsDelivr) ----+
                          |
        Supabase: Auth | Postgres + RLS + fungsi | Edge Functions
        (login, admin-reset-password, admin-update-account, send-push)
        + Storage (bucket avatars) + pg_cron + pg_net
```
Hosting: GitHub Pages. Tanpa build.

## 2. Pemisahan Layer
| Layer | Aplikasi Kelas | Konsol | Aturan |
|---|---|---|---|
| UI | `js/presentation/` | `js/konsol/views`, `js/konsol/components` | hanya merender dan menangkap input |
| Service | `js/services/` | `js/konsol/services/` | aturan tampilan, validasi, pemetaan galat, izin sisi klien |
| Data | `js/data/` | `js/konsol/data/` | satu-satunya yang memanggil Supabase |
| Core | `js/core/` | dipakai bersama | router hash, state, `h()`, galat, format, skeleton |

Konsol memakai `js/core` bersama tetapi punya Supabase client sendiri (`storageKey: "kelasku-konsol-auth"`), sehingga sesi dua aplikasi tidak saling menimpa.

## 3. Alur Data
1. View memanggil service.
2. Service memanggil repository.
3. Repository menjalankan query atau RPC. Keputusan akses diambil RLS dan fungsi database.
4. Galat dilempar ke service, dipetakan `core/errors.js` (`SERVER_MESSAGES`) ke pesan Indonesia, lalu view menampilkan pesan dengan tombol Coba lagi.

## 4. Model Peringkat dan Izin
- Main Admin -1 (`profiles.is_platform_owner`), Admin Kelas 0, role kustom 1 sampai 999999, Murid 1000000.
- Aturan "hanya ke bawah" ada di `can_assign_role` (database). `permissions.js` di klien hanya mencerminkannya untuk menampilkan atau menyembunyikan tombol.
- Pengangkatan Admin Kelas hanya lewat `set_class_admin` (Main Admin), dengan batas per kelas atau bawaan sistem.

## 5. Konsol
- Masuk: Edge Function `login`, lalu klien memeriksa `is_platform_owner`, keluar bila bukan (`BUKAN_MAIN_ADMIN`), dan memanggil `log_console_login`.
- Seluruh data lewat RPC `console_*` dan `create_class`, `update_class`, `set_class_active`, `delete_class`, `delete_school`, `set_class_admin`, `set_max_admins_default`.
- Ubah akun lewat Edge Function `admin-update-account`: verifikasi token pemanggil, `authorize_account_edit`, ubah profil, kontak, nama anggota, dan Auth Admin API, lalu `record_account_edit` (aksi `akun.ubah`).
- Log hanya `scope = sistem`. Catatan: RLS mengizinkan Main Admin membaca log kelas juga, tetapi Konsol sengaja tidak menampilkannya.

## 6. PWA
Satu service worker `kelasku-sw.js` untuk kedua aplikasi (satu cakupan tidak boleh punya dua worker). Daftar PRECACHE dihasilkan dari graf impor oleh `node tests/check-precache.mjs --write` dan diperiksa tanpa flag. Versi cache `kelasku-v1.0.0`. Data Supabase tidak pernah di-cache.

## 7. Error Handling
| Sumber | Penanganan |
|---|---|
| Validasi input | pesan di kolom terkait |
| Kode galat server (`BATAS_ADMIN`, `HARUS_NONAKTIF`, `KONFIRMASI_SALAH`, dan lainnya) | dipetakan ke kalimat Indonesia |
| RLS menolak | `TIDAK_DIIZINKAN`, pesan tanpa izin |
| Jaringan | pesan koneksi dengan Coba lagi |
| Edge Function | membaca `error.context.json()` untuk mendapat `code` |

## 8. Keamanan
- Kunci `service_role` hanya di Edge Function.
- Kunci anon di front-end aman karena RLS.
- Kode kelas hanya lewat `get_join_code`.
- Aksi merusak (hapus sekolah atau kelas, hapus siaran) memakai konfirmasi ketik nama.

## 9. Pengujian
| Perintah | Isi |
|---|---|
| `PGHOST=/tmp PGPORT=5544 PGUSER=postgres tests/db/jalankan.sh` | 277 uji database |
| `NODE_PATH=$(npm root -g) node tests/e2e/konsol.mjs` | 40 skenario Konsol |
| `NODE_PATH=$(npm root -g) node tests/e2e/kelas.mjs` | 55 skenario aplikasi Kelas |
| `node tests/unit/sw-push.mjs` | 8 uji penangan push service worker |
| `node tests/check-precache.mjs` | daftar PRECACHE sesuai |

Belum teruji di Supabase asli: Auth, empat Edge Function, Storage (unggah foto), dan pengiriman push sungguhan.

## 10. Tambahan v0.4.0
- Layer baru: `data/features-repository.js` (piket, voting, kas, avatar), `services/{piket,voting,kas,avatar}-service.js`, view piket, voting, kas, organigram, panel, menu.
- `avatar-service.js` mengompres gambar di perangkat sebelum unggah. Foto dibaca lewat signed URL (`createSignedUrls`) karena bucket privat.
- Voting: klien tidak pernah membaca `poll_votes`. Hasil datang dari `class_polls`, yang menyembunyikan angka mode `anonim_akhir` sampai selesai dan tidak pernah memuat nama di mode anonim.
- Kas: saldo dari `kas_summary`; centang iuran lewat `set_due_paid` (satu transaksi buat atau hapus catatan pemasukan).
- Gerbang izin: sisi klien menyembunyikan menu (rail dan halaman Menu), sisi server memaksa lewat RLS dan `has_perm`. Organigram hanya digerbang di UI.
- Panel Admin: `withPanel(active, view)` membungkus halaman lama dengan deretan tab.
- Galat server baru dipetakan di `core/errors.js` (mis. `VOTING_SELESAI`, `SUDAH_MEMILIH`, `IURAN_NONAKTIF`).

## 11. Tambahan v1.0.0: notifikasi push
```
kejadian (insert) --> trigger --> push_enqueue --> push_outbox (satu baris per penerima)
pg_cron tiap menit --> push_kick --> pg_net --> Edge Function send-push
send-push --> push_claim --> Web Push (VAPID) --> perangkat --> service worker (push, notificationclick)
```
- Klien: `data/push-repository.js`, `services/push-service.js` (izin, langganan, kategori, `syncPush`, `forgetDevice`), `components/notif-settings.js`, penangan push dan klik di `kelasku-sw.js`.
- Antrean dipakai agar penyimpanan data tidak bergantung pada jaringan push. Trigger menelan galat sendiri. Penerima ditentukan saat kejadian (izin, perangkat, kategori), bukan saat kirim.
- `push_claim` memakai `for update skip locked` dan klaim 2 menit supaya dua pemanggil tidak mengirim pesan yang sama. Pesan dicoba maksimal 5 kali.
- Keamanan: `send-push` menolak panggilan tanpa `x-push-secret` (dibandingkan tanpa jalan pintas panjang). Fungsi database internal tidak bisa dipanggil `anon` atau `authenticated`. `push_outbox` dan `push_settings` tidak punya hak baca untuk aplikasi. Kunci privat VAPID hanya ada di secret Edge Function.
- Klik notifikasi hanya membuka alamat berawalan `#` di dalam aplikasi; selain itu jatuh ke `#/mading`.
- Satu worker tetap melayani kedua aplikasi. Push berlaku hanya untuk aplikasi Kelas.
- Batas yang diketahui: pengiriman bisa terlambat sampai sekitar satu menit; hanya diuji dengan push tiruan di sini.
