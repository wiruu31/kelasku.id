import * as repo from "../data/class-repository.js";
import { appStore } from "../core/state.js";
import { AppError, fromServerCode } from "../core/errors.js";
import { memberRank, myRank } from "./permissions.js";

// Aturan bisnis pengelolaan kelas, persetujuan akun, dan kode kelas.

function myClassId() {
  const id = appStore.get().member?.class?.id;
  if (!id) throw new AppError("no_class", "Kamu belum tergabung di kelas.");
  return id;
}

// ---- persetujuan akun

export async function loadApprovals() {
  const classId = myClassId();
  const [pending, inactive] = await Promise.all([
    repo.fetchMembersByStatus(classId, ["pending"]),
    repo.fetchMembersByStatus(classId, ["rejected", "removed"]),
  ]);
  const contacts = await repo.fetchContacts(pending.map((m) => m.user_id));
  const byUser = new Map(contacts.map((c) => [c.user_id, c]));
  return { pending: pending.map((m) => ({ ...m, contact: byUser.get(m.user_id) ?? null })), inactive };
}

export const approveMember = (member) => repo.setMemberStatus(member.id, "active");
export const rejectMember = (member) => repo.setMemberStatus(member.id, "rejected");

// Hanya anggota yang peringkatnya di bawahku yang boleh dikeluarkan.
export function removeMember(member, roleIndex) {
  const state = appStore.get();
  if (member.user_id === state.session?.user.id) {
    throw new AppError("TIDAK_DIIZINKAN", "Kamu tidak bisa mengeluarkan dirimu sendiri.");
  }
  if (memberRank(member, roleIndex) <= myRank(state)) {
    throw new AppError("TIDAK_DIIZINKAN", "Kamu hanya bisa mengeluarkan anggota di bawah peringkatmu.");
  }
  return repo.setMemberStatus(member.id, "removed");
}

// ---- kode kelas

const CODE_FORMAT = /^[A-HJ-NP-Z2-9]{6,12}$/;

export const loadJoinCode = (classId = myClassId()) => repo.fetchJoinCode(classId);

// input kosong berarti minta kode acak baru dari database.
export async function saveJoinCode(input, classId = myClassId()) {
  const code = String(input ?? "").trim().toUpperCase();
  if (code && !CODE_FORMAT.test(code)) throw fromServerCode("KODE_FORMAT_SALAH");
  return repo.changeJoinCode(classId, code || null);
}

// ---- reset sandi

export async function resetMemberPassword(member) {
  const result = await repo.resetPassword(member.user_id);
  if (result?.code) throw fromServerCode(result.code === "GAGAL_RESET" ? "unknown" : result.code);
  return result.password;
}

export function validateNewPassword(password, confirm) {
  if (String(password).length < 8) return "Kata sandi minimal 8 karakter.";
  if (password !== confirm) return "Konfirmasi kata sandi tidak sama.";
  return null;
}

export async function changeOwnPassword(password, confirm) {
  const problem = validateNewPassword(password, confirm);
  if (problem) throw Object.assign(new AppError("validation", problem), { fields: { password: problem } });
  await repo.updateOwnPassword(password);
}
