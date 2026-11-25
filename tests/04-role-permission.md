# Checklist uji: Role dan izin (hierarki v0.3.0)

Uji otomatis: `tests/db/jalankan.sh` (141 skenario terhadap Postgres, termasuk migrasi dari v0.2.0 dan hierarki) dan `tests/e2e/kelas.mjs` (tampilan di browser dengan supabase-js tiruan). Ulangi manual di Supabase asli.

Peringkat: Main Admin (-1), Admin Kelas (0, role sistem), role kustom (1 dan seterusnya), Murid (paling bawah, role sistem).

Akses
- [ ] Murid dan pemegang role kustom: menu Peran dan Log tidak ada; `#/peran` dan `#/log` menampilkan "Kamu tidak punya akses".
- [ ] Admin Kelas: menu Anggota, Peran, Log, Kelas, Kabar Sistem muncul di rel samping desktop; di ponsel dijangkau dari Profil.

Role
- [ ] Daftar role menampilkan Admin Kelas (label Sistem, "Semua izin", "Izin terkunci") dan Murid (label Sistem) di samping role kustom.
- [ ] Buat role "Sekretaris": muncul di antara Admin Kelas dan Murid, urutan paling bawah dari role kustom.
- [ ] Nama 1 huruf ditolak; nama kembar di kelas yang sama ditolak (tanpa peka huruf besar-kecil).
- [ ] Naik dan Turun hanya menukar role kustom; tombol nonaktif pada role sistem.
- [ ] Atur role kustom: ubah nama, warna, izin, lalu Simpan menampilkan "Tersimpan."
- [ ] Atur role Murid: nama dan warna terkunci, izin boleh diubah.
- [ ] Atur role Admin Kelas: halaman menolak ("Izin role ini terkunci").
- [ ] Matriks izin per fitur (Pengumuman, Jadwal, Tugas) berisi Membuka menu, Melihat isi, Menambah, Mengubah, Menghapus. Mengubah dan Menghapus punya pilihan Milik sendiri atau Semua.
- [ ] Hapus role kustom butuh dua langkah; role sistem tidak punya tombol hapus.

Memasang role (hierarki)
- [ ] Admin Kelas bisa memasang role kustom ke murid mana pun yang peringkatnya di bawahnya.
- [ ] Admin Kelas tidak bisa memasang atau mencabut role pada sesama Admin Kelas.
- [ ] Pemegang izin Memberi role ke murid di bawahnya: hanya bisa memasang role di bawah peringkatnya ke anggota di bawah peringkatnya. Tidak bisa membuat, mengubah, atau menghapus role.
- [ ] Murid tidak muncul sebagai lencana di daftar anggota.
- [ ] Lewat API langsung: memasang role di atas peringkat sendiri, atau menaikkan diri, ditolak (42501).
- [ ] Admin Kelas diangkat dan dicabut hanya lewat Konsol; di aplikasi Kelas tidak ada tombolnya.

Lain-lain
- [ ] Role tidak ada (`#/peran/ngawur`): pesan "Role tidak ditemukan".
- [ ] Setiap perubahan role tercatat di log kelas.
- [ ] Ponsel 375px: Peran, Anggota, Profil tanpa geser horizontal.

Checkpoint Git: `git add . && git commit -m "role dan izin hierarki"`
Pemulihan: `git reset --hard`
