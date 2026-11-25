import { db } from "./supabase-client.js";

// Lapisan data role. Aturan siapa boleh apa dijaga RLS; di sini hanya query.

const ROLE_COLUMNS = "id, class_id, name, color, position, is_system, system_key, role_permissions(permission, scope)";

export async function fetchRoles(classId) {
  const { data, error } = await db()
    .from("roles")
    .select(ROLE_COLUMNS)
    .eq("class_id", classId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchRole(roleId) {
  const { data, error } = await db().from("roles").select(ROLE_COLUMNS).eq("id", roleId).maybeSingle();
  if (error) throw error;
  return data;
}

// Role milik pengguna sendiri, untuk menghitung izin dan peringkat.
export async function fetchMemberRoles(memberId) {
  const { data, error } = await db()
    .from("member_roles")
    .select("role:roles(id, name, color, position, is_system, system_key, role_permissions(permission, scope))")
    .eq("member_id", memberId);
  if (error) throw error;
  return (data ?? []).map((row) => row.role).filter(Boolean);
}

export async function insertRole(row) {
  const { data, error } = await db().from("roles").insert(row).select(ROLE_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function updateRole(roleId, patch) {
  const { error } = await db().from("roles").update(patch).eq("id", roleId);
  if (error) throw error;
}

export async function deleteRole(roleId) {
  const { error } = await db().from("roles").delete().eq("id", roleId);
  if (error) throw error;
}

export async function upsertPermissions(rows) {
  if (!rows.length) return;
  const { error } = await db().from("role_permissions").upsert(rows, { onConflict: "role_id,permission" });
  if (error) throw error;
}

export async function deletePermissions(roleId, permissions) {
  if (!permissions.length) return;
  const { error } = await db().from("role_permissions").delete().eq("role_id", roleId).in("permission", permissions);
  if (error) throw error;
}

export async function fetchActiveMembers(classId) {
  const { data, error } = await db()
    .from("class_members")
    .select("id, user_id, display_name, profile:profiles!user_id(avatar_path), member_roles(role_id)")
    .eq("class_id", classId)
    .eq("status", "active")
    .order("display_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addMemberRole(memberId, roleId) {
  const { error } = await db().from("member_roles").insert({ member_id: memberId, role_id: roleId });
  if (error) throw error;
}

export async function removeMemberRole(memberId, roleId) {
  const { error } = await db().from("member_roles").delete().eq("member_id", memberId).eq("role_id", roleId);
  if (error) throw error;
}
