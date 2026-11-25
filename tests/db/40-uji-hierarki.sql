-- Aturan hierarki dan hak akses. Tiap uji berjalan sebagai pengguna tertentu lewat RLS sungguhan.

-- ---- Main Admin menunjuk Admin Kelas, batas jumlah
select t.sebagai('adm1');
select t.coba('Admin Kelas tidak boleh menunjuk Admin Kelas', format('select public.set_class_admin(%L, true)', t.mid('sis1')), 'galat:TIDAK_DIIZINKAN');
select t.sebagai('geris');
select t.coba('Main Admin menunjuk Admin Kelas', format('select public.set_class_admin(%L, true)', t.mid('sis1')), 'ok');
select t.coba('batas 3 admin tercapai', format('select public.set_class_admin(%L, true)', t.mid('sis2')), 'galat:BATAS_ADMIN');
select t.coba('batas per kelas tidak boleh di bawah jumlah admin', format('select public.update_class(%L, %L, %L, 2)', t.cid('XII IPA 1'), 'XII IPA 1', t.sid('SMAN 1 Contoh')), 'galat:BATAS_DI_BAWAH_JUMLAH');
select t.coba('batas bawaan sistem dinaikkan', 'select public.set_max_admins_default(4)', 'ok');
select t.coba('admin keempat boleh sesudah batas naik', format('select public.set_class_admin(%L, true)', t.mid('sis2')), 'ok');
select t.coba('mencabut Admin Kelas', format('select public.set_class_admin(%L, false)', t.mid('sis2')), 'ok');
select t.coba('mencabut Admin Kelas kedua', format('select public.set_class_admin(%L, false)', t.mid('sis1')), 'ok');
select t.coba('anggota belum aktif tidak bisa jadi admin', format('select public.set_class_admin(%L, true)', t.mid('pen1')), 'galat:ANGGOTA_BELUM_AKTIF');
select t.coba('batas bawaan di luar rentang', 'select public.set_max_admins_default(0)', 'galat:BATAS_TIDAK_VALID');
select t.coba('batas bawaan kembali ke 3', 'select public.set_max_admins_default(3)', 'ok');

-- ---- Role: hanya Main Admin dan Admin Kelas
select t.sebagai('ketua');
select t.coba('Ketua tidak boleh membuat role', format($q$insert into public.roles (class_id, name, position) values (%L, 'Bendahara', 4)$q$, t.cid('XII IPA 1')), 'galat:row-level security');
select t.coba('Ketua tidak boleh menghapus role', format('delete from public.roles where id = %L', t.rid('XII IPA 1', 'Wakil')), 'baris:0');
select t.coba('Ketua tidak boleh mengedit izin role', format($q$insert into public.role_permissions (role_id, permission) values (%L, 'tugas.tambah')$q$, t.rid('XII IPA 1', 'Wakil')), 'galat:row-level security');

