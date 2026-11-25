// Pengganti supabase-js untuk uji klik aplikasi Kelas. Dua akun: ayu (Admin Kelas) dan budi (Murid).
// Bentuk jawaban mengikuti select di js/data/*.js; kolom yang diminta tidak disaring.
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T = "2026-11-20T08:00:00+07:00";
const CLASS = { id: uid(20), name: "XI IPA 1", school: { id: uid(10), name: "SMA Negeri 1 Contoh" } };
const P = (permission, scope = "semua") => ({ permission, scope });
const ALL = ["pengumuman", "jadwal", "tugas"].flatMap((m) => [P(`${m}.akses`), P(`${m}.lihat`), P(`${m}.tambah`), P(`${m}.ubah`, "semua"), P(`${m}.hapus`, "semua")]);

const roles = [
  { id: uid(50), class_id: CLASS.id, name: "Admin Kelas", color: "#ffe2a8", position: 0, is_system: true, system_key: "admin_kelas", role_permissions: [] },
  { id: uid(51), class_id: CLASS.id, name: "Ketua", color: "#bfe3ff", position: 1, is_system: false, system_key: null, role_permissions: [P("pengumuman.tambah"), P("role.beri"), ...["piket", "voting", "kas"].flatMap((m) => [P(`${m}.akses`), P(`${m}.lihat`), P(`${m}.tambah`), P(`${m}.ubah`), P(`${m}.hapus`)]), P("organigram.akses")] },
  { id: uid(52), class_id: CLASS.id, name: "Murid", color: "#e6e6e6", position: 1000000, is_system: true, system_key: "murid", role_permissions: [P("pengumuman.akses"), P("pengumuman.lihat"), P("jadwal.akses"), P("jadwal.lihat"), P("tugas.akses"), P("tugas.lihat"), P("voting.akses"), P("voting.lihat"), P("organigram.akses")] },
];
const users = {
  ayu: { id: uid(40), full_name: "Ayu Lestari", username: "ayu", member: uid(30), roleIds: [uid(50), uid(52)] },
  budi: { id: uid(41), full_name: "Budi Santoso", username: "budi", member: uid(31), roleIds: [uid(52)] },
};
const members = [
  { id: uid(30), user_id: uid(40), display_name: "Ayu Lestari", status: "active", roleIds: [uid(50), uid(52)] },
  { id: uid(31), user_id: uid(41), display_name: "Budi Santoso", status: "active", roleIds: [uid(52)] },
  { id: uid(32), user_id: uid(42), display_name: "Citra Dewi", status: "active", roleIds: [uid(51), uid(52)] },
];
const news = [
  { id: uid(60), title: "Pembaruan sistem v0.3.0", body: "Konsol baru sudah aktif.", created_at: T },
  { id: uid(61), title: "Jadwal pemeliharaan", body: "Minggu malam.", created_at: T },
];
const reads = new Set();
const prefs = [];
window.__fakeLog = window.__fakeLog ?? [];
let seq = 900;
const nid = () => uid(seq++);
const piket = [{ id: nid(), day_of_week: 1, member_id: uid(31) }];
const kasEntries = [{ id: nid(), kind: "masuk", amount: 50000, note: "Sumbangan awal", entry_date: "2026-11-20", source: null, created_by: uid(40), created_at: T }];
const dues = [{ id: nid(), name: "Iuran kas", amount: 5000, period: "bulanan", starts_on: "2026-11-01", is_active: true, created_by: uid(40) }];
const payments = [];
const polls = [
  { id: nid(), title: "Warna kaos kelas", description: null, mode: "terlihat", closes_at: null, closed_at: null, created_at: T, created_by: uid(40), options: [{ id: nid(), label: "Merah" }, { id: nid(), label: "Biru" }], votes: [] },
  { id: nid(), title: "Ketua panitia", description: null, mode: "anonim_akhir", closes_at: null, closed_at: null, created_at: T, created_by: uid(40), options: [{ id: nid(), label: "Ani" }, { id: nid(), label: "Budi" }], votes: [] },
];
const pollJson = (p) => {
  const me = current()?.id;
  const done = !!p.closed_at;
  const visible = p.mode !== "anonim_akhir" || done;
  return {
    id: p.id, title: p.title, description: p.description, mode: p.mode, closes_at: p.closes_at, closed_at: p.closed_at, created_at: p.created_at, created_by: p.created_by,
    state: done ? "selesai" : "berjalan", results_visible: visible, voters: visible ? new Set(p.votes.map((v) => v.user)).size : null,
    my_options: p.votes.filter((v) => v.user === me).map((v) => v.option),
    options: p.options.map((o) => ({ id: o.id, label: o.label, votes: visible ? p.votes.filter((v) => v.option === o.id).length : null, names: p.mode === "terlihat" && visible ? p.votes.filter((v) => v.option === o.id).map((v) => v.name) : null })),
  };
};
const saldo = () => ({ masuk: kasEntries.filter((e) => e.kind === "masuk").reduce((a, e) => a + e.amount, 0), keluar: kasEntries.filter((e) => e.kind === "keluar").reduce((a, e) => a + e.amount, 0) });
const current = () => JSON.parse(localStorage.getItem("fake-user") ?? "null");
const ok = (data) => ({ data, error: null });
const fail = (message, code) => ({ data: null, error: Object.assign(new Error(message), { code, message }) });
const roleOf = (id) => roles.find((r) => r.id === id);

