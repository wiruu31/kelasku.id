import { db } from "./supabase-client.js";
import { requireRow } from "../core/errors.js";

// Lapisan data pengelolaan kelas. Aturan akses dijaga RLS dan fungsi database.

export async function fetchMembersByStatus(classId, statuses) {
  const { data, error } = await db()
    .from("class_members")
    .select("id, user_id, display_name, status, created_at")
    .eq("class_id", classId)
    .in("status", statuses)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Hanya admin kelas dan pemilik yang bisa membaca kontak; selain itu hasilnya kosong.
export async function fetchContacts(userIds) {
  if (!userIds.length) return [];
  const { data, error } = await db().from("profile_contacts").select("user_id, wa, email").in("user_id", userIds);
  if (error) throw error;
  return data ?? [];
}

export async function setMemberStatus(memberId, status) {
  const { data, error } = await db().from("class_members").update({ status }).eq("id", memberId).select("id");
  if (error) throw error;
  requireRow(data);
}

export async function fetchJoinCode(classId) {
  const { data, error } = await db().rpc("get_join_code", { p_class: classId });
  if (error) throw error;
  return data;
}

export async function changeJoinCode(classId, code) {
  const { data, error } = await db().rpc("change_join_code", { p_class: classId, p_code: code });
  if (error) throw error;
  return data;
}

// Edge Function mengembalikan {password} atau {code}.
export async function resetPassword(userId) {
  const { data, error } = await db().functions.invoke("admin-reset-password", { body: { userId } });
  if (!error) return data;
  const body = await error.context?.json?.().catch(() => null);
  if (body?.code) return body;
  throw error;
}

export async function updateOwnPassword(password) {
  const { error } = await db().auth.updateUser({ password });
  if (error) throw error;
}
