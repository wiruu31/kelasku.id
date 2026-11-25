-- Uji push v1.0.0: langganan, pengaturan, pemicu antrean, pengingat, dan pengambilan oleh Edge Function.

select t.admin();
create function t.pn(p_cat text) returns text[] language sql security definer as $$
  select coalesce(array_agg(pr.username order by pr.username), '{}') from public.push_outbox o join public.profiles pr on pr.id = o.user_id where o.category = p_cat $$;
create function t.pn_n() returns int language sql security definer as $$ select count(*)::int from public.push_outbox $$;
create function t.pn_clear() returns void language sql security definer as $$ delete from public.push_outbox $$;

-- ---- langganan dan pengaturan
select t.sebagai('sis1');
select t.coba('murid menyimpan langganannya', $q$select public.save_push_subscription('https://push.contoh.id/s1', repeat('a', 40), repeat('b', 16), 'Uji')$q$, 'ok');
select t.coba('endpoint bukan https ditolak', $q$select public.save_push_subscription('http://push.contoh.id/x', repeat('a', 40), repeat('b', 16), null)$q$, 'galat:check constraint');
select t.coba('kunci terlalu pendek ditolak', $q$select public.save_push_subscription('https://push.contoh.id/x', 'a', 'b', null)$q$, 'galat:check constraint');
select t.coba('tidak boleh menyisipkan langganan langsung', $q$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), 'https://push.contoh.id/y', repeat('a', 40), repeat('b', 16))$q$, 'galat:permission denied');
select t.sebagai('sis2');
select t.coba('murid kedua menyimpan langganan', $q$select public.save_push_subscription('https://push.contoh.id/s2', repeat('c', 40), repeat('d', 16), 'Uji')$q$, 'ok');
select t.sama('hanya melihat langganan sendiri', (select count(*) from public.push_subscriptions)::int, 1);
select t.sebagai('ketua');
select public.save_push_subscription('https://push.contoh.id/k', repeat('e', 40), repeat('f', 16), 'Uji');
select t.sebagai('adm1');
select public.save_push_subscription('https://push.contoh.id/a1', repeat('g', 40), repeat('h', 16), 'Uji');
select t.sebagai('badm');
select public.save_push_subscription('https://push.contoh.id/b', repeat('i', 40), repeat('j', 16), 'Uji');
select t.sebagai('sis2');
select t.coba('perangkat yang sama dipakai akun lain pindah akun', $q$select public.save_push_subscription('https://push.contoh.id/k', repeat('e', 40), repeat('f', 16), 'Uji')$q$, 'ok');
select t.sama('langganan sis2 kini dua', (select count(*) from public.push_subscriptions)::int, 2);
select t.coba('murid melepas langganannya', $q$select public.remove_push_subscription('https://push.contoh.id/k')$q$, 'ok');
select t.sebagai('ketua');
select public.save_push_subscription('https://push.contoh.id/k', repeat('e', 40), repeat('f', 16), 'Uji');
select t.sebagai('sis1');
select t.coba('tidak bisa melepas langganan orang lain', $q$select public.remove_push_subscription('https://push.contoh.id/k')$q$, 'ok');
select t.admin();
select t.sama('langganan orang lain tetap ada', (select count(*) from public.push_subscriptions where endpoint = 'https://push.contoh.id/k')::int, 1);

select t.sebagai('sis2');
select t.coba('mematikan kategori pengumuman', format($q$insert into public.push_prefs (user_id, category, enabled) values (%L, 'pengumuman', false)$q$, t.uid('sis2')), 'ok');
select t.coba('kategori tak dikenal ditolak', format($q$insert into public.push_prefs (user_id, category, enabled) values (%L, 'iklan', true)$q$, t.uid('sis2')), 'galat:check constraint');
select t.coba('tidak bisa mengatur pengaturan orang lain', format($q$insert into public.push_prefs (user_id, category, enabled) values (%L, 'voting', false)$q$, t.uid('sis1')), 'galat:row-level security');
select t.coba('murid tidak membaca antrean', 'select * from public.push_outbox', 'galat:permission denied');
select t.coba('murid tidak memanggil push_claim', 'select public.push_claim(5)', 'galat:permission denied');
select t.coba('murid tidak membaca pengaturan push', 'select * from public.push_settings', 'galat:permission denied');

