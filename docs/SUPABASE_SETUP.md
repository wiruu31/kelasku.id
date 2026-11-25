# Panduan setup Supabase untuk Kelasku.id dan Admin Kelasku.id

Hampir semua langkah dilakukan lewat dashboard. Satu langkah (membuat kunci VAPID untuk notifikasi) butuh Node.js di komputer atau Termux. Waktu total sekitar 30 menit.

**Urutan untuk proyek baru:** 1 proyek, 2 email, 3 ekstensi (pg_cron dan pg_net), 4 skema, 5 kunci aplikasi, 6 Main Admin, 7 sampai 9 tiga Edge Function, 10 notifikasi push.

## 1. Buat akun dan proyek

1. Buka https://supabase.com, klik **Start your project**, daftar (boleh pakai GitHub).
2. Klik **New project**. Isi:
   - **Name**: `kelasku`
   - **Database Password**: buat yang kuat, simpan di password manager. Tidak dipakai di aplikasi.
   - **Region**: Southeast Asia (Singapore), paling dekat dengan Indonesia.
3. Tunggu sekitar 2 menit sampai proyek siap.

Catatan paket gratis: proyek bisa di-pause kalau tidak ada aktivitas sekitar satu minggu. Kalau itu terjadi, buka dashboard dan klik **Restore**.

## 2. Matikan konfirmasi email

Kelasku.id tidak memverifikasi email (persetujuan Admin Kelas yang jadi penjaga pintu).

1. **Authentication** > **Sign In / Providers** (atau **Providers**) > **Email**.
2. Matikan **Confirm email**, lalu **Save**.

## 3. Aktifkan ekstensi untuk push

**Database** > **Extensions**: aktifkan `pg_cron` dan `pg_net`. Dipakai oleh pengingat dan pengiriman notifikasi (langkah 10).

## 4. Jalankan skema database

Pilih satu jalur.

**Instalasi baru (proyek Supabase kosong)**

1. **SQL Editor** > **New query**.
2. Buka `supabase/schema.sql`, salin seluruh isinya, tempel, klik **Run**.
3. Harus muncul "Success. No rows returned". File ini aman dijalankan ulang.

**Memperbarui dari v0.2.0 (data sudah ada)**

1. Cadangkan dulu: **Database** > **Backups**, atau jalankan `pg_dump` dari komputer. Lewati langkah ini dan Anda tidak punya jalan kembali.
2. **SQL Editor** > **New query**, tempel seluruh isi `supabase/migrations/002_rombak_v030.sql`, klik **Run**. Setelah itu jalankan juga `003_fitur_kelas_v040.sql` dan `004_push_v100.sql` berurutan.
3. Migrasi 002 memindahkan `school_name` ke tabel `schools` (kelas yang belum punya nama sekolah masuk ke "Sekolah Bawaan"), mengubah flag admin menjadi role sistem Admin Kelas, memberi semua anggota role Murid, dan menggeser urutan role kustom. Migrasi tidak mengisi log aktivitas. Aman diulang.
4. Periksa hasilnya:
   ```sql
   select count(*) from public.schools;
   select c.name, count(*) filter (where r.system_key = 'admin_kelas') as role_admin
     from public.classes c join public.roles r on r.class_id = c.id group by c.name;
   ```

## 5. Salin kunci ke aplikasi

1. **Project Settings** > **API**.
2. Salin **Project URL** dan **anon public** key.
3. Tempel ke `js/core/config.js` pada `SUPABASE_URL` dan `SUPABASE_ANON_KEY`. Satu berkas ini dipakai aplikasi Kelas dan Konsol.

Kunci anon memang publik. Data dilindungi oleh RLS di database, jadi aman ada di kode front-end. Jangan pernah menaruh kunci `service_role` di file front-end.

## 6. Jadikan dirimu Main Admin

Dilakukan sekali. Lewati langkah ini bila memperbarui dari v0.2.0 dan akunmu sudah Pemilik: statusnya otomatis menjadi Main Admin.

