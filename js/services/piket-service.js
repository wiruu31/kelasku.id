import * as repo from "../data/features-repository.js";
import { appStore } from "../core/state.js";
import { AppError } from "../core/errors.js";
import { fetchActiveMembers } from "../data/role-repository.js";

// Jadwal piket manual: pasangan hari dan murid. Tidak ada tukar jadwal; satu murid boleh di banyak hari.

function classId() {
  const id = appStore.get().member?.class?.id;
  if (!id) throw new AppError("no_class", "Kamu belum tergabung di kelas.");
  return id;
}

// Hasil: peta hari (1 sampai 7) ke daftar { id, memberId, name, avatarPath }.
export async function loadPiket() {
  const rows = await repo.fetchPiket(classId());
  const byDay = new Map();
  for (const r of rows) {
    const list = byDay.get(r.day_of_week) ?? [];
    list.push({ id: r.id, memberId: r.member_id, name: r.member?.display_name ?? "Murid", avatarPath: r.member?.profile?.avatar_path ?? null });
    byDay.set(r.day_of_week, list);
  }
  return byDay;
}

export const activeMembersForPiket = () => fetchActiveMembers(classId());

export async function addPiket(day, memberId) {
  if (!(Number(day) >= 1 && Number(day) <= 7) || !memberId) throw new AppError("validation", "Pilih murid.");
  try {
    await repo.insertPiket({ class_id: classId(), day_of_week: Number(day), member_id: memberId });
  } catch (err) {
    if (err?.code === "23505") throw new AppError("duplicate", "Murid itu sudah ada di piket hari ini.", err);
    throw err;
  }
}

export const removePiket = (id) => repo.deletePiket(id);