select t.sebagai('adm1');
select t.coba('Admin Kelas membuat role', format($q$insert into public.roles (class_id, name, position, color) values (%L, 'Bendahara', 4, '#bfe3ff')$q$, t.cid('XII IPA 1')), 'ok');
select t.coba('role biasa tidak boleh berstatus sistem', format($q$insert into public.roles (class_id, name, position, is_system) values (%L, 'Palsu', 5, true)$q$, t.cid('XII IPA 1')), 'galat:TIDAK_DIIZINKAN');
select t.coba('role biasa tidak boleh peringkat 0', format($q$insert into public.roles (class_id, name, position) values (%L, 'Atas', 0)$q$, t.cid('XII IPA 1')), 'galat:TIDAK_DIIZINKAN');
select t.coba('role biasa tidak boleh peringkat Murid', format($q$insert into public.roles (class_id, name, position) values (%L, 'Bawah', 1000000)$q$, t.cid('XII IPA 1')), 'galat:TIDAK_DIIZINKAN');
select t.coba('nama role kembar dengan Murid ditolak', format($q$insert into public.roles (class_id, name, position) values (%L, 'murid', 9)$q$, t.cid('XII IPA 1')), 'galat:duplicate key');
select t.coba('izin Admin Kelas terkunci (tambah)', format($q$insert into public.role_permissions (role_id, permission) values (%L, 'tugas.hapus')$q$, t.rid('XII IPA 1', 'Admin Kelas')), 'galat:row-level security');
select t.coba('izin Admin Kelas terkunci (hapus)', format('delete from public.role_permissions where role_id = %L', t.rid('XII IPA 1', 'Admin Kelas')), 'baris:0');
select t.coba('role Admin Kelas tidak bisa diubah', format($q$update public.roles set color = '#bfe3ff' where id = %L$q$, t.rid('XII IPA 1', 'Admin Kelas')), 'galat:TIDAK_DIIZINKAN');
select t.coba('izin Murid bisa diedit', format($q$insert into public.role_permissions (role_id, permission) values (%L, 'tugas.tambah')$q$, t.rid('XII IPA 1', 'Murid')), 'ok');
select t.coba('izin Murid dikembalikan', format($q$delete from public.role_permissions where role_id = %L and permission = 'tugas.tambah'$q$, t.rid('XII IPA 1', 'Murid')), 'baris:1');
select t.coba('Murid tidak bisa dihapus', format('delete from public.roles where id = %L', t.rid('XII IPA 1', 'Murid')), 'galat:TIDAK_DIIZINKAN');
select t.coba('Admin Kelas tidak bisa dihapus', format('delete from public.roles where id = %L', t.rid('XII IPA 1', 'Admin Kelas')), 'galat:TIDAK_DIIZINKAN');
select t.coba('nama Murid tidak bisa diganti', format($q$update public.roles set name = 'Rakyat' where id = %L$q$, t.rid('XII IPA 1', 'Murid')), 'galat:TIDAK_DIIZINKAN');
select t.coba('role Admin Kelas kelas lain tidak tersentuh', format($q$insert into public.roles (class_id, name, position) values (%L, 'Intruder', 4)$q$, t.cid('XII IPS 2')), 'galat:row-level security');

-- ---- Memberi role: hanya yang lebih rendah
select t.sebagai('adm1');
select t.coba('Admin Kelas memberi Ketua ke murid', format('insert into public.member_roles values (%L, %L)', t.mid('sis1'), t.rid('XII IPA 1', 'Ketua')), 'ok');
select t.coba('role sistem Admin Kelas tidak bisa dipasang lewat tabel', format('insert into public.member_roles values (%L, %L)', t.mid('sis2'), t.rid('XII IPA 1', 'Admin Kelas')), 'galat:row-level security');
select t.coba('Admin Kelas tidak mengatur sesama Admin Kelas', format('insert into public.member_roles values (%L, %L)', t.mid('adm2'), t.rid('XII IPA 1', 'Wakil')), 'galat:row-level security');
select t.coba('Admin Kelas tidak mencabut role sesama Admin Kelas', format('delete from public.member_roles where member_id = %L and role_id = %L', t.mid('adm2'), t.rid('XII IPA 1', 'Admin Kelas')), 'baris:0');
select t.coba('Murid tidak bisa dilepas lewat tabel', format('delete from public.member_roles where member_id = %L and role_id = %L', t.mid('sis2'), t.rid('XII IPA 1', 'Murid')), 'baris:0');
select t.coba('Admin Kelas mencabut Ketua dari murid', format('delete from public.member_roles where member_id = %L and role_id = %L', t.mid('sis1'), t.rid('XII IPA 1', 'Ketua')), 'baris:1');

select t.sebagai('ketua');
select t.coba('Ketua memberi Wakil ke murid', format('insert into public.member_roles values (%L, %L)', t.mid('sis2'), t.rid('XII IPA 1', 'Wakil')), 'ok');
select t.coba('Ketua tidak memberi Ketua (sejajar)', format('insert into public.member_roles values (%L, %L)', t.mid('sis1'), t.rid('XII IPA 1', 'Ketua')), 'galat:row-level security');
select t.coba('Ketua tidak memberi role ke Admin Kelas', format('insert into public.member_roles values (%L, %L)', t.mid('adm1'), t.rid('XII IPA 1', 'Sekretaris')), 'galat:row-level security');
select t.coba('Ketua memberi Sekretaris ke Wakil', format('insert into public.member_roles values (%L, %L)', t.mid('wakil'), t.rid('XII IPA 1', 'Sekretaris')), 'ok');
select t.coba('Ketua mencabut role yang ia beri', format('delete from public.member_roles where member_id = %L and role_id = %L', t.mid('sis2'), t.rid('XII IPA 1', 'Wakil')), 'baris:1');
select t.coba('Ketua tidak memberi role lintas kelas', format('insert into public.member_roles values (%L, %L)', t.mid('bsis1'), t.rid('XII IPA 1', 'Wakil')), 'galat:row-level security');

