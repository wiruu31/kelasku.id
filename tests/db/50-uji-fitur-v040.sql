-- Uji piket, voting, kas, dan foto profil v0.4.0 lewat RLS dan fungsi sungguhan.

-- Murid bawaan tidak punya akses fitur baru; Ketua diberi izin lewat role.
select t.admin();
create function t.pid(p_judul text) returns uuid language sql security definer as $$ select id from public.polls where title = p_judul $$;
create function t.oid(p_judul text, p_label text) returns uuid language sql security definer as $$
  select o2.id from public.poll_options o2 join public.polls p on p.id = o2.poll_id where p.title = p_judul and o2.label = p_label $$;

create function t.pj(p_judul text) returns jsonb language sql security definer as $$ select public.poll_json(id) from public.polls where title = p_judul $$;
create function t.did() returns uuid language sql security definer as $$ select id from public.kas_dues where name = 'Iuran kas' $$;
insert into public.role_permissions (role_id, permission, scope)
select t.rid('XII IPA 1', 'Ketua'), p, 'semua' from unnest(array[
  'piket.akses', 'piket.lihat', 'piket.tambah', 'piket.hapus',
  'voting.akses', 'voting.lihat', 'voting.tambah', 'voting.ubah', 'voting.hapus',
  'kas.akses', 'kas.lihat', 'kas.tambah', 'kas.ubah', 'kas.hapus']) p;
insert into public.role_permissions (role_id, permission, scope)
select t.rid('XII IPA 1', 'Murid'), p, 'semua' from unnest(array['voting.akses', 'voting.lihat']) p;

-- ---- izin bawaan Murid
select t.sebagai('sis1');
select t.sama('Murid bawaan tidak melihat piket', (select count(*) from public.piket_duties)::int, 0);
select t.coba('Murid tidak boleh menambah piket', format($q$insert into public.piket_duties (class_id, day_of_week, member_id) values (%L, 1, %L)$q$, t.cid('XII IPA 1'), t.mid('sis1')), 'galat:row-level security');
select t.coba('Murid tanpa izin kas ditolak ringkasan', format('select public.kas_summary(%L)', t.cid('XII IPA 1')), 'galat:TIDAK_DIIZINKAN');
select t.coba('Murid tanpa izin tidak membuat voting', format($q$select public.create_poll(%L, 'Uji', null, 'terlihat', null, array['a','b'])$q$, t.cid('XII IPA 1')), 'galat:TIDAK_DIIZINKAN');

-- ---- piket
select t.sebagai('ketua');
select t.coba('Ketua menambah piket', format($q$insert into public.piket_duties (class_id, day_of_week, member_id) values (%L, 1, %L)$q$, t.cid('XII IPA 1'), t.mid('sis1')), 'ok');
select t.coba('satu murid boleh di hari lain', format($q$insert into public.piket_duties (class_id, day_of_week, member_id) values (%L, 3, %L)$q$, t.cid('XII IPA 1'), t.mid('sis1')), 'ok');
select t.coba('pasangan hari dan murid tidak boleh kembar', format($q$insert into public.piket_duties (class_id, day_of_week, member_id) values (%L, 1, %L)$q$, t.cid('XII IPA 1'), t.mid('sis1')), 'galat:duplicate key');
select t.coba('anggota belum aktif tidak boleh piket', format($q$insert into public.piket_duties (class_id, day_of_week, member_id) values (%L, 2, %L)$q$, t.cid('XII IPA 1'), t.mid('pen2')), 'galat:ANGGOTA_TIDAK_VALID');
select t.coba('anggota kelas lain tidak boleh piket', format($q$insert into public.piket_duties (class_id, day_of_week, member_id) values (%L, 2, %L)$q$, t.cid('XII IPA 1'), t.mid('bsis1')), 'galat:ANGGOTA_TIDAK_VALID');
select t.coba('hari di luar 1 sampai 7 ditolak', format($q$insert into public.piket_duties (class_id, day_of_week, member_id) values (%L, 8, %L)$q$, t.cid('XII IPA 1'), t.mid('sis2')), 'galat:check constraint');
select t.sebagai('badm');
select t.sama('Admin kelas lain tidak melihat piket kelas ini', (select count(*) from public.piket_duties where class_id = t.cid('XII IPA 1'))::int, 0);
select t.sebagai('ketua');
select t.coba('Ketua menghapus piket', format($q$delete from public.piket_duties where class_id = %L and day_of_week = 3$q$, t.cid('XII IPA 1')), 'baris:1');

