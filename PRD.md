# Product Requirements Document (PRD) - Kelasku.id dan Admin Kelasku.id

**Versi:** v1.0.0  
**Status:** Disetujui

## 1. Ringkasan Produk
Dua aplikasi web (PWA) dalam satu sistem. **Admin Kelasku.id** (Konsol) hanya untuk Main Admin: mengelola sekolah, kelas, Admin Kelas, akun murid, siaran, dan log sistem. **Kelasku.id** untuk murid dan pengurus: pendaftaran, jadwal, tugas, pengumuman, anggota, role, dan Kabar Sistem. Versi 0.3.0 meliputi fondasi database, Konsol, hierarki role, dan siaran. Perombakan tampilan dan fitur baru aplikasi Kelas ada di v0.4.0.

## 2. Aturan Peran dan Peringkat
- Peringkat: Main Admin (-1), Admin Kelas (0), role kustom (1 sampai 999999), Murid (1000000). Angka kecil berarti lebih tinggi.
- **Main Admin:** satu atau lebih akun dengan `profiles.is_platform_owner`. Tidak diubah dari aplikasi.
- **Admin Kelas** dan **Murid** adalah role sistem per kelas: dibuat otomatis, tidak bisa diganti nama atau dihapus. Izin Admin Kelas terkunci (semua izin). Izin Murid boleh diatur.
- Hanya Main Admin dan Admin Kelas yang membuat, mengubah, dan menghapus role kustom.
- Memberi role kustom ke anggota: hanya role di bawah peringkat pemberi, ke anggota di bawah peringkat pemberi. Butuh izin `role.beri` atau menjadi Admin Kelas atau Main Admin. Role sistem tidak dipasang lewat jalur ini.
- Hanya Main Admin yang mengangkat atau mencabut Admin Kelas (fungsi `set_class_admin`), dibatasi `classes.max_admins` atau, bila kosong, `system_settings.max_admins_per_class` (bawaan 3, rentang 1 sampai 20).

## 3. Spesifikasi Fungsional: Aplikasi Kelas

### F-01: Pendaftaran dan persetujuan
- **Alur:** isi nama lengkap, username, email, WA, kata sandi, kode kelas > cek aturan di server > buat akun > "Menunggu persetujuan" > Admin Kelas atau pemegang izin `akun.approve` menyetujui atau menolak.
- **Aturan:** nama lengkap unik per kelas. Username, email, dan WA unik global. Kode kelas harus valid, kelas aktif, dan sekolahnya aktif (`KELAS_NONAKTIF` bila tidak). Pesan galat server diterjemahkan ke bahasa Indonesia.
- **Penerimaan:** pendaftar pending tidak bisa membaca data kelas. Setelah disetujui masuk ke Mading.

### F-02: Masuk dan sesi
- Masuk memakai nama lengkap, username, email, atau nomor WA lewat Edge Function `login`. Sandi salah dan identitas tidak dikenal memberi pesan sama. Nama kembar antarkelas meminta identitas lain.
- Akun Main Admin yang masuk lewat aplikasi Kelas tidak punya kelas, sehingga tidak diberi akses; ia memakai Konsol.

### F-03: Role dan izin
- Admin Kelas membuat role (nama, warna dari 8 pilihan, urutan) dan mengatur izin.
- Izin per fitur (Pengumuman, Jadwal, Tugas): `akses` (membuka menu), `lihat`, `tambah`, `ubah`, `hapus`. `ubah` dan `hapus` berskala `milik` atau `semua`. Izin pengelolaan: `akun.approve`, `role.beri`, `kode.kelola`.
- Bawaan Murid: `akses` dan `lihat` untuk pengumuman, jadwal, tugas.
- **Penerimaan:** menaikkan diri atau memasang role di atas peringkat lewat API ditolak database.

### F-04: Anggota dan reset kata sandi
- Daftar anggota, keluarkan atau pulihkan, pasang atau lepas role, reset kata sandi.
- Admin Kelas hanya mengeluarkan dan mereset anggota yang peringkatnya di bawahnya, di kelasnya sendiri. Kata sandi sementara tampil sekali.

### F-05: Mading, F-06 Pengumuman, F-07 Jadwal, F-08 Tugas
- Tidak berubah dari v0.2.0 selain nama izin (`.buat` menjadi `.tambah`) dan izin `akses` yang kini menentukan menu muncul.
- Mading: sapaan, tanggal WIB, jadwal hari ini, pengumuman terbaru, tugas mendatang, jumlah pendaftar menunggu (pemegang izin).
- Pengumuman: judul 2 sampai 120, isi maksimal 4000, sematkan. Jadwal: jam selesai setelah jam mulai. Tugas: urut tenggat, lencana Terlewat, Hari ini, Besok.

