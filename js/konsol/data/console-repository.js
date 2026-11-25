import { db } from "./client.js";

// Lapisan data Konsol. Semua aturan akses dijaga RLS dan fungsi database khusus Main Admin.

const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};

// ---- auth

export async function resolveLogin(identifier, password) {
  const { data, error } = await db().functions.invoke("login", { body: { identifier, password } });
  if (!error) return data;
  const body = await error.context?.json?.().catch(() => null);
  if (body?.code) return body;
  throw error;
}

export async function adoptSession({ access_token, refresh_token }) {
  const { error } = await db().auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

export const signOut = async () => {
  const { error } = await db().auth.signOut();
  if (error) throw error;
};

export async function currentSession() {
  return check(await db().auth.getSession()).session;
}

export function onAuthChange(callback) {
  const { data } = db().auth.onAuthStateChange((event) => callback(event));
  return () => data.subscription.unsubscribe();
}

export async function fetchProfile(userId) {
  return check(await db().from("profiles").select("id, full_name, username, is_platform_owner").eq("id", userId).maybeSingle());
}

export async function fetchContact(userId) {
  return check(await db().from("profile_contacts").select("email, wa").eq("user_id", userId).maybeSingle());
}

export const logConsoleLogin = async () => check(await db().rpc("log_console_login"));
export const updateOwnPassword = async (password) => {
  const { error } = await db().auth.updateUser({ password });
  if (error) throw error;
};
export const updateOwnName = async (userId, fullName) => {
  const { data, error } = await db().from("profiles").update({ full_name: fullName }).eq("id", userId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("TIDAK_DIIZINKAN");
};

// ---- sekolah dan kelas

export const fetchSchools = async () =>
  check(await db().from("schools").select("id, name, is_active, created_at").order("name", { ascending: true }));

export const fetchClasses = async () =>
  check(await db().from("classes").select("id, name, school_id, max_admins, is_active, created_at").order("name", { ascending: true }));

export const fetchTallies = async () => check(await db().rpc("console_tallies"));
export const fetchClassMembers = async (classId) => check(await db().rpc("console_class_members", { p_class: classId }));
export const fetchAdmins = async () => check(await db().rpc("console_admins"));
export const fetchJoinCode = async (classId) => check(await db().rpc("get_join_code", { p_class: classId }));

export const insertSchool = async (name) => check(await db().from("schools").insert({ name }).select("id, name, is_active, created_at").single());
export const updateSchool = async (id, patch) => {
  const { data, error } = await db().from("schools").update(patch).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("TIDAK_DIIZINKAN");
};
export const deleteSchool = async (id, confirm) => check(await db().rpc("delete_school", { p_school: id, p_confirm: confirm }));

export const createClass = async (name, schoolId) => check(await db().rpc("create_class", { p_name: name, p_school: schoolId }));
export const updateClass = async ({ id, name, schoolId, maxAdmins }) =>
  check(await db().rpc("update_class", { p_class: id, p_name: name, p_school: schoolId, p_max_admins: maxAdmins }));
export const setClassActive = async (id, active) => check(await db().rpc("set_class_active", { p_class: id, p_active: active }));
export const deleteClass = async (id, confirm) => check(await db().rpc("delete_class", { p_class: id, p_confirm: confirm }));
export const setClassAdmin = async (memberId, on) => check(await db().rpc("set_class_admin", { p_member: memberId, p_on: on }));

// ---- pengaturan

export async function fetchMaxAdminsDefault() {
  const row = check(await db().from("system_settings").select("value").eq("key", "max_admins_per_class").maybeSingle());
  return Number(row?.value ?? 3);
}
export const setMaxAdminsDefault = async (value) => check(await db().rpc("set_max_admins_default", { p_value: value }));

// ---- akun (Edge Function)

async function invoke(name, body) {
  const { data, error } = await db().functions.invoke(name, { body });
  if (!error) return data;
  const parsed = await error.context?.json?.().catch(() => null);
  if (parsed?.code) return parsed;
  throw error;
}
export const updateAccount = (body) => invoke("admin-update-account", body);
export const resetPassword = (userId) => invoke("admin-reset-password", { userId });

// ---- siaran

export const fetchAnnouncements = async () =>
  check(await db().from("system_announcements").select("id, title, body, target_type, school_id, class_id, created_at").order("created_at", { ascending: false }).limit(100));
export const insertAnnouncement = async (row) => check(await db().from("system_announcements").insert(row).select("id").single());
export const deleteAnnouncement = async (id) => {
  const { data, error } = await db().from("system_announcements").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("TIDAK_DIIZINKAN");
};
export const fetchReadCount = async (id) => {
  const { count, error } = await db().from("system_announcement_reads").select("user_id", { count: "exact", head: true }).eq("announcement_id", id);
  if (error) throw error;
  return count ?? 0;
};

// ---- log sistem

export async function fetchSystemLogs(beforeId, limit = 40) {
  let q = db().from("audit_logs").select("id, actor_id, action, target_id, detail, created_at, school_id").eq("scope", "sistem").order("id", { ascending: false }).limit(limit);
  if (beforeId) q = q.lt("id", beforeId);
  return check(await q);
}
export async function fetchProfileNames(ids) {
  if (!ids.length) return [];
  return check(await db().from("profiles").select("id, full_name").in("id", ids));
}
