# Checklist uji tutorial awal

Prasyarat: `supabase/schema.sql` terbaru dijalankan ulang (menambah `profiles.tour_done_at`). Untuk mengulang uji sebagai akun yang sama, di SQL Editor: `update profiles set tour_done_at = null where username = 'nama_akun';`

## Siswa (tanpa izin khusus)
- [ ] Setelah disetujui dan masuk Mading, tur muncul sendiri dengan latar meredup.
- [ ] Langkah: Mading, Kabar, Jadwal, Tugas, Profil, Pasang aplikasi (yang terakhir hilang bila sudah terpasang).
- [ ] Kartu tidak menutupi menu yang disorot, baik di ponsel (bilah bawah) maupun desktop (rel samping).
- [ ] Kembali tidak ada di langkah pertama. Tombol Lanjut berubah jadi Selesai di langkah terakhir.
- [ ] Tab hanya berputar di dalam kartu. Esc menutup tur dan fokus kembali ke elemen sebelumnya.
- [ ] Setelah Selesai atau Lewati, muat ulang dan masuk dari perangkat lain: tur tidak muncul lagi.

## Peran lain
- [ ] Pemegang izin tulis: ada langkah "Menulis dan menambah" yang menyebut hal yang boleh ia lakukan saja.
- [ ] Admin desktop: langkah Persetujuan akun, Peran, Anggota, Log aktivitas, Kelas.
- [ ] Admin ponsel: satu langkah "Menu pengelolaan" menunjuk Profil, bukan langkah rel samping.
- [ ] Admin Kelas: ada langkah Kabar Sistem. Main Admin tidak memakai aplikasi ini (ia memakai Konsol).
- [ ] Anggota yang masih menunggu persetujuan tidak melihat tur.

## Ulang dan ketahanan
- [ ] Profil > Ulangi tutorial memutar tur lagi tanpa mengubah status selesai.
- [ ] Putar layar atau ubah ukuran jendela di tengah tur: kartu pindah dan tetap di dalam layar.
- [ ] Matikan internet saat menyelesaikan tur: tidak ada pesan galat ke pengguna, tur tertutup normal.
- [ ] Mode "kurangi gerak" aktif: kartu berpindah tanpa animasi.

## Git checkpoint
Simpan: `git add . && git commit -m "tutorial awal"`
Pulihkan bila rusak: `git reset --hard`
