# Checklist uji tugas 7: PWA dan tombol install

Otomatis: `node tests/check-precache.mjs` (daftar cache lengkap). Jalankan setiap menambah berkas css, js, atau ikon baru, dan naikkan `VERSION` di `kelasku-sw.js` setiap rilis.

PWA hanya jalan lewat `https://` (GitHub Pages) atau `http://localhost`, tidak lewat membuka file langsung.

## Android (Chrome)
- [ ] Buka situs, masuk. Di Mading muncul banner "Pasang di ponselmu" dengan tombol Pasang aplikasi.
- [ ] Ketuk Pasang aplikasi: dialog bawaan Chrome muncul. Setelah dipasang, ikon Kelasku ada di layar utama.
- [ ] Buka dari ikon: tampil tanpa bilah alamat, langsung ke Mading.
- [ ] Di aplikasi terpasang, banner dan kartu pasang di Profil tidak tampil lagi.
- [ ] Batalkan dialog: muncul pesan "Pemasangan dibatalkan", tombol bisa dicoba lagi setelah muat ulang.
- [ ] "Nanti saja" menutup banner dan tetap tertutup setelah muat ulang. Kartu di Profil tetap ada.

## iPhone (Safari)
- [ ] Banner dan kartu Profil menampilkan tiga langkah: Bagikan, Tambah ke Layar Utama, Tambah.
- [ ] Setelah ditambahkan, buka dari layar utama: ikon benar dan tanpa bilah Safari.

## Offline
- [ ] Buka aplikasi sekali saat online. Matikan internet, buka lagi: kerangka aplikasi tetap tampil dengan bilah "Kamu offline".
- [ ] Offline, buka Jadwal atau Tugas: muncul pesan galat berbahasa Indonesia dengan tombol Coba lagi, bukan layar kosong.
- [ ] Nyalakan internet, ketuk Coba lagi: data muncul.
- [ ] Data kelas tidak pernah tersimpan di cache (hanya berkas aplikasi).

## Pembaruan
- [ ] Setelah rilis baru (VERSION dinaikkan), muat ulang dua kali: tampilan versi baru muncul dan cache lama terhapus.

## Git checkpoint
Simpan: `git add . && git commit -m "tugas 7: pwa dan tombol install"`
Pulihkan bila rusak: `git reset --hard`
