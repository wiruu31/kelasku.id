import { db } from "./supabase-client.js";
import { requireRow } from "../core/errors.js";

// Lapisan data piket, voting, kas, dan foto profil. Aturan akses dijaga RLS dan fungsi database.

const AVATAR_BUCKET = "avatars";

// ---- piket

export async function fetchPiket(classId) {
  const { data, error } = await db()
    .from("piket_duties")
    .select("id, day_of_week, member_id, member:class_members!member_id(id, display_name, user_id, profile:profiles!user_id(avatar_path))")
    .eq("class_id", classId)
    .order("day_of_week", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertPiket(row) {
  const { error } = await db().from("piket_duties").insert(row);
  if (error) throw error;
}

export async function deletePiket(id) {
  const { data, error } = await db().from("piket_duties").delete().eq("id", id).select("id");
  if (error) throw error;
  requireRow(data);
}

// ---- voting

export async function fetchPolls(classId) {
  const { data, error } = await db().rpc("class_polls", { p_class: classId });
  if (error) throw error;
  return data ?? [];
}

export async function rpcCreatePoll(args) {
  const { data, error } = await db().rpc("create_poll", args);
  if (error) throw error;
  return data;
}

export async function rpcCastVote(pollId, optionIds) {
  const { error } = await db().rpc("cast_vote", { p_poll: pollId, p_options: optionIds });
  if (error) throw error;
}

export async function rpcClosePoll(pollId) {
  const { error } = await db().rpc("close_poll", { p_poll: pollId });
  if (error) throw error;
}

export async function deletePoll(id) {
  const { data, error } = await db().from("polls").delete().eq("id", id).select("id");
  if (error) throw error;
  requireRow(data);
}

// ---- kas

const ENTRY = "id, kind, amount, note, entry_date, source, created_by, created_at";
const DUE = "id, name, amount, period, starts_on, is_active, created_by";

export async function fetchKasSummary(classId) {
  const { data, error } = await db().rpc("kas_summary", { p_class: classId });
  if (error) throw error;
  return data;
}

export async function fetchKasEntries(classId, limit = 100) {
  const { data, error } = await db()
    .from("kas_entries")
    .select(ENTRY)
    .eq("class_id", classId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function insertKasEntry(row) {
  const { error } = await db().from("kas_entries").insert(row);
  if (error) throw error;
}

export async function updateKasEntry(id, patch) {
  const { data, error } = await db().from("kas_entries").update(patch).eq("id", id).select("id");
  if (error) throw error;
  requireRow(data);
}

export async function deleteKasEntry(id) {
  const { data, error } = await db().from("kas_entries").delete().eq("id", id).select("id");
  if (error) throw error;
  requireRow(data);
}

export async function fetchDues(classId) {
  const { data, error } = await db().from("kas_dues").select(DUE).eq("class_id", classId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertDue(row) {
  const { error } = await db().from("kas_dues").insert(row);
  if (error) throw error;
}

export async function updateDue(id, patch) {
  const { data, error } = await db().from("kas_dues").update(patch).eq("id", id).select("id");
  if (error) throw error;
  requireRow(data);
}

export async function deleteDue(id) {
  const { data, error } = await db().from("kas_dues").delete().eq("id", id).select("id");
  if (error) throw error;
  requireRow(data);
}

export async function fetchPayments(dueIds) {
  if (!dueIds.length) return [];
  const { data, error } = await db().from("kas_due_payments").select("due_id, member_id, period_key").in("due_id", dueIds);
  if (error) throw error;
  return data ?? [];
}

export async function rpcSetDuePaid(args) {
  const { error } = await db().rpc("set_due_paid", args);
  if (error) throw error;
}

// ---- foto profil

export async function uploadAvatar(userId, blob) {
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await db().storage.from(AVATAR_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

export async function rpcSetMyAvatar(path) {
  const { data, error } = await db().rpc("set_my_avatar", { p_path: path });
  if (error) throw error;
  return data;
}

export async function rpcClearAvatar(userId) {
  const { data, error } = await db().rpc("clear_avatar", { p_user: userId });
  if (error) throw error;
  return data;
}

export async function removeAvatarFiles(paths) {
  const list = paths.filter(Boolean);
  if (!list.length) return;
  const { error } = await db().storage.from(AVATAR_BUCKET).remove(list);
  if (error) throw error;
}

// Berkas privat: alamat bertanda tangan berlaku sejam. Hasilnya peta path ke URL.
export async function signAvatarUrls(paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await db().storage.from(AVATAR_BUCKET).createSignedUrls(unique, 3600);
  if (error) throw error;
  return new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}
