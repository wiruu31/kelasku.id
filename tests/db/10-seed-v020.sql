-- Data contoh bentuk v0.2.0: dua kelas, admin lewat flag is_admin, role bernomor dari 0, izin lama.
insert into public.classes (name, school_name, join_code) values
  ('XII IPA 1', 'SMAN 1 Contoh', 'KELAS2AB'),
  ('XII IPS 2', null, 'RUANG3CD');

create temp table u (username text primary key, id uuid, class_code text);
insert into u values
  ('geris', gen_random_uuid(), 'KELAS2AB'), ('adm1', gen_random_uuid(), 'KELAS2AB'), ('adm2', gen_random_uuid(), 'KELAS2AB'),
  ('ketua', gen_random_uuid(), 'KELAS2AB'), ('wakil', gen_random_uuid(), 'KELAS2AB'), ('sekre', gen_random_uuid(), 'KELAS2AB'),
  ('sis1', gen_random_uuid(), 'KELAS2AB'), ('sis2', gen_random_uuid(), 'KELAS2AB'), ('pen1', gen_random_uuid(), 'KELAS2AB'), ('pen2', gen_random_uuid(), 'KELAS2AB'),
  ('badm', gen_random_uuid(), 'RUANG3CD'), ('bsis1', gen_random_uuid(), 'RUANG3CD');

insert into auth.users (id, email, raw_user_meta_data)
select id, username || '@contoh.id',
  jsonb_build_object('full_name', initcap(username) || ' Contoh', 'username', username,
                     'wa', '0812000' || lpad((row_number() over (order by username))::text, 5, '0'), 'join_code', class_code)
from u;

update public.profiles set is_platform_owner = true where username = 'geris';
delete from public.class_members where user_id = (select id from u where username = 'geris');
update public.class_members set status = 'active' where user_id in (select id from u where username not in ('pen1', 'pen2'));
update public.class_members set is_admin = true
  where user_id in (select id from u where username in ('adm1', 'adm2', 'badm'));

insert into public.roles (class_id, name, position)
select c.id, r.name, r.pos from public.classes c, (values ('Ketua', 0), ('Wakil', 1), ('Sekretaris', 2)) as r(name, pos)
where c.name = 'XII IPA 1';

insert into public.role_permissions (role_id, permission, scope)
select r.id, p.perm, p.scope from public.roles r
join (values ('Ketua', 'pengumuman.buat', 'semua'), ('Ketua', 'role.kelola', 'semua'), ('Ketua', 'akun.approve', 'semua'),
             ('Ketua', 'log.lihat', 'semua'), ('Wakil', 'tugas.buat', 'semua'), ('Sekretaris', 'pengumuman.ubah', 'milik'))
  as p(name, perm, scope) on p.name = r.name;

insert into public.member_roles (member_id, role_id)
select m.id, r.id from public.class_members m
join public.profiles pr on pr.id = m.user_id
join (values ('ketua', 'Ketua'), ('wakil', 'Wakil'), ('sekre', 'Sekretaris')) as x(username, role) on x.username = pr.username
join public.roles r on r.name = x.role and r.class_id = m.class_id;

insert into public.announcements (class_id, title, body, created_by)
select m.class_id, 'Ujian pekan depan', 'Siapkan alat tulis.', m.user_id
from public.class_members m join public.profiles p on p.id = m.user_id where p.username = 'ketua';
insert into public.announcements (class_id, title, body, created_by)
select m.class_id, 'Rapat kelas B', 'Jumat siang.', m.user_id
from public.class_members m join public.profiles p on p.id = m.user_id where p.username = 'badm';

-- Jumlah baris log sebelum migrasi, pembanding untuk uji "migrasi tidak menulis log".
create table public.zz_sebelum as select count(*)::int as n from public.audit_logs;