select t.sebagai('wakil');
select t.coba('Wakil (tanpa role.beri) tidak memberi role', format('insert into public.member_roles values (%L, %L)', t.mid('sis2'), t.rid('XII IPA 1', 'Sekretaris')), 'galat:row-level security');
select t.coba('Wakil tidak memberi role Ketua', format('insert into public.member_roles values (%L, %L)', t.mid('sis2'), t.rid('XII IPA 1', 'Ketua')), 'galat:row-level security');

-- ---- Status anggota mengikuti peringkat
select t.sebagai('ketua');
select t.coba('pemegang akun.approve menyetujui pendaftar', format($q$update public.class_members set status = 'active' where id = %L$q$, t.mid('pen1')), 'baris:1');
select t.coba('Ketua tidak bisa mengeluarkan Admin Kelas', format($q$update public.class_members set status = 'removed' where id = %L$q$, t.mid('adm1')), 'galat:TIDAK_DIIZINKAN');
select t.coba('Ketua mengeluarkan murid', format($q$update public.class_members set status = 'removed' where id = %L$q$, t.mid('pen1')), 'baris:1');
select t.coba('Ketua tidak mengubah NIS orang lain', format($q$update public.class_members set nis = '123' where id = %L$q$, t.mid('sis1')), 'galat:TIDAK_DIIZINKAN');
select t.sebagai('adm1');
select t.coba('Admin Kelas tidak mengeluarkan sesama Admin Kelas', format($q$update public.class_members set status = 'removed' where id = %L$q$, t.mid('adm2')), 'galat:TIDAK_DIIZINKAN');
select t.coba('Admin Kelas memulihkan murid', format($q$update public.class_members set status = 'active' where id = %L$q$, t.mid('pen1')), 'baris:1');
select t.coba('Admin Kelas mengisi NIS murid', format($q$update public.class_members set nis = '9999', jenis_kelamin = 'P' where id = %L$q$, t.mid('sis1')), 'baris:1');
select t.sebagai('sis1');
select t.coba('murid mengisi NIS sendiri', format($q$update public.class_members set nis = '1234' where id = %L$q$, t.mid('sis1')), 'baris:1');
select t.coba('murid tidak mengubah nama tampilan', format($q$update public.class_members set display_name = 'Lain' where id = %L$q$, t.mid('sis1')), 'galat:TIDAK_DIIZINKAN');
select t.sebagai('pen2');
select t.coba('pendaftar tidak menyetujui diri sendiri', format($q$update public.class_members set status = 'active' where id = %L$q$, t.mid('pen2')), 'galat:TIDAK_DIIZINKAN');

-- ---- Isi kelas mengikuti izin lihat/tambah
select t.sebagai('sis1');
select t.coba('murid melihat pengumuman kelasnya', 'select * from public.announcements', 'baris:1');
select t.coba('murid tidak menambah pengumuman', format($q$insert into public.announcements (class_id, title, body) values (%L, 'Coba', 'Coba')$q$, t.cid('XII IPA 1')), 'galat:row-level security');
select t.sebagai('ketua');
select t.coba('Ketua menambah pengumuman', format($q$insert into public.announcements (class_id, title, body) values (%L, 'Baru', 'Isi')$q$, t.cid('XII IPA 1')), 'ok');
select t.sebagai('bsis1');
select t.coba('murid kelas lain tidak melihat isi', format('select * from public.announcements where class_id = %L', t.cid('XII IPA 1')), 'baris:0');
select t.sebagai('pen2');
select t.coba('pendaftar menunggu tidak melihat isi', 'select * from public.announcements', 'baris:0');

