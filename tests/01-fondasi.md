# Checklist uji: Tugas 1 Fondasi

Jalankan server statis dari folder proyek: `python3 -m http.server 8080`, buka `http://localhost:8080/kelasku.html`.

- [ ] Halaman terbuka tanpa error di konsol.
- [ ] Skeleton tampil sekejap saat pindah halaman, lalu diganti isi halaman.
- [ ] Lima menu bisa diklik dan halaman berganti; menu aktif punya penanda.
- [ ] Alamat tanpa hash (`kelasku.html`) otomatis menuju `#/mading`.
- [ ] Alamat ngawur (`#/asal`) dialihkan ke `#/mading`.
- [ ] Sebelum config diisi, muncul panel "Database belum tersambung".
- [ ] Ponsel (375px): menu di bawah, tidak ada geser horizontal.
- [ ] Desktop (1280px): menu jadi rel samping kiri, isi tidak tertimpa.
- [ ] Tab keyboard: tautan lompat muncul, fokus terlihat jelas di semua menu.
- [ ] Matikan jaringan di DevTools: bar "Kamu offline" muncul; nyalakan lagi, bar hilang.
- [ ] Aktifkan "reduce motion" di OS: animasi skeleton berhenti.

Checkpoint Git setelah lolos:
`git add . && git commit -m "tugas 1: fondasi"`
Kalau ada yang rusak: `git reset --hard` (kembali ke commit terakhir).
