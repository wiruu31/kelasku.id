-- Kelasku.id v1.0.0: skema lengkap untuk instalasi baru (gabungan migrations/*.sql).
-- Jangan diedit langsung. Ubah berkas di migrations/, lalu jalankan: ./gabung-schema.sh
-- Naik dari v0.2.0? Jangan pakai berkas ini; jalankan migrations/002_rombak_v030.sql lalu 003_fitur_kelas_v040.sql dan 004_push_v100.sql.

-- ======== migrations/001_dasar_v020.sql
-- Kelasku.id: skema dasar (versi 0.2.0). Jalankan 002_rombak_v030.sql sesudahnya.
-- Aman diulang.

-- ---------------------------------------------------------------- tabel

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  username text not null,
  is_platform_owner boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);
-- Tutorial awal: terisi saat pengguna selesai atau melewati tur, supaya tidak muncul lagi di perangkat lain.
alter table public.profiles add column if not exists tour_done_at timestamptz;
create unique index if not exists profiles_username_key on public.profiles (lower(username));

-- Kontak dipisah dari profil supaya teman sekelas tidak bisa membaca email dan nomor WA.
create table if not exists public.profile_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email text not null,
  wa text not null
);
create unique index if not exists profile_contacts_email_key on public.profile_contacts (lower(email));
create unique index if not exists profile_contacts_wa_key on public.profile_contacts (wa);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  school_name text check (school_name is null or char_length(school_name) <= 120),
  join_code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint classes_join_code_format check (join_code ~ '^[A-Z2-9]{6,12}$' and join_code !~ '[OI]')
);
create unique index if not exists classes_join_code_key on public.classes (join_code);

create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'removed')),
  is_admin boolean not null default false,
  nomor_absen text check (nomor_absen is null or char_length(nomor_absen) <= 20),
  nis text check (nis is null or char_length(nis) <= 30),
  approved_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (class_id, user_id)
);
-- Nama lengkap tidak boleh kembar di satu kelas, tapi boleh kembar antarkelas.
create unique index if not exists class_members_name_key
  on public.class_members (class_id, lower(display_name))
  where status in ('pending', 'active');
create index if not exists class_members_user_idx on public.class_members (user_id);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 30),
  color text not null default '#d7f36b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position int not null check (position >= 0), -- makin kecil makin tinggi
  created_at timestamptz not null default now()
);
create unique index if not exists roles_name_key on public.roles (class_id, lower(name));

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission text not null check (permission ~ '^[a-z_]+\.[a-z_]+$'),
  scope text not null default 'semua' check (scope in ('semua', 'milik')),
  primary key (role_id, permission)
);

create table if not exists public.member_roles (
  member_id uuid not null references public.class_members (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  primary key (member_id, role_id)
);
create index if not exists member_roles_role_idx on public.member_roles (role_id);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  class_id uuid references public.classes (id) on delete cascade,
  actor_id uuid,
  action text not null,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_class_idx on public.audit_logs (class_id, created_at desc);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 120),
  body text not null check (char_length(body) <= 4000),
  pinned boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists announcements_class_idx on public.announcements (class_id, pinned desc, created_at desc);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 7), -- 1 = Senin
  start_time time not null,
  end_time time not null,
  subject text not null check (char_length(trim(subject)) between 1 and 80),
  teacher text check (teacher is null or char_length(teacher) <= 80),
  room text check (room is null or char_length(room) <= 40),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists schedules_class_idx on public.schedules (class_id, day_of_week, start_time);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 120),
  description text check (description is null or char_length(description) <= 4000),
  subject text check (subject is null or char_length(subject) <= 80),
  due_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists tasks_class_idx on public.tasks (class_id, due_at);

-- ---------------------------------------------------------------- fungsi bantu
-- Semua security definer agar bisa dipakai di policy tanpa rekursi RLS.

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_owner from profiles where id = auth.uid()), false)
$$;

create or replace function public.is_class_member(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from class_members
    where class_id = p_class and user_id = auth.uid() and status = 'active'
  )
$$;

create or replace function public.is_class_admin(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from class_members
    where class_id = p_class and user_id = auth.uid() and status = 'active' and is_admin
  )
$$;

-- Izin "milik" terpenuhi oleh "semua" maupun "milik"; izin "semua" hanya oleh "semua".
create or replace function public.has_perm(p_class uuid, p_perm text, p_scope text default 'semua')
returns boolean language sql stable security definer set search_path = public as $$
  select is_owner() or exists (
    select 1 from class_members m
    where m.class_id = p_class and m.user_id = auth.uid() and m.status = 'active'
      and (
        m.is_admin or exists (
          select 1 from member_roles mr
          join role_permissions rp on rp.role_id = mr.role_id
          where mr.member_id = m.id and rp.permission = p_perm
            and (rp.scope = 'semua' or p_scope = 'milik')
        )
      )
  )
$$;

-- Peringkat tertinggi milik pengguna di kelas ini. Admin dan pemilik = -1 (di atas semua role).
create or replace function public.my_top_position(p_class uuid) returns int
language sql stable security definer set search_path = public as $$
  select case
    when is_owner() or is_class_admin(p_class) then -1
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
  select case
    when (select is_admin from class_members where id = p_member) then -1
    else coalesce((
      select min(r.position) from member_roles mr
      join roles r on r.id = mr.role_id where mr.member_id = p_member
    ), 2147483647)
  end
$$;

create or replace function public.can_manage_role(p_role uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roles r
    where r.id = p_role
      and (is_owner() or is_class_admin(r.class_id)
           or (has_perm(r.class_id, 'role.kelola') and r.position > my_top_position(r.class_id)))
  )
$$;

-- Hanya boleh memberi izin yang dimiliki sendiri.
create or replace function public.can_grant(p_role uuid, p_perm text, p_scope text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roles r
    where r.id = p_role and (is_owner() or is_class_admin(r.class_id) or has_perm(r.class_id, p_perm, p_scope))
  )
$$;

create or replace function public.can_assign_role(p_member uuid, p_role uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from roles r join class_members m on m.class_id = r.class_id
    where r.id = p_role and m.id = p_member and can_manage_role(p_role)
      and my_top_position(r.class_id) < member_top_position(p_member)
  )
$$;

create or replace function public.norm_name(p text) returns text
language sql immutable as $$
  select trim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'))
$$;

-- 08xx, 8xx, +62xx, 62xx semuanya menjadi 628xx.
create or replace function public.norm_wa(p text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d like '0%' then d := '62' || substr(d, 2);
  elsif d like '8%' then d := '62' || d;
  end if;
  return d;
end $$;

create or replace function public.generate_join_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from classes where join_code = code);
  end loop;
  return code;
end $$;

-- ---------------------------------------------------------------- trigger

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists announcements_touch on public.announcements;
create trigger announcements_touch before update on public.announcements
  for each row execute function public.touch_updated_at();

create or replace function public.classes_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.join_code is null or new.join_code = '' then
    new.join_code := generate_join_code();
  end if;
  new.join_code := upper(new.join_code);
  return new;
end $$;
-- join_code not null: beri nilai awal kosong lewat default agar trigger yang mengisi.
alter table public.classes alter column join_code set default 'AAAAAA';
create or replace function public.classes_before_insert_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.join_code = 'AAAAAA' then new.join_code := generate_join_code(); end if;
  new.join_code := upper(new.join_code);
  return new;
end $$;
drop trigger if exists classes_fill_code on public.classes;
create trigger classes_fill_code before insert on public.classes
  for each row execute function public.classes_before_insert_fill();
drop function if exists public.classes_before_insert();

-- Validasi pendaftaran satu pintu. Mengembalikan kode galat, atau null kalau lolos.
-- Dipanggil klien sebelum signUp (pesan galat dari trigger disembunyikan Supabase) dan
-- sekali lagi oleh trigger di bawah sebagai pengaman.
-- p_self: akun yang sedang dibuat (dari trigger), dikecualikan dari cek email kembar.
drop function if exists public.registration_error(text, text, text, text, text);
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
  if not v_class.is_active then return 'KELAS_NONAKTIF'; end if;

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

-- Pendaftaran: Supabase membuat akun, trigger ini membuat profil dan keanggotaan pending.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_err text;
  v_class uuid;
begin
  v_err := registration_error(
    meta ->> 'full_name', meta ->> 'username', new.email, meta ->> 'wa', meta ->> 'join_code', new.id
  );
  if v_err is not null then raise exception '%', v_err; end if;

  select id into v_class from classes where join_code = upper(trim(meta ->> 'join_code'));
  insert into profiles (id, full_name, username)
    values (new.id, norm_name(meta ->> 'full_name'), lower(trim(meta ->> 'username')));
  insert into profile_contacts (user_id, email, wa)
    values (new.id, lower(new.email), norm_wa(meta ->> 'wa'));
  insert into class_members (class_id, user_id, display_name)
    values (v_class, new.id, norm_name(meta ->> 'full_name'));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profil: flag pemilik platform tidak boleh diubah dari aplikasi (hanya dari SQL Editor).
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.is_platform_owner is distinct from old.is_platform_owner then
    raise exception 'TIDAK_DIIZINKAN';
  end if;
  if auth.uid() is not null and new.id is distinct from old.id then
    raise exception 'TIDAK_DIIZINKAN';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg before update on public.profiles
  for each row execute function public.profiles_guard();

-- Keanggotaan: aturan kolom mana yang boleh diubah siapa.
create or replace function public.class_members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  admins int;
  privileged boolean;
begin
  if auth.uid() is null then return new; end if;
  privileged := is_owner() or is_class_admin(old.class_id);

  if new.class_id is distinct from old.class_id
     or new.user_id is distinct from old.user_id
     or new.display_name is distinct from old.display_name then
    raise exception 'TIDAK_DIIZINKAN';
  end if;

  if new.is_admin is distinct from old.is_admin then
    if not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
    if new.is_admin then
      select count(*) into admins from class_members
        where class_id = new.class_id and is_admin and status = 'active' and id <> new.id;
      if admins >= 3 or new.status <> 'active' then raise exception 'BATAS_ADMIN'; end if;
    end if;
  end if;

  if new.status is distinct from old.status then
    if not (privileged or has_perm(old.class_id, 'akun.approve')) then raise exception 'TIDAK_DIIZINKAN'; end if;
    if old.user_id = auth.uid() and not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
    if new.status = 'active' then
      new.approved_by := auth.uid();
    end if;
    if new.status <> 'active' and old.is_admin and not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
  end if;

  if (new.nomor_absen is distinct from old.nomor_absen or new.nis is distinct from old.nis)
     and old.user_id <> auth.uid() and not privileged then
    raise exception 'TIDAK_DIIZINKAN';
  end if;
  return new;
end $$;
drop trigger if exists class_members_guard_trg on public.class_members;
create trigger class_members_guard_trg before update on public.class_members
  for each row execute function public.class_members_guard();

-- Jejak aktivitas otomatis dari trigger, jadi tidak bergantung pada klien.
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_class uuid;
  v_detail jsonb;
begin
  v_class := case
    when tg_table_name = 'classes' then (r ->> 'id')::uuid
    when tg_table_name = 'member_roles' then (select class_id from class_members where id = (r ->> 'member_id')::uuid)
    else (r ->> 'class_id')::uuid
  end;
  v_detail := jsonb_strip_nulls(jsonb_build_object(
    'label', coalesce(r ->> 'title', r ->> 'name', r ->> 'subject', r ->> 'display_name'),
    'status_dari', case when o ? 'status' and o ->> 'status' <> r ->> 'status' then o ->> 'status' end,
    'status_ke', case when o ? 'status' and o ->> 'status' <> r ->> 'status' then r ->> 'status' end,
    'admin_ke', case when o ? 'is_admin' and o ->> 'is_admin' <> r ->> 'is_admin' then r ->> 'is_admin' end,
    'anggota', case when tg_table_name = 'member_roles'
      then (select display_name from class_members where id = (r ->> 'member_id')::uuid) end,
    'role', case when tg_table_name = 'member_roles'
      then (select name from roles where id = (r ->> 'role_id')::uuid) end
  ));
  -- Update keanggotaan yang tidak mengubah status atau admin (mis. nomor absen) tidak dicatat.
  if tg_table_name = 'class_members' and tg_op = 'UPDATE' and v_detail = jsonb_build_object('label', r ->> 'display_name') then
    return new;
  end if;
  insert into audit_logs (class_id, actor_id, action, target_id, detail)
  values (v_class, auth.uid(), tg_table_name || '.' || lower(tg_op), coalesce(r ->> 'id', r ->> 'member_id'), v_detail);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['class_members', 'roles', 'member_roles', 'announcements', 'schedules', 'tasks']
  loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- RPC

create or replace function public.create_class(p_name text, p_school text default null)
returns public.classes language plpgsql security definer set search_path = public as $$
declare c classes;
begin
  if not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
  insert into classes (name, school_name) values (trim(p_name), nullif(trim(p_school), '')) returning * into c;
  insert into audit_logs (class_id, actor_id, action, target_id, detail)
  values (c.id, auth.uid(), 'classes.insert', c.id::text, jsonb_build_object('label', c.name));
  return c;
end $$;

create or replace function public.change_join_code(p_class uuid, p_code text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not (is_owner() or is_class_admin(p_class) or has_perm(p_class, 'kode.kelola')) then
    raise exception 'TIDAK_DIIZINKAN';
  end if;
  v_code := upper(trim(coalesce(p_code, '')));
  if v_code = '' then v_code := generate_join_code(); end if;
  if v_code !~ '^[A-Z2-9]{6,12}$' or v_code ~ '[OI]' then raise exception 'KODE_FORMAT_SALAH'; end if;
  if exists (select 1 from classes where join_code = v_code and id <> p_class) then raise exception 'KODE_SUDAH_DIPAKAI'; end if;
  update classes set join_code = v_code where id = p_class;
  insert into audit_logs (class_id, actor_id, action, target_id)
  values (p_class, auth.uid(), 'classes.kode_diubah', p_class::text);
  return v_code;
end $$;

create or replace function public.set_class_active(p_class uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'TIDAK_DIIZINKAN'; end if;
  update classes set is_active = p_active where id = p_class;
  insert into audit_logs (class_id, actor_id, action, target_id, detail)
  values (p_class, auth.uid(), 'classes.status', p_class::text, jsonb_build_object('aktif', p_active));
end $$;

-- ---------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.member_roles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.announcements enable row level security;
alter table public.schedules enable row level security;
alter table public.tasks enable row level security;

create or replace function public.shares_class(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from class_members a join class_members b on a.class_id = b.class_id
    where a.user_id = auth.uid() and a.status = 'active'
      and b.user_id = p_user and b.status = 'active'
  )
$$;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or is_owner() or shares_class(id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- profile_contacts: diri sendiri, pemilik, dan admin kelas yang sama (untuk membantu reset sandi)
drop policy if exists contacts_select on public.profile_contacts;
create policy contacts_select on public.profile_contacts for select to authenticated
  using (
    user_id = auth.uid() or is_owner()
    or exists (
      select 1 from class_members t
      where t.user_id = profile_contacts.user_id and is_class_admin(t.class_id)
    )
  );
drop policy if exists contacts_update on public.profile_contacts;
create policy contacts_update on public.profile_contacts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- classes: pending pun boleh melihat nama kelasnya sendiri
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select to authenticated
  using (
    is_owner()
    or exists (select 1 from class_members m where m.class_id = classes.id and m.user_id = auth.uid())
  );
drop policy if exists classes_update on public.classes;
create policy classes_update on public.classes for update to authenticated
  using (is_owner()) with check (is_owner());
drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes for delete to authenticated using (is_owner());

-- class_members
drop policy if exists members_select on public.class_members;
create policy members_select on public.class_members for select to authenticated
  using (user_id = auth.uid() or is_owner() or is_class_member(class_id));
drop policy if exists members_update on public.class_members;
create policy members_update on public.class_members for update to authenticated
  using (user_id = auth.uid() or is_owner() or is_class_admin(class_id) or has_perm(class_id, 'akun.approve'))
  with check (user_id = auth.uid() or is_owner() or is_class_admin(class_id) or has_perm(class_id, 'akun.approve'));

-- roles
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles for select to authenticated
  using (is_owner() or is_class_member(class_id));
drop policy if exists roles_insert on public.roles;
create policy roles_insert on public.roles for insert to authenticated
  with check (
    is_owner() or is_class_admin(class_id)
    or (has_perm(class_id, 'role.kelola') and position > my_top_position(class_id))
  );
drop policy if exists roles_update on public.roles;
create policy roles_update on public.roles for update to authenticated
  using (can_manage_role(id))
  with check (
    is_owner() or is_class_admin(class_id)
    or (has_perm(class_id, 'role.kelola') and position > my_top_position(class_id))
  );
drop policy if exists roles_delete on public.roles;
create policy roles_delete on public.roles for delete to authenticated using (can_manage_role(id));

-- role_permissions
drop policy if exists rperm_select on public.role_permissions;
create policy rperm_select on public.role_permissions for select to authenticated
  using (exists (select 1 from roles r where r.id = role_id and (is_owner() or is_class_member(r.class_id))));
drop policy if exists rperm_insert on public.role_permissions;
create policy rperm_insert on public.role_permissions for insert to authenticated
  with check (can_manage_role(role_id) and can_grant(role_id, permission, scope));
drop policy if exists rperm_update on public.role_permissions;
create policy rperm_update on public.role_permissions for update to authenticated
  using (can_manage_role(role_id))
  with check (can_manage_role(role_id) and can_grant(role_id, permission, scope));
drop policy if exists rperm_delete on public.role_permissions;
create policy rperm_delete on public.role_permissions for delete to authenticated
  using (can_manage_role(role_id));

-- member_roles
drop policy if exists mroles_select on public.member_roles;
create policy mroles_select on public.member_roles for select to authenticated
  using (exists (
    select 1 from class_members m
    where m.id = member_id and (is_owner() or is_class_member(m.class_id))
  ));
drop policy if exists mroles_insert on public.member_roles;
create policy mroles_insert on public.member_roles for insert to authenticated
  with check (can_assign_role(member_id, role_id));
drop policy if exists mroles_delete on public.member_roles;
create policy mroles_delete on public.member_roles for delete to authenticated
  using (can_assign_role(member_id, role_id));

-- audit_logs: hanya baca; penulisan lewat trigger dan RPC
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated
  using (class_id is not null and has_perm(class_id, 'log.lihat'));

-- modul isi: semua anggota aktif boleh melihat; tambah, ubah, hapus mengikuti izin dan cakupan.
-- Nama izin memakai nama modul (pengumuman.buat), bukan nama tabel.
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
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (is_owner() or is_class_member(class_id))', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (has_perm(class_id, %2$L) and created_by = auth.uid())', t, m || '.buat');
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format($p$create policy %1$s_update on public.%1$s for update to authenticated
      using (has_perm(class_id, %2$L) or (created_by = auth.uid() and has_perm(class_id, %2$L, 'milik')))
      with check (has_perm(class_id, %2$L) or (created_by = auth.uid() and has_perm(class_id, %2$L, 'milik')))$p$, t, m || '.ubah');
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format($p$create policy %1$s_delete on public.%1$s for delete to authenticated
      using (has_perm(class_id, %2$L) or (created_by = auth.uid() and has_perm(class_id, %2$L, 'milik')))$p$, t, m || '.hapus');
  end loop;
end $$;

-- ---------------------------------------------------------------- hak akses

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.create_class(text, text) to authenticated;
grant execute on function public.change_join_code(uuid, text) to authenticated;
grant execute on function public.set_class_active(uuid, boolean) to authenticated;
-- Pengecekan pendaftaran harus bisa dipanggil sebelum pengguna punya akun.
grant execute on function public.registration_error(text, text, text, text, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------- tugas 5: kode kelas dan reset sandi

-- Kode kelas tidak boleh terbaca lewat API oleh semua anggota. Kolom join_code dikeluarkan
-- dari hak baca, lalu dibuka lewat get_join_code untuk yang berwenang.
revoke select on public.classes from authenticated;
grant select (id, name, school_name, is_active, created_at) on public.classes to authenticated;

create or replace function public.get_join_code(p_class uuid) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_owner() or is_class_admin(p_class) or has_perm(p_class, 'kode.kelola')) then
    raise exception 'TIDAK_DIIZINKAN';
  end if;
  return (select join_code from classes where id = p_class);
end $$;
grant execute on function public.get_join_code(uuid) to authenticated;

-- Reset sandi oleh admin: Edge Function admin-reset-password memanggil dua fungsi ini
-- dengan service_role. Keputusan boleh atau tidak diambil di sini, bukan di Edge Function.
create or replace function public.authorize_password_reset(p_caller uuid, p_target uuid) returns uuid
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
    and a.user_id = p_caller and a.status = 'active' and a.is_admin
  limit 1;
  if v_class is null then raise exception 'TIDAK_DIIZINKAN'; end if;
  return v_class;
end $$;

create or replace function public.record_password_reset(p_caller uuid, p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (class_id, actor_id, action, target_id, detail)
  values (
    (select class_id from class_members where user_id = p_target order by created_at limit 1),
    p_caller, 'akun.reset_sandi', p_target::text,
    jsonb_build_object('label', (select full_name from profiles where id = p_target))
  );
end $$;

revoke execute on function public.authorize_password_reset(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.record_password_reset(uuid, uuid) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.authorize_password_reset(uuid, uuid) to service_role;
    grant execute on function public.record_password_reset(uuid, uuid) to service_role;
  end if;
end $$;

-- ======== migrations/002_rombak_v030.sql
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

-- ======== migrations/003_fitur_kelas_v040.sql
-- Kelasku.id v0.4.0: piket, voting, kas, foto profil.
-- Naik dari v0.3.0: cadangkan dulu, lalu jalankan file ini di SQL Editor. Aman diulang.
-- Instalasi baru: jalankan supabase/schema.sql, bukan file ini.
--
-- Izin baru (semua mati untuk Murid bawaan sampai Admin Kelas menyalakannya):
--   piket.{akses,lihat,tambah,hapus}  voting.{akses,lihat,tambah,ubah,hapus}
--   kas.{akses,lihat,tambah,ubah,hapus}  organigram.akses

-- ---------------------------------------------------------------- piket

create table if not exists public.piket_duties (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 7),
  member_id uuid not null references public.class_members (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (class_id, day_of_week, member_id)
);
create index if not exists piket_duties_class_idx on public.piket_duties (class_id, day_of_week);

create or replace function public.piket_duties_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from class_members m where m.id = new.member_id and m.class_id = new.class_id and m.status = 'active') then
    raise exception 'ANGGOTA_TIDAK_VALID';
  end if;
  return new;
end $$;
drop trigger if exists piket_duties_guard_trg on public.piket_duties;
create trigger piket_duties_guard_trg before insert on public.piket_duties
  for each row execute function public.piket_duties_guard();

-- ---------------------------------------------------------------- voting

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 120),
  description text check (description is null or char_length(description) <= 500),
  mode text not null check (mode in ('terlihat', 'anonim_akhir', 'anonim_banyak')),
  closes_at timestamptz,
  closed_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists polls_class_idx on public.polls (class_id, created_at desc);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  position int not null default 0
);
create index if not exists poll_options_poll_idx on public.poll_options (poll_id, position);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (poll_id, option_id, user_id)
);

-- ---------------------------------------------------------------- kas

create table if not exists public.kas_entries (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  kind text not null check (kind in ('masuk', 'keluar')),
  amount bigint not null check (amount > 0 and amount <= 1000000000000),
  note text not null check (char_length(trim(note)) between 1 and 120),
  entry_date date not null,
  source text check (source is null or source = 'iuran'),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists kas_entries_class_idx on public.kas_entries (class_id, entry_date desc, created_at desc);

create table if not exists public.kas_dues (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 60),
  amount bigint not null check (amount > 0 and amount <= 1000000000),
  period text not null check (period in ('mingguan', 'bulanan')),
  starts_on date not null,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists kas_dues_class_idx on public.kas_dues (class_id, created_at desc);

-- Satu baris = satu murid sudah bayar satu periode. Menghapus catatan pemasukan ikut membatalkannya.
create table if not exists public.kas_due_payments (
  id uuid primary key default gen_random_uuid(),
  due_id uuid not null references public.kas_dues (id) on delete cascade,
  member_id uuid not null references public.class_members (id) on delete cascade,
  period_key text not null check (period_key ~ '^[0-9]{4}-(W[0-9]{2}|[0-9]{2})$'),
  entry_id uuid not null references public.kas_entries (id) on delete cascade,
  marked_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (due_id, member_id, period_key)
);
create index if not exists kas_due_payments_due_idx on public.kas_due_payments (due_id, period_key);

-- ---------------------------------------------------------------- foto profil

alter table public.profiles add column if not exists avatar_path text
  check (avatar_path is null or char_length(avatar_path) <= 200);

-- Foto hanya boleh menunjuk berkas di folder sendiri.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.is_platform_owner is distinct from old.is_platform_owner then
    raise exception 'TIDAK_DIIZINKAN';
  end if;
  if auth.uid() is not null and new.id is distinct from old.id then
    raise exception 'TIDAK_DIIZINKAN';
  end if;
  if new.avatar_path is distinct from old.avatar_path and new.avatar_path is not null
     and new.avatar_path not like new.id::text || '/%' then
    raise exception 'TIDAK_DIIZINKAN';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- log kelas

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
  if v_class is null or not exists (select 1 from classes where id = v_class) then return coalesce(new, old); end if;
  if tg_table_name = 'member_roles' then
    select system_key into v_key from roles where id = (r ->> 'role_id')::uuid;
    if v_key = 'murid' then return coalesce(new, old); end if;
  end if;

  v_detail := jsonb_strip_nulls(jsonb_build_object(
    'label', coalesce(r ->> 'title', r ->> 'name', r ->> 'subject', r ->> 'display_name', r ->> 'note'),
    'status_dari', case when o ? 'status' and o ->> 'status' <> r ->> 'status' then o ->> 'status' end,
    'status_ke', case when o ? 'status' and o ->> 'status' <> r ->> 'status' then r ->> 'status' end,
    'anggota', case
      when tg_table_name = 'member_roles' then (select display_name from class_members where id = (r ->> 'member_id')::uuid)
      when tg_table_name = 'piket_duties' then (select display_name from class_members where id = (r ->> 'member_id')::uuid)
    end,
    'role', case when tg_table_name = 'member_roles'
      then (select name from roles where id = (r ->> 'role_id')::uuid) end,
    'jumlah', case when tg_table_name = 'kas_entries' then r ->> 'amount' end,
    'jenis', case when tg_table_name = 'kas_entries' then r ->> 'kind' end,
    'hari', case when tg_table_name = 'piket_duties' then r ->> 'day_of_week' end
  ));
  if tg_table_name = 'class_members' and tg_op = 'UPDATE' and v_detail = jsonb_build_object('label', r ->> 'display_name') then
    return new;
  end if;
  insert into audit_logs (scope, class_id, school_id, actor_id, action, target_id, detail)
  values ('kelas', v_class, (select school_id from classes where id = v_class), auth.uid(),
          tg_table_name || '.' || lower(tg_op), coalesce(r ->> 'id', r ->> 'member_id'), v_detail);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['piket_duties', 'polls', 'kas_entries', 'kas_dues']
  loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- RLS

alter table public.piket_duties enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.kas_entries enable row level security;
alter table public.kas_dues enable row level security;
alter table public.kas_due_payments enable row level security;

-- Piket: lihat, tambah, hapus mengikuti izin. Tidak ada ubah: satu baris hanya pasangan hari dan murid.
drop policy if exists piket_select on public.piket_duties;
create policy piket_select on public.piket_duties for select to authenticated
  using (has_perm(class_id, 'piket.lihat'));
drop policy if exists piket_insert on public.piket_duties;
create policy piket_insert on public.piket_duties for insert to authenticated
  with check (has_perm(class_id, 'piket.tambah') and created_by = auth.uid());
drop policy if exists piket_delete on public.piket_duties;
create policy piket_delete on public.piket_duties for delete to authenticated
  using (has_perm(class_id, 'piket.hapus'));

-- Voting: pembuatan dan pencoblosan hanya lewat fungsi di bawah. Tabel suara hanya terbaca pemiliknya.
drop policy if exists polls_select on public.polls;
create policy polls_select on public.polls for select to authenticated
  using (has_perm(class_id, 'voting.lihat'));
drop policy if exists polls_delete on public.polls;
create policy polls_delete on public.polls for delete to authenticated
  using (has_perm(class_id, 'voting.hapus') or (created_by = auth.uid() and has_perm(class_id, 'voting.hapus', 'milik')));

drop policy if exists poll_options_select on public.poll_options;
create policy poll_options_select on public.poll_options for select to authenticated
  using (exists (select 1 from polls p where p.id = poll_id and has_perm(p.class_id, 'voting.lihat')));

drop policy if exists poll_votes_select on public.poll_votes;
create policy poll_votes_select on public.poll_votes for select to authenticated
  using (user_id = auth.uid());

-- Kas: pemasukan dan pengeluaran. Catatan hasil iuran tidak boleh diubah langsung.
drop policy if exists kas_entries_select on public.kas_entries;
create policy kas_entries_select on public.kas_entries for select to authenticated
  using (has_perm(class_id, 'kas.lihat'));
drop policy if exists kas_entries_insert on public.kas_entries;
create policy kas_entries_insert on public.kas_entries for insert to authenticated
  with check (has_perm(class_id, 'kas.tambah') and created_by = auth.uid() and source is null);
drop policy if exists kas_entries_update on public.kas_entries;
create policy kas_entries_update on public.kas_entries for update to authenticated
  using (source is null and (has_perm(class_id, 'kas.ubah') or (created_by = auth.uid() and has_perm(class_id, 'kas.ubah', 'milik'))))
  with check (source is null and (has_perm(class_id, 'kas.ubah') or (created_by = auth.uid() and has_perm(class_id, 'kas.ubah', 'milik'))));
drop policy if exists kas_entries_delete on public.kas_entries;
create policy kas_entries_delete on public.kas_entries for delete to authenticated
  using (has_perm(class_id, 'kas.hapus') or (created_by = auth.uid() and has_perm(class_id, 'kas.hapus', 'milik')));

drop policy if exists kas_dues_select on public.kas_dues;
create policy kas_dues_select on public.kas_dues for select to authenticated
  using (has_perm(class_id, 'kas.lihat'));
drop policy if exists kas_dues_insert on public.kas_dues;
create policy kas_dues_insert on public.kas_dues for insert to authenticated
  with check (has_perm(class_id, 'kas.tambah') and created_by = auth.uid());
drop policy if exists kas_dues_update on public.kas_dues;
create policy kas_dues_update on public.kas_dues for update to authenticated
  using (has_perm(class_id, 'kas.ubah') or (created_by = auth.uid() and has_perm(class_id, 'kas.ubah', 'milik')))
  with check (has_perm(class_id, 'kas.ubah') or (created_by = auth.uid() and has_perm(class_id, 'kas.ubah', 'milik')));
drop policy if exists kas_dues_delete on public.kas_dues;
create policy kas_dues_delete on public.kas_dues for delete to authenticated
  using (has_perm(class_id, 'kas.hapus') or (created_by = auth.uid() and has_perm(class_id, 'kas.hapus', 'milik')));

drop policy if exists kas_payments_select on public.kas_due_payments;
create policy kas_payments_select on public.kas_due_payments for select to authenticated
  using (exists (select 1 from kas_dues d where d.id = due_id and has_perm(d.class_id, 'kas.lihat')));

-- ---------------------------------------------------------------- fungsi voting

create or replace function public.poll_state(p_poll uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p.closed_at is not null then 'selesai'
    when p.closes_at is not null and p.closes_at <= now() then 'selesai'
    else 'berjalan' end
  from polls p where p.id = p_poll
$$;

create or replace function public.create_poll(
  p_class uuid, p_title text, p_description text, p_mode text, p_closes_at timestamptz, p_options text[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_labels text[];
  i int;
begin
  if auth.uid() is null or not has_perm(p_class, 'voting.tambah') then raise exception 'TIDAK_DIIZINKAN'; end if;
  select array_agg(trim(x)) into v_labels from unnest(coalesce(p_options, '{}')) x where trim(x) <> '';
  if coalesce(array_length(v_labels, 1), 0) < 2 or array_length(v_labels, 1) > 10 then raise exception 'OPSI_TIDAK_VALID'; end if;
  if (select count(distinct lower(x)) from unnest(v_labels) x) <> array_length(v_labels, 1) then raise exception 'OPSI_KEMBAR'; end if;
  if p_closes_at is not null and p_closes_at <= now() then raise exception 'TENGGAT_TIDAK_VALID'; end if;
  insert into polls (class_id, title, description, mode, closes_at)
  values (p_class, p_title, nullif(trim(coalesce(p_description, '')), ''), p_mode, p_closes_at)
  returning id into v_id;
  for i in 1 .. array_length(v_labels, 1) loop
    insert into poll_options (poll_id, label, position) values (v_id, v_labels[i], i);
  end loop;
  return v_id;
end $$;

create or replace function public.close_poll(p_poll uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v polls%rowtype;
begin
  select * into v from polls where id = p_poll;
  if not found then raise exception 'TIDAK_DITEMUKAN'; end if;
  if not (has_perm(v.class_id, 'voting.ubah') or (v.created_by = auth.uid() and has_perm(v.class_id, 'voting.ubah', 'milik'))) then
    raise exception 'TIDAK_DIIZINKAN';
  end if;
  if poll_state(p_poll) = 'selesai' then raise exception 'VOTING_SELESAI'; end if;
  update polls set closed_at = now() where id = p_poll;
end $$;

create or replace function public.cast_vote(p_poll uuid, p_options uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v polls%rowtype;
  v_opts uuid[];
begin
  select * into v from polls where id = p_poll;
  if not found then raise exception 'TIDAK_DITEMUKAN'; end if;
  if auth.uid() is null or not has_perm(v.class_id, 'voting.lihat')
     or not exists (select 1 from class_members m where m.class_id = v.class_id and m.user_id = auth.uid() and m.status = 'active') then
    raise exception 'TIDAK_DIIZINKAN';
  end if;
  if poll_state(p_poll) = 'selesai' then raise exception 'VOTING_SELESAI'; end if;
  select array_agg(distinct x) into v_opts from unnest(coalesce(p_options, '{}')) x;
  if coalesce(array_length(v_opts, 1), 0) = 0 then raise exception 'PILIHAN_KOSONG'; end if;
  if (select count(*) from poll_options o where o.poll_id = p_poll and o.id = any (v_opts)) <> array_length(v_opts, 1) then
    raise exception 'PILIHAN_TIDAK_VALID';
  end if;
  if v.mode <> 'anonim_banyak' and array_length(v_opts, 1) > 1 then raise exception 'SATU_PILIHAN'; end if;
  if exists (select 1 from poll_votes where poll_id = p_poll and user_id = auth.uid()) then
    -- Hanya mode terlihat yang boleh mengganti suara.
    if v.mode <> 'terlihat' then raise exception 'SUDAH_MEMILIH'; end if;
    delete from poll_votes where poll_id = p_poll and user_id = auth.uid();
  end if;
  insert into poll_votes (poll_id, option_id, user_id) select p_poll, x, auth.uid() from unnest(v_opts) x;
end $$;

-- Bentuk hasil satu voting. Anonim: nama pemilih tidak pernah dikeluarkan.
-- anonim_akhir: angka baru dibuka setelah selesai.
create or replace function public.poll_json(p_poll uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v polls%rowtype;
  v_state text;
  v_open boolean;
begin
  select * into v from polls where id = p_poll;
  v_state := poll_state(p_poll);
  v_open := v.mode <> 'anonim_akhir' or v_state = 'selesai';
  return jsonb_build_object(
    'id', v.id, 'title', v.title, 'description', v.description, 'mode', v.mode,
    'closes_at', v.closes_at, 'closed_at', v.closed_at, 'created_at', v.created_at,
    'created_by', v.created_by, 'state', v_state, 'results_visible', v_open,
    'voters', case when v_open then (select count(distinct user_id) from poll_votes where poll_id = v.id) end,
    'my_options', coalesce((select jsonb_agg(option_id) from poll_votes where poll_id = v.id and user_id = auth.uid()), '[]'::jsonb),
    'options', (
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'label', o.label,
        'votes', case when v_open then (select count(*) from poll_votes pv where pv.option_id = o.id) end,
        'names', case when v.mode = 'terlihat' and v_open then coalesce((
          select jsonb_agg(m.display_name order by m.display_name)
          from poll_votes pv join class_members m on m.user_id = pv.user_id and m.class_id = v.class_id
          where pv.option_id = o.id), '[]'::jsonb) end
      ) order by o.position)
      from poll_options o where o.poll_id = v.id
    )
  );
end $$;

create or replace function public.class_polls(p_class uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not has_perm(p_class, 'voting.lihat') then raise exception 'TIDAK_DIIZINKAN'; end if;
  return coalesce((
    select jsonb_agg(poll_json(id) order by created_at desc)
    from (select id, created_at from polls where class_id = p_class order by created_at desc limit 50) x
  ), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- fungsi kas

create or replace function public.kas_summary(p_class uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_in bigint; v_out bigint;
begin
  if auth.uid() is null or not has_perm(p_class, 'kas.lihat') then raise exception 'TIDAK_DIIZINKAN'; end if;
  select coalesce(sum(amount) filter (where kind = 'masuk'), 0), coalesce(sum(amount) filter (where kind = 'keluar'), 0)
    into v_in, v_out from kas_entries where class_id = p_class;
  return jsonb_build_object('masuk', v_in, 'keluar', v_out, 'saldo', v_in - v_out);
end $$;

-- Menandai lunas membuat catatan pemasukan; membatalkan menghapusnya. Keduanya satu transaksi.
create or replace function public.set_due_paid(p_due uuid, p_member uuid, p_period_key text, p_paid boolean, p_date date)
returns void
language plpgsql security definer set search_path = public as $$
declare
  d kas_dues%rowtype;
  v_member class_members%rowtype;
  v_entry uuid;
begin
  select * into d from kas_dues where id = p_due;
  if not found then raise exception 'TIDAK_DITEMUKAN'; end if;
  if auth.uid() is null or not has_perm(d.class_id, 'kas.ubah') then raise exception 'TIDAK_DIIZINKAN'; end if;
  select * into v_member from class_members where id = p_member and class_id = d.class_id and status = 'active';
  if not found then raise exception 'ANGGOTA_TIDAK_VALID'; end if;
  if d.period = 'mingguan' and p_period_key !~ '^[0-9]{4}-W[0-9]{2}$' then raise exception 'PERIODE_TIDAK_VALID'; end if;
  if d.period = 'bulanan' and p_period_key !~ '^[0-9]{4}-[0-9]{2}$' then raise exception 'PERIODE_TIDAK_VALID'; end if;
  if p_paid then
    if not d.is_active then raise exception 'IURAN_NONAKTIF'; end if;
    if exists (select 1 from kas_due_payments where due_id = p_due and member_id = p_member and period_key = p_period_key) then return; end if;
    insert into kas_entries (class_id, kind, amount, note, entry_date, source)
    values (d.class_id, 'masuk', d.amount, left(d.name || ' ' || p_period_key || ': ' || v_member.display_name, 120), p_date, 'iuran')
    returning id into v_entry;
    insert into kas_due_payments (due_id, member_id, period_key, entry_id) values (p_due, p_member, p_period_key, v_entry);
  else
    delete from kas_entries where id = (
      select entry_id from kas_due_payments where due_id = p_due and member_id = p_member and period_key = p_period_key);
  end if;
end $$;

-- ---------------------------------------------------------------- foto profil

create or replace function public.can_manage_avatar(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() or is_owner() or exists (
    select 1 from class_members t where t.user_id = p_user and t.status = 'active' and is_class_admin(t.class_id))
$$;

create or replace function public.set_my_avatar(p_path text) returns text
language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if auth.uid() is null then raise exception 'TIDAK_DIIZINKAN'; end if;
  if p_path is not null and p_path not like auth.uid()::text || '/%' then raise exception 'TIDAK_DIIZINKAN'; end if;
  select avatar_path into v_old from profiles where id = auth.uid();
  update profiles set avatar_path = p_path where id = auth.uid();
  return v_old;
end $$;

-- Admin Kelas atau Main Admin mencabut foto anggota. Mengembalikan path lama untuk dihapus dari Storage.
create or replace function public.clear_avatar(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not can_manage_avatar(p_user) then raise exception 'TIDAK_DIIZINKAN'; end if;
  select avatar_path into v_old from profiles where id = p_user;
  update profiles set avatar_path = null where id = p_user;
  return v_old;
end $$;

-- Bucket privat, maksimal 300 KB per berkas. Hanya dijalankan bila Storage tersedia (Supabase).
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', false, 307200, array['image/jpeg', 'image/webp', 'image/png'])
    on conflict (id) do update set public = false, file_size_limit = 307200,
      allowed_mime_types = array['image/jpeg', 'image/webp', 'image/png'];
  end if;
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists avatars_select on storage.objects';
    execute $p$create policy avatars_select on storage.objects for select to authenticated
      using (bucket_id = 'avatars' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or public.is_owner()
        or public.shares_class(((storage.foldername(name))[1])::uuid)))$p$;
    execute 'drop policy if exists avatars_insert on storage.objects';
    execute $p$create policy avatars_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute 'drop policy if exists avatars_delete on storage.objects';
    execute $p$create policy avatars_delete on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and public.can_manage_avatar(((storage.foldername(name))[1])::uuid))$p$;
  end if;
end $$;

-- ---------------------------------------------------------------- hak akses

revoke all on public.piket_duties, public.polls, public.poll_options, public.poll_votes,
  public.kas_entries, public.kas_dues, public.kas_due_payments from anon;
grant select, insert, update, delete on public.piket_duties, public.polls, public.poll_options, public.poll_votes,
  public.kas_entries, public.kas_dues, public.kas_due_payments to authenticated;
-- Suara hanya lewat cast_vote; tabel pembuatan voting hanya lewat create_poll.
revoke insert, update on public.polls, public.poll_options from authenticated;
revoke insert, update, delete on public.poll_votes from authenticated;
-- Pembayaran iuran hanya lewat set_due_paid.
revoke insert, update, delete on public.kas_due_payments from authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'create_poll(uuid, text, text, text, timestamptz, text[])', 'close_poll(uuid)', 'cast_vote(uuid, uuid[])',
    'class_polls(uuid)', 'kas_summary(uuid)', 'set_due_paid(uuid, uuid, text, boolean, date)',
    'set_my_avatar(text)', 'clear_avatar(uuid)', 'can_manage_avatar(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['poll_json(uuid)', 'poll_state(uuid)', 'piket_duties_guard()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ======== migrations/004_push_v100.sql
-- Kelasku.id v1.0.0: notifikasi push (Web Push). Aman dijalankan berulang.
-- Pola: pemicu dan pengingat hanya mengisi antrean push_outbox. Edge Function send-push
-- mengambil antrean itu tiap menit (pg_cron + pg_net) dan mengirimnya.

-- ---------------------------------------------------------------- tabel

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 200),
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table if not exists public.push_prefs (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category text not null check (category in ('pengumuman', 'tugas', 'tenggat', 'voting', 'piket', 'siaran', 'pendaftar')),
  enabled boolean not null default true,
  primary key (user_id, category)
);

create table if not exists public.push_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  title text not null,
  body text not null,
  url text not null default '#/mading',
  dedupe_key text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  attempts int not null default 0,
  last_error text
);
create unique index if not exists push_outbox_dedupe_idx on public.push_outbox (user_id, dedupe_key) where dedupe_key is not null;
create index if not exists push_outbox_pending_idx on public.push_outbox (id) where sent_at is null;

-- Alamat Edge Function dan rahasia bersama untuk pemanggil terjadwal. Satu baris, diisi lewat SQL Editor.
create table if not exists public.push_settings (
  id boolean primary key default true check (id),
  function_url text not null,
  secret text not null
);

-- ---------------------------------------------------------------- penerima

-- Seperti has_perm, tetapi untuk pengguna tertentu (dipakai di pemicu, tanpa auth.uid()).
create or replace function public.push_user_perm(p_user uuid, p_class uuid, p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from class_members m
    where m.class_id = p_class and m.user_id = p_user and m.status = 'active'
      and (
        exists (select 1 from member_roles mr join roles r on r.id = mr.role_id
                where mr.member_id = m.id and r.system_key = 'admin_kelas')
        or exists (select 1 from member_roles mr join role_permissions rp on rp.role_id = mr.role_id
                   where mr.member_id = m.id and rp.permission = p_perm)
      )
  )
$$;

-- Pengguna siap menerima: punya perangkat terdaftar dan tidak mematikan kategori itu.
create or replace function public.push_wants(p_user uuid, p_category text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from push_subscriptions s where s.user_id = p_user)
     and not exists (select 1 from push_prefs f where f.user_id = p_user and f.category = p_category and not f.enabled)
$$;

-- Antrekan satu pesan untuk semua anggota aktif kelas yang berhak (p_perm) dan mau menerima.
create or replace function public.push_enqueue(
  p_class uuid, p_category text, p_title text, p_body text, p_url text, p_perm text default null, p_exclude uuid default null
) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into push_outbox (user_id, category, title, body, url)
  select distinct m.user_id, p_category, left(p_title, 80), left(p_body, 140), p_url
  from class_members m
  where m.class_id = p_class and m.status = 'active'
    and m.user_id is distinct from p_exclude
    and push_wants(m.user_id, p_category)
    and (p_perm is null or push_user_perm(m.user_id, p_class, p_perm));
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------- pemicu

create or replace function public.push_on_announcement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform push_enqueue(new.class_id, 'pengumuman', 'Pengumuman baru', new.title, '#/pengumuman', 'pengumuman.lihat', new.created_by);
  exception when others then null; -- push tidak boleh menggagalkan penyimpanan data
  end;
  return new;
end $$;

create or replace function public.push_on_task() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform push_enqueue(new.class_id, 'tugas', 'Tugas baru',
      case when new.subject is null or new.subject = '' then new.title else new.subject || ': ' || new.title end,
      '#/tugas', 'tugas.lihat', new.created_by);
  exception when others then null;
  end;
  return new;
end $$;

create or replace function public.push_on_poll() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform push_enqueue(new.class_id, 'voting', 'Voting baru', new.title, '#/voting', 'voting.lihat', new.created_by);
  exception when others then null;
  end;
  return new;
end $$;

create or replace function public.push_on_pending_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'pending' then return new; end if;
  begin
    perform push_enqueue(new.class_id, 'pendaftar', 'Pendaftar baru', new.display_name || ' menunggu persetujuan', '#/persetujuan', 'akun.approve', null);
  exception when others then null;
  end;
  return new;
end $$;

create or replace function public.push_on_broadcast() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into push_outbox (user_id, category, title, body, url)
    select distinct m.user_id, 'siaran', left(new.title, 80), left(new.body, 140), '#/sistem'
    from class_members m
    join classes c on c.id = m.class_id
    where m.status = 'active'
      and (new.target_type = 'all'
        or (new.target_type = 'school' and c.school_id = new.school_id)
        or (new.target_type = 'class' and c.id = new.class_id))
      and push_wants(m.user_id, 'siaran');
  exception when others then null;
  end;
  return new;
end $$;

drop trigger if exists push_announcement on public.announcements;
create trigger push_announcement after insert on public.announcements for each row execute function public.push_on_announcement();
drop trigger if exists push_task on public.tasks;
create trigger push_task after insert on public.tasks for each row execute function public.push_on_task();
drop trigger if exists push_poll on public.polls;
create trigger push_poll after insert on public.polls for each row execute function public.push_on_poll();
drop trigger if exists push_pending on public.class_members;
create trigger push_pending after insert on public.class_members for each row execute function public.push_on_pending_member();
drop trigger if exists push_broadcast on public.system_announcements;
create trigger push_broadcast after insert on public.system_announcements for each row execute function public.push_on_broadcast();

-- ---------------------------------------------------------------- pengingat terjadwal

-- Piket hari ini (hari WIB). Satu pengingat per murid per tanggal.
create or replace function public.push_enqueue_piket() returns int
language plpgsql security definer set search_path = public as $$
declare n int; v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  insert into push_outbox (user_id, category, title, body, url, dedupe_key)
  select distinct m.user_id, 'piket', 'Piket hari ini', 'Giliranmu piket hari ini di ' || c.name, '#/piket', 'piket:' || v_today
  from piket_duties d
  join class_members m on m.id = d.member_id and m.status = 'active'
  join classes c on c.id = d.class_id
  where d.day_of_week = extract(isodow from v_today)::int
    and push_wants(m.user_id, 'piket')
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Tugas yang tenggatnya besok (tanggal WIB). Satu pengingat per murid per tugas.
create or replace function public.push_enqueue_deadlines() returns int
language plpgsql security definer set search_path = public as $$
declare n int; v_tomorrow date := (now() at time zone 'Asia/Jakarta')::date + 1;
begin
  insert into push_outbox (user_id, category, title, body, url, dedupe_key)
  select distinct m.user_id, 'tenggat', 'Tenggat besok', left(t.title, 140), '#/tugas', 'tenggat:' || t.id
  from tasks t
  join class_members m on m.class_id = t.class_id and m.status = 'active'
  where (t.due_at at time zone 'Asia/Jakarta')::date = v_tomorrow
    and push_wants(m.user_id, 'tenggat')
    and push_user_perm(m.user_id, t.class_id, 'tugas.lihat')
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------- RPC untuk aplikasi

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'TIDAK_DIIZINKAN'; end if;
  -- Perangkat yang sama dipakai akun lain: langganan pindah ke akun yang sedang masuk.
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_ua, 200))
  on conflict (endpoint) do update
    set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end $$;

create or replace function public.remove_push_subscription(p_endpoint text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'TIDAK_DIIZINKAN'; end if;
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end $$;

-- ---------------------------------------------------------------- RPC untuk Edge Function (service_role)

-- Ambil pesan yang belum terkirim beserta perangkat penerimanya. Pesan yang sedang diproses tidak diambil dua kali.
create or replace function public.push_claim(p_limit int default 50) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  with picked as (
    select id from push_outbox
    where sent_at is null and attempts < 5 and (claimed_at is null or claimed_at < now() - interval '2 minutes')
    order by id limit greatest(p_limit, 1) for update skip locked
  ), upd as (
    update push_outbox o set claimed_at = now(), attempts = attempts + 1
    from picked where o.id = picked.id
    returning o.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id, 'title', u.title, 'body', u.body, 'url', u.url, 'category', u.category,
    'subs', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
                      from push_subscriptions s where s.user_id = u.user_id), '[]'::jsonb)
  ) order by u.id), '[]'::jsonb) into v from upd u;
  return v;
end $$;

create or replace function public.push_finish(p_id bigint, p_error text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_error is null then
    update push_outbox set sent_at = now(), last_error = null where id = p_id;
  else
    update push_outbox set last_error = left(p_error, 200), claimed_at = null where id = p_id;
  end if;
end $$;

create or replace function public.push_mark_ok(p_sub uuid) returns void
language sql security definer set search_path = public as $$
  update push_subscriptions set last_ok_at = now() where id = p_sub
$$;

-- Perangkat yang sudah tidak berlaku (404 atau 410 dari layanan push) dibuang.
create or replace function public.push_drop_subscription(p_sub uuid) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where id = p_sub
$$;

create or replace function public.push_cleanup() returns void
language sql security definer set search_path = public as $$
  delete from push_outbox where created_at < now() - interval '7 days' and (sent_at is not null or attempts >= 5)
$$;

-- Membangunkan Edge Function. Tidak melakukan apa pun bila push_settings belum diisi atau pg_net belum aktif.
create or replace function public.push_kick() returns void
language plpgsql security definer set search_path = public as $$
declare s push_settings;
begin
  select * into s from push_settings limit 1;
  if s.function_url is null then return; end if;
  if not exists (select 1 from pg_namespace where nspname = 'net') then return; end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3)'
    using s.function_url,
          jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s.secret),
          '{}'::jsonb;
end $$;

-- ---------------------------------------------------------------- RLS dan hak akses

alter table public.push_subscriptions enable row level security;
alter table public.push_prefs enable row level security;
alter table public.push_outbox enable row level security;
alter table public.push_settings enable row level security;

drop policy if exists push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists push_prefs_select on public.push_prefs;
create policy push_prefs_select on public.push_prefs for select to authenticated using (user_id = auth.uid());
drop policy if exists push_prefs_insert on public.push_prefs;
create policy push_prefs_insert on public.push_prefs for insert to authenticated with check (user_id = auth.uid());
drop policy if exists push_prefs_update on public.push_prefs;
create policy push_prefs_update on public.push_prefs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.push_subscriptions, public.push_prefs, public.push_outbox, public.push_settings from anon, authenticated;
grant select on public.push_subscriptions to authenticated;
grant select, insert, update on public.push_prefs to authenticated;

do $$
declare f text;
begin
  foreach f in array array['save_push_subscription(text, text, text, text)', 'remove_push_subscription(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array[
    'push_user_perm(uuid, uuid, text)', 'push_wants(uuid, text)', 'push_enqueue(uuid, text, text, text, text, text, uuid)',
    'push_on_announcement()', 'push_on_task()', 'push_on_poll()', 'push_on_pending_member()', 'push_on_broadcast()',
    'push_enqueue_piket()', 'push_enqueue_deadlines()', 'push_kick()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'push_claim(int)', 'push_finish(bigint, text)', 'push_mark_ok(uuid)', 'push_drop_subscription(uuid)', 'push_cleanup()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------- jadwal (pg_cron dan pg_net)
-- Tanpa kedua ekstensi, push tetap tersimpan di antrean tetapi tidak terkirim. Aktifkan di Database > Extensions.

do $$
begin
  begin
    create extension if not exists pg_net;
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron atau pg_net belum bisa diaktifkan otomatis: aktifkan lewat Database > Extensions, lalu jalankan ulang berkas ini.';
  end;
end $$;

do $$
declare j text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then return; end if;
  for j in select unnest(array['kelasku-piket', 'kelasku-tenggat', 'kelasku-push-kirim', 'kelasku-push-bersih']) loop
    perform cron.unschedule(jobid) from cron.job where jobname = j;
  end loop;
  -- Waktu cron dalam UTC: 23.30 UTC = 06.30 WIB, 09.00 UTC = 16.00 WIB.
  perform cron.schedule('kelasku-piket', '30 23 * * *', 'select public.push_enqueue_piket()');
  perform cron.schedule('kelasku-tenggat', '0 9 * * *', 'select public.push_enqueue_deadlines()');
  perform cron.schedule('kelasku-push-kirim', '* * * * *', 'select public.push_kick()');
  perform cron.schedule('kelasku-push-bersih', '15 20 * * *', 'select public.push_cleanup()');
end $$;