-- ---- Log
select t.sebagai('sis1');
select t.coba('murid tidak melihat log', 'select * from public.audit_logs', 'baris:0');
select t.sebagai('ketua');
select t.coba('Ketua tidak melihat log kelas (khusus Admin Kelas)', 'select * from public.audit_logs', 'baris:0');
select t.sebagai('adm1');
select t.sama('Admin Kelas melihat log kelasnya', (select count(*) > 0 from public.audit_logs where scope = 'kelas'), true);
select t.sama('Admin Kelas tidak melihat log sistem', (select count(*) from public.audit_logs where scope = 'sistem')::int, 0);
select t.sebagai('geris');
select t.sama('Main Admin melihat log sistem', (select count(*) > 0 from public.audit_logs where scope = 'sistem'), true);
select t.sama('log penunjukan admin tercatat', (select count(*) from public.audit_logs where action = 'admin_kelas.beri')::int, 2);
select t.sama('log pemberian role Murid tidak mengotori log', (select count(*) from public.audit_logs where detail ->> 'role' = 'Murid')::int, 0);

-- ---- Sekolah
select t.sebagai('sis1');
select t.coba('murid melihat sekolahnya saja', 'select * from public.schools', 'baris:1');
select t.coba('murid tidak menambah sekolah', $q$insert into public.schools (name) values ('Sekolah Liar')$q$, 'galat:row-level security');
select t.sebagai('geris');
select t.coba('Main Admin menambah sekolah', $q$insert into public.schools (name) values ('SMAN 2 Contoh')$q$, 'ok');
select t.coba('nama sekolah kembar ditolak', $q$insert into public.schools (name) values ('  sman 2 contoh ')$q$, 'galat:duplicate key');
select t.coba('Main Admin melihat semua sekolah', 'select * from public.schools', 'baris:3');
select t.coba('tidak ada hapus langsung', format('delete from public.schools where id = %L', t.sid('SMAN 2 Contoh')), 'baris:0');
select t.coba('membuat kelas di sekolah aktif', format($q$select public.create_class('XI MIPA 3', %L)$q$, t.sid('SMAN 2 Contoh')), 'ok');
select t.sama('kelas baru otomatis punya role sistem', (select count(*) from public.roles where class_id = t.cid('XI MIPA 3') and is_system)::int, 2);
select t.sama('Murid kelas baru punya hak lihat', (select count(*) from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.class_id = t.cid('XI MIPA 3') and r.system_key = 'murid')::int, 6);
select t.coba('memindah kelas antar sekolah', format($q$select public.update_class(%L, 'XI MIPA 3', %L, null)$q$, t.cid('XI MIPA 3'), t.sid('SMAN 1 Contoh')), 'ok');
select t.sebagai('adm1');
select t.coba('Admin Kelas tidak membuat kelas', format($q$select public.create_class('Liar', %L)$q$, t.sid('SMAN 1 Contoh')), 'galat:TIDAK_DIIZINKAN');
select t.coba('Admin Kelas tidak melihat kode kelas lewat tabel', 'select join_code from public.classes', 'galat:permission denied');
select t.coba('Admin Kelas bisa melihat kodenya lewat RPC', format('select public.get_join_code(%L)', t.cid('XII IPA 1')), 'ok');
select t.coba('Admin Kelas tidak melihat kode kelas lain', format('select public.get_join_code(%L)', t.cid('XII IPS 2')), 'galat:TIDAK_DIIZINKAN');

