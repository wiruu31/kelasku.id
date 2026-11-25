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
