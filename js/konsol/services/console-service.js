import * as repo from "../data/console-repository.js";
import { AppError, fromServerCode } from "../../core/errors.js";

// Aturan bisnis Konsol. Tidak menyentuh DOM maupun Supabase secara langsung.

const clean = (s) => String(s ?? "").trim().replace(/\s+/g, " ");
const invalid = (fields) => Object.assign(new AppError("validation", "Periksa isian."), { fields });

// ---- ringkasan

// Satu pemuatan untuk Dashboard, Ringkasan, dan Sekolah: sekolah, kelas, dan hitungan digabung di sini.
export async function loadOverview() {
  const [schools, classes, tallies, defaultLimit] = await Promise.all([
    repo.fetchSchools(),
    repo.fetchClasses(),
    repo.fetchTallies(),
    repo.fetchMaxAdminsDefault(),
  ]);
  const tally = new Map(tallies.map((t) => [t.class_id, t]));
  const withCounts = classes.map((c) => {
    const t = tally.get(c.id);
    return { ...c, active: t?.active ?? 0, pending: t?.pending ?? 0, admins: t?.admins ?? 0, limit: c.max_admins ?? defaultLimit };
  });
  const bySchool = schools.map((s) => {
    const own = withCounts.filter((c) => c.school_id === s.id);
    return {
      ...s,
      classes: own,
      students: own.reduce((n, c) => n + c.active, 0),
      pending: own.reduce((n, c) => n + c.pending, 0),
      admins: own.reduce((n, c) => n + c.admins, 0),
    };
  });
  return {
    schools: bySchool,
    classes: withCounts,
    defaultLimit,
    totals: {
      schools: schools.filter((s) => s.is_active).length,
      schoolsOff: schools.filter((s) => !s.is_active).length,
      classes: classes.filter((c) => c.is_active).length,
      classesOff: classes.filter((c) => !c.is_active).length,
      students: withCounts.reduce((n, c) => n + c.active, 0),
      pending: withCounts.reduce((n, c) => n + c.pending, 0),
      admins: withCounts.reduce((n, c) => n + c.admins, 0),
    },
  };
}

export async function loadClassDetail(classId) {
  const [members, code] = await Promise.all([repo.fetchClassMembers(classId), repo.fetchJoinCode(classId)]);
  return { members, code };
}

// ---- sekolah

export function validateSchool({ name }) {
  const n = clean(name);
  return n.length < 2 || n.length > 120 ? { name: "Nama sekolah 2 sampai 120 karakter." } : {};
}

export async function addSchool({ name }) {
  const errors = validateSchool({ name });
  if (Object.keys(errors).length) throw invalid(errors);
  return repo.insertSchool(clean(name));
}

export async function renameSchool(school, { name }) {
  const errors = validateSchool({ name });
  if (Object.keys(errors).length) throw invalid(errors);
  await repo.updateSchool(school.id, { name: clean(name) });
}

export const setSchoolActive = (school, active) => repo.updateSchool(school.id, { is_active: active });
export const removeSchool = (school, confirm) => repo.deleteSchool(school.id, confirm);

// ---- kelas

export function validateClass({ name, schoolId, maxAdmins }) {
  const e = {};
  const n = clean(name);
  if (n.length < 2 || n.length > 80) e.name = "Nama kelas 2 sampai 80 karakter.";
  if (!schoolId) e.schoolId = "Pilih sekolah.";
  if (maxAdmins !== "" && maxAdmins != null) {
    const v = Number(maxAdmins);
    if (!Number.isInteger(v) || v < 1 || v > 20) e.maxAdmins = "Batas 1 sampai 20, atau kosongkan untuk ikut bawaan.";
  }
  return e;
}

export async function addClass({ name, schoolId }) {
  const errors = validateClass({ name, schoolId });
  if (Object.keys(errors).length) throw invalid(errors);
  return repo.createClass(clean(name), schoolId);
}