-- ---- Siaran Sistem
select t.sebagai('geris');
select t.coba('Main Admin menyiarkan ke semua', format($q$insert into public.system_announcements (title, body, target_type, created_by) values ('Libur', 'Sekolah libur Senin.', 'all', %L)$q$, t.uid('geris')), 'ok');
select t.coba('siaran ke kelas B', format($q$insert into public.system_announcements (title, body, target_type, class_id, created_by) values ('Khusus B', 'Halo B.', 'class', %L, %L)$q$, t.cid('XII IPS 2'), t.uid('geris')), 'ok');
select t.coba('siaran ke sekolah A', format($q$insert into public.system_announcements (title, body, target_type, school_id, created_by) values ('Sekolah A', 'Halo A.', 'school', %L, %L)$q$, t.sid('SMAN 1 Contoh'), t.uid('geris')), 'ok');
select t.coba('target tidak konsisten ditolak', format($q$insert into public.system_announcements (title, body, target_type, school_id, created_by) values ('Rusak', 'x', 'all', %L, %L)$q$, t.sid('SMAN 1 Contoh'), t.uid('geris')), 'galat:system_announcements_target');
select t.sebagai('adm1');
select t.coba('Admin Kelas A menerima siaran semua + sekolah A', 'select * from public.system_announcements', 'baris:2');
select t.coba('Admin Kelas tidak menyiarkan', format($q$insert into public.system_announcements (title, body, target_type, created_by) values ('Palsu', 'x', 'all', %L)$q$, t.uid('adm1')), 'galat:row-level security');
select t.coba('Admin Kelas menandai terbaca', format('insert into public.system_announcement_reads (announcement_id) select id from public.system_announcements where target_type = %L', 'all'), 'ok');
select t.sebagai('badm');
select t.coba('Admin Kelas B menerima siaran semua + kelas B', 'select * from public.system_announcements', 'baris:2');
select t.sebagai('ketua');
select t.coba('Ketua (bukan Admin Kelas) tidak menerima siaran', 'select * from public.system_announcements', 'baris:0');
select t.coba('Ketua tidak bisa menandai terbaca', format('insert into public.system_announcement_reads (announcement_id) select id from public.system_announcements', 1), 'ok');
select t.sebagai('geris');
select t.sama('Main Admin melihat penanda baca', (select count(*) from public.system_announcement_reads)::int, 1);

-- ---- RPC Konsol
select t.sebagai('sis1');
select t.coba('murid tidak memanggil console_tallies', 'select * from public.console_tallies()', 'galat:TIDAK_DIIZINKAN');
select t.coba('murid tidak memanggil console_admins', 'select * from public.console_admins()', 'galat:TIDAK_DIIZINKAN');
select t.sebagai('adm1');
select t.coba('Admin Kelas tidak memanggil console_class_members', format('select * from public.console_class_members(%L)', t.cid('XII IPA 1')), 'galat:TIDAK_DIIZINKAN');
select t.sebagai('geris');
select t.coba('console_tallies', 'select * from public.console_tallies()', 'baris:3');
select t.coba('console_admins', 'select * from public.console_admins()', 'baris:3');
select t.coba('console_class_members', format('select * from public.console_class_members(%L)', t.cid('XII IPA 1')), 'ok');
select t.coba('catat login Konsol', 'select public.log_console_login()', 'ok');
select t.sebagai('adm1');
select t.coba('Admin Kelas tidak mencatat login Konsol', 'select public.log_console_login()', 'galat:TIDAK_DIIZINKAN');

-- ---- Pendaftaran
select t.admin();
select t.sama('pendaftaran ke kelas aktif lolos', public.registration_error('Siswa Baru', 'siswabaru', 'baru@contoh.id', '0813000000001', 'KELAS2AB'), null::text);
update public.schools set is_active = false where name = 'SMAN 1 Contoh';
select t.sama('sekolah nonaktif menolak pendaftaran', public.registration_error('Siswa Baru', 'siswabaru', 'baru@contoh.id', '0813000000001', 'KELAS2AB'), 'KELAS_NONAKTIF');
update public.schools set is_active = true where name = 'SMAN 1 Contoh';
insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'baru@contoh.id',
  jsonb_build_object('full_name', 'Siswa Baru', 'username', 'siswabaru', 'wa', '0813000000001', 'join_code', 'KELAS2AB'));
select t.sama('pendaftar baru otomatis Murid', (select count(*) from public.member_roles mr join public.roles r on r.id = mr.role_id where mr.member_id = t.mid('siswabaru') and r.system_key = 'murid')::int, 1);
select t.sama('pendaftar baru berstatus menunggu', (select status from public.class_members where id = t.mid('siswabaru')), 'pending');