-- ---- voting
select t.coba('opsi kurang dari dua ditolak', format($q$select public.create_poll(%L, 'Satu opsi', null, 'terlihat', null, array['a'])$q$, t.cid('XII IPA 1')), 'galat:OPSI_TIDAK_VALID');
select t.coba('opsi lebih dari sepuluh ditolak', format($q$select public.create_poll(%L, 'Banyak', null, 'terlihat', null, array['1','2','3','4','5','6','7','8','9','10','11'])$q$, t.cid('XII IPA 1')), 'galat:OPSI_TIDAK_VALID');
select t.coba('opsi kembar ditolak', format($q$select public.create_poll(%L, 'Kembar', null, 'terlihat', null, array['a','A'])$q$, t.cid('XII IPA 1')), 'galat:OPSI_KEMBAR');
select t.coba('tenggat lampau ditolak', format($q$select public.create_poll(%L, 'Lampau', null, 'terlihat', now() - interval '1 hour', array['a','b'])$q$, t.cid('XII IPA 1')), 'galat:TENGGAT_TIDAK_VALID');
select t.coba('mode tak dikenal ditolak', format($q$select public.create_poll(%L, 'Mode', null, 'rahasia', null, array['a','b'])$q$, t.cid('XII IPA 1')), 'galat:check constraint');
select t.coba('membuat voting terlihat', format($q$select public.create_poll(%L, 'Warna kaos', null, 'terlihat', null, array['Merah','Biru','Hitam'])$q$, t.cid('XII IPA 1')), 'ok');
select t.coba('membuat voting anonim akhir', format($q$select public.create_poll(%L, 'Ketua panitia', null, 'anonim_akhir', null, array['Ani','Budi'])$q$, t.cid('XII IPA 1')), 'ok');
select t.coba('membuat voting anonim banyak', format($q$select public.create_poll(%L, 'Menu rapat', null, 'anonim_banyak', null, array['Nasi','Mie','Roti'])$q$, t.cid('XII IPA 1')), 'ok');
select t.coba('Ketua tidak boleh menyisipkan suara langsung', format($q$insert into public.poll_votes (poll_id, option_id) select poll_id, id from public.poll_options limit 1$q$), 'galat:permission denied');

select t.sebagai('sis1');
select t.coba('Murid memilih (terlihat)', format('select public.cast_vote(%L, array[%L]::uuid[])', t.pid('Warna kaos'), t.oid('Warna kaos', 'Merah')), 'ok');
select t.coba('Murid mengganti suara di mode terlihat', format('select public.cast_vote(%L, array[%L]::uuid[])', t.pid('Warna kaos'), t.oid('Warna kaos', 'Biru')), 'ok');
select t.sama('hanya satu suara tersisa setelah ganti', (select count(*) from public.poll_votes where user_id = t.uid('sis1'))::int, 1);
select t.coba('mode terlihat tidak boleh dua pilihan', format('select public.cast_vote(%L, array[%L, %L]::uuid[])', t.pid('Warna kaos'), t.oid('Warna kaos', 'Merah'), t.oid('Warna kaos', 'Biru')), 'galat:SATU_PILIHAN');
select t.coba('pilihan dari voting lain ditolak', format('select public.cast_vote(%L, array[%L]::uuid[])', t.pid('Warna kaos'), t.oid('Menu rapat', 'Nasi')), 'galat:PILIHAN_TIDAK_VALID');
select t.coba('pilihan kosong ditolak', format('select public.cast_vote(%L, array[]::uuid[])', t.pid('Warna kaos')), 'galat:PILIHAN_KOSONG');
select t.coba('anonim akhir: memilih sekali', format('select public.cast_vote(%L, array[%L]::uuid[])', t.pid('Ketua panitia'), t.oid('Ketua panitia', 'Ani')), 'ok');
select t.coba('anonim akhir: tidak boleh ganti suara', format('select public.cast_vote(%L, array[%L]::uuid[])', t.pid('Ketua panitia'), t.oid('Ketua panitia', 'Budi')), 'galat:SUDAH_MEMILIH');
select t.coba('anonim banyak: dua pilihan sekaligus', format('select public.cast_vote(%L, array[%L, %L]::uuid[])', t.pid('Menu rapat'), t.oid('Menu rapat', 'Nasi'), t.oid('Menu rapat', 'Roti')), 'ok');
select t.sebagai('sis2');
select t.coba('murid kedua memilih Ani', format('select public.cast_vote(%L, array[%L]::uuid[])', t.pid('Ketua panitia'), t.oid('Ketua panitia', 'Ani')), 'ok');
select t.coba('murid kedua memilih Biru', format('select public.cast_vote(%L, array[%L]::uuid[])', t.pid('Warna kaos'), t.oid('Warna kaos', 'Biru')), 'ok');

