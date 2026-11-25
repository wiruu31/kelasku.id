import * as authRepo from "../data/auth-repository.js";
import * as memberRepo from "../data/member-repository.js";
import { appStore } from "../core/state.js";
import { loadMyAccess } from "./access-service.js";
import { AppError, fromServerCode, toAppError } from "../core/errors.js";
import { forgetDevice } from "./push-service.js";

// Aturan bisnis auth. Tidak menyentuh DOM maupun Supabase secara langsung.

const SIGNED_OUT = { session: null, profile: null, memberships: [], member: null, myRoles: [], perms: new Map(), rank: null };

export function normalizeWa(input) {
  let d = String(input ?? "").replace(/\D/g, "");
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  else if (d.startsWith("8")) d = `62${d}`;
  return d;
}

export function cleanName(input) {
  return String(input ?? "").trim().replace(/\s+/g, " ");
}

// Mengembalikan { field: "pesan" } untuk field yang bermasalah. Kosong berarti lolos.
export function validateRegister(v) {
  const errors = {};
  if (cleanName(v.fullName).length < 3) errors.fullName = "Nama lengkap minimal 3 huruf.";
  if (!/^[a-z0-9_]{3,20}$/.test(String(v.username).trim().toLowerCase())) {
    errors.username = "Username 3 sampai 20 karakter: huruf kecil, angka, atau garis bawah.";
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v.email).trim())) errors.email = "Format email belum benar.";
  if (!/^62\d{8,13}$/.test(normalizeWa(v.wa))) errors.wa = "Nomor WA belum benar. Contoh: 081234567890.";
  if (String(v.password).length < 8) errors.password = "Kata sandi minimal 8 karakter.";
  if (!/^[A-Za-z0-9]{6,12}$/.test(String(v.joinCode).trim())) errors.joinCode = "Kode kelas 6 sampai 12 huruf atau angka.";
  return errors;
}

// Kode galat server -> field yang ditandai.
const CODE_FIELD = {
  NAMA_TIDAK_VALID: "fullName",
  NAMA_SUDAH_ADA_DI_KELAS: "fullName",
  USERNAME_TIDAK_VALID: "username",
  USERNAME_SUDAH_DIPAKAI: "username",
  EMAIL_TIDAK_VALID: "email",
  EMAIL_SUDAH_DIPAKAI: "email",
  WA_TIDAK_VALID: "wa",
  WA_SUDAH_DIPAKAI: "wa",
  KODE_KELAS_TIDAK_VALID: "joinCode",
  KELAS_NONAKTIF: "joinCode",
};

export class FieldError extends AppError {
  constructor(code) {
    super(code, fromServerCode(code).userMessage);
    this.field = CODE_FIELD[code] ?? null;
  }
}

export async function register(values) {
  const fields = {
    fullName: cleanName(values.fullName),
    username: String(values.username).trim().toLowerCase(),
    email: String(values.email).trim().toLowerCase(),
    wa: normalizeWa(values.wa),
    joinCode: String(values.joinCode).trim().toUpperCase(),
  };
  const problems = validateRegister({ ...fields, password: values.password });
  if (Object.keys(problems).length) throw Object.assign(new AppError("validation", "Periksa isian."), { fields: problems });

  try {
    const code = await authRepo.registrationError(fields);
    if (code) throw new FieldError(code);
    await authRepo.signUp({
      email: fields.email,
      password: values.password,
      meta: { full_name: fields.fullName, username: fields.username, wa: fields.wa, join_code: fields.joinCode },
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Balapan langka: ada yang mendaftar di antara pengecekan dan signUp.
    throw toAppError(err);
  }
  await refreshSession();
}

export async function login(identifier, password) {
  const id = String(identifier ?? "").trim();
  if (!id || !password) throw new AppError("validation", "Isi identitas dan kata sandi.");
  let result;
  try {
    result = await authRepo.resolveLogin(id, password);
  } catch (err) {
    throw toAppError(err);
  }
  if (result?.code) throw fromServerCode(result.code);
  await authRepo.adoptSession(result.session);
  await refreshSession();
}

// Kosongkan state tanpa menyentuh Supabase (dipakai saat sesi sudah berakhir dari luar).
export function clearSession() {
  appStore.set(SIGNED_OUT);
}

export async function logout() {
  try {
    await forgetDevice();
    await authRepo.signOut();
  } finally {
    appStore.set(SIGNED_OUT);
  }
}

// Baca ulang sesi, profil, dan keanggotaan ke state global.
export async function refreshSession() {
  const session = await authRepo.currentSession();
  if (!session) {
    appStore.set(SIGNED_OUT);
    return;
  }
  const [profile, memberships] = await Promise.all([
    memberRepo.fetchProfile(session.user.id),
    memberRepo.fetchMemberships(session.user.id),
  ]);
  const member = memberships.find((m) => m.status === "active") ?? memberships[0] ?? null;
  appStore.set({ session, profile, memberships, member });
  await loadMyAccess();
}

// Main Admin memakai Konsol, bukan aplikasi kelas.
export function canEnterApp(state) {
  return !!state.session && state.member?.status === "active";
}

export function homePath() {
  return "/mading";
}
