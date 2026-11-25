// Pengganti supabase-js untuk uji klik di browser tanpa jaringan. Meniru bentuk jawaban Supabase
// secukupnya untuk Konsol. Data awal ada di bawah; perubahan hidup di memori selama halaman terbuka.
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T = "2026-11-01T08:00:00+07:00";

const db = {
  profiles: [{ id: uid(1), full_name: "Geris Wiru", username: "geris", is_platform_owner: true }],
  schools: [
    { id: uid(10), name: "SMA Negeri 1 Contoh", is_active: true, created_at: T },
    { id: uid(11), name: "SMK Harapan", is_active: true, created_at: T },
    { id: uid(12), name: "SMP Lama", is_active: false, created_at: T },
  ],
  classes: [
    { id: uid(20), name: "XI IPA 1", school_id: uid(10), max_admins: null, is_active: true, created_at: T },
    { id: uid(21), name: "XI IPA 2", school_id: uid(10), max_admins: 2, is_active: true, created_at: T },
    { id: uid(22), name: "X TKJ 1", school_id: uid(11), max_admins: null, is_active: true, created_at: T },
    { id: uid(23), name: "IX A", school_id: uid(12), max_admins: null, is_active: false, created_at: T },
  ],
  members: [
    { member_id: uid(30), user_id: uid(40), class_id: uid(20), display_name: "Ayu Lestari", status: "active", nomor_absen: "1", nis: "1001", jenis_kelamin: "P", username: "ayu", email: "ayu@contoh.id", wa: "6281200000001", is_admin: true, roles: [{ name: "Admin Kelas", color: "#ffe2a8" }] },
    { member_id: uid(31), user_id: uid(41), class_id: uid(20), display_name: "Budi Santoso", status: "active", nomor_absen: "2", nis: "1002", jenis_kelamin: "L", username: "budi", email: "budi@contoh.id", wa: "6281200000002", is_admin: false, roles: [] },
    { member_id: uid(32), user_id: uid(42), class_id: uid(20), display_name: "Citra Dewi", status: "pending", nomor_absen: null, nis: null, jenis_kelamin: "P", username: "citra", email: "citra@contoh.id", wa: "6281200000003", is_admin: false, roles: [] },
    { member_id: uid(33), user_id: uid(43), class_id: uid(21), display_name: "Dimas Putra", status: "active", nomor_absen: "1", nis: "2001", jenis_kelamin: "L", username: "dimas", email: "dimas@contoh.id", wa: "6281200000004", is_admin: false, roles: [] },
  ],
  codes: { [uid(20)]: "ABCD2345", [uid(21)]: "EFGH6789", [uid(22)]: "JKLM2468", [uid(23)]: "NPQR3579" },
  announcements: [],
  reads: {},
  logs: [
    { id: 3, actor_id: uid(1), action: "classes.insert", target_id: uid(22), detail: { label: "X TKJ 1" }, created_at: T, scope: "sistem", school_id: uid(11) },
    { id: 2, actor_id: uid(1), action: "schools.insert", target_id: uid(11), detail: { label: "SMK Harapan" }, created_at: T, scope: "sistem", school_id: uid(11) },
    { id: 1, actor_id: uid(1), action: "konsol.login", target_id: null, detail: { label: "Geris Wiru" }, created_at: T, scope: "sistem", school_id: null },
  ],
  settings: { max_admins_per_class: 3 },
};
window.__fake = db;

const ok = (data) => ({ data, error: null });
const fail = (message, code) => ({ data: null, error: Object.assign(new Error(message), { code, message }) });
let nextId = 100;

function tally() {
  return db.classes.map((c) => {
    const own = db.members.filter((m) => m.class_id === c.id);
    return { class_id: c.id, school_id: c.school_id, active: own.filter((m) => m.status === "active").length, pending: own.filter((m) => m.status === "pending").length, admins: own.filter((m) => m.status === "active" && m.is_admin).length };
  });
}

const rpcs = {
  console_tallies: tally,
  console_class_members: ({ p_class }) => structuredClone(db.members.filter((m) => m.class_id === p_class)),
  console_admins: () =>
    db.members.filter((m) => m.is_admin && m.status === "active").map((m) => {
      const c = db.classes.find((x) => x.id === m.class_id);
      const s = db.schools.find((x) => x.id === c.school_id);
      return { member_id: m.member_id, user_id: m.user_id, class_id: c.id, class_name: c.name, school_id: s.id, school_name: s.name, display_name: m.display_name, username: m.username, email: m.email, wa: m.wa };
    }),
  get_join_code: ({ p_class }) => db.codes[p_class],
  log_console_login: () => null,
  create_class: ({ p_name, p_school }) => {
    if (!db.schools.find((s) => s.id === p_school && s.is_active)) throw new Error("SEKOLAH_TIDAK_VALID");
    const c = { id: uid(nextId++), name: p_name, school_id: p_school, max_admins: null, is_active: true, created_at: T };
    db.classes.push(c);
    db.codes[c.id] = "ZXCV2468";
    return c;
  },
  update_class: ({ p_class, p_name, p_school, p_max_admins }) => {
    const c = db.classes.find((x) => x.id === p_class);
    const admins = db.members.filter((m) => m.class_id === p_class && m.is_admin && m.status === "active").length;
    if (p_max_admins != null && admins > p_max_admins) throw new Error("BATAS_DI_BAWAH_JUMLAH");
    Object.assign(c, { name: p_name, school_id: p_school, max_admins: p_max_admins });
    return null;
  },
  set_class_active: ({ p_class, p_active }) => { db.classes.find((x) => x.id === p_class).is_active = p_active; return null; },
  delete_class: ({ p_class, p_confirm }) => {
    const c = db.classes.find((x) => x.id === p_class);
    if (c.is_active) throw new Error("HARUS_NONAKTIF");
    if (p_confirm !== c.name) throw new Error("KONFIRMASI_SALAH");
    db.classes.splice(db.classes.indexOf(c), 1);
    return null;
  },
  delete_school: ({ p_school, p_confirm }) => {
    const s = db.schools.find((x) => x.id === p_school);
    if (s.is_active) throw new Error("HARUS_NONAKTIF");
    if (p_confirm !== s.name) throw new Error("KONFIRMASI_SALAH");
    db.classes = db.classes.filter((c) => c.school_id !== p_school);
    db.schools.splice(db.schools.indexOf(s), 1);
    return null;
  },
  set_class_admin: ({ p_member, p_on }) => {
    const m = db.members.find((x) => x.member_id === p_member);
    const c = db.classes.find((x) => x.id === m.class_id);
    const limit = c.max_admins ?? db.settings.max_admins_per_class;
    if (p_on && db.members.filter((x) => x.class_id === m.class_id && x.is_admin && x.status === "active").length >= limit) throw new Error("BATAS_ADMIN");
    m.is_admin = p_on;
    m.roles = p_on ? [{ name: "Admin Kelas", color: "#ffe2a8" }] : [];
    return null;
  },
  set_max_admins_default: ({ p_value }) => {
    if (!Number.isInteger(p_value) || p_value < 1 || p_value > 20) throw new Error("BATAS_TIDAK_VALID");
    db.settings.max_admins_per_class = p_value;
    return null;
  },
};