export async function saveClass(cls, { name, schoolId, maxAdmins }) {
  const errors = validateClass({ name, schoolId, maxAdmins });
  if (Object.keys(errors).length) throw invalid(errors);
  await repo.updateClass({ id: cls.id, name: clean(name), schoolId, maxAdmins: maxAdmins === "" || maxAdmins == null ? null : Number(maxAdmins) });
}

export const setClassActive = (cls, active) => repo.setClassActive(cls.id, active);
export const removeClass = (cls, confirm) => repo.deleteClass(cls.id, confirm);

// ---- Admin Kelas

export async function setAdmin(member, on, cls) {
  if (member.status !== "active") throw fromServerCode("ANGGOTA_BELUM_AKTIF");
  if (on && cls && cls.admins >= cls.limit) throw fromServerCode("BATAS_ADMIN");
  await repo.setClassAdmin(member.member_id, on);
}

export async function saveDefaultLimit(value) {
  const v = Number(value);
  if (!Number.isInteger(v) || v < 1 || v > 20) throw invalid({ limit: "Batas 1 sampai 20." });
  await repo.setMaxAdminsDefault(v);
  return v;
}

// ---- akun murid

export function validateAccount(v) {
  const e = {};
  if (clean(v.fullName).length < 3) e.fullName = "Nama minimal 3 huruf.";
  if (!/^[a-z0-9_]{3,20}$/.test(String(v.username).trim().toLowerCase())) e.username = "Username 3 sampai 20 karakter: huruf kecil, angka, atau garis bawah.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v.email).trim())) e.email = "Format email belum benar.";
  if (!/^62\d{8,13}$/.test(normalizeWa(v.wa))) e.wa = "Nomor WA belum benar. Contoh: 081234567890.";
  if (v.password && String(v.password).length < 8) e.password = "Kata sandi minimal 8 karakter.";
  return e;
}

export function normalizeWa(input) {
  let d = String(input ?? "").replace(/\D/g, "");
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  else if (d.startsWith("8")) d = `62${d}`;
  return d;
}

// Kirim hanya kolom yang berubah. Kode kegagalan dari Edge Function diubah jadi galat berbahasa Indonesia.
export async function saveAccount(member, v) {
  const errors = validateAccount(v);
  if (Object.keys(errors).length) throw invalid(errors);
  const body = { userId: member.user_id };
  if (clean(v.fullName) !== member.display_name) body.fullName = clean(v.fullName);
  if (String(v.username).trim().toLowerCase() !== member.username) body.username = String(v.username).trim().toLowerCase();
  if (String(v.email).trim().toLowerCase() !== (member.email ?? "")) body.email = String(v.email).trim();
  if (normalizeWa(v.wa) !== (member.wa ?? "")) body.wa = v.wa;
  if ((v.jenisKelamin || null) !== (member.jenis_kelamin || null)) body.jenisKelamin = v.jenisKelamin || null;
  if (v.password) body.password = v.password;
  if (Object.keys(body).length === 1) throw fromServerCode("TIDAK_ADA_PERUBAHAN");
  const result = await repo.updateAccount(body);
  if (result?.code) {
    const err = fromServerCode(result.code);
    const field = { NAMA_SUDAH_ADA_DI_KELAS: "fullName", USERNAME_SUDAH_DIPAKAI: "username", EMAIL_SUDAH_DIPAKAI: "email", WA_SUDAH_DIPAKAI: "wa" }[result.code];
    throw field ? Object.assign(err, { fields: { [field]: err.userMessage } }) : err;
  }
  return body;
}

export async function resetPassword(member) {
  const result = await repo.resetPassword(member.user_id);
  if (result?.code) throw fromServerCode(result.code === "GAGAL_RESET" ? "unknown" : result.code);
  return result.password;
}

// ---- siaran

