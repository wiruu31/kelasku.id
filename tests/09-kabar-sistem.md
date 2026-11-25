# Checklist uji: Kabar Sistem (aplikasi Kelas)

Uji otomatis: `node tests/e2e/kelas.mjs`. Ulangi manual di Supabase asli bersama Konsol.

- [ ] Kirim siaran "ke semua" dari Konsol: Admin Kelas di semua kelas menerima; Murid tidak melihat menu maupun isinya.
- [ ] Siaran "satu sekolah": hanya Admin Kelas di sekolah itu yang menerima.
- [ ] Siaran "satu kelas": hanya Admin Kelas kelas itu.
- [ ] Menu Kabar Sistem hanya muncul untuk Admin Kelas; Murid yang membuka `#/sistem` melihat "Kamu tidak punya akses".
- [ ] Siaran yang belum dibaca bertanda Baru; setelah dibuka, penanda hilang di kunjungan berikutnya dan jumlah pembaca di Konsol bertambah.
- [ ] Lewat API: Murid tidak bisa membaca `system_announcements` maupun menulis `system_announcement_reads`.
- [ ] Hapus siaran di Konsol: hilang dari semua Admin Kelas.
- [ ] Ponsel 375px tanpa geser horizontal.

Checkpoint Git: `git add . && git commit -m "kabar sistem"`
Pemulihan: `git reset --hard`