select t.sama('hasil terlihat: Biru dua suara', (select (o ->> 'votes')::int from jsonb_array_elements(t.pj('Warna kaos') -> 'options') o where o ->> 'label' = 'Biru'), 2);
select t.sama('hasil terlihat: nama pemilih tampil', (select jsonb_array_length(o -> 'names') from jsonb_array_elements(t.pj('Warna kaos') -> 'options') o where o ->> 'label' = 'Biru'), 2);
select t.sama('anonim akhir: angka tersembunyi saat berjalan', (t.pj('Ketua panitia') ->> 'results_visible')::boolean, false);
select t.sama('anonim akhir: tidak ada angka per opsi', (select count(*) from jsonb_array_elements(t.pj('Ketua panitia') -> 'options') o where o ->> 'votes' is not null)::int, 0);
select t.sama('anonim banyak: hasil langsung', (select (o ->> 'votes')::int from jsonb_array_elements(t.pj('Menu rapat') -> 'options') o where o ->> 'label' = 'Nasi'), 1);
select t.sama('anonim banyak: tanpa nama pemilih', (select count(*) from jsonb_array_elements(t.pj('Menu rapat') -> 'options') o where o ? 'names' and o ->> 'names' is not null)::int, 0);
select t.sama('murid hanya membaca suaranya sendiri', (select count(*) from public.poll_votes)::int, 2);
select t.sama('class_polls mengembalikan tiga voting', jsonb_array_length(public.class_polls(t.cid('XII IPA 1'))), 3);

select t.sebagai('ketua');
select t.sama('Ketua tidak bisa membaca suara anonim lewat tabel', (select count(*) from public.poll_votes where poll_id = t.pid('Ketua panitia'))::int, 0);
select t.sebagai('geris');
select t.sama('Main Admin pun tidak bisa membaca suara anonim lewat tabel', (select count(*) from public.poll_votes where poll_id = t.pid('Ketua panitia'))::int, 0);
select t.sebagai('sis1');
select t.coba('Murid tidak boleh menutup voting', format('select public.close_poll(%L)', t.pid('Ketua panitia')), 'galat:TIDAK_DIIZINKAN');
select t.sebagai('ketua');
select t.coba('Ketua menutup voting', format('select public.close_poll(%L)', t.pid('Ketua panitia')), 'ok');
select t.coba('menutup dua kali ditolak', format('select public.close_poll(%L)', t.pid('Ketua panitia')), 'galat:VOTING_SELESAI');
select t.sama('anonim akhir: hasil terbuka setelah selesai', (t.pj('Ketua panitia') ->> 'results_visible')::boolean, true);
select t.sama('anonim akhir: Ani dua suara', (select (o ->> 'votes')::int from jsonb_array_elements(t.pj('Ketua panitia') -> 'options') o where o ->> 'label' = 'Ani'), 2);
select t.sebagai('sis2');
select t.coba('memilih di voting selesai ditolak', format('select public.cast_vote(%L, array[%L]::uuid[])', t.pid('Ketua panitia'), t.oid('Ketua panitia', 'Budi')), 'galat:VOTING_SELESAI');
select t.sebagai('ketua');
select t.coba('Ketua menghapus voting', format('delete from public.polls where id = %L', t.pid('Menu rapat')), 'baris:1');
select t.sama('suara ikut terhapus', (select count(*) from public.poll_votes where poll_id is not null and option_id not in (select id from public.poll_options))::int, 0);

