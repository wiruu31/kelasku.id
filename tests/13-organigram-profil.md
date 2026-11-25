# Checklist uji: Organigram dan foto profil

## Organigram
- [ ] Hanya muncul bila `organigram.akses` diberikan ke Murid (Admin Kelas selalu melihat).
- [ ] Setiap role kustom jadi satu kartu, urut sesuai peringkat, dengan nama pemegang dan foto.
- [ ] Admin Kelas dan Murid tidak tampil sebagai kartu.
- [ ] Role tanpa pemegang tampil "Belum ada pemegang".
- [ ] Ubah role anggota di halaman Anggota, buka ulang Organigram: berubah.

## Foto profil (di Supabase asli, butuh Storage)
- [ ] Pilih foto 3 MB: terkompres otomatis, berhasil diunggah, tampil di Profil, Anggota, Organigram.
- [ ] Berkas bukan gambar (misalnya PDF) ditolak dengan pesan.
- [ ] Di Storage, ukuran berkas di bucket `avatars` tidak lebih dari 300 KB.
- [ ] Anggota kelas lain melihat fotomu. Akun dari kelas lain tidak bisa membuka URL fotonya.
- [ ] Hapus foto: kembali ke huruf awal, berkas lama terhapus dari bucket.
- [ ] Ganti foto: berkas lama terhapus.
- [ ] Admin Kelas: "Cabut foto profil" di Anggota untuk murid di bawahnya. Tidak ada tombolnya untuk sesama Admin Kelas atau diri sendiri.
- [ ] Profil menampilkan nama sekolah.
- [ ] Ponsel: tombol Pilih foto seluas 44px, tanpa gulir mendatar.