-- ---- Otorisasi edit akun (dipanggil Edge Function dengan service_role)
select t.admin();
select t.coba('Main Admin boleh mengedit murid', format('select public.authorize_account_edit(%L, %L)', t.uid('geris'), t.uid('sis1')), 'ok');
select t.coba('Main Admin boleh mengedit Admin Kelas', format('select public.authorize_account_edit(%L, %L)', t.uid('geris'), t.uid('adm1')), 'ok');
select t.coba('Admin Kelas boleh mengedit murid kelasnya', format('select public.authorize_account_edit(%L, %L)', t.uid('adm1'), t.uid('sis1')), 'ok');
select t.coba('Admin Kelas boleh mengedit pemegang role', format('select public.authorize_account_edit(%L, %L)', t.uid('adm1'), t.uid('ketua')), 'ok');
select t.coba('Admin Kelas tidak mengedit sesama Admin Kelas', format('select public.authorize_account_edit(%L, %L)', t.uid('adm1'), t.uid('adm2')), 'galat:TIDAK_DIIZINKAN');
select t.coba('Admin Kelas tidak mengedit murid kelas lain', format('select public.authorize_account_edit(%L, %L)', t.uid('adm1'), t.uid('bsis1')), 'galat:TIDAK_DIIZINKAN');
select t.coba('Admin Kelas tidak mengedit Main Admin', format('select public.authorize_account_edit(%L, %L)', t.uid('adm1'), t.uid('geris')), 'galat:TIDAK_DIIZINKAN');
select t.coba('Ketua tidak mengedit akun', format('select public.authorize_account_edit(%L, %L)', t.uid('ketua'), t.uid('sis1')), 'galat:TIDAK_DIIZINKAN');
select t.coba('tidak mengedit diri sendiri lewat jalur ini', format('select public.authorize_account_edit(%L, %L)', t.uid('adm1'), t.uid('adm1')), 'galat:TIDAK_DIIZINKAN');
select t.coba('reset sandi ikut aturan yang sama', format('select public.authorize_password_reset(%L, %L)', t.uid('adm1'), t.uid('adm2')), 'galat:TIDAK_DIIZINKAN');
select public.record_account_edit(t.uid('geris'), t.uid('sis1'), 'akun.edit', array['email']);
select public.record_account_edit(t.uid('adm1'), t.uid('sis1'), 'akun.edit', array['nama']);
select t.sama('edit oleh Main Admin masuk log sistem', (select count(*) from public.audit_logs where action = 'akun.edit' and scope = 'sistem')::int, 1);
select t.sama('edit oleh Admin Kelas masuk log kelas', (select count(*) from public.audit_logs where action = 'akun.edit' and scope = 'kelas')::int, 1);

-- ---- Hapus permanen
select t.sebagai('geris');
select t.coba('kelas aktif tidak bisa dihapus', format($q$select public.delete_class(%L, 'XI MIPA 3')$q$, t.cid('XI MIPA 3')), 'galat:HARUS_NONAKTIF');
select t.coba('menonaktifkan kelas', format('select public.set_class_active(%L, false)', t.cid('XI MIPA 3')), 'ok');
select t.coba('nama konfirmasi harus persis', format($q$select public.delete_class(%L, 'xi mipa 3')$q$, t.cid('XI MIPA 3')), 'galat:KONFIRMASI_SALAH');
select t.coba('hapus kelas nonaktif dengan nama benar', format($q$select public.delete_class(%L, 'XI MIPA 3')$q$, t.cid('XI MIPA 3')), 'ok');
select t.sama('kelas terhapus', (select count(*) from public.classes where name = 'XI MIPA 3')::int, 0);
select t.sama('role kelas terhapus ikut', (select count(*) from public.roles r where not exists (select 1 from public.classes c where c.id = r.class_id))::int, 0);
select t.coba('sekolah aktif tidak bisa dihapus', format($q$select public.delete_school(%L, 'SMAN 2 Contoh')$q$, t.sid('SMAN 2 Contoh')), 'galat:HARUS_NONAKTIF');
select t.coba('menonaktifkan sekolah', format($q$update public.schools set is_active = false where id = %L$q$, t.sid('SMAN 2 Contoh')), 'baris:1');
select t.coba('hapus sekolah nonaktif', format($q$select public.delete_school(%L, 'SMAN 2 Contoh')$q$, t.sid('SMAN 2 Contoh')), 'ok');
select t.coba('sekolah dengan kelas aktif tidak bisa dihapus', format($q$select public.delete_school(%L, 'SMAN 1 Contoh')$q$, t.sid('SMAN 1 Contoh')), 'galat:HARUS_NONAKTIF');
select t.sama('log penghapusan kelas ada di log sistem', (select count(*) from public.audit_logs where action = 'classes.delete' and scope = 'sistem')::int, 1);
