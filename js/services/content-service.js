import * as repo from "../data/content-repository.js";
import { appStore } from "../core/state.js";
import { AppError } from "../core/errors.js";
import { fromJakartaInput, hhmm } from "../core/format.js";

// Aturan bisnis pengumuman, jadwal, tugas, log, dan profil kelas.

function classId() {
  const id = appStore.get().member?.class?.id;
  if (!id) throw new AppError("no_class", "Kamu belum tergabung di kelas.");
  return id;
}

const clean = (v) => String(v ?? "").trim();
const optional = (v) => clean(v) || null;

function invalid(errors) {
  return Object.assign(new AppError("validation", "Periksa isian."), { fields: errors });
}

// ---- pengumuman

export function validateAnnouncement(v) {
  const e = {};
  const title = clean(v.title);
  if (title.length < 2 || title.length > 120) e.title = "Judul 2 sampai 120 karakter.";
  const body = clean(v.body);
  if (!body) e.body = "Isi pengumuman tidak boleh kosong.";
  else if (body.length > 4000) e.body = "Isi pengumuman maksimal 4000 karakter.";
  return e;
}
const announcementRow = (v) => ({ title: clean(v.title), body: clean(v.body), pinned: !!v.pinned });

export const listAnnouncements = () => repo.fetchAnnouncements(classId());
export async function createAnnouncement(v) {
  const e = validateAnnouncement(v);
  if (Object.keys(e).length) throw invalid(e);
  return repo.insertAnnouncement({ class_id: classId(), ...announcementRow(v) });
}
export async function editAnnouncement(id, v) {
  const e = validateAnnouncement(v);
  if (Object.keys(e).length) throw invalid(e);
  return repo.updateAnnouncement(id, announcementRow(v));
}
export const removeAnnouncement = (id) => repo.deleteRow("announcements", id);

// ---- jadwal

export function validateSchedule(v) {
  const e = {};
  const day = Number(v.day);
  if (!(day >= 1 && day <= 7)) e.day = "Pilih hari.";
  if (!clean(v.subject) || clean(v.subject).length > 80) e.subject = "Mata pelajaran wajib diisi, maksimal 80 karakter.";
  if (!/^\d{2}:\d{2}$/.test(clean(v.start))) e.start = "Isi jam mulai.";
  if (!/^\d{2}:\d{2}$/.test(clean(v.end))) e.end = "Isi jam selesai.";
  if (!e.start && !e.end && clean(v.end) <= clean(v.start)) e.end = "Jam selesai harus setelah jam mulai.";
  if (clean(v.teacher).length > 80) e.teacher = "Nama guru maksimal 80 karakter.";
  if (clean(v.room).length > 40) e.room = "Ruang maksimal 40 karakter.";
  return e;
}
const scheduleRow = (v) => ({
  day_of_week: Number(v.day),
  start_time: clean(v.start),
  end_time: clean(v.end),
  subject: clean(v.subject),
  teacher: optional(v.teacher),
  room: optional(v.room),
});

export async function listSchedules() {
  const rows = await repo.fetchSchedules(classId());
  return rows.map((r) => ({ ...r, start_time: hhmm(r.start_time), end_time: hhmm(r.end_time) }));
}
export async function createSchedule(v) {
  const e = validateSchedule(v);
  if (Object.keys(e).length) throw invalid(e);
  return repo.insertSchedule({ class_id: classId(), ...scheduleRow(v) });
}
export async function editSchedule(id, v) {
  const e = validateSchedule(v);
  if (Object.keys(e).length) throw invalid(e);
  return repo.updateSchedule(id, scheduleRow(v));
}
export const removeSchedule = (id) => repo.deleteRow("schedules", id);

// ---- tugas

export function validateTask(v) {
  const e = {};
  const title = clean(v.title);
  if (title.length < 2 || title.length > 120) e.title = "Judul 2 sampai 120 karakter.";
  if (clean(v.description).length > 4000) e.description = "Keterangan maksimal 4000 karakter.";
  if (clean(v.subject).length > 80) e.subject = "Mata pelajaran maksimal 80 karakter.";
  if (v.due && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.due)) e.due = "Format tenggat belum benar.";
  return e;
}
const taskRow = (v) => ({
  title: clean(v.title),
  description: optional(v.description),
  subject: optional(v.subject),
  due_at: fromJakartaInput(v.due),
});