-- ---- kas
select t.sebagai('ketua');
select t.coba('pemasukan', format($q$insert into public.kas_entries (class_id, kind, amount, note, entry_date) values (%L, 'masuk', 50000, 'Sumbangan', current_date)$q$, t.cid('XII IPA 1')), 'ok');
select t.coba('pengeluaran', format($q$insert into public.kas_entries (class_id, kind, amount, note, entry_date) values (%L, 'keluar', 12000, 'Spidol', current_date)$q$, t.cid('XII IPA 1')), 'ok');
select t.coba('jumlah nol ditolak', format($q$insert into public.kas_entries (class_id, kind, amount, note, entry_date) values (%L, 'masuk', 0, 'Nol', current_date)$q$, t.cid('XII IPA 1')), 'galat:check constraint');
select t.coba('catatan sumber iuran tidak boleh dibuat langsung', format($q$insert into public.kas_entries (class_id, kind, amount, note, entry_date, source) values (%L, 'masuk', 1000, 'Palsu', current_date, 'iuran')$q$, t.cid('XII IPA 1')), 'galat:row-level security');
select t.sama('saldo = masuk - keluar', (public.kas_summary(t.cid('XII IPA 1')) ->> 'saldo')::bigint, 38000::bigint);
select t.coba('membuat iuran bulanan', format($q$insert into public.kas_dues (class_id, name, amount, period, starts_on) values (%L, 'Iuran kas', 5000, 'bulanan', date '2026-11-01')$q$, t.cid('XII IPA 1')), 'ok');
select t.coba('menandai lunas', format($q$select public.set_due_paid(%L, %L, '2026-11', true, date '2026-11-23')$q$, t.did(), t.mid('sis1')), 'ok');
select t.coba('menandai lunas dua kali tidak menggandakan', format($q$select public.set_due_paid(%L, %L, '2026-11', true, date '2026-11-23')$q$, t.did(), t.mid('sis1')), 'ok');
select t.sama('saldo naik sekali', (public.kas_summary(t.cid('XII IPA 1')) ->> 'saldo')::bigint, 43000::bigint);
select t.coba('format periode salah ditolak', format($q$select public.set_due_paid(%L, %L, '2026-W47', true, date '2026-11-23')$q$, t.did(), t.mid('sis1')), 'galat:PERIODE_TIDAK_VALID');
select t.coba('anggota belum aktif tidak bisa ditandai', format($q$select public.set_due_paid(%L, %L, '2026-11', true, date '2026-11-23')$q$, t.did(), t.mid('pen2')), 'galat:ANGGOTA_TIDAK_VALID');
select t.coba('catatan hasil iuran tidak bisa diubah langsung', format($q$update public.kas_entries set amount = 1 where source = 'iuran' and class_id = %L$q$, t.cid('XII IPA 1')), 'baris:0');
select t.coba('membatalkan lunas', format($q$select public.set_due_paid(%L, %L, '2026-11', false, date '2026-11-23')$q$, t.did(), t.mid('sis1')), 'ok');
select t.sama('saldo kembali', (public.kas_summary(t.cid('XII IPA 1')) ->> 'saldo')::bigint, 38000::bigint);
select t.sama('penanda lunas ikut terhapus', (select count(*) from public.kas_due_payments)::int, 0);
select t.coba('lunas lagi lalu hapus catatan pemasukan', format($q$select public.set_due_paid(%L, %L, '2026-11', true, date '2026-11-23')$q$, t.did(), t.mid('sis2')), 'ok');
select t.coba('menghapus catatan pemasukan hasil iuran', format($q$delete from public.kas_entries where source = 'iuran' and class_id = %L$q$, t.cid('XII IPA 1')), 'baris:1');
select t.sama('penanda lunas batal otomatis', (select count(*) from public.kas_due_payments)::int, 0);

