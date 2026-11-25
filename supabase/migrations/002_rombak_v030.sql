-- Kelasku.id v0.3.0: Sekolah, hierarki role gaya Discord, Siaran Sistem, dan dasar Konsol.
-- Naik dari v0.2.0: BACKUP DULU (lihat docs/SUPABASE_SETUP.md), lalu jalankan file ini di SQL Editor.
-- Aman diulang. Instalasi baru: jalankan supabase/schema.sql, bukan file ini.
--
-- Peringkat (makin kecil makin tinggi):
--   -1 Main Admin (profiles.is_platform_owner)   0 Admin Kelas (role sistem)
--   1..999999 role buatan Admin Kelas            1000000 Murid (role sistem)

-- Penanda agar trigger log tidak mencatat ribuan baris saat migrasi data.
select set_config('kelasku.migrasi', '1', false);

-- ---------------------------------------------------------------- tabel baru

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists schools_name_key on public.schools (lower(trim(name)));

create table if not exists public.system_settings (
  key text primary key check (key ~ '^[a-z_]{3,60}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.system_settings (key, value) values ('max_admins_per_class', '3'::jsonb)
  on conflict (key) do nothing;

create table if not exists public.system_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 120),
  body text not null check (char_length(body) between 1 and 4000),
  target_type text not null check (target_type in ('all', 'school', 'class')),
  school_id uuid references public.schools (id) on delete cascade,
  class_id uuid references public.classes (id) on delete cascade,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint system_announcements_target check (
    (target_type = 'all' and school_id is null and class_id is null)
    or (target_type = 'school' and school_id is not null and class_id is null)
    or (target_type = 'class' and class_id is not null and school_id is null)
  )
);
create index if not exists system_announcements_created_idx on public.system_announcements (created_at desc);

create table if not exists public.system_announcement_reads (
  announcement_id uuid not null references public.system_announcements (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

-- ---------------------------------------------------------------- kolom baru

alter table public.classes add column if not exists school_id uuid references public.schools (id) on delete restrict;
alter table public.classes add column if not exists max_admins int check (max_admins is null or max_admins between 1 and 20);
create index if not exists classes_school_idx on public.classes (school_id);

alter table public.roles add column if not exists is_system boolean not null default false;
alter table public.roles add column if not exists system_key text check (system_key in ('admin_kelas', 'murid'));
create unique index if not exists roles_system_key_idx on public.roles (class_id, system_key) where system_key is not null;

alter table public.class_members add column if not exists jenis_kelamin text check (jenis_kelamin in ('L', 'P'));

alter table public.audit_logs add column if not exists scope text not null default 'kelas' check (scope in ('sistem', 'kelas'));
alter table public.audit_logs add column if not exists school_id uuid references public.schools (id) on delete set null;
create index if not exists audit_logs_scope_idx on public.audit_logs (scope, id desc);

-- ---------------------------------------------------------------- migrasi sekolah

do $$
declare r record;
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'classes' and column_name = 'school_name') then
    for r in select distinct trim(school_name) as n from public.classes
             where school_name is not null and trim(school_name) <> '' loop
      insert into public.schools (name) values (r.n) on conflict do nothing;
    end loop;
    if exists (select 1 from public.classes where school_id is null and coalesce(trim(school_name), '') = '') then
      insert into public.schools (name) values ('Sekolah Bawaan') on conflict do nothing;
    end if;
    update public.classes c set school_id = s.id
      from public.schools s
      where c.school_id is null and lower(trim(c.school_name)) = lower(trim(s.name));
    update public.classes set school_id = (select id from public.schools where lower(name) = 'sekolah bawaan')
      where school_id is null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from public.classes where school_id is null) then
    alter table public.classes alter column school_id set not null;
  end if;
end $$;

-- ---------------------------------------------------------------- fungsi bantu (hierarki)

create or replace function public.is_class_admin(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from class_members m
    join member_roles mr on mr.member_id = m.id
    join roles r on r.id = mr.role_id
    where m.class_id = p_class and m.user_id = auth.uid() and m.status = 'active'
      and r.system_key = 'admin_kelas'
  )
$$;