1. Buat sekolah dan kelas awal di **SQL Editor** (Main Admin belum ada, jadi belum ada yang bisa membuatnya lewat Konsol):
   ```sql
   insert into public.schools (name) values ('Sekolah Awal');
   insert into public.classes (name, school_id)
     values ('Kelas Awal', (select id from public.schools where name = 'Sekolah Awal'));
   select name, join_code from public.classes;
   ```
   Catat `join_code` yang tampil.
2. Setelah Edge Function `login` ter-deploy (langkah 7), buka `kelasku.html`, daftar memakai kode itu.
3. Jadikan akunmu Main Admin (ganti `username_kamu`):
   ```sql
   update public.profiles set is_platform_owner = true where username = 'username_kamu';
   ```
4. Main Admin tidak memakai aplikasi Kelas. Lepaskan keanggotaan kelas awalnya bila tidak diperlukan:
   ```sql
   update public.class_members set status = 'removed'
     where user_id = (select id from public.profiles where username = 'username_kamu');
   ```
5. Buka `konsol.html` dan masuk. Sekolah, kelas, dan Admin Kelas berikutnya dikelola dari Konsol, tidak perlu SQL lagi.

## 7. Deploy Edge Function `login`

Fungsi ini memungkinkan masuk memakai nama lengkap, username, email, atau nomor WA. Dipakai aplikasi Kelas dan Konsol. Tanpa fungsi ini, tombol Masuk akan gagal.

1. **Edge Functions** > **Deploy a new function** > **Via Editor**.
2. Nama fungsi: `login` (huruf kecil persis).
3. Hapus kode contoh, lalu salin seluruh isi `supabase/functions/login/index.ts` dan tempel.
4. Klik **Deploy function**. Biarkan pengaturan JWT bawaan.

Kunci `service_role` dan URL sudah disuntikkan otomatis ke fungsi oleh Supabase, tidak perlu diisi manual.

## 8. Deploy Edge Function `admin-reset-password`

Dipakai Admin Kelas dan Main Admin untuk membuat kata sandi sementara bagi anggota yang lupa sandi.

1. **Edge Functions** > **Deploy a new function** > **Via Editor**.
2. Nama fungsi: `admin-reset-password`.
3. Salin isi `supabase/functions/admin-reset-password/index.ts`, tempel, lalu **Deploy function**.

Siapa boleh mereset siapa diputuskan di database (fungsi `authorize_password_reset`), bukan di Edge Function.

## 9. Deploy Edge Function `admin-update-account`

Baru di v0.3.0. Dipakai untuk mengubah nama, username, email, WA, jenis kelamin, dan kata sandi akun murid.

1. **Edge Functions** > **Deploy a new function** > **Via Editor**.
2. Nama fungsi: `admin-update-account`.
3. Salin isi `supabase/functions/admin-update-account/index.ts`, tempel, lalu **Deploy function**.

Aturannya (di fungsi database `authorize_account_edit`): Main Admin boleh mengubah akun siapa pun. Admin Kelas hanya boleh mengubah murid di kelasnya yang peringkatnya di bawahnya, tidak pernah sesama Admin Kelas.

## 10. Notifikasi push (baru di v1.0.0)

Butuh: migrasi `004_push_v100.sql` (sudah ada di `schema.sql`), ekstensi **pg_cron** dan **pg_net**, Edge Function `send-push`, dan sepasang kunci VAPID. Aplikasi harus dibuka lewat HTTPS (GitHub Pages sudah HTTPS).

1. **Ekstensi.** **Database** > **Extensions**, cari `pg_cron` lalu aktifkan, kemudian `pg_net`. Lakukan ini sebelum menjalankan `schema.sql` atau `004`. Bila terlanjur, aktifkan sekarang lalu jalankan ulang `004_push_v100.sql` (aman diulang) supaya jadwalnya terpasang.
2. **Kunci VAPID.** Di komputer (atau Termux) yang punya Node.js, jalankan `npx web-push generate-vapid-keys`. Akan tampil Public Key dan Private Key. Simpan keduanya. Private Key jangan masuk ke berkas aplikasi atau Git.
3. **Rahasia bersama.** Buat string acak panjang, misalnya `openssl rand -hex 24`, untuk `PUSH_SECRET`.
4. **Secrets.** **Edge Functions** > **Secrets** > tambahkan empat nilai:
   - `VAPID_PUBLIC_KEY`: Public Key dari langkah 2
   - `VAPID_PRIVATE_KEY`: Private Key dari langkah 2
   - `VAPID_SUBJECT`: `mailto:emailmu@contoh.com`
   - `PUSH_SECRET`: string dari langkah 3
