import { db } from "./supabase-client.js";

export async function fetchProfile(userId) {
  const { data, error } = await db()
    .from("profiles")
    .select("id, full_name, username, is_platform_owner, tour_done_at, avatar_path")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMemberships(userId) {
  const { data, error } = await db()
    .from("class_members")
    .select("id, status, display_name, nomor_absen, nis, class:classes(id, name, school:schools(id, name))")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateTourDone(userId, at) {
  const { data, error } = await db().from("profiles").update({ tour_done_at: at }).eq("id", userId).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("TIDAK_DIIZINKAN");
}
