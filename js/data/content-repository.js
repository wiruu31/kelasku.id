import { db } from "./supabase-client.js";
import { requireRow } from "../core/errors.js";

// Lapisan data pengumuman, jadwal, tugas, log, dan data kelas milik sendiri.

const ANNOUNCEMENT = "id, title, body, pinned, created_by, created_at, updated_at, author:profiles!created_by(full_name)";
const SCHEDULE = "id, day_of_week, start_time, end_time, subject, teacher, room, created_by";
const TASK = "id, title, description, subject, due_at, created_by, created_at, author:profiles!created_by(full_name)";

async function insertRow(table, columns, row) {
  const { data, error } = await db().from(table).insert(row).select(columns).single();
  if (error) throw error;
  return data;
}

async function updateRow(table, columns, id, patch) {
  const { data, error } = await db().from(table).update(patch).eq("id", id).select(columns);
  if (error) throw error;
  requireRow(data);
  return data[0];
}

export async function deleteRow(table, id) {
  const { data, error } = await db().from(table).delete().eq("id", id).select("id");
  if (error) throw error;
  requireRow(data);
}

export async function fetchAnnouncements(classId, limit = 60) {
  const { data, error } = await db()
    .from("announcements")
    .select(ANNOUNCEMENT)
    .eq("class_id", classId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
export const insertAnnouncement = (row) => insertRow("announcements", ANNOUNCEMENT, row);
export const updateAnnouncement = (id, patch) => updateRow("announcements", ANNOUNCEMENT, id, patch);

export async function fetchSchedules(classId) {
  const { data, error } = await db()
    .from("schedules")
    .select(SCHEDULE)
    .eq("class_id", classId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
export const insertSchedule = (row) => insertRow("schedules", SCHEDULE, row);
export const updateSchedule = (id, patch) => updateRow("schedules", SCHEDULE, id, patch);

export async function fetchTasks(classId) {
  const { data, error } = await db()
    .from("tasks")
    .select(TASK)
    .eq("class_id", classId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export const insertTask = (row) => insertRow("tasks", TASK, row);
export const updateTask = (id, patch) => updateRow("tasks", TASK, id, patch);

export async function countPending(classId) {
  const { count, error } = await db()
    .from("class_members")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function fetchAuditLogs(classId, beforeId, limit = 40) {
  let query = db()
    .from("audit_logs")
    .select("id, actor_id, action, target_id, detail, created_at")
    .eq("class_id", classId)
    .order("id", { ascending: false })
    .limit(limit);
  if (beforeId) query = query.lt("id", beforeId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchMemberNames(classId) {
  const { data, error } = await db().from("class_members").select("user_id, display_name").eq("class_id", classId);
  if (error) throw error;
  return data ?? [];
}

export async function updateOwnMember(memberId, patch) {
  const { data, error } = await db().from("class_members").update(patch).eq("id", memberId).select("id");
  if (error) throw error;
  requireRow(data);
}

// ---- kabar sistem (siaran Main Admin untuk Admin Kelas)

export async function fetchSystemNews(limit = 50) {
  const { data, error } = await db().from("system_announcements").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

export async function fetchReadIds(userId) {
  const { data, error } = await db().from("system_announcement_reads").select("announcement_id").eq("user_id", userId);
  if (error) throw error;
  return data.map((r) => r.announcement_id);
}

// Primary key (announcement_id, user_id) membuat penanda ganda tidak berbahaya.
export async function markNewsRead(ids, userId) {
  if (!ids.length) return;
  const { error } = await db().from("system_announcement_reads").upsert(ids.map((id) => ({ announcement_id: id, user_id: userId })), { onConflict: "announcement_id,user_id", ignoreDuplicates: true });
  if (error) throw error;
}