function builder(table) {
  let op = "select", head = false, single = false, maybe = false, cols = "", payload = null;
  const eqs = {}, ins = {};
  const api = {
    select(c, o) { cols = c ?? cols; head = !!o?.head; return api; },
    insert(r) { op = "insert"; payload = r; return api; },
    upsert(r) { op = "upsert"; payload = r; return api; },
    update(r) { op = "update"; payload = r; return api; },
    delete() { op = "delete"; return api; },
    eq(k, v) { eqs[k] = v; return api; },
    in(k, v) { ins[k] = v; return api; },
    lt() { return api; }, order() { return api; }, limit() { return api; },
    single() { single = true; return api; },
    maybeSingle() { maybe = true; return api; },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); },
  };
  function rows() {
    const u = current();
    switch (table) {
      case "push_prefs": return prefs.map((p) => ({ ...p }));
      case "profiles": return [{ id: u.id, full_name: u.full_name, username: u.username, is_platform_owner: false, tour_done_at: T }];
      case "class_members": {
        if (eqs.user_id) return [{ id: u.member, status: "active", display_name: u.full_name, nomor_absen: null, nis: null, class: CLASS }];
        if (cols.includes("member_roles")) return members.map((m) => ({ id: m.id, user_id: m.user_id, display_name: m.display_name, profile: { avatar_path: null }, member_roles: m.roleIds.map((role_id) => ({ role_id })) }));
        return members.map((m) => ({ id: m.id, user_id: m.user_id, display_name: m.display_name, status: m.status, created_at: T }));
      }
      case "roles": return eqs.id ? roles.filter((r) => r.id === eqs.id) : roles;
      case "member_roles": return (members.find((m) => m.id === eqs.member_id)?.roleIds ?? []).map((id) => ({ role: roleOf(id) }));
      case "system_announcements": return news;
      case "system_announcement_reads": return [...reads].map((announcement_id) => ({ announcement_id }));
      case "profile_contacts": return [];
      case "piket_duties": return piket.map((d) => { const m = members.find((x) => x.id === d.member_id); return { ...d, member: { id: m.id, display_name: m.display_name, user_id: m.user_id, profile: { avatar_path: null } } }; });
      case "kas_entries": return kasEntries;
      case "kas_dues": return dues;
      case "kas_due_payments": return payments;
      default: return [];
    }
  }
  function run() {
    if (op === "upsert" && table === "push_prefs") { const i = prefs.findIndex((p) => p.category === payload.category); if (i >= 0) prefs[i] = payload; else prefs.push(payload); window.__fakeLog.push({ prefs: payload }); return ok(null); }
    if (op === "upsert" && table === "system_announcement_reads") { [].concat(payload).forEach((r) => reads.add(r.announcement_id)); return ok(null); }
    if (op === "insert" && table === "member_roles") { members.find((m) => m.id === payload.member_id).roleIds.push(payload.role_id); return ok(null); }
    if (op === "insert" && table === "piket_duties") { piket.push({ id: nid(), day_of_week: payload.day_of_week, member_id: payload.member_id }); return ok(null); }
    if (op === "delete" && table === "piket_duties") { const i = piket.findIndex((d) => d.id === eqs.id); if (i >= 0) piket.splice(i, 1); return ok([{ id: eqs.id }]); }
    if (op === "insert" && table === "kas_entries") { kasEntries.unshift({ id: nid(), source: null, created_by: current().id, created_at: T, ...payload }); return ok(null); }
    if (op === "update" && table === "kas_entries") { Object.assign(kasEntries.find((e) => e.id === eqs.id), payload); return ok([{ id: eqs.id }]); }
    if (op === "delete" && table === "kas_entries") { const i = kasEntries.findIndex((e) => e.id === eqs.id); if (i >= 0) kasEntries.splice(i, 1); for (let k = payments.length - 1; k >= 0; k--) if (!kasEntries.some((e) => e.id === payments[k].entry_id)) payments.splice(k, 1); return ok([{ id: eqs.id }]); }
    if (op === "insert" && table === "kas_dues") { dues.unshift({ id: nid(), is_active: true, created_by: current().id, ...payload }); return ok(null); }
    if (op === "update" && table === "kas_dues") { Object.assign(dues.find((d) => d.id === eqs.id), payload); return ok([{ id: eqs.id }]); }
    if (op === "delete" && table === "polls") { const i = polls.findIndex((x) => x.id === eqs.id); if (i >= 0) polls.splice(i, 1); return ok([{ id: eqs.id }]); }
    if (op !== "select") return ok(single ? payload : []);
    const out = rows();
    if (head) return { data: null, error: null, count: out.length };
    if (single) return out[0] ? ok(out[0]) : fail("no rows", "PGRST116");
    if (maybe) return ok(out[0] ?? null);
    return ok(out);
  }
  return api;
}

