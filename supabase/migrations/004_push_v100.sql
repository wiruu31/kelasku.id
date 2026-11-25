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
