# Checklist uji: Tugas 2 Database

Semua skenario di bawah sudah dijalankan otomatis terhadap Postgres 16 dengan stub `auth` Supabase (hasil: lolos). Ulangi di Supabase asli setelah setup:

- [ ] `schema.sql` jalan sampai selesai, dan jalan lagi tanpa error saat diulang.
- [ ] Kelas baru otomatis punya kode 8 karakter tanpa O, 0, I, 1.
- [ ] Daftar dengan kode huruf kecil berhasil (kode tidak peka huruf besar-kecil).
- [ ] Nomor WA `+62 812-...`, `0812...`, `812...` semuanya tersimpan sebagai `62812...`.
- [ ] Kode kelas salah ditolak (`KODE_KELAS_TIDAK_VALID`).
- [ ] Nama lengkap sama di kelas yang sama ditolak; di kelas berbeda diterima.
- [ ] Username dan nomor WA kembar ditolak lintas kelas.
- [ ] Kelas nonaktif menolak pendaftaran baru.
- [ ] Akun pending tidak bisa melihat anggota atau isi kelas.
- [ ] Akun pending tidak bisa menyetujui dirinya sendiri.
- [ ] Siswa tanpa role tidak bisa membuat pengumuman, jadwal, atau tugas.
- [ ] Role dengan `pengumuman.tambah` + `pengumuman.ubah (milik)`: bisa tambah, bisa ubah miliknya, tidak bisa hapus.
- [ ] Hanya Main Admin yang bisa membuat kelas, mengarsipkan kelas atau sekolah, menghapus permanen, dan mengangkat atau mencabut Admin Kelas.
- [ ] Admin melebihi batas kelas (`classes.max_admins`, atau bawaan sistem 3) ditolak (`BATAS_ADMIN`).
- [ ] Pemegang role tidak bisa memberi izin yang tidak ia miliki.
- [ ] Admin kelas A tidak melihat anggota atau kontak kelas B.
- [ ] Kode kelas: format salah dan duplikat ditolak; siswa biasa ditolak.
- [ ] Log kelas hanya terlihat oleh Admin Kelas dan Main Admin. Log sistem (`scope = sistem`) hanya dibaca Main Admin.
- [ ] Role Admin Kelas dan Murid bersifat sistem: tidak bisa dibuat, diganti nama, atau dihapus lewat API. Izin Admin Kelas terkunci.

Checkpoint Git: `git add . && git commit -m "tugas 2: database"`
Pemulihan: `git reset --hard`