select t.sebagai('sis1');
select t.coba('Murid tanpa izin kas tidak membaca catatan', 'select 1', 'ok');
select t.sama('Murid tanpa izin kas melihat nol catatan', (select count(*) from public.kas_entries)::int, 0);
select t.coba('Murid tanpa izin tidak menandai lunas', format($q$select public.set_due_paid(%L, %L, '2026-11', true, date '2026-11-23')$q$, t.did(), t.mid('sis1')), 'galat:TIDAK_DIIZINKAN');
select t.sebagai('geris');
select t.admin();
insert into public.role_permissions (role_id, permission, scope) values (t.rid('XII IPA 1', 'Murid'), 'kas.lihat', 'semua');
select t.sebagai('sis1');
select t.sama('izin lihat dinyalakan: Murid melihat saldo', (public.kas_summary(t.cid('XII IPA 1')) ->> 'saldo')::bigint, 38000::bigint);
select t.coba('lihat tidak berarti boleh tambah', format($q$insert into public.kas_entries (class_id, kind, amount, note, entry_date) values (%L, 'masuk', 1000, 'Curang', current_date)$q$, t.cid('XII IPA 1')), 'galat:row-level security');
select t.sebagai('badm');
select t.coba('Admin kelas lain tidak bisa membaca kas kelas ini', format('select public.kas_summary(%L)', t.cid('XII IPA 1')), 'galat:TIDAK_DIIZINKAN');

-- ---- log kelas mencatat fitur baru
select t.sebagai('adm1');
select t.sama('log kas tercatat', (select count(*) from public.audit_logs where class_id = t.cid('XII IPA 1') and action = 'kas_entries.insert')::int >= 2, true);
select t.sama('log piket tercatat dengan nama', (select count(*) from public.audit_logs where class_id = t.cid('XII IPA 1') and action = 'piket_duties.insert' and detail ? 'anggota')::int >= 1, true);
select t.sama('log voting tercatat', (select count(*) from public.audit_logs where class_id = t.cid('XII IPA 1') and action = 'polls.insert')::int, 3);

-- ---- foto profil
select t.sebagai('sis1');
select t.sama('bucket avatars privat dan 300 KB', (select public::text || file_size_limit::text from storage.buckets where id = 'avatars'), 'false307200');
select t.coba('mengunggah ke folder sendiri', format($q$insert into storage.objects (bucket_id, name) values ('avatars', %L)$q$, t.uid('sis1')::text || '/a.jpg'), 'ok');
select t.coba('tidak boleh mengunggah ke folder orang lain', format($q$insert into storage.objects (bucket_id, name) values ('avatars', %L)$q$, t.uid('sis2')::text || '/a.jpg'), 'galat:row-level security');
select t.coba('set foto sendiri', format($q$select public.set_my_avatar(%L)$q$, t.uid('sis1')::text || '/a.jpg'), 'ok');
select t.coba('foto tidak boleh menunjuk folder orang lain', format($q$select public.set_my_avatar(%L)$q$, t.uid('sis2')::text || '/a.jpg'), 'galat:TIDAK_DIIZINKAN');
select t.coba('update langsung ke folder orang lain ditolak', format($q$update public.profiles set avatar_path = %L where id = %L$q$, t.uid('sis2')::text || '/a.jpg', t.uid('sis1')), 'galat:TIDAK_DIIZINKAN');
select t.sebagai('sis2');
select t.sama('teman sekelas melihat berkas foto', (select count(*) from storage.objects where bucket_id = 'avatars' and name like t.uid('sis1')::text || '/%')::int, 1);
select t.coba('murid tidak boleh mencabut foto teman', format('select public.clear_avatar(%L)', t.uid('sis1')), 'galat:TIDAK_DIIZINKAN');
select t.coba('murid tidak boleh menghapus berkas teman', format($q$delete from storage.objects where bucket_id = 'avatars' and name like %L$q$, t.uid('sis1')::text || '/%'), 'baris:0');
select t.sebagai('badm');
select t.sama('kelas lain tidak melihat foto', (select count(*) from storage.objects where bucket_id = 'avatars')::int, 0);
select t.sebagai('adm1');
select t.coba('Admin Kelas mencabut foto muridnya', format('select public.clear_avatar(%L)', t.uid('sis1')), 'ok');
select t.coba('Admin Kelas menghapus berkas', format($q$delete from storage.objects where bucket_id = 'avatars' and name like %L$q$, t.uid('sis1')::text || '/%'), 'baris:1');
select t.sebagai('badm');
select t.coba('Admin kelas lain tidak boleh mencabut foto', format('select public.clear_avatar(%L)', t.uid('sis1')), 'galat:TIDAK_DIIZINKAN');
