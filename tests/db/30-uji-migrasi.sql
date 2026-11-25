-- Keadaan data sesudah 002 dijalankan di atas data v0.2.0 (dijalankan sebagai superuser).
select t.admin();

select t.sama('sekolah dari school_name', (select count(*) from public.schools where name = 'SMAN 1 Contoh')::int, 1);
select t.sama('sekolah bawaan untuk kelas tanpa sekolah', (select count(*) from public.schools where name = 'Sekolah Bawaan')::int, 1);
select t.sama('semua kelas punya sekolah', (select count(*) from public.classes where school_id is null)::int, 0);
select t.sama('kolom is_admin dibuang', (select count(*) from information_schema.columns where table_name = 'class_members' and column_name = 'is_admin')::int, 0);
select t.sama('kolom school_name dibuang', (select count(*) from information_schema.columns where table_name = 'classes' and column_name = 'school_name')::int, 0);

select t.sama('Admin Kelas peringkat 0', (select position from public.roles where class_id = t.cid('XII IPA 1') and system_key = 'admin_kelas'), 0);
select t.sama('Murid peringkat dasar', (select position from public.roles where class_id = t.cid('XII IPA 1') and system_key = 'murid'), 1000000);
select t.sama('Ketua bergeser ke 1', (select position from public.roles where id = t.rid('XII IPA 1', 'Ketua')), 1);
select t.sama('Sekretaris bergeser ke 3', (select position from public.roles where id = t.rid('XII IPA 1', 'Sekretaris')), 3);
select t.sama('admin lama jadi Admin Kelas', (select count(*) from public.member_roles mr join public.roles r on r.id = mr.role_id where r.system_key = 'admin_kelas')::int, 3);
select t.sama('semua anggota punya Murid', (select count(*) from public.class_members m where not exists (
  select 1 from public.member_roles mr join public.roles r on r.id = mr.role_id where mr.member_id = m.id and r.system_key = 'murid'))::int, 0);
select t.sama('izin .buat menjadi .tambah', (select count(*) from public.role_permissions where permission like '%.buat')::int, 0);
select t.sama('pengumuman.tambah ada di Ketua', (select count(*) from public.role_permissions where role_id = t.rid('XII IPA 1', 'Ketua') and permission = 'pengumuman.tambah')::int, 1);
select t.sama('role.kelola menjadi role.beri', (select count(*) from public.role_permissions where role_id = t.rid('XII IPA 1', 'Ketua') and permission = 'role.beri')::int, 1);
select t.sama('log.lihat dihapus dari role', (select count(*) from public.role_permissions where permission = 'log.lihat')::int, 0);
select t.sama('Murid punya hak lihat pengumuman', (select count(*) from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.system_key = 'murid' and rp.permission = 'pengumuman.lihat')::int, 2);
select t.sama('migrasi tidak menulis log', (select count(*) from public.audit_logs)::int, (select n from public.zz_sebelum));
