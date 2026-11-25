# BRAINSTORM - Kelasku.id dan Admin Kelasku.id

## 1. Tujuan Utama
- Masalah yang diselesaikan: informasi kelas (jadwal, tugas, pengumuman) tercecer di grup chat, dan tidak ada pengelolaan sekolah, kelas, anggota, serta hak akses yang jelas.
- Nilai utama: dua aplikasi dalam satu sistem. **Kelasku.id** untuk murid dan pengurus kelas. **Admin Kelasku.id** (Konsol) untuk Main Admin yang mengelola semua sekolah, kelas, dan Admin Kelas.
- Alasan memisahkan: pekerjaan Main Admin (membuat sekolah, mengangkat Admin Kelas, siaran sistem) berbeda dari pekerjaan harian kelas. Gabungan keduanya membuat menu kelas penuh opsi yang hanya dipakai satu orang.

## 2. Target Pengguna
- **Main Admin** (satu orang, pembuat aplikasi): pakai Konsol. Membuat dan mengarsipkan sekolah dan kelas, mengangkat dan mencabut Admin Kelas, mengubah akun murid, mengirim siaran, melihat log sistem.
- **Admin Kelas** (batas per kelas, bawaan 3): role sistem tertinggi di kelas. Menyetujui pendaftar, mengelola anggota, role, dan kode kelas, membaca log kelas dan Kabar Sistem.
- **Pengurus ber-role** (ketua, bendahara, dan seterusnya): izin ditentukan role kustom buatan Admin Kelas.
- **Murid:** melihat isi kelas, mengisi nomor absen dan NIS sendiri.

## 3. Pemisahan Fitur
### Fitur Inti v0.3.0 (rilis sebelumnya)
- [x] Fondasi database baru: sekolah, role sistem, hierarki peringkat, log berlingkup
- [x] Konsol: masuk khusus Main Admin, Dashboard, Ringkasan (Sekolah > Kelas > Murid), Atur Role, Tambah Kelas, Sekolah, Siaran Sistem, Log, Pengaturan
- [x] Hierarki role: Main Admin, Admin Kelas, role kustom, Murid
- [x] Matriks izin per fitur: akses, lihat, tambah, ubah, hapus
- [x] Siaran Sistem (ke semua, satu sekolah, atau satu kelas) dan Kabar Sistem di aplikasi Kelas
- [x] Logo baru "Halaman K" untuk kedua aplikasi

### Fitur v0.4.0 (rilis ini, hanya aplikasi Kelas)
- [x] Antarmuka "Senja Kelas": krem hangat, tinta aubergine, aksen terakota, kartu bento di Mading, bilah bawah di ponsel dengan tab Menu berlabel
- [x] Piket manual: murid bisa di beberapa hari, tanpa tukar jadwal
- [x] Voting tiga mode, maksimal 10 pilihan, tenggat opsional, tutup manual
- [x] Kas: pemasukan, pengeluaran, saldo, iuran tetap mingguan atau bulanan
- [x] Organigram otomatis dari role kustom
- [x] Foto profil maksimal 300 KB, nama sekolah di header dan profil
- [x] Panel Admin Kelas satu tempat dengan tab: Ringkasan, Anggota, Persetujuan, Peran, Log, Kode kelas
- [x] Murid: fitur baru mati bawaan sampai Admin Kelas menyalakan

### Fitur v1.0.0 (rilis ini): notifikasi push
- [x] Web Push (VAPID) untuk aplikasi Kelas, termasuk yang dibungkus TWA
- [x] Pemicu: pengumuman baru, tugas baru, voting baru, siaran sistem, pendaftar baru (untuk pemegang izin persetujuan)
- [x] Pengingat terjadwal: piket hari ini 06.30 WIB, tenggat tugas besok 16.00 WIB
- [x] Pengaturan per kategori di Profil, bawaan semua nyala, diatur pengguna sendiri
- [x] Isi notifikasi memakai judul asli
- [ ] Fase berikutnya: jam tenang, ringkasan harian, riwayat notifikasi, push untuk Konsol

### Fase Berikutnya
- [ ] Pembungkus APK (TWA) dan uji menyeluruh di Supabase asli
- [ ] Ganti sandi wajib setelah reset

### Keputusan v1.0.0
- Versi diloncatkan ke v1.0.0 karena setelah push aplikasi siap dibungkus jadi APK. Status final menunggu checklist manual di Supabase asli lolos.
- Push hanya aplikasi Kelas. Konsol tidak ikut.
- APK memakai TWA, sehingga Web Push cukup (tanpa FCM).
- Pemicu lewat antrean di database; pengiriman oleh Edge Function tiap menit.

### Keputusan v0.4.0
- Piket: satu tabel `piket_duties`, tanpa tukar jadwal, dikelola pemegang izin.
- Voting: ubah suara hanya di mode terlihat. Pembuat dibatasi izin `voting.tambah`.
- Kas: iuran tidak memakai bukti bayar. Bendahara mencentang, dan centang membuat pemasukan otomatis.
- Foto profil terlihat oleh semua anggota kelas. Admin Kelas bisa mencabut.
- Izin Kas, Voting, dan Piket diatur per role (akses, lihat, tambah, ubah, hapus).

### Keputusan yang sudah dikunci
- Absensi dihapus dari rencana.
- Voting punya tiga mode: satu pilihan dengan pemilih terlihat dan hasil langsung; satu pilihan anonim dengan hasil setelah selesai; banyak pilihan anonim dengan hasil langsung.
- Izin murid hanya bisa diubah Admin Kelas dan Main Admin.
- Ubah akun: Main Admin untuk semua; Admin Kelas hanya murid di kelasnya yang peringkatnya di bawahnya, tidak pernah sesama Admin Kelas.
- Hapus permanen selalu didahului arsip, lalu mengetik nama.
- Log Konsol hanya tingkat sistem; tidak ada tampilan baca-saja untuk isi kelas.

## 4. Tech Stack & Arsitektur
- UI: HTML, CSS, JavaScript ES module tanpa framework dan tanpa build. Router hash, komponen kecil, skeleton loading. Dua titik masuk: `kelasku.html` dan `konsol.html`.
- Service: `js/services/` (Kelas) dan `js/konsol/services/` (Konsol).
- Data: `js/data/` dan `js/konsol/data/` memanggil Supabase (Auth, Postgres dengan RLS, Edge Functions). Hosting statis di GitHub Pages.
- Satu service worker melayani kedua aplikasi (satu origin, satu cakupan).
- Push: Web Push dengan kunci VAPID, `push_outbox` sebagai antrean, Edge Function `send-push`, jadwal lewat pg_cron dan pg_net.
- Storage Supabase: bucket privat `avatars` untuk foto profil, diakses lewat signed URL.

## 5. Alasan Pilihan Teknologi
- Supabase: autentikasi dan database siap pakai; keamanan di RLS sehingga kunci anon aman di front-end. Aturan yang sensitif (siapa boleh mengubah akun siapa, batas Admin Kelas, hapus permanen) hidup di fungsi database, bukan di JavaScript.
- Tanpa framework dan tanpa build: dideploy dengan menaruh berkas di GitHub Pages.
