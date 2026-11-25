-- Uji hierarki, RLS, dan RPC v0.3.0. Tiap uji tercatat di t.hasil; yang gagal dicetak di akhir.
drop schema if exists t cascade;
create schema t;
create table t.hasil (nama text, lulus boolean, rincian text);
grant usage on schema t to public;
grant all on t.hasil to public;

create function t.sebagai(p_username text) returns void language plpgsql as $$
declare v uuid;
begin
  reset role;
  select id into v from public.profiles where username = p_username;
  perform set_config('request.jwt.claim.sub', coalesce(v::text, ''), false);
  execute 'set role authenticated';
end $$;

create function t.admin() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

-- p_harap: 'ok' (tanpa galat), 'galat:<potongan pesan>', atau 'baris:N' (jumlah baris terpengaruh).
create function t.coba(p_nama text, p_sql text, p_harap text) returns void language plpgsql as $$
declare n bigint; msg text;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
    if p_harap = 'ok' then insert into t.hasil values (p_nama, true, null);
    elsif p_harap like 'baris:%' then
      insert into t.hasil values (p_nama, n = split_part(p_harap, ':', 2)::bigint, 'baris=' || n);
    else insert into t.hasil values (p_nama, false, 'harusnya galat ' || p_harap || ', tapi berhasil (baris=' || n || ')');
    end if;
  exception when others then
    msg := sqlerrm;
    if p_harap like 'galat:%' then
      insert into t.hasil values (p_nama, position(substr(p_harap, 7) in msg) > 0, msg);
    else insert into t.hasil values (p_nama, false, 'galat tak terduga: ' || msg);
    end if;
  end;
end $$;

create function t.sama(p_nama text, p_nyata anyelement, p_harap anyelement) returns void language plpgsql as $$
begin
  insert into t.hasil values (p_nama, p_nyata is not distinct from p_harap, 'nyata=' || coalesce(p_nyata::text, 'null') || ' harap=' || coalesce(p_harap::text, 'null'));
end $$;
grant execute on all functions in schema t to public;

-- Pencari id supaya uji mudah dibaca. security definer agar bisa dipakai dari peran authenticated.
create function t.uid(p_username text) returns uuid language sql security definer as $$
  select id from public.profiles where username = p_username $$;
create function t.mid(p_username text) returns uuid language sql security definer as $$
  select m.id from public.class_members m join public.profiles p on p.id = m.user_id where p.username = p_username limit 1 $$;
create function t.cid(p_name text) returns uuid language sql security definer as $$
  select id from public.classes where name = p_name $$;
create function t.rid(p_class text, p_role text) returns uuid language sql security definer as $$
  select r.id from public.roles r join public.classes c on c.id = r.class_id where c.name = p_class and r.name = p_role $$;
create function t.sid(p_school text) returns uuid language sql security definer as $$
  select id from public.schools where name = p_school $$;
grant execute on all functions in schema t to public;