### F-09: Log kelas
- Catatan otomatis dari database untuk perubahan anggota, role, pengumuman, jadwal, tugas, kode kelas, ubah akun, dan reset sandi, tampil sebagai kalimat. Hanya Admin Kelas. 40 baris per halaman.

### F-10: Kabar Sistem
- Admin Kelas membaca siaran Main Admin yang ditujukan ke kelasnya (semua, sekolahnya, atau kelasnya). Siaran baru bertanda **Baru**; membukanya mencatat penanda baca yang dilihat Main Admin sebagai jumlah pembaca. Murid tidak menerima.

### F-11: Profil, F-12 PWA, F-13 Tutorial
- Profil: identitas, role, nomor absen, NIS, ganti kata sandi. PWA: manifest, service worker, tombol pasang, kerangka tetap terbuka offline, data tidak di-cache. Tutorial: tur sorot per izin, sekali, bisa diulang; langkah Kabar Sistem untuk Admin Kelas.

### F-14: Piket
- Tujuh hari, tiap hari berisi nol sampai banyak murid. Satu murid boleh di beberapa hari, tidak boleh dobel di hari yang sama.
- Izin `piket.akses`, `lihat`, `tambah`, `hapus`. Hanya anggota aktif kelas itu yang bisa dipilih.
- Mading menampilkan "Piket hari ini" (hari WIB). Tanpa tukar jadwal.

### F-15: Voting
- Mode: `terlihat` (satu pilihan, nama dan hasil langsung, suara bisa diganti), `anonim_akhir` (satu pilihan, hasil terbuka setelah selesai), `anonim_banyak` (banyak pilihan, anonim, hasil langsung).
- 2 sampai 10 pilihan, judul 2 sampai 120 karakter, tenggat opsional, tutup manual. Voting selesai tidak menerima suara.
- Pembuat butuh `voting.tambah`; tutup dan hapus oleh pemegang `voting.ubah` atau `voting.hapus`.
- Anonimitas: tabel suara hanya terbaca pemiliknya. Hasil dihitung fungsi database. Batas: pemegang akses superuser database secara teknis tetap bisa membaca tabel.

### F-16: Kas kelas
- Catatan pemasukan dan pengeluaran (jumlah rupiah bulat positif, keterangan 1 sampai 120 karakter, tanggal). Saldo dihitung `kas_summary`.
- Iuran tetap: nama, jumlah, periode mingguan (minggu ISO `YYYY-Www`) atau bulanan (`YYYY-MM`). Bendahara mencentang lunas per murid per periode, tanpa bukti bayar.
- Centang lunas membuat catatan pemasukan `source='iuran'`; membatalkan menghapusnya, dalam satu transaksi. Catatan iuran tidak bisa diubah langsung.
- Izin `kas.akses`, `lihat`, `tambah`, `ubah`, `hapus`. Edge case: jumlah tidak valid ditolak, iuran nonaktif tidak bisa dicentang.

### F-17: Organigram
- Kartu per role kustom (selain Admin Kelas dan Murid), urut peringkat, dengan pemegang dan fotonya. Izin `organigram.akses` (dibatasi di UI; datanya sama dengan daftar anggota yang memang boleh dilihat).

### F-18: Foto profil
- Maksimal 300 KB setelah dikompres di perangkat (potong persegi, kecilkan, turunkan mutu). Tipe jpeg, png, webp.
- Terlihat oleh anggota sekelas. Pemilik bisa mengganti atau menghapus. Admin Kelas bisa mencabut foto murid di bawahnya.

### F-19: Panel Admin Kelas
- Satu halaman dengan tab: Ringkasan, Anggota, Persetujuan, Peran, Log, Kode kelas. Hanya Admin Kelas (pemegang izin tunggal tetap punya halamannya di rail).

### F-20: Notifikasi push
- Pengguna mengaktifkan notifikasi di Profil per perangkat (izin browser). Satu pengguna boleh punya banyak perangkat. Keluar dari akun melepas langganan perangkat itu.
- Kategori: `pengumuman`, `tugas`, `tenggat`, `voting`, `piket`, `siaran`, `pendaftar` (hanya terlihat untuk Admin Kelas dan pemegang `akun.approve`). Bawaan semua nyala; pengguna mematikan per kategori.
- Penerima hanya anggota aktif kelas yang punya izin melihat fiturnya (`pengumuman.lihat`, `tugas.lihat`, `voting.lihat`), punya perangkat terdaftar, dan tidak mematikan kategori itu. Pembuat tidak menerima notifikasi buatannya sendiri.
- Pemicu langsung: pengumuman baru, tugas baru ("Mapel: judul"), voting baru, siaran sistem (sesuai target semua, sekolah, atau kelas), pendaftar baru (ke pemegang izin persetujuan).
- Pengingat: piket hari ini pukul 06.30 WIB (murid yang bertugas), tenggat besok pukul 16.00 WIB (tugas yang tenggatnya jatuh besok menurut tanggal WIB). Satu pengingat per murid per hari atau per tugas, tidak dobel.
- Isi memuat judul asli, dipotong 80 karakter (judul) dan 140 karakter (isi). Ketuk notifikasi membuka halaman terkait.
- Edge case: langganan kedaluwarsa (HTTP 404 atau 410) dibuang otomatis; gagal sementara dicoba lagi sampai 5 kali; kegagalan push tidak pernah menggagalkan penyimpanan pengumuman, tugas, atau voting; antrean lama dibersihkan setelah 7 hari.
- Batas: iPhone hanya menerima bila aplikasi terpasang di layar utama; keterlambatan pengiriman sampai sekitar satu menit; Konsol tidak ikut.

