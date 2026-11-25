# Checklist uji: Tugas 3 Auth

29 skenario di bawah sudah dijalankan otomatis di browser (Chromium) memakai Supabase tiruan: lolos, stabil di 6 kali jalan. Ulangi manual di Supabase asli setelah setup dan deploy fungsi `login`.

Daftar
- [ ] Kirim form kosong: 6 pesan galat tampil, fokus pindah ke Nama lengkap.
- [ ] Kode kelas salah: galat muncul di kolom Kode kelas, bukan pesan umum.
- [ ] Nama sama dengan anggota lain di kelas yang sama: galat di kolom Nama.
- [ ] Username, email, atau WA yang sudah dipakai: galat di kolomnya masing-masing.
- [ ] Nomor `0812-3456-7890` tersimpan sebagai `6281234567890`.
- [ ] Tombol Tampilkan/Sembunyikan membuka dan menutup sandi.
- [ ] Daftar berhasil: masuk ke halaman Menunggu persetujuan.

Menunggu persetujuan
- [ ] Muat ulang halaman: tetap di Menunggu persetujuan (sesi bertahan).
- [ ] Buka `#/mading` saat masih pending: dialihkan ke Menunggu persetujuan.
- [ ] Cek status sebelum disetujui: muncul "Belum ada perubahan".
- [ ] Setelah admin menyetujui, Cek status membawa ke Mading dan menu tampil.

Masuk
- [ ] Berhasil dengan username, email (huruf besar-kecil bebas), nomor WA, dan nama lengkap.
- [ ] Sandi salah dan identitas tak dikenal memberi pesan yang sama.
- [ ] Nama lengkap yang dipakai beberapa akun: pesan menyuruh pakai username, email, atau WA.
- [ ] Sudah masuk lalu buka `#/masuk`: dialihkan ke Mading.
- [ ] Keluar dari Profil kembali ke halaman masuk; ketik langsung di form tanpa isian terhapus.

Tampilan
- [ ] Ponsel 375px dan desktop 1280px: tanpa geser horizontal, kartu di tengah, menu bawah tersembunyi di halaman auth.
- [ ] Semua kolom punya label terlihat; fokus keyboard jelas.

Catatan: karena auth sudah aktif, membuka aplikasi tanpa login kini menuju `#/masuk`, bukan `#/mading` seperti di checklist tugas 1.

Checkpoint Git: `git add . && git commit -m "tugas 3: auth"`
Pemulihan: `git reset --hard`
