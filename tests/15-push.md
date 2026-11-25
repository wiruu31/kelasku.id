# Checklist uji: Notifikasi push (di Supabase dan perangkat asli)

Prasyarat: migrasi 004 sudah dijalankan, VAPID diisi, `send-push` ter-deploy, `push_settings` terisi, pg_cron dan pg_net aktif (lihat `docs/SUPABASE_SETUP.md`, bagian Notifikasi push). Aplikasi dibuka lewat HTTPS. Siapkan dua akun di satu kelas: Admin Kelas dan Murid, masing-masing di perangkat sendiri.

## Langganan
- [ ] Profil memuat bagian Notifikasi dengan tombol "Aktifkan notifikasi". Bila `VAPID_PUBLIC_KEY` kosong, bagian ini tidak tampil sama sekali.
- [ ] Ketuk Aktifkan: browser meminta izin, lalu daftar kategori muncul, semuanya tercentang.
- [ ] Di tabel `push_subscriptions` ada satu baris untuk akun itu.
- [ ] Murid tidak melihat kategori "Pendaftar baru". Admin Kelas melihatnya.
- [ ] Matikan satu kategori, muat ulang Profil: tetap mati. Baris ada di `push_prefs`.
- [ ] "Matikan di perangkat ini": baris langganan hilang, tombol Aktifkan kembali.
- [ ] Izin diblokir di pengaturan browser: muncul petunjuk, tanpa tombol aktifkan.
- [ ] iPhone: di Safari biasa muncul petunjuk memasang ke layar utama. Dari ikon layar utama, tombol aktifkan bekerja.
- [ ] Keluar dari akun: baris langganan perangkat itu hilang. Masuk dengan akun lain di perangkat yang sama lalu aktifkan: langganan tercatat atas akun baru.

## Pengiriman langsung (maksimal sekitar satu menit setelah kejadian)
- [ ] Admin Kelas menulis pengumuman: Murid menerima "Pengumuman baru" dengan judul asli. Admin tidak menerima notifikasi untuk pengumumannya sendiri.
- [ ] Tambah tugas bermapel: Murid menerima "Tugas baru" berisi "Mapel: judul".
- [ ] Buat voting: yang berizin `voting.lihat` menerima, yang belum diberi izin tidak.
- [ ] Murid kedua mematikan "Tugas baru", tambah tugas lagi: ia tidak menerima.
- [ ] Main Admin mengirim Siaran Sistem ke kelas itu: anggota menerima. Siaran ke kelas lain tidak sampai.
- [ ] Murid baru mendaftar dengan kode kelas: Admin Kelas menerima "Pendaftar baru".
- [ ] Ketuk notifikasi saat aplikasi tertutup: aplikasi terbuka di halaman tujuan (Pengumuman, Tugas, Voting, Persetujuan).
- [ ] Ketuk notifikasi saat aplikasi terbuka di halaman lain: jendela yang sama pindah ke tujuan.

## Pengingat terjadwal
- [ ] Jalankan `select public.push_enqueue_piket();` saat ada murid piket hari ini: murid itu menerima "Piket hari ini". Jalankan lagi: tidak dobel.
- [ ] Buat tugas bertenggat besok lalu `select public.push_enqueue_deadlines();`: penerima "Tenggat besok". Jalankan lagi: tidak dobel.
- [ ] `select jobname, schedule from cron.job;` memuat empat pekerjaan kelasku (piket 30 23, tenggat 0 9, kirim tiap menit, bersih).

## Ketahanan
- [ ] Hapus langganan di pengaturan browser, lalu kirim pengumuman: baris langganan hilang otomatis (HTTP 404 atau 410), antrean tetap selesai.
- [ ] `select * from push_outbox where sent_at is null;` kosong setelah beberapa menit.
- [ ] Panggil fungsi tanpa header rahasia (`curl -X POST` ke URL function): ditolak 401.
- [ ] Murid tidak bisa membaca `push_outbox` maupun `push_settings` (galat permission denied).
- [ ] Menyimpan pengumuman tetap berhasil walau pg_net mati (antrean menumpuk, tidak ada galat di aplikasi).
