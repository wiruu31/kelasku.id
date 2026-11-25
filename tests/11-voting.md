# Checklist uji: Voting

Prasyarat: migrasi 003. Akun: Admin Kelas, pemegang `voting.tambah`, dua Murid dengan `voting.akses` dan `voting.lihat`.

## Membuat
- [ ] Murid tanpa `voting.tambah`: tidak ada tombol Buat voting.
- [ ] Judul 1 karakter ditolak ("Judul 2 sampai 120 karakter"). Satu pilihan ditolak ("Isi minimal 2 pilihan").
- [ ] Pilihan kembar ditolak. Tombol Tambah pilihan berhenti di 10.
- [ ] Tenggat yang sudah lewat ditolak.
- [ ] Voting dengan tiga pilihan dan tenggat besok berhasil dibuat.

## Mode Terlihat
- [ ] Murid memilih, hitungan dan nama pemilih langsung tampil di bawah pilihan.
- [ ] Murid mengganti suara sebelum selesai: hitungan berpindah.

## Mode Anonim, hasil di akhir
- [ ] Setelah memilih: pesan "Suaramu tercatat", tombol menjadi nonaktif, tidak bisa diganti.
- [ ] Selama berjalan: angka dan nama disembunyikan untuk semua orang, termasuk pembuat.
- [ ] Setelah ditutup: angka tampil, nama tetap tidak ada.

## Mode Anonim, hasil langsung
- [ ] Angka naik setelah tiap suara, nama tidak pernah tampil.

## Penutupan
- [ ] Tutup manual meminta konfirmasi, status menjadi Selesai, tombol Kirim suara hilang.
- [ ] Voting lewat tenggat otomatis berstatus Selesai.
- [ ] Mengirim suara ke voting selesai lewat SQL ditolak (`VOTING_SELESAI`).
- [ ] Hapus voting oleh pemegang `voting.hapus`: hilang beserta suaranya.

## Privasi (di Supabase asli)
- [ ] `select * from poll_votes` oleh akun Admin Kelas hanya mengembalikan suaranya sendiri.
- [ ] Kartu "Voting" di Mading menghitung voting berjalan yang belum kamu pilih.
- [ ] Ponsel 375px: tanpa gulir mendatar, pilihan mudah diketuk.
