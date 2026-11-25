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