5. **Deploy fungsi.** **Edge Functions** > **Deploy a new function** > **Via Editor**, nama `send-push`, tempel isi `supabase/functions/send-push/index.ts`. Di pengaturan fungsi, **matikan Verify JWT** (pemanggilnya pg_cron dan diperiksa lewat `PUSH_SECRET`). Deploy.
6. **Beri tahu database alamat fungsi.** Di SQL Editor (ganti `REF` dengan kode proyekmu dan `RAHASIA` dengan `PUSH_SECRET`):
   ```sql
   insert into public.push_settings (function_url, secret)
   values ('https://REF.supabase.co/functions/v1/send-push', 'RAHASIA')
   on conflict (id) do update set function_url = excluded.function_url, secret = excluded.secret;
   ```
7. **Kunci publik di aplikasi.** Tempel Public Key ke `VAPID_PUBLIC_KEY` di `js/core/config.js`, lalu unggah ulang aplikasi. Selama nilainya kosong, bagian Notifikasi di Profil tidak tampil.
8. **Cek.** Jalankan `select jobname, schedule from cron.job;` (harus ada empat pekerjaan `kelasku-...`). Aktifkan notifikasi di Profil, tulis satu pengumuman dari akun lain, tunggu sekitar satu menit. Bila tidak sampai: `select * from net._http_response order by id desc limit 5;` menunjukkan jawaban fungsi, dan `select * from public.push_outbox order by id desc limit 5;` menunjukkan antrean.

Jadwal pengingat (zona WIB): piket hari ini pukul 06.30, tenggat tugas besok pukul 16.00, pengiriman tiap menit. Aturan tiap pemicu ada di `PRD.md`.

iPhone hanya menerima push jika aplikasi dipasang ke layar utama (iOS 16.4 ke atas). Untuk APK jenis TWA (Bubblewrap), push web berjalan seperti di Chrome.

## Memperbarui ke v1.0.0 (dari v0.4.0)

1. Cadangkan database.
2. Aktifkan `pg_cron` dan `pg_net` (langkah 10.1), lalu jalankan seluruh isi `supabase/migrations/004_push_v100.sql`.
3. Ikuti langkah 10.2 sampai 10.8.

## Memperbarui ke v0.4.0

Migrasi `supabase/migrations/003_fitur_kelas_v040.sql` menambah Piket, Voting, Kas, kolom `profiles.avatar_path`, dan bucket Storage `avatars`.

1. Cadangkan database.
2. Jalankan seluruh isi `003_fitur_kelas_v040.sql` di SQL Editor (aman diulang).
3. Buka **Storage**: bucket `avatars` harus ada, berstatus private, batas 300 KB, tipe jpeg/png/webp. Bila migrasi tidak membuatnya (Storage belum aktif di proyekmu), buat manual dengan pengaturan itu lalu jalankan ulang 003 agar kebijakannya terpasang.
4. Di **Storage > Policies** pastikan ada kebijakan untuk `avatars` (baca anggota sekelas, unggah ke folder sendiri, hapus lewat fungsi `can_manage_avatar`).
5. Tidak ada Edge Function baru di v0.4.0.

## Memperbarui skema

Setiap kali berkas di `supabase/migrations/` bertambah, jalankan berkas barunya di SQL Editor. `supabase/schema.sql` adalah gabungan semua migrasi untuk instalasi baru; buat ulang dengan `./supabase/gabung-schema.sh` setelah menambah migrasi.

## Jika ada masalah

| Gejala | Penyebab umum |
| --- | --- |
| `permission denied for table ...` | Skema belum dijalankan penuh. Jalankan ulang `schema.sql`. |
| Daftar gagal dengan pesan kode kelas | Kode salah atau kelas nonaktif. Cek `select name, join_code, is_active from classes;` |
| Data tidak muncul padahal sudah login | Akun masih pending, atau belum punya izin. Cek `class_members.status`. |
