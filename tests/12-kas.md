# Checklist uji: Kas kelas

Prasyarat: migrasi 003. Akun: Admin Kelas, Bendahara (role kustom dengan `kas.*`), Murid dengan `kas.akses` dan `kas.lihat`.

- [ ] Murid tanpa `kas.akses`: menu Kas tidak ada, kartu Saldo kas di Mading tidak ada.
- [ ] Bendahara mencatat pemasukan Rp50.000: saldo Rp50.000.
- [ ] Pengeluaran Rp12.000 "Spidol": saldo Rp38.000, baris tampil bertanda keluar.
- [ ] Jumlah "abc", 0, atau negatif ditolak dengan pesan. Format "12.000" diterima sebagai 12000.
- [ ] Ubah catatan oleh pemegang `kas.ubah`: saldo menyesuaikan.
- [ ] Hapus catatan oleh pemegang `kas.hapus`: saldo menyesuaikan.
- [ ] Murid dengan `kas.lihat` saja: riwayat dan saldo terlihat, tidak ada formulir.

## Iuran tetap
- [ ] Buat iuran mingguan Rp2.000. Periode berjalan memakai minggu ISO (contoh `2026-W48`).
- [ ] Centang Budi lunas: muncul pemasukan "dari iuran", saldo naik, ringkasan "1 dari N lunas".
- [ ] Hapus centang: pemasukan itu hilang, saldo kembali.
- [ ] Catatan dari iuran tidak bisa diubah langsung (lewat SQL ditolak).
- [ ] Ganti periode ke bulan sebelumnya: status lunas terpisah per periode.
- [ ] Iuran dinonaktifkan: tidak bisa mencentang (`IURAN_NONAKTIF`).
- [ ] Log kelas mencatat jumlah dan jenis.
- [ ] Ponsel 375px: tabel tidak meluber, tetap terbaca.