-- ---- pemicu antrean
select t.admin();
select t.pn_clear();
insert into public.announcements (class_id, title, body, created_by) values (t.cid('XII IPA 1'), 'Rapat OSIS', 'Besok', t.uid('adm1'));
select t.sama('pengumuman: sis1, ketua (adm1 pembuat, sis2 mati, badm kelas lain)', t.pn('pengumuman'), array['ketua', 'sis1']);
select t.sama('isi pengumuman memakai judul asli', (select body from public.push_outbox where category = 'pengumuman' limit 1), 'Rapat OSIS');

select t.pn_clear();
insert into public.tasks (class_id, title, subject, due_at, created_by) values (t.cid('XII IPA 1'), 'Latihan bab 3', 'Matematika', now() + interval '10 days', t.uid('adm1'));
select t.sama('tugas: sis1, sis2, ketua', t.pn('tugas'), array['ketua', 'sis1', 'sis2']);
select t.sama('isi tugas memuat mapel dan judul', (select body from public.push_outbox where category = 'tugas' limit 1), 'Matematika: Latihan bab 3');

select t.pn_clear();
insert into public.polls (class_id, title, mode, created_by) values (t.cid('XII IPA 1'), 'Kaos kelas', 'terlihat', t.uid('ketua'));
select t.sama('voting: adm1, sis1, sis2 (ketua pembuat)', t.pn('voting'), array['adm1', 'sis1', 'sis2']);

select t.pn_clear();
insert into public.system_announcements (title, body, target_type, class_id) values ('Pemeliharaan', 'Sabtu malam', 'class', t.cid('XII IPA 1'));
select t.sama('siaran kelas: hanya kelas itu', t.pn('siaran'), array['adm1', 'ketua', 'sis1', 'sis2']);
select t.pn_clear();
insert into public.system_announcements (title, body, target_type) values ('Kabar umum', 'Halo', 'all');
select t.sama('siaran semua: ikut kelas lain', t.pn('siaran'), array['adm1', 'badm', 'ketua', 'sis1', 'sis2']);

select t.pn_clear();
insert into auth.users (id, email, raw_user_meta_data)
values (gen_random_uuid(), 'pushbaru@contoh.id', jsonb_build_object('full_name', 'Murid Baru', 'username', 'pushbaru', 'wa', '081299977001', 'join_code', 'KELAS2AB'));
select t.sama('pendaftar baru: pemegang izin persetujuan', t.pn('pendaftar'), array['adm1', 'ketua']);
select t.sama('isi pendaftar memuat nama', (select body from public.push_outbox where category = 'pendaftar' limit 1), 'Murid Baru menunggu persetujuan');

-- pemicu tidak menggagalkan penyimpanan
select t.pn_clear();
select t.coba('tanpa penerima, pengumuman tetap tersimpan', format($q$insert into public.announcements (class_id, title, body, created_by) values (%L, 'Sepi', 'x', %L)$q$, t.cid('XII IPS 2'), t.uid('badm')), 'ok');

-- ---- pengingat terjadwal
select t.pn_clear();
insert into public.piket_duties (class_id, day_of_week, member_id, created_by)
values (t.cid('XII IPA 1'), extract(isodow from (now() at time zone 'Asia/Jakarta'))::int, t.mid('sis1'), t.uid('ketua')),
       (t.cid('XII IPA 1'), extract(isodow from (now() at time zone 'Asia/Jakarta') + interval '1 day')::int, t.mid('sis2'), t.uid('ketua'));
select t.sama('piket hari ini: hanya yang bertugas hari ini', public.push_enqueue_piket(), 1);
select t.sama('penerima piket sis1', t.pn('piket'), array['sis1']);
select t.sama('pengingat piket tidak dobel di hari yang sama', public.push_enqueue_piket(), 0);