create or replace function public.has_perm(p_class uuid, p_perm text, p_scope text default 'semua')
returns boolean language sql stable security definer set search_path = public as $$
  select is_owner() or exists (
    select 1 from class_members m
    where m.class_id = p_class and m.user_id = auth.uid() and m.status = 'active'
      and (
        exists (select 1 from member_roles mr join roles r on r.id = mr.role_id
                where mr.member_id = m.id and r.system_key = 'admin_kelas')
        or exists (select 1 from member_roles mr join role_permissions rp on rp.role_id = mr.role_id
                   where mr.member_id = m.id and rp.permission = p_perm
                     and (rp.scope = 'semua' or p_scope = 'milik'))
      )
  )
$$;

-- Main Admin = -1. Selain itu peringkat tertinggi dari role yang dimiliki.
create or replace function public.my_top_position(p_class uuid) returns int
language sql stable security definer set search_path = public as $$
  select case
    when is_owner() then -1
    else coalesce((
      select min(r.position)
      from member_roles mr
      join roles r on r.id = mr.role_id
      join class_members m on m.id = mr.member_id
      where m.user_id = auth.uid() and m.class_id = p_class and m.status = 'active'
    ), 2147483647)
  end
$$;

create or replace function public.member_top_position(p_member uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((
    select min(r.position) from member_roles mr join roles r on r.id = mr.role_id
    where mr.member_id = p_member
  ), 2147483647)
$$;

-- Hanya Main Admin dan Admin Kelas yang membuat, mengubah, dan menghapus role.
create or replace function public.can_manage_role(p_role uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roles r where r.id = p_role and (is_owner() or is_class_admin(r.class_id))
  )
$$;

-- Izin role Admin Kelas terkunci penuh, untuk siapa pun.
create or replace function public.can_edit_role_perms(p_role uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roles r
    where r.id = p_role and r.system_key is distinct from 'admin_kelas'
      and (is_owner() or is_class_admin(r.class_id))
  )
$$;

-- Memberi atau mencabut role biasa: hanya role dan anggota yang lebih rendah dari pemanggil.
-- Role sistem (Admin Kelas, Murid) tidak pernah lewat sini.
create or replace function public.can_assign_role(p_member uuid, p_role uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from roles r join class_members m on m.class_id = r.class_id
    where r.id = p_role and m.id = p_member and m.status = 'active' and r.system_key is null
      and (
        is_owner()
        or (
          (is_class_admin(r.class_id) or has_perm(r.class_id, 'role.beri'))
          and my_top_position(r.class_id) < r.position
          and my_top_position(r.class_id) < member_top_position(p_member)
        )
      )
  )
$$;

create or replace function public.class_admin_limit(p_class uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select max_admins from classes where id = p_class),
    (select (value #>> '{}')::int from system_settings where key = 'max_admins_per_class'),
    3
  )
$$;

create or replace function public.in_school(p_school uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from classes c join class_members m on m.class_id = c.id
    where c.school_id = p_school and m.user_id = auth.uid()
  )
$$;

-- Role bawaan tiap kelas. Murid mulai dengan hak lihat modul isi.
create or replace function public.ensure_system_roles(p_class uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  -- Tanda untuk roles_guard: pembuatan role sistem hanya boleh dari fungsi ini.
  perform set_config('kelasku.sistem', '1', true);
  insert into roles (class_id, name, color, position, is_system, system_key)
  values (p_class, 'Admin Kelas', '#ffe2a8', 0, true, 'admin_kelas')
  on conflict (class_id, system_key) where system_key is not null do nothing;

  insert into roles (class_id, name, color, position, is_system, system_key)
  values (p_class, 'Murid', '#e6e6e6', 1000000, true, 'murid')
  on conflict (class_id, system_key) where system_key is not null do nothing
  returning id into v_id;

  if v_id is not null then
    insert into role_permissions (role_id, permission, scope)
    select v_id, p, 'semua'
    from unnest(array['pengumuman.akses', 'pengumuman.lihat', 'jadwal.akses', 'jadwal.lihat',
                      'tugas.akses', 'tugas.lihat']) as p
    on conflict do nothing;
  end if;
  perform set_config('kelasku.sistem', '0', true);
end $$;

-- ---------------------------------------------------------------- log (dipasang sebelum migrasi data)

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_class uuid;
  v_detail jsonb;
  v_key text;
begin
  if current_setting('kelasku.migrasi', true) = '1' then return coalesce(new, old); end if;
  v_class := case
    when tg_table_name = 'member_roles' then (select class_id from class_members where id = (r ->> 'member_id')::uuid)
    else (r ->> 'class_id')::uuid
  end;
  -- Kelas yang sedang dihapus: baris anaknya ikut terhapus, tidak perlu dicatat.
  if v_class is null or not exists (select 1 from classes where id = v_class) then return coalesce(new, old); end if;
  if tg_table_name = 'member_roles' then
    select system_key into v_key from roles where id = (r ->> 'role_id')::uuid;
    if v_key = 'murid' then return coalesce(new, old); end if;
  end if;

  v_detail := jsonb_strip_nulls(jsonb_build_object(
    'label', coalesce(r ->> 'title', r ->> 'name', r ->> 'subject', r ->> 'display_name'),
    'status_dari', case when o ? 'status' and o ->> 'status' <> r ->> 'status' then o ->> 'status' end,
    'status_ke', case when o ? 'status' and o ->> 'status' <> r ->> 'status' then r ->> 'status' end,
    'anggota', case when tg_table_name = 'member_roles'
      then (select display_name from class_members where id = (r ->> 'member_id')::uuid) end,
    'role', case when tg_table_name = 'member_roles'
      then (select name from roles where id = (r ->> 'role_id')::uuid) end
  ));
  -- Update keanggotaan yang tidak mengubah status (mis. nomor absen) tidak dicatat.
  if tg_table_name = 'class_members' and tg_op = 'UPDATE' and v_detail = jsonb_build_object('label', r ->> 'display_name') then
    return new;
  end if;
  insert into audit_logs (scope, class_id, school_id, actor_id, action, target_id, detail)
  values ('kelas', v_class, (select school_id from classes where id = v_class), auth.uid(),
          tg_table_name || '.' || lower(tg_op), coalesce(r ->> 'id', r ->> 'member_id'), v_detail);
  return coalesce(new, old);
end $$;

-- Log tingkat sistem: sekolah, kelas, pengaturan, dan siaran. Yang ditampilkan Konsol.
create or replace function public.audit_system_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_changes jsonb;
  v_school uuid;
begin
  if current_setting('kelasku.migrasi', true) = '1' then return coalesce(new, old); end if;
  v_school := case when tg_table_name = 'schools' then (r ->> 'id')::uuid else (r ->> 'school_id')::uuid end;
  if tg_op = 'UPDATE' then
    select jsonb_agg(k) into v_changes
    from jsonb_object_keys(r) k
    where r -> k is distinct from o -> k and k not in ('join_code', 'updated_at');
    if v_changes is null then return new; end if;
  end if;
  insert into audit_logs (scope, class_id, school_id, actor_id, action, target_id, detail)
  values (
    'sistem', null,
    case when v_school is not null and exists (select 1 from schools where id = v_school) then v_school end,
    auth.uid(), tg_table_name || '.' || lower(tg_op), coalesce(r ->> 'id', r ->> 'key'),
    jsonb_strip_nulls(jsonb_build_object(
      'label', coalesce(r ->> 'name', r ->> 'title', r ->> 'key'),
      'perubahan', v_changes,
      'aktif', case when tg_op = 'UPDATE' and o ->> 'is_active' is distinct from r ->> 'is_active' then r ->> 'is_active' end
    ))
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['schools', 'classes', 'system_settings', 'system_announcements']
  loop
    execute format('drop trigger if exists audit_sys_%1$s on public.%1$s', t);
    execute format('create trigger audit_sys_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_system_row()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- migrasi role dan anggota

-- Nama bawaan tidak boleh bentrok dengan role lama.
update public.roles set name = name || ' (lama)'
  where system_key is null and lower(name) in ('admin kelas', 'murid');

-- Peringkat role lama bergeser satu supaya Admin Kelas (0) ada di atas semuanya. Sekali saja per kelas.
update public.roles r set position = r.position + 1
  where r.system_key is null
    and not exists (select 1 from public.roles s where s.class_id = r.class_id and s.system_key = 'admin_kelas');

select public.ensure_system_roles(id) from public.classes;

update public.role_permissions set permission = replace(permission, '.buat', '.tambah') where permission like '%.buat';
update public.role_permissions set permission = 'role.beri' where permission = 'role.kelola'
  and not exists (select 1 from public.role_permissions x where x.role_id = role_permissions.role_id and x.permission = 'role.beri');
delete from public.role_permissions where permission in ('role.kelola', 'log.lihat');

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'class_members' and column_name = 'is_admin') then
    insert into public.member_roles (member_id, role_id)
    select m.id, r.id from public.class_members m
    join public.roles r on r.class_id = m.class_id and r.system_key = 'admin_kelas'
    where m.is_admin and m.status = 'active'
    on conflict do nothing;
  end if;
end $$;

insert into public.member_roles (member_id, role_id)
select m.id, r.id from public.class_members m
join public.roles r on r.class_id = m.class_id and r.system_key = 'murid'
on conflict do nothing;

-- ---------------------------------------------------------------- trigger

-- Anggota baru otomatis jadi Murid.
create or replace function public.class_members_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform ensure_system_roles(new.class_id);
  insert into member_roles (member_id, role_id)
  select new.id, id from roles where class_id = new.class_id and system_key = 'murid'
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists class_members_after_insert_trg on public.class_members;
create trigger class_members_after_insert_trg after insert on public.class_members
  for each row execute function public.class_members_after_insert();

create or replace function public.classes_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform ensure_system_roles(new.id);
  return new;
end $$;
drop trigger if exists classes_after_insert_trg on public.classes;
create trigger classes_after_insert_trg after insert on public.classes
  for each row execute function public.classes_after_insert();

create or replace function public.class_members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare privileged boolean;
begin
  if auth.uid() is null then return new; end if;
  privileged := is_owner() or is_class_admin(old.class_id);

  if new.class_id is distinct from old.class_id
     or new.user_id is distinct from old.user_id
     or new.display_name is distinct from old.display_name then
    raise exception 'TIDAK_DIIZINKAN';
  end if;

  if new.status is distinct from old.status then
    if not (privileged or has_perm(old.class_id, 'akun.approve')) then raise exception 'TIDAK_DIIZINKAN'; end if;
    if old.user_id = auth.uid() and not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
    -- Yang sejajar atau di atas pemanggil tidak bisa diubah statusnya. Main Admin mengatur semua.
    if not is_owner() and my_top_position(old.class_id) >= member_top_position(old.id) then
      raise exception 'TIDAK_DIIZINKAN';
    end if;
    if new.status = 'active' then new.approved_by := auth.uid(); end if;
  end if;

  if (new.nomor_absen is distinct from old.nomor_absen
      or new.nis is distinct from old.nis
      or new.jenis_kelamin is distinct from old.jenis_kelamin)
     and old.user_id <> auth.uid() and not privileged then
    raise exception 'TIDAK_DIIZINKAN';
  end if;
  return new;
end $$;

-- Role sistem tidak bisa dibuat, dihapus, atau diubah bentuknya lewat API.
create or replace function public.roles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or current_setting('kelasku.sistem', true) = '1' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if new.is_system or new.system_key is not null or new.position < 1 or new.position >= 1000000 then
      raise exception 'TIDAK_DIIZINKAN';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    -- Saat kelasnya dihapus (cascade), role sistem ikut terhapus.
    if old.is_system and exists (select 1 from classes where id = old.class_id) then
      raise exception 'TIDAK_DIIZINKAN';
    end if;
    return old;
  end if;
  if new.is_system is distinct from old.is_system or new.system_key is distinct from old.system_key
     or new.class_id is distinct from old.class_id then
    raise exception 'TIDAK_DIIZINKAN';
  end if;
  if old.system_key = 'admin_kelas' then raise exception 'TIDAK_DIIZINKAN'; end if;
  if old.is_system and (new.name is distinct from old.name or new.position is distinct from old.position) then
    raise exception 'TIDAK_DIIZINKAN';
  end if;
  if not old.is_system and (new.position < 1 or new.position >= 1000000) then raise exception 'TIDAK_DIIZINKAN'; end if;
  return new;
end $$;
drop trigger if exists roles_guard_trg on public.roles;
create trigger roles_guard_trg before insert or update or delete on public.roles
  for each row execute function public.roles_guard();

-- ---------------------------------------------------------------- is_admin dibuang

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'class_members' and column_name = 'is_admin') then
    alter table public.class_members drop column is_admin;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'classes' and column_name = 'school_name') then
    alter table public.classes drop column school_name;
  end if;
end $$;

-- ---------------------------------------------------------------- RLS

alter table public.schools enable row level security;
alter table public.system_settings enable row level security;
alter table public.system_announcements enable row level security;
alter table public.system_announcement_reads enable row level security;

drop policy if exists schools_select on public.schools;
create policy schools_select on public.schools for select to authenticated
  using (is_owner() or in_school(id));
drop policy if exists schools_insert on public.schools;
create policy schools_insert on public.schools for insert to authenticated with check (is_owner());
drop policy if exists schools_update on public.schools;
create policy schools_update on public.schools for update to authenticated
  using (is_owner()) with check (is_owner());
-- Hapus sekolah hanya lewat delete_school (arsip dulu, lalu ketik nama).

drop policy if exists settings_select on public.system_settings;
create policy settings_select on public.system_settings for select to authenticated using (is_owner());

-- Siapa yang menerima siaran: Admin Kelas di kelas atau sekolah yang dituju.
create or replace function public.admin_receives_system(p_ann uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from system_announcements a
    join class_members m on m.user_id = auth.uid() and m.status = 'active'
    join classes c on c.id = m.class_id
    join member_roles mr on mr.member_id = m.id
    join roles r on r.id = mr.role_id and r.system_key = 'admin_kelas'
    where a.id = p_ann
      and (a.target_type = 'all'
           or (a.target_type = 'school' and c.school_id = a.school_id)
           or (a.target_type = 'class' and c.id = a.class_id))
  )
$$;

drop policy if exists sysann_select on public.system_announcements;
create policy sysann_select on public.system_announcements for select to authenticated
  using (is_owner() or admin_receives_system(id));
drop policy if exists sysann_insert on public.system_announcements;
create policy sysann_insert on public.system_announcements for insert to authenticated
  with check (is_owner() and created_by = auth.uid());
drop policy if exists sysann_update on public.system_announcements;
create policy sysann_update on public.system_announcements for update to authenticated
  using (is_owner()) with check (is_owner());
drop policy if exists sysann_delete on public.system_announcements;
create policy sysann_delete on public.system_announcements for delete to authenticated using (is_owner());

drop policy if exists sysread_select on public.system_announcement_reads;
create policy sysread_select on public.system_announcement_reads for select to authenticated
  using (user_id = auth.uid() or is_owner());
drop policy if exists sysread_insert on public.system_announcement_reads;
create policy sysread_insert on public.system_announcement_reads for insert to authenticated
  with check (user_id = auth.uid() and admin_receives_system(announcement_id));

-- roles: hanya Main Admin dan Admin Kelas yang menulis.
drop policy if exists roles_insert on public.roles;
create policy roles_insert on public.roles for insert to authenticated
  with check (is_owner() or is_class_admin(class_id));
drop policy if exists roles_update on public.roles;
create policy roles_update on public.roles for update to authenticated
  using (can_manage_role(id)) with check (is_owner() or is_class_admin(class_id));
drop policy if exists roles_delete on public.roles;
create policy roles_delete on public.roles for delete to authenticated using (can_manage_role(id));

drop policy if exists rperm_insert on public.role_permissions;
create policy rperm_insert on public.role_permissions for insert to authenticated
  with check (can_edit_role_perms(role_id));
drop policy if exists rperm_update on public.role_permissions;
create policy rperm_update on public.role_permissions for update to authenticated
  using (can_edit_role_perms(role_id)) with check (can_edit_role_perms(role_id));
drop policy if exists rperm_delete on public.role_permissions;
create policy rperm_delete on public.role_permissions for delete to authenticated
  using (can_edit_role_perms(role_id));

drop policy if exists mroles_insert on public.member_roles;
create policy mroles_insert on public.member_roles for insert to authenticated
  with check (can_assign_role(member_id, role_id));
drop policy if exists mroles_delete on public.member_roles;
create policy mroles_delete on public.member_roles for delete to authenticated
  using (can_assign_role(member_id, role_id));

-- Log kelas hanya untuk Admin Kelas; log sistem hanya untuk Main Admin.
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated
  using (
    (scope = 'sistem' and is_owner())
    or (scope = 'kelas' and class_id is not null and (is_owner() or is_class_admin(class_id)))
  );

-- Modul isi: lihat, tambah, ubah, hapus mengikuti izin. "milik" tetap berlaku untuk ubah dan hapus.
do $$
declare
  pair text[];
  t text;
  m text;
begin
  foreach pair slice 1 in array array[
    array['announcements', 'pengumuman'], array['schedules', 'jadwal'], array['tasks', 'tugas']
  ]
  loop
    t := pair[1]; m := pair[2];
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (has_perm(class_id, %2$L))', t, m || '.lihat');
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (has_perm(class_id, %2$L) and created_by = auth.uid())', t, m || '.tambah');
  end loop;
end $$;

-- ---------------------------------------------------------------- pendaftaran

create or replace function public.registration_error(
  p_name text, p_username text, p_email text, p_wa text, p_code text, p_self uuid default null
) returns text language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_name text := norm_name(p_name);
  v_user text := lower(trim(coalesce(p_username, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_wa text := norm_wa(p_wa);
  v_class classes%rowtype;
begin
  if char_length(v_name) < 3 or char_length(v_name) > 80 then return 'NAMA_TIDAK_VALID'; end if;
  if v_user !~ '^[a-z0-9_]{3,20}$' then return 'USERNAME_TIDAK_VALID'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return 'EMAIL_TIDAK_VALID'; end if;
  if v_wa !~ '^62[0-9]{8,13}$' then return 'WA_TIDAK_VALID'; end if;

  select * into v_class from classes where join_code = upper(trim(coalesce(p_code, '')));
  if not found then return 'KODE_KELAS_TIDAK_VALID'; end if;
  if not v_class.is_active
     or not coalesce((select is_active from schools where id = v_class.school_id), false) then
    return 'KELAS_NONAKTIF';
  end if;

  if exists (select 1 from profiles where lower(username) = v_user) then return 'USERNAME_SUDAH_DIPAKAI'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email and id is distinct from p_self)
     or exists (select 1 from profile_contacts where lower(email) = v_email) then return 'EMAIL_SUDAH_DIPAKAI'; end if;
  if exists (select 1 from profile_contacts where wa = v_wa) then return 'WA_SUDAH_DIPAKAI'; end if;
  if exists (
    select 1 from class_members
    where class_id = v_class.id and lower(display_name) = lower(v_name) and status in ('pending', 'active')
  ) then return 'NAMA_SUDAH_ADA_DI_KELAS'; end if;
  return null;
end $$;

-- ---------------------------------------------------------------- RPC Konsol (khusus Main Admin)

drop function if exists public.create_class(text, text);
create or replace function public.create_class(p_name text, p_school uuid)
returns public.classes language plpgsql security definer set search_path = public as $$
declare c classes;
begin
  if not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
  if not exists (select 1 from schools where id = p_school and is_active) then raise exception 'SEKOLAH_TIDAK_VALID'; end if;
  insert into classes (name, school_id) values (trim(p_name), p_school) returning * into c;
  return c;
end $$;

create or replace function public.update_class(p_class uuid, p_name text, p_school uuid, p_max_admins int default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
  if not exists (select 1 from schools where id = p_school) then raise exception 'SEKOLAH_TIDAK_VALID'; end if;
  if p_max_admins is not null and (select count(*) from class_members m
       join member_roles mr on mr.member_id = m.id join roles r on r.id = mr.role_id
       where m.class_id = p_class and m.status = 'active' and r.system_key = 'admin_kelas') > p_max_admins then
    raise exception 'BATAS_DI_BAWAH_JUMLAH';
  end if;
  update classes set name = trim(p_name), school_id = p_school, max_admins = p_max_admins where id = p_class;
end $$;

create or replace function public.set_class_active(p_class uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
  update classes set is_active = p_active where id = p_class;
end $$;

-- Hapus permanen: hanya yang sudah nonaktif, dan nama harus diketik persis.
create or replace function public.delete_class(p_class uuid, p_confirm text)
returns void language plpgsql security definer set search_path = public as $$
declare c classes;
begin
  if not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
  select * into c from classes where id = p_class;
  if not found then raise exception 'TIDAK_DITEMUKAN'; end if;
  if c.is_active then raise exception 'HARUS_NONAKTIF'; end if;
  if trim(coalesce(p_confirm, '')) <> c.name then raise exception 'KONFIRMASI_SALAH'; end if;
  delete from classes where id = p_class;
end $$;

create or replace function public.delete_school(p_school uuid, p_confirm text)
returns void language plpgsql security definer set search_path = public as $$
declare s schools;
begin
  if not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
  select * into s from schools where id = p_school;
  if not found then raise exception 'TIDAK_DITEMUKAN'; end if;
  if s.is_active then raise exception 'HARUS_NONAKTIF'; end if;
  if exists (select 1 from classes where school_id = p_school and is_active) then raise exception 'KELAS_MASIH_AKTIF'; end if;
  if trim(coalesce(p_confirm, '')) <> s.name then raise exception 'KONFIRMASI_SALAH'; end if;
  delete from classes where school_id = p_school;
  delete from schools where id = p_school;
end $$;

-- Menunjuk atau mencabut Admin Kelas. Hanya Main Admin; batas jumlah dijaga di sini.
create or replace function public.set_class_admin(p_member uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  m class_members;
  v_role uuid;
  v_count int;
begin
  if not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
  select * into m from class_members where id = p_member;
  if not found then raise exception 'TIDAK_DITEMUKAN'; end if;
  perform ensure_system_roles(m.class_id);
  select id into v_role from roles where class_id = m.class_id and system_key = 'admin_kelas';

  if p_on then
    if m.status <> 'active' then raise exception 'ANGGOTA_BELUM_AKTIF'; end if;
    if exists (select 1 from member_roles where member_id = p_member and role_id = v_role) then return; end if;
    select count(*) into v_count from class_members cm
      join member_roles mr on mr.member_id = cm.id
      where cm.class_id = m.class_id and cm.status = 'active' and mr.role_id = v_role;
    if v_count >= class_admin_limit(m.class_id) then raise exception 'BATAS_ADMIN'; end if;
    insert into member_roles (member_id, role_id) values (p_member, v_role);
  else
    delete from member_roles where member_id = p_member and role_id = v_role;
  end if;

  insert into audit_logs (scope, class_id, school_id, actor_id, action, target_id, detail)
  values ('sistem', null, (select school_id from classes where id = m.class_id), auth.uid(),
          case when p_on then 'admin_kelas.beri' else 'admin_kelas.cabut' end, p_member::text,
          jsonb_build_object('label', m.display_name, 'kelas', (select name from classes where id = m.class_id)));
end $$;

create or replace function public.set_max_admins_default(p_value int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
  if p_value is null or p_value < 1 or p_value > 20 then raise exception 'BATAS_TIDAK_VALID'; end if;
  update system_settings set value = to_jsonb(p_value), updated_at = now() where key = 'max_admins_per_class';
end $$;

create or replace function public.log_console_login() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
  insert into audit_logs (scope, actor_id, action, detail)
  values ('sistem', auth.uid(), 'konsol.login', jsonb_build_object('label', (select full_name from profiles where id = auth.uid())));
end $$;

-- Hitungan per kelas untuk Dashboard dan Ringkasan, satu panggilan.
create or replace function public.console_tallies()
returns table (class_id uuid, school_id uuid, active int, pending int, admins int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
  return query
  select c.id, c.school_id,
    (select count(*)::int from class_members m where m.class_id = c.id and m.status = 'active'),
    (select count(*)::int from class_members m where m.class_id = c.id and m.status = 'pending'),
    (select count(*)::int from class_members m
       join member_roles mr on mr.member_id = m.id join roles r on r.id = mr.role_id
       where m.class_id = c.id and m.status = 'active' and r.system_key = 'admin_kelas')
  from classes c;
end $$;

-- Murid satu kelas lengkap dengan kontak dan role, untuk tingkat ketiga Ringkasan.
create or replace function public.console_class_members(p_class uuid)
returns table (member_id uuid, user_id uuid, display_name text, status text, nomor_absen text, nis text,
               jenis_kelamin text, username text, email text, wa text, is_admin boolean, roles jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
  return query
  select m.id, m.user_id, m.display_name, m.status, m.nomor_absen, m.nis, m.jenis_kelamin,
         p.username, pc.email, pc.wa,
         exists (select 1 from member_roles mr join roles r on r.id = mr.role_id
                 where mr.member_id = m.id and r.system_key = 'admin_kelas'),
         coalesce((select jsonb_agg(jsonb_build_object('name', r.name, 'color', r.color) order by r.position)
                   from member_roles mr join roles r on r.id = mr.role_id
                   where mr.member_id = m.id and r.system_key is distinct from 'murid'), '[]'::jsonb)
  from class_members m
  join profiles p on p.id = m.user_id
  left join profile_contacts pc on pc.user_id = m.user_id
  where m.class_id = p_class and m.status in ('active', 'pending')
  order by m.display_name;
end $$;

-- Semua Admin Kelas di semua kelas, untuk halaman Atur Role.
create or replace function public.console_admins()
returns table (member_id uuid, user_id uuid, class_id uuid, class_name text, school_id uuid, school_name text,
               display_name text, username text, email text, wa text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
  return query
  select m.id, m.user_id, c.id, c.name, s.id, s.name, m.display_name, p.username, pc.email, pc.wa
  from class_members m
  join classes c on c.id = m.class_id
  join schools s on s.id = c.school_id
  join profiles p on p.id = m.user_id
  left join profile_contacts pc on pc.user_id = m.user_id
  join member_roles mr on mr.member_id = m.id
  join roles r on r.id = mr.role_id and r.system_key = 'admin_kelas'
  where m.status = 'active'
  order by s.name, c.name, m.display_name;
end $$;

-- ---------------------------------------------------------------- edit akun (dipanggil Edge Function)

-- Boleh atau tidak diputuskan di sini: Main Admin mengubah siapa pun; Admin Kelas hanya murid
-- di kelasnya yang peringkatnya lebih rendah. Mengembalikan kelas terkait (bisa null untuk Main Admin).
create or replace function public.authorize_account_edit(p_caller uuid, p_target uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_class uuid;
begin
  if p_caller is null or p_target is null or p_caller = p_target then raise exception 'TIDAK_DIIZINKAN'; end if;

  if exists (select 1 from profiles where id = p_caller and is_platform_owner) then
    select class_id into v_class from class_members where user_id = p_target order by created_at limit 1;
    return v_class;
  end if;

  if exists (select 1 from profiles where id = p_target and is_platform_owner) then
    raise exception 'TIDAK_DIIZINKAN';
  end if;

  select t.class_id into v_class
  from class_members t
  join class_members a on a.class_id = t.class_id
  where t.user_id = p_target and t.status in ('pending', 'active')
    and a.user_id = p_caller and a.status = 'active'
    and exists (select 1 from member_roles mr join roles r on r.id = mr.role_id
                where mr.member_id = a.id and r.system_key = 'admin_kelas')
    and not exists (select 1 from member_roles mr join roles r on r.id = mr.role_id
                    where mr.member_id = t.id and r.system_key = 'admin_kelas')
  limit 1;
  if v_class is null then raise exception 'TIDAK_DIIZINKAN'; end if;
  return v_class;
end $$;

create or replace function public.authorize_password_reset(p_caller uuid, p_target uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select public.authorize_account_edit(p_caller, p_target)
$$;

-- Catat ke log sistem bila pelakunya Main Admin, ke log kelas bila Admin Kelas.
create or replace function public.record_account_edit(p_caller uuid, p_target uuid, p_action text, p_fields text[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner boolean := exists (select 1 from profiles where id = p_caller and is_platform_owner);
  v_class uuid := (select class_id from class_members where user_id = p_target order by created_at limit 1);
begin
  insert into audit_logs (scope, class_id, school_id, actor_id, action, target_id, detail)
  values (
    case when v_owner then 'sistem' else 'kelas' end,
    case when v_owner then null else v_class end,
    (select school_id from classes where id = v_class),
    p_caller, p_action, p_target::text,
    jsonb_build_object('label', (select full_name from profiles where id = p_target), 'perubahan', to_jsonb(p_fields))
  );
end $$;

create or replace function public.record_password_reset(p_caller uuid, p_target uuid) returns void
language sql security definer set search_path = public as $$
  select public.record_account_edit(p_caller, p_target, 'akun.reset_sandi', array['sandi'])
$$;

-- ---------------------------------------------------------------- hak akses

revoke all on public.schools, public.system_settings, public.system_announcements, public.system_announcement_reads from anon;
grant select, insert, update, delete on public.schools, public.system_settings,
  public.system_announcements, public.system_announcement_reads to authenticated;

-- Kode kelas tetap tidak terbaca lewat API; kolom baru dibuka satu per satu.
revoke select on public.classes from authenticated;
grant select (id, name, school_id, max_admins, is_active, created_at) on public.classes to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'create_class(text, uuid)', 'update_class(uuid, text, uuid, int)', 'set_class_active(uuid, boolean)',
    'delete_class(uuid, text)', 'delete_school(uuid, text)', 'set_class_admin(uuid, boolean)',
    'set_max_admins_default(int)', 'log_console_login()', 'console_tallies()', 'console_class_members(uuid)',
    'console_admins()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;

  foreach f in array array[
    'authorize_account_edit(uuid, uuid)', 'record_account_edit(uuid, uuid, text, text[])',
    'authorize_password_reset(uuid, uuid)', 'record_password_reset(uuid, uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.authorize_account_edit(uuid, uuid) to service_role;
    grant execute on function public.record_account_edit(uuid, uuid, text, text[]) to service_role;
    grant execute on function public.authorize_password_reset(uuid, uuid) to service_role;
    grant execute on function public.record_password_reset(uuid, uuid) to service_role;
  end if;
end $$;

grant execute on function public.registration_error(text, text, text, text, text, uuid) to anon, authenticated;

select set_config('kelasku.migrasi', '0', false);