export function validateAnnouncement({ title, body, targetType, schoolId, classId }) {
  const e = {};
  if (clean(title).length < 2 || clean(title).length > 120) e.title = "Judul 2 sampai 120 karakter.";
  if (!String(body ?? "").trim() || String(body).length > 4000) e.body = "Isi siaran 1 sampai 4000 karakter.";
  if (targetType === "school" && !schoolId) e.schoolId = "Pilih sekolah tujuan.";
  if (targetType === "class" && !classId) e.classId = "Pilih kelas tujuan.";
  return e;
}

export async function sendAnnouncement(v, userId) {
  const errors = validateAnnouncement(v);
  if (Object.keys(errors).length) throw invalid(errors);
  return repo.insertAnnouncement({
    title: clean(v.title),
    body: String(v.body).trim(),
    target_type: v.targetType,
    school_id: v.targetType === "school" ? v.schoolId : null,
    class_id: v.targetType === "class" ? v.classId : null,
    created_by: userId,
  });
}

export async function loadAnnouncements() {
  const rows = await repo.fetchAnnouncements();
  const reads = await Promise.all(rows.map((r) => repo.fetchReadCount(r.id).catch(() => null)));
  return rows.map((r, i) => ({ ...r, reads: reads[i] }));
}

export const removeAnnouncement = (row) => repo.deleteAnnouncement(row.id);

// ---- log sistem

const TABLE_LABEL = { schools: "sekolah", classes: "kelas", system_settings: "pengaturan", system_announcements: "siaran" };
const VERB = { insert: "menambah", update: "mengubah", delete: "menghapus" };
const FIELD_LABEL = { name: "nama", school_id: "sekolah", max_admins: "batas admin", is_active: "status", value: "nilai", title: "judul", body: "isi", target_type: "tujuan" };

export function describeSystemLog(row, names, schoolNames) {
  const d = row.detail ?? {};
  const who = row.actor_id ? names.get(row.actor_id) ?? "Main Admin" : "Sistem";
  const label = d.label ? ` "${d.label}"` : "";
  const [table, op] = row.action.split(".");
  if (row.action === "konsol.login") return { who, text: "masuk ke Konsol" };
  if (row.action === "akun.ubah") return { who, text: `mengubah ${[].concat(d.perubahan ?? []).join(", ")} akun${label}` };
  if (row.action === "akun.reset_sandi") return { who, text: `mereset kata sandi${label}` };
  if (row.action === "classes.kode_diubah") return { who, text: "mengganti kode kelas" };
  if (table === "member_roles") {
    const verb = op === "insert" ? "mengangkat" : "mencabut";
    return { who, text: `${verb} ${d.anggota ?? "anggota"} ${op === "insert" ? "sebagai" : "dari"} ${d.role ?? "role"}` };
  }
  if (d.aktif !== undefined && table !== "system_settings") return { who, text: `${d.aktif === "true" ? "mengaktifkan" : "mengarsipkan"} ${TABLE_LABEL[table] ?? table}${label}` };
  if (TABLE_LABEL[table] && VERB[op]) {
    const changes = op === "update" && Array.isArray(d.perubahan) ? ` (${d.perubahan.map((k) => FIELD_LABEL[k] ?? k).join(", ")})` : "";
    const school = row.school_id && table !== "schools" && schoolNames.get(row.school_id) ? ` di ${schoolNames.get(row.school_id)}` : "";
    return { who, text: `${VERB[op]} ${TABLE_LABEL[table]}${label}${changes}${school}` };
  }
  return { who, text: row.action };
}

export async function loadSystemLogs(beforeId) {
  const [rows, schools] = await Promise.all([repo.fetchSystemLogs(beforeId), repo.fetchSchools()]);
  const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))];
  const people = await repo.fetchProfileNames(ids);
  const names = new Map(people.map((p) => [p.id, p.full_name]));
  const schoolNames = new Map(schools.map((s) => [s.id, s.name]));
  return rows.map((r) => ({ id: r.id, at: r.created_at, ...describeSystemLog(r, names, schoolNames) }));
}