select t.pn_clear();
insert into public.tasks (class_id, title, due_at, created_by) values
  (t.cid('XII IPA 1'), 'Laporan besok', ((now() at time zone 'Asia/Jakarta')::date + 1 + time '12:00') at time zone 'Asia/Jakarta', t.uid('adm1')),
  (t.cid('XII IPA 1'), 'Laporan lusa', ((now() at time zone 'Asia/Jakarta')::date + 2 + time '12:00') at time zone 'Asia/Jakarta', t.uid('adm1'));
select t.pn_clear();
select t.sama('tenggat besok: hanya tugas besok, empat penerima', public.push_enqueue_deadlines(), 4);
select t.sama('isi tenggat memuat judul tugas', (select distinct body from public.push_outbox where category = 'tenggat'), 'Laporan besok');
select t.sama('pengingat tenggat tidak dobel', public.push_enqueue_deadlines(), 0);

-- ---- pengambilan oleh Edge Function
select t.admin();
select t.coba('push_kick tanpa pengaturan tidak galat', 'select public.push_kick()', 'ok');
create function t.klaim(p_n int) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  execute 'set role service_role';
  v := public.push_claim(p_n);
  execute 'reset role';
  return v;
end $$;
select t.sama('claim mengambil semua antrean', jsonb_array_length(t.klaim(50)), (select count(*)::int from public.push_outbox));
select t.sama('claim kedua kosong (sedang diproses)', jsonb_array_length(t.klaim(50)), 0);
select t.sama('setiap pesan membawa perangkat', (select count(*) from public.push_outbox o where attempts = 1)::int, (select count(*)::int from public.push_outbox));
create function t.selesai(p_id bigint, p_err text) returns void language plpgsql as $$
begin
  execute 'set role service_role';
  perform public.push_finish(p_id, p_err);
  execute 'reset role';
end $$;
select t.selesai((select min(id) from public.push_outbox), null);
select t.sama('push_finish menandai terkirim', (select count(*) from public.push_outbox where sent_at is not null)::int, 1);
select t.selesai((select max(id) from public.push_outbox), 'gagal sementara');
select t.sama('galat sementara melepas klaim agar dicoba lagi', (select claimed_at is null from public.push_outbox where id = (select max(id) from public.push_outbox)), true);
create table t.k as select t.klaim(50) as j;
select t.sama('yang terkirim tidak diambil lagi', (select count(*) from t.k, jsonb_array_elements(j) e where (e ->> 'id')::bigint = (select min(id) from public.push_outbox))::int, 0);
select t.sama('pesan yang gagal diambil lagi', (select count(*) from t.k, jsonb_array_elements(j) e where (e ->> 'id')::bigint = (select max(id) from public.push_outbox))::int, 1);
update public.push_outbox set attempts = 5, sent_at = null, claimed_at = null where id = (select max(id) from public.push_outbox);
select t.sama('setelah lima percobaan tidak diambil lagi', (select count(*) from jsonb_array_elements(t.klaim(50)) e where (e ->> 'id')::bigint = (select max(id) from public.push_outbox))::int, 0);
select t.coba('membuang langganan kedaluwarsa', format($q$select public.push_drop_subscription(%L)$q$, (select id from public.push_subscriptions where endpoint = 'https://push.contoh.id/b')), 'ok');
select t.sama('langganan terbuang', (select count(*) from public.push_subscriptions where endpoint = 'https://push.contoh.id/b')::int, 0);
select t.sama('penerima tanpa perangkat tidak diantrekan', (select public.push_enqueue(t.cid('XII IPS 2'), 'pengumuman', 'a', 'b', '#/x')), 0);
update public.push_outbox set created_at = now() - interval '9 days', sent_at = now();
select public.push_cleanup();
select t.sama('pembersihan antrean lama', t.pn_n(), 0);

select t.admin();
