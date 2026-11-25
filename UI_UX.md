# UI/UX - Kelasku.id dan Admin Kelasku.id

**Versi:** v1.0.0

Dua aplikasi, dua identitas. Konsol tidak meminjam rupa aplikasi Kelas, dan sebaliknya.

## 1. Admin Kelasku.id (Konsol): "Bara"
**Karakter:** ruang kerja gelap hangat untuk satu orang yang mengurus banyak hal. Tenang, padat informasi, satu aksen. Gelap dipilih karena Main Admin memakainya lama dan sering di malam hari, bukan karena tren.

### Warna
| Token | Nilai | Pakai untuk |
|---|---|---|
| `--bg` | #121110 | latar halaman |
| `--surface`, `--surface-2` | #1a1816, #221f1c | kartu, panel |
| `--line` | #2e2a26 | garis pemisah |
| `--line-strong` | #766d64 | batas input (3:1 ke latar) |
| `--text` | #ede8e1 | teks utama |
| `--muted` | #9a9189 | teks pendukung |
| `--ember` | #ff7a45 | satu aksen: aksi utama dan item aktif |
| `--danger` | #ff5d5d | aksi merusak |
| `--ok` | #8fd3a8 | status berhasil |

Kontras terukur: teks 15,5:1, muted 5,3 sampai 6,1, ember 6,9 sampai 7,3, danger 6,3, batas input minimal 3,2:1. Status selalu disertai teks atau ikon, tidak hanya warna.

### Tipografi
Geist untuk antarmuka dan Geist Mono untuk angka, kode kelas, dan jam, karena angka sejajar memudahkan membaca tabel dan meter. Skala fluida dengan `clamp()`.

### Tata letak
- **Desktop (900px ke atas):** rel kiri 13rem berisi menu, konten maksimal 72rem.
- **Ponsel:** bilah atas ringkas dengan tombol berlabel "Menu" yang membuka lembar menu, bukan hamburger polos.
- **Tabel:** di bawah 720px menjadi kartu bertumpuk.
- **Panel samping** untuk mengelola sekolah, kelas, dan murid; fokus terkunci di dalamnya, Escape menutup.
- Rentang tengah (720 sampai 900px) punya keadaan sendiri: tabel tetap, menu lembar.
- Target sentuh minimal 44px, `prefers-reduced-motion` dihormati.

### Ikon dan logo
Set ikon garis 1,5px buatan sendiri. Logo "Halaman K": halaman dengan huruf K dan detail sudut kecil berpanah ember yang menandai sisi admin. Ikon aplikasi Konsol berlatar gelap.

### Alur utama
1. Masuk, bila bukan Main Admin langsung ditolak.
2. Dashboard: lihat "Perlu perhatian".
3. Ringkasan: Sekolah > Kelas > Murid, kelola lewat panel.
4. Atur Role: pilih kelas, Angkat atau Cabut Admin Kelas.
5. Siaran Sistem: tulis, pilih tujuan, kirim.

### Keadaan
Skeleton berbentuk tile, tabel, dan formulir. Keadaan kosong menjelaskan apa yang belum ada. Galat memberi pesan dan tombol Coba lagi.

## 2. Kelasku.id (aplikasi Kelas): "Senja Kelas"
**Karakter:** ruang kelas sore hari. Hangat, rapi, bersahabat untuk murid, bukan dasbor korporat. Berbeda dari Konsol (gelap, padat) dan dari tampilan lama (ungu muda berpapan tempel).

### Warna
| Token | Nilai | Pakai untuk |
|---|---|---|
| `--paper` | #f7efe6 | latar halaman |
| `--card` | #fff9f1 | kartu |
| `--ink` | #2a1d2b | teks utama (14,09:1 di atas kertas) |
| `--ink-soft` | #5a4a5b | teks pendukung (6,74:1) |
| `--accent` | #b8431f | tombol utama, tautan, item aktif (kartu di atas aksen 5,24:1) |
| `--night` | #2f3a5c | kartu penekanan (kartu di atas night 10,75:1) |
| `--sun` | #f6e2b8 | lencana dan sorotan lembut |
| `--line-strong` | batas input | 3,95:1 di atas kartu |
| `--danger` | merah bata | aksi merusak (6,12:1 di atas tint) |
Hijau tidak dipakai sebagai warna utama.

### Tipografi
Fraunces untuk judul dan angka besar, Instrument Sans untuk isi. Ukuran memakai skala `clamp()`. Dengan font gagal dimuat, judul jatuh ke serif sistem.

### Tata letak
- Desktop: rail kiri 248px berisi nama kelas dan sekolah, konten maksimal 1040px.
- Mading berupa kartu bento: Jadwal hari ini (besar, biru malam), Pengumuman, Tugas, lalu deretan kecil Piket, Saldo kas, Voting, Persetujuan sesuai izin.
- Ponsel: bilah bawah melayang berisi Mading, Jadwal, Tugas, Menu, Profil. Tab Menu berlabel membuka halaman berisi semua fitur lain. Konten diberi ruang agar tidak tertutup bilah.
- Target ketuk minimal 44px, fokus berupa garis biru malam 3px.

### Alur utama
Murid: Mading > Voting > pilih > Kirim suara. Bendahara: Kas > Catat kas, atau centang iuran per murid. Admin Kelas: Panel Admin > tab yang dituju.

### Notifikasi (Profil)
Satu kartu "Notifikasi" di Profil, tanpa halaman baru. Keadaan: memuat (skeleton), belum aktif (tombol Aktifkan notifikasi), aktif (daftar kategori bercentang, tiap baris minimal 44px, dengan keterangan, lalu "Matikan di perangkat ini"), diblokir browser (petunjuk), iPhone di browser (petunjuk memasang ke layar utama), tidak didukung. Bagian ini tidak tampil bila kunci VAPID kosong. Status selalu berupa teks, bukan warna saja.

### Keadaan
Setiap daftar punya skeleton saat memuat, pesan kosong, dan pesan galat dengan Coba lagi. Status voting ditulis dengan teks (Berjalan, Selesai), tidak hanya warna.

## 3. Aksesibilitas
Kontras AA, fokus terlihat 3:1, semua kontrol bisa dioperasikan keyboard, setiap kolom punya label, dialog menutup dengan Escape, tidak ada informasi yang hanya berupa warna.
