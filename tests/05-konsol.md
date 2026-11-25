# Checklist uji: Konsol Admin Kelasku.id

Uji otomatis: `node tests/e2e/konsol.mjs` (40 skenario di Chromium, desktop 1280px dan ponsel 375px, dengan supabase-js tiruan) dan `tests/db/jalankan.sh` untuk aturan database. Yang belum pernah jalan di Supabase asli: Auth, Edge Function `login`, `admin-update-account`, `admin-reset-password`. Ulangi bagian itu manual.

Masuk
- [ ] Buka `konsol.html`: tanpa sesi diarahkan ke halaman masuk.
- [ ] Masuk dengan akun murid atau Admin Kelas: ditolak dengan pesan "bukan Main Admin" dan sesi langsung keluar.
- [ ] Masuk dengan akun Main Admin: dashboard terbuka; tercatat "masuk ke Konsol" di Log.
- [ ] Sesi Konsol terpisah dari aplikasi Kelas (masuk di satu tidak mengubah yang lain).

Dashboard
- [ ] Jam WIB berjalan tiap detik; total sekolah, kelas, murid, menunggu, dan Admin Kelas sesuai data.
- [ ] "Perlu perhatian" menandai kelas dengan pendaftar menunggu atau tanpa Admin Kelas.

Ringkasan (Sekolah > Kelas > Murid)
- [ ] Klik sekolah membuka kelasnya; klik kelas membuka muridnya; breadcrumb bisa diklik mundur.
- [ ] Cari murid menyaring nama dan username.
- [ ] Kelola sekolah, kelas, dan murid membuka panel samping; Escape menutup dan fokus kembali ke tombol asal.
- [ ] Ubah akun murid (nama, username, email, WA, jenis kelamin, kata sandi): berhasil dan tercatat di log sistem. Username atau email bentrok tampil di kolomnya.
- [ ] Kata sandi sementara tampil sekali dengan tombol Salin.
- [ ] Kode kelas tampil dan bisa disalin.

Atur Role (Admin Kelas)
- [ ] Pilih sekolah lalu kelas: murid aktif tampil dengan meter "terpakai/batas".
- [ ] Angkat dan Cabut bekerja; tombol Angkat nonaktif saat batas penuh.
- [ ] Murid yang belum aktif tidak bisa diangkat.
- [ ] Menurunkan batas kelas di bawah jumlah Admin Kelas sekarang ditolak.

Tambah Kelas dan Sekolah
- [ ] Tambah Kelas butuh nama dan sekolah aktif; kode kelas tampil setelah dibuat.
- [ ] Tambah sekolah; nama kembar ditolak.
- [ ] Ganti nama sekolah; pindahkan kelas ke sekolah lain.
- [ ] Arsipkan sekolah atau kelas; sekolah arsip tidak menerima pendaftar baru.
- [ ] Hapus permanen hanya muncul untuk yang sudah diarsipkan; tombol baru aktif setelah nama diketik persis; server menolak nama yang salah.

Siaran Sistem
- [ ] Siaran kosong ditolak per kolom. Kirim ke semua, satu sekolah, atau satu kelas.
- [ ] Riwayat menampilkan tujuan dan jumlah pembaca; hapus siaran butuh mengetik judul.

Log dan Pengaturan
- [ ] Log hanya berisi catatan tingkat sistem; "Muat lebih banyak" menambah 40 baris.
- [ ] Batas bawaan Admin Kelas: 1 sampai 20; di luar itu ditolak. Ganti nama dan kata sandi sendiri.
- [ ] Keluar kembali ke halaman masuk; membuka rute privat tanpa sesi diarahkan ke masuk.

Tampilan
- [ ] Ponsel 375px: semua halaman tanpa geser horizontal, tombol Menu berlabel membuka daftar menu, target sentuh minimal 44px.
- [ ] Tab dengan keyboard: fokus terlihat dan terkunci di dalam panel.

Checkpoint Git: `git add . && git commit -m "konsol admin"`
Pemulihan: `git reset --hard`
