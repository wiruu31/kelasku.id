import * as roleRepo from "../data/role-repository.js";
import { appStore } from "../core/state.js";
import { AppError } from "../core/errors.js";
import { loadMyAccess } from "./access-service.js";
import { ROLE_COLORS, canEditPerms, canManageRole, myRank } from "./permissions.js";

// Aturan bisnis role. Tidak menyentuh DOM maupun Supabase secara langsung.

const colorOk = (c) => ROLE_COLORS.some((x) => x.value === c);

export function validateRole({ name, color }) {
  const errors = {};
  const n = String(name ?? "").trim().replace(/\s+/g, " ");
  if (n.length < 2 || n.length > 30) errors.name = "Nama role 2 sampai 30 karakter.";
  if (!colorOk(color)) errors.color = "Pilih salah satu warna.";
  return errors;
}

function classId() {
  const id = appStore.get().member?.class?.id;
  if (!id) throw new AppError("no_class", "Kamu belum tergabung di kelas.");
  return id;
}

export function listRoles() {
  return roleRepo.fetchRoles(classId());
}

export function getRole(roleId) {
  return roleRepo.fetchRole(roleId);
}

export function listMembers() {
  return roleRepo.fetchActiveMembers(classId());
}

export async function createRole({ name, color }, existing) {
  const errors = validateRole({ name, color });
  if (Object.keys(errors).length) throw Object.assign(new AppError("validation", "Periksa isian."), { fields: errors });
  const state = appStore.get();
  // Role baru ditaruh di dasar, tapi tidak pernah di atas peringkat pembuatnya.
  const custom = existing.filter((r) => !r.is_system);
  const bottom = custom.reduce((max, r) => Math.max(max, r.position), 0) + 1;
  const position = Math.max(bottom, myRank(state) + 1);
  const role = await roleRepo.insertRole({
    class_id: classId(),
    name: String(name).trim().replace(/\s+/g, " "),
    color,
    position,
  });
  await refreshMyRoles();
  return role;
}

export async function saveRole(role, { name, color, grants }) {
  const state = appStore.get();
  if (!canEditPerms(state, role)) throw new AppError("TIDAK_DIIZINKAN", "Kamu tidak boleh mengubah role ini.");
  const errors = role.is_system ? {} : validateRole({ name, color });
  if (Object.keys(errors).length) throw Object.assign(new AppError("validation", "Periksa isian."), { fields: errors });

  const cleanName = String(name).trim().replace(/\s+/g, " ");
  if (!role.is_system && (cleanName !== role.name || color !== role.color)) {
    await roleRepo.updateRole(role.id, { name: cleanName, color });
  }

  // Bandingkan dengan izin yang tersimpan; hanya kirim selisihnya.
  const current = new Map(role.role_permissions.map((p) => [p.permission, p.scope]));
  const toUpsert = [];
  const toDelete = [];
  for (const [permission, scope] of grants) {
    if (current.get(permission) !== scope) toUpsert.push({ role_id: role.id, permission, scope });
  }
  for (const permission of current.keys()) {
    if (!grants.has(permission)) toDelete.push(permission);
  }
  await roleRepo.deletePermissions(role.id, toDelete);
  await roleRepo.upsertPermissions(toUpsert);
  await refreshMyRoles();
  // Kembalikan data terbaru supaya simpan berikutnya dibandingkan dengan keadaan yang benar.
  return roleRepo.fetchRole(role.id);
}

export async function removeRole(role) {
  if (!canManageRole(appStore.get(), role)) throw new AppError("TIDAK_DIIZINKAN", "Kamu tidak boleh menghapus role ini.");
  await roleRepo.deleteRole(role.id);
  await refreshMyRoles();
}

// Tukar peringkat dua role bertetangga. direction -1 naik, +1 turun.
export async function moveRole(roles, role, direction) {
  const state = appStore.get();
  const sorted = [...roles].sort((a, b) => a.position - b.position);
  const i = sorted.findIndex((r) => r.id === role.id);
  const other = sorted[i + direction];
  if (!other || !canManageRole(state, role) || !canManageRole(state, other)) {
    throw new AppError("TIDAK_DIIZINKAN", "Role ini tidak bisa dipindah ke arah itu.");
  }
  // Posisi bisa sama bila pernah bertabrakan; paksa berbeda supaya urutan jelas.
  const a = role.position;
  const b = other.position === role.position ? role.position + direction : other.position;
  await roleRepo.updateRole(role.id, { position: b });
  await roleRepo.updateRole(other.id, { position: a });
  await refreshMyRoles();
}

export async function setMemberRole(member, role, on) {
  if (on) await roleRepo.addMemberRole(member.id, role.id);
  else await roleRepo.removeMemberRole(member.id, role.id);
  await refreshMyRoles();
}

// Muat ulang izin dan peringkat milik sendiri setelah ada perubahan role.
const refreshMyRoles = loadMyAccess;
