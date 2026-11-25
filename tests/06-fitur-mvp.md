# Checklist uji tugas 6: Mading, pengumuman, jadwal, tugas, log, profil

Prasyarat: `supabase/schema.sql` terbaru sudah dijalankan ulang di Supabase. Siapkan tiga akun aktif: admin, anggota biasa, dan pemegang role dengan izin tulis (mis. Sekretaris).

## Pengumuman
- [ ] Anggota biasa: daftar tampil, tidak ada tombol "Tulis pengumuman", Ubah, Hapus.
- [ ] Admin: kirim formulir kosong, muncul pesan galat di judul dan isi.
- [ ] Tulis pengumuman dengan isi dua baris dan teks `<b>`: baris baru terjaga, tag tampil sebagai teks.
- [ ] Centang "Sematkan": catatan pindah ke paling atas dengan penanda Disematkan.
- [ ] Role dengan izin ubah/hapus "milik": hanya catatannya sendiri punya Ubah dan Hapus.
- [ ] Ubah lalu Batal: tampilan kembali seperti semula. Ubah lalu Simpan: judul berubah.
- [ ] Hapus: muncul konfirmasi, "Ya, hapus" menghilangkan catatan.

## Jadwal
- [ ] Kosong: empty state. Tambah jadwal beberapa hari: dikelompokkan Senin sampai Minggu, urut jam.
- [ ] Hari ini diberi penanda. Jam tampil tanpa detik (07:00).
- [ ] Jam selesai sebelum jam mulai ditolak dengan pesan.

## Tugas
- [ ] Urutan: tenggat terdekat dulu, tanpa tenggat di akhir.
- [ ] Lencana Terlewat, Hari ini, Besok sesuai tenggat (zona WIB).
- [ ] Ubah tugas: kolom tenggat menampilkan jam yang sama dengan yang dimasukkan. Kosongkan tenggat lalu simpan.

## Mading
- [ ] Kartu: jadwal hari ini, pengumuman (tersemat dulu), tugas mendatang (yang terlewat tidak tampil).
- [ ] Kartu "Perlu persetujuan" hanya untuk pemegang izin menyetujui akun, jumlahnya sama dengan antrean.
- [ ] Matikan internet lalu muat ulang: pesan offline tampil, tidak ada layar kosong.

## Log aktivitas
- [ ] Hanya Admin Kelas: menu Log dan tautan di Profil muncul. Yang lain melihat "Kamu tidak punya akses".
- [ ] Kalimat terbaca ("Budi membuat pengumuman ..."). "Muat lebih banyak" menyambung tanpa duplikat.

## Profil
- [ ] Isi nomor absen dan NIS, simpan: nilai langsung tampil di daftar data.
- [ ] Nomor absen lebih dari 20 karakter ditolak dengan pesan.

## Umum
- [ ] Ponsel 375px: tidak ada geser horizontal, tombol minimal 44px, label menu bawah tidak terpotong.
- [ ] Tab dan fokus terlihat di semua formulir. Dengan "kurangi gerak" aktif tidak ada animasi.

## Git checkpoint
Simpan: `git add . && git commit -m "tugas 6: fitur mvp"`
Pulihkan bila rusak: `git reset --hard`