function table(name) {
  if (name === "system_settings") return [{ key: "max_admins_per_class", value: db.settings.max_admins_per_class }];
  if (name === "system_announcement_reads") return [];
  if (name === "audit_logs") return db.logs;
  return db[name === "system_announcements" ? "announcements" : name];
}

function builder(name) {
  let rows = table(name);
  let op = "select";
  let payload = null;
  let head = false;
  let single = false;
  let maybe = false;
  const filters = [];
  let limit = Infinity;
  let order = null;
  const api = {
    select(_cols, opts) { head = !!opts?.head; if (op === "select") op = "select"; return api; },
    insert(row) { op = "insert"; payload = row; return api; },
    update(patch) { op = "update"; payload = patch; return api; },
    delete() { op = "delete"; return api; },
    eq(k, v) { filters.push((r) => r[k] === v); return api; },
    in(k, v) { filters.push((r) => v.includes(r[k])); return api; },
    lt(k, v) { filters.push((r) => r[k] < v); return api; },
    order(k, o) { order = [k, o?.ascending !== false]; return api; },
    limit(n) { limit = n; return api; },
    single() { single = true; return api; },
    maybeSingle() { maybe = true; return api; },
    then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
  };
  function run() {
    let out = rows.filter((r) => filters.every((f) => f(r)));
    if (op === "insert") {
      if (name === "schools" && rows.some((r) => r.name.toLowerCase() === payload.name.toLowerCase())) return fail("duplicate key value violates unique constraint", "23505");
      const row = { id: uid(nextId++), created_at: T, is_active: true, ...payload };
      rows.push(row);
      if (name === "system_announcements") db.reads[row.id] = 0;
      return ok(single ? row : [row]);
    }
    if (op === "update") { out.forEach((r) => Object.assign(r, payload)); return ok(out); }
    if (op === "delete") { out.forEach((r) => rows.splice(rows.indexOf(r), 1)); return ok(out); }
    if (name === "system_announcement_reads") return { data: null, error: null, count: 0 };
    if (order) out = [...out].sort((a, b) => (a[order[0]] > b[order[0]] ? 1 : -1) * (order[1] ? 1 : -1));
    out = out.slice(0, limit);
    if (head) return { data: null, error: null, count: out.length };
    if (single) return out[0] ? ok(out[0]) : fail("no rows", "PGRST116");
    if (maybe) return ok(out[0] ?? null);
    return ok(out);
  }
  return api;
}

const session = () => (localStorage.getItem("fake-session") ? { access_token: "a", refresh_token: "r", user: { id: uid(1) } } : null);

export function createClient() {
  return {
    from: builder,
    rpc: async (name, args) => {
      try { return ok(rpcs[name](args ?? {})); } catch (e) { return fail(e.message, "P0001"); }
    },
    functions: {
      invoke: async (name, { body }) => {
        if (name === "login") {
          if (body.identifier === "geris" && body.password === "sandi12345") return ok({ session: { access_token: "a", refresh_token: "r" } });
          if (body.identifier === "ayu" && body.password === "sandi12345") return ok({ session: { access_token: "a2", refresh_token: "r2" }, nonOwner: true });
          return { data: null, error: Object.assign(new Error("x"), { context: { json: async () => ({ code: "KREDENSIAL_SALAH" }) } }) };
        }
        if (name === "admin-update-account") {
          const m = db.members.find((x) => x.user_id === body.userId);
          if (body.username && db.members.some((x) => x.username === body.username && x !== m)) return ok({ code: "USERNAME_SUDAH_DIPAKAI" });
          if (body.fullName) m.display_name = body.fullName;
          if (body.username) m.username = body.username;
          if (body.email) m.email = body.email;
          if (body.wa) m.wa = body.wa.replace(/^0/, "62");
          return ok({ ok: true });
        }
        if (name === "admin-reset-password") return ok({ password: "Tmp7Kq2mXz" });
        return ok({});
      },
    },
    auth: {
      getSession: async () => ok({ session: session() }),
      setSession: async ({ access_token }) => { localStorage.setItem("fake-session", access_token); return ok({}); },
      signOut: async () => { localStorage.removeItem("fake-session"); return ok({}); },
      updateUser: async () => ok({}),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  };
}