### Izin bawaan Murid
Fitur baru (piket, voting, kas, organigram) mati bawaan. Admin Kelas menyalakannya lewat matriks izin role Murid.

## 4. Spesifikasi Fungsional: Konsol (Main Admin)

### K-01: Masuk
- Memakai Edge Function `login` yang sama. Setelah masuk, klien memeriksa `is_platform_owner`; akun lain langsung dikeluarkan dengan pesan "bukan Main Admin". Setiap masuk tercatat (`log_console_login`). Sesi Konsol memakai kunci penyimpanan sendiri.

### K-02: Dashboard
- Sapaan, jam WIB hidup, total sekolah aktif, kelas aktif, murid aktif, menunggu persetujuan, Admin Kelas. Daftar "Perlu perhatian" (kelas dengan pendaftar menunggu atau tanpa Admin Kelas) dan aktivitas sistem terbaru.

### K-03: Ringkasan
- Drill-down Sekolah > Kelas > Murid dengan breadcrumb. Panel samping untuk mengelola sekolah, kelas, dan murid. Cari murid menurut nama atau username.

### K-04: Atur Role
- Pilih sekolah dan kelas, lihat murid aktif, Angkat atau Cabut Admin Kelas dengan meter terpakai per batas. Daftar semua Admin Kelas.
- **Aturan:** hanya murid aktif; batas dijaga database (`BATAS_ADMIN`); batas kelas tidak boleh di bawah jumlah Admin Kelas sekarang (`BATAS_DI_BAWAH_JUMLAH`).

### K-05: Tambah Kelas dan Sekolah
- Kelas: nama 2 sampai 80, sekolah aktif wajib; kode kelas dibuat otomatis dan ditampilkan.
- Sekolah: tambah, ganti nama, pindahkan kelas antar sekolah, arsipkan atau aktifkan.
- **Hapus permanen:** hanya setelah diarsipkan (`HARUS_NONAKTIF`), dan harus mengetik nama persis (`KONFIRMASI_SALAH` bila salah). Menghapus sekolah menghapus kelas di dalamnya.

### K-06: Ubah akun murid
- Nama, username, email, WA, jenis kelamin, kata sandi lewat Edge Function `admin-update-account`. Hanya kolom yang berubah dikirim. Duplikat username, email, WA, atau nama di kelas ditampilkan di kolomnya. Kata sandi sementara lewat `admin-reset-password`.

### K-07: Siaran Sistem
- Judul (2 sampai 120), isi (maksimal 4000), tujuan: semua Admin Kelas, satu sekolah, atau satu kelas. Riwayat dengan jumlah pembaca; hapus siaran dengan mengetik judul.

### K-08: Log
- Hanya catatan `scope = sistem` (sekolah, kelas, pengaturan, siaran, pengangkatan Admin Kelas, ubah akun, masuk Konsol). Tidak menampilkan isi kelas. 40 baris per halaman.

### K-09: Pengaturan
- Batas bawaan Admin Kelas (1 sampai 20), ganti nama sendiri, ganti kata sandi sendiri, keluar.

## 5. Kebutuhan Non-Fungsional
- **Loading state:** skeleton (Konsol: tiles, table, form; Kelas: board, list, profile, form).
- **Arsitektur:** UI, Service, dan Data terpisah; hanya Data yang menyentuh Supabase.
- **Error handling:** pesan berbahasa Indonesia untuk input salah, tanpa izin, dan koneksi gagal, dengan tombol Coba lagi.
- **Keamanan:** keputusan akses ada di RLS dan fungsi database. Tombol di UI hanya cermin. Kunci `service_role` hanya di Edge Function. Kode kelas hanya terbaca lewat `get_join_code`.
- **Aksesibilitas:** kontras AA, keyboard, fokus terlihat dan terkunci di panel, target sentuh 44px, `prefers-reduced-motion`.
- **Zona waktu:** WIB (Asia/Jakarta).
