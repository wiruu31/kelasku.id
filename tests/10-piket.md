# Checklist uji: Piket

Prasyarat: migrasi 003 sudah dijalankan. Siapkan tiga akun aktif: Admin Kelas, pemegang role dengan izin `piket.*`, dan Murid biasa (izin piket belum diberikan).

- [ ] Murid biasa: menu Piket tidak ada di rail maupun halaman Menu. Membuka `#/piket` langsung menampilkan pesan tidak punya akses.
- [ ] Admin Kelas: aktifkan `piket.akses` dan `piket.lihat` untuk Murid. Murid kini melihat tujuh hari, tanpa tombol Tambah atau Cabut.
- [ ] Admin Kelas: pilih murid di hari Selasa lalu Tambah. Nama muncul sebagai chip di Selasa.
- [ ] Murid yang sama ditambahkan ke Kamis: boleh, muncul di dua hari.
- [ ] Murid yang sama ditambahkan dua kali di hari yang sama: murid itu hilang dari pilihan hari tersebut. Lewat SQL (`insert` ganda), database menolak.
- [ ] Cabut dari satu hari: chip hilang, hari lain tidak berubah.
- [ ] Kartu "Piket hari ini" di Mading menampilkan nama sesuai hari WIB.
- [ ] Pemegang `piket.tambah` tanpa `piket.hapus`: bisa menambah, tidak melihat tombol Cabut.
- [ ] Log kelas mencatat tambah dan cabut piket dengan nama murid dan hari.
- [ ] Murid yang dikeluarkan dari kelas hilang dari piket (cek ulang halaman).
- [ ] Muat ulang: kerangka loading (skeleton) tampil sebelum data.
- [ ] Ponsel 375px: tidak ada gulir mendatar, tombol Cabut seluas 44px.