export const listTasks = () => repo.fetchTasks(classId());
export async function createTask(v) {
  const e = validateTask(v);
  if (Object.keys(e).length) throw invalid(e);
  return repo.insertTask({ class_id: classId(), ...taskRow(v) });
}
export async function editTask(id, v) {
  const e = validateTask(v);
  if (Object.keys(e).length) throw invalid(e);
  return repo.updateTask(id, taskRow(v));
}
export const removeTask = (id) => repo.deleteRow("tasks", id);

// ---- Mading

export const countPendingMembers = () => repo.countPending(classId());

// ---- log aktivitas

const MODULE_LABEL = { announcements: "pengumuman", schedules: "jadwal", tasks: "tugas", roles: "role" };
const VERB = { insert: "membuat", update: "mengubah", delete: "menghapus" };

// Ubah satu baris audit_logs menjadi kalimat Indonesia.
export function describeLog(row, names) {
  const d = row.detail ?? {};
  const who = row.actor_id ? names.get(row.actor_id) ?? "Main Admin" : "Sistem";
  const label = d.label ? ` "${d.label}"` : "";
  const [table, op] = row.action.split(".");

  if (row.action === "akun.ubah") return { who, text: `mengubah ${[].concat(d.perubahan ?? []).join(", ")} ${d.label ?? "seorang anggota"}`.replace(/\s+/g, " ") };
  if (row.action === "akun.reset_sandi") return { who, text: `mereset kata sandi ${d.label ?? "seorang anggota"}` };
  if (row.action === "classes.kode_diubah") return { who, text: "mengganti kode kelas" };
  if (row.action === "classes.status") return { who, text: d.aktif ? "mengaktifkan kelas" : "menonaktifkan kelas" };
  if (row.action === "classes.insert") return { who, text: `membuat kelas${label}` };
  if (table === "member_roles") {
    const verb = op === "insert" ? "memasang" : "melepas";
    return { who, text: `${verb} role ${d.role ?? ""}${op === "insert" ? " pada " : " dari "}${d.anggota ?? "seorang anggota"}`.replace(/\s+/g, " ").trim() };
  }
  if (table === "class_members") {
    if (op === "insert") return { who: d.label ?? "Seseorang", text: "mendaftar ke kelas" };
    if (d.status_dari === "pending" && d.status_ke === "active") return { who, text: `menyetujui ${d.label}` };
    if (d.status_dari === "pending" && d.status_ke === "rejected") return { who, text: `menolak ${d.label}` };
    if (d.status_ke === "removed") return { who, text: `mengeluarkan ${d.label}` };
    if (d.status_ke === "active") return { who, text: `memulihkan ${d.label}` };
    return { who, text: `mengubah data ${d.label ?? "anggota"}` };
  }
  if (MODULE_LABEL[table] && VERB[op]) return { who, text: `${VERB[op]} ${MODULE_LABEL[table]}${label}` };
  return { who, text: row.action };
}

export async function loadLogs(beforeId) {
  const id = classId();
  const [rows, members] = await Promise.all([repo.fetchAuditLogs(id, beforeId), repo.fetchMemberNames(id)]);
  const names = new Map(members.map((m) => [m.user_id, m.display_name]));
  return rows.map((row) => ({ id: row.id, at: row.created_at, ...describeLog(row, names) }));
}

// ---- data kelas milik sendiri (profil)

export function validateOwnMember(v) {
  const e = {};
  if (clean(v.nomorAbsen).length > 20) e.nomorAbsen = "Nomor absen maksimal 20 karakter.";
  if (clean(v.nis).length > 30) e.nis = "NIS maksimal 30 karakter.";
  return e;
}
export async function saveOwnMember(v) {
  const e = validateOwnMember(v);
  if (Object.keys(e).length) throw invalid(e);
  const member = appStore.get().member;
  await repo.updateOwnMember(member.id, { nomor_absen: optional(v.nomorAbsen), nis: optional(v.nis) });
}

// ---- kabar sistem

export async function loadSystemNews() {
  const userId = appStore.get().session.user.id;
  const [rows, readIds] = await Promise.all([repo.fetchSystemNews(), repo.fetchReadIds(userId)]);
  const read = new Set(readIds);
  return rows.map((r) => ({ ...r, unread: !read.has(r.id) }));
}

export async function markNewsRead(rows) {
  const ids = rows.filter((r) => r.unread).map((r) => r.id);
  await repo.markNewsRead(ids, appStore.get().session.user.id);
}
