import * as repo from "../data/console-repository.js";
import { createStore } from "../../core/state.js";
import { AppError, fromServerCode, toAppError } from "../../core/errors.js";

export const konsolStore = createStore({ session: null, profile: null, online: navigator.onLine });

const SIGNED_OUT = { session: null, profile: null };

// Hanya Main Admin yang boleh tinggal di Konsol; akun lain langsung dikeluarkan.
async function admit(session) {
  const profile = await repo.fetchProfile(session.user.id);
  if (!profile?.is_platform_owner) {
    await repo.signOut().catch(() => {});
    konsolStore.set(SIGNED_OUT);
    throw new AppError("BUKAN_MAIN_ADMIN", fromServerCode("BUKAN_MAIN_ADMIN").userMessage);
  }
  konsolStore.set({ session, profile });
}

export async function login(identifier, password) {
  const id = String(identifier ?? "").trim();
  if (!id || !password) throw new AppError("validation", "Isi identitas dan kata sandi.");
  let result;
  try {
    result = await repo.resolveLogin(id, password);
  } catch (err) {
    throw toAppError(err);
  }
  if (result?.code) throw fromServerCode(result.code);
  await repo.adoptSession(result.session);
  await admit(await repo.currentSession());
  await repo.logConsoleLogin().catch(() => {});
}

export async function restore() {
  const session = await repo.currentSession();
  if (!session) return konsolStore.set(SIGNED_OUT);
  await admit(session);
}

export async function logout() {
  try {
    await repo.signOut();
  } finally {
    konsolStore.set(SIGNED_OUT);
  }
}

export const isSignedIn = () => !!konsolStore.get().profile;

export function validatePasswordChange(password, confirm) {
  if (String(password).length < 8) return "Kata sandi minimal 8 karakter.";
  if (password !== confirm) return "Konfirmasi kata sandi tidak sama.";
  return null;
}

export async function changeOwnPassword(password, confirm) {
  const problem = validatePasswordChange(password, confirm);
  if (problem) throw Object.assign(new AppError("validation", problem), { fields: { password: problem } });
  await repo.updateOwnPassword(password);
}

export async function changeOwnName(fullName) {
  const name = String(fullName ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 3) throw Object.assign(new AppError("validation", "Nama minimal 3 huruf."), { fields: { fullName: "Nama minimal 3 huruf." } });
  const { profile } = konsolStore.get();
  await repo.updateOwnName(profile.id, name);
  konsolStore.set({ profile: { ...profile, full_name: name } });
}