export function createClient() {
  return {
    from: builder,
    rpc: async (name, a = {}) => {
      if (name === "get_join_code") return ok("ABCD2345");
      if (name === "save_push_subscription" || name === "remove_push_subscription") { window.__fakeLog.push({ rpc: name, args: a }); return ok(null); }
      if (name === "class_polls") return ok(polls.map(pollJson));
      if (name === "create_poll") { polls.unshift({ id: nid(), title: a.p_title, description: a.p_description, mode: a.p_mode, closes_at: a.p_closes_at, closed_at: null, created_at: T, created_by: current().id, options: a.p_options.map((label) => ({ id: nid(), label })), votes: [] }); return ok(null); }
      if (name === "cast_vote") {
        const p = polls.find((x) => x.id === a.p_poll), u = current();
        if (p.mode !== "terlihat" && p.votes.some((v) => v.user === u.id)) return fail("SUDAH_MEMILIH");
        p.votes = p.votes.filter((v) => v.user !== u.id);
        a.p_options.forEach((option) => p.votes.push({ user: u.id, option, name: u.full_name }));
        return ok(null);
      }
      if (name === "close_poll") { polls.find((x) => x.id === a.p_poll).closed_at = T; return ok(null); }
      if (name === "kas_summary") { const t = saldo(); return ok({ ...t, saldo: t.masuk - t.keluar }); }
      if (name === "set_due_paid") {
        const d = dues.find((x) => x.id === a.p_due);
        const hit = payments.findIndex((p) => p.due_id === a.p_due && p.member_id === a.p_member && p.period_key === a.p_period_key);
        if (a.p_paid && hit < 0) {
          const entry = { id: nid(), kind: "masuk", amount: d.amount, note: `${d.name} ${a.p_period_key}`, entry_date: a.p_date, source: "iuran", created_by: current().id, created_at: T };
          kasEntries.unshift(entry);
          payments.push({ due_id: a.p_due, member_id: a.p_member, period_key: a.p_period_key, entry_id: entry.id });
        }
        if (!a.p_paid && hit >= 0) { const [gone] = payments.splice(hit, 1); kasEntries.splice(kasEntries.findIndex((e) => e.id === gone.entry_id), 1); }
        return ok(null);
      }
      return ok(null);
    },
    storage: { from: () => ({ createSignedUrls: async () => ok([]), upload: async () => ok({}), remove: async () => ok([]) }) },
    functions: {
      invoke: async (_n, { body }) => {
        const u = users[body.identifier];
        if (u && body.password === "sandi12345") { localStorage.setItem("fake-user", JSON.stringify(u)); return ok({ session: { access_token: "a", refresh_token: "r" } }); }
        return { data: null, error: Object.assign(new Error("x"), { context: { json: async () => ({ code: "KREDENSIAL_SALAH" }) } }) };
      },
    },
    auth: {
      getSession: async () => ok({ session: current() ? { access_token: "a", refresh_token: "r", user: { id: current().id } } : null }),
      setSession: async () => ok({}),
      signOut: async () => { localStorage.removeItem("fake-user"); return ok({}); },
      updateUser: async () => ok({}),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  };
}
