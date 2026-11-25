import { h } from "./dom.js";

// Galat yang pesannya aman ditampilkan ke pengguna.
export class AppError extends Error {
  constructor(code, userMessage, cause) {
    super(userMessage);
    this.name = "AppError";
    this.code = code;
    this.userMessage = userMessage;
    this.cause = cause;
  }
}

// Kode galat dari database dan Edge Function, diterjemahkan untuk pengguna.
export const SERVER_MESSAGES = {
  NAMA_TIDAK_VALID: "Nama lengkap minimal 3 huruf.",
  USERNAME_TIDAK_VALID: "Username 3 sampai 20 karakter: huruf kecil, angka, atau garis bawah.",
  EMAIL_TIDAK_VALID: "Format email belum benar.",
  WA_TIDAK_VALID: "Nomor WA belum benar. Contoh: 081234567890.",
  KODE_KELAS_TIDAK_VALID: "Kode kelas tidak ditemukan. Cek lagi ke ketua atau admin kelasmu.",
  KELAS_NONAKTIF: "Kelas ini sedang tidak menerima anggota baru.",
  USERNAME_SUDAH_DIPAKAI: "Username itu sudah dipakai. Coba yang lain.",
  EMAIL_SUDAH_DIPAKAI: "Email itu sudah terdaftar. Kalau itu kamu, silakan masuk.",
  WA_SUDAH_DIPAKAI: "Nomor WA itu sudah terdaftar. Kalau itu kamu, silakan masuk.",
  NAMA_SUDAH_ADA_DI_KELAS:
    "Nama itu sudah ada di kelas ini. Kalau itu kamu, silakan masuk. Kalau orang lain, tambahkan nama belakang atau inisial.",
  KREDENSIAL_SALAH: "Identitas atau kata sandi salah.",
  AMBIGU: "Ada lebih dari satu akun dengan nama itu. Masuk pakai username, email, atau nomor WA.",
  TIDAK_DIIZINKAN: "Kamu tidak punya izin untuk tindakan ini.",
  BATAS_ADMIN: "Kelas ini sudah mencapai batas jumlah Admin Kelas.",
  BATAS_DI_BAWAH_JUMLAH: "Batas tidak boleh lebih kecil dari jumlah Admin Kelas yang sekarang.",
  BATAS_TIDAK_VALID: "Batas harus berupa angka bulat antara 1 dan 20.",
  ANGGOTA_BELUM_AKTIF: "Anggota ini belum aktif di kelas.",
  HARUS_NONAKTIF: "Nonaktifkan dulu sebelum menghapus.",
  KONFIRMASI_SALAH: "Nama yang diketik belum sama. Hapus dibatalkan.",
  KELAS_MASIH_AKTIF: "Kelas masih aktif. Nonaktifkan dulu.",
  SEKOLAH_TIDAK_VALID: "Sekolah tidak ditemukan.",
  BUKAN_MAIN_ADMIN: "Akun ini bukan Main Admin. Konsol hanya untuk Main Admin.",
  SANDI_TIDAK_VALID: "Kata sandi minimal 8 karakter.",
  TIDAK_ADA_PERUBAHAN: "Belum ada yang diubah.",
  GAGAL_UBAH: "Perubahan gagal disimpan. Coba lagi sebentar lagi.",
  TIDAK_DITEMUKAN: "Data yang dicari tidak ditemukan.",
  KODE_FORMAT_SALAH: "Kode kelas 6 sampai 12 karakter, huruf dan angka tanpa O, I, 0, dan 1.",
  KODE_SUDAH_DIPAKAI: "Kode itu sudah dipakai kelas lain.",
  ANGGOTA_TIDAK_VALID: "Murid itu bukan anggota aktif di kelas ini.",
  OPSI_TIDAK_VALID: "Voting butuh 2 sampai 10 pilihan.",
  OPSI_KEMBAR: "Ada pilihan yang sama. Tiap pilihan harus berbeda.",
  TENGGAT_TIDAK_VALID: "Tenggat harus di masa depan.",
  VOTING_SELESAI: "Voting ini sudah selesai.",
  PILIHAN_KOSONG: "Pilih salah satu dulu.",
  PILIHAN_TIDAK_VALID: "Pilihan itu tidak ada di voting ini.",
  SATU_PILIHAN: "Voting ini hanya boleh satu pilihan.",
  SUDAH_MEMILIH: "Kamu sudah memilih. Voting ini tidak bisa diganti suaranya.",
  PERIODE_TIDAK_VALID: "Periode iuran tidak valid.",
  IURAN_NONAKTIF: "Iuran ini sedang dinonaktifkan.",
  not_configured: "Database belum tersambung. Isi config.js dulu.",
};

const POSTGRES_MESSAGES = {
  "23505": "Data itu sudah dipakai. Coba nilai yang lain.",
  "42501": "Kamu tidak punya izin untuk tindakan ini.",
  PGRST301: "Sesi kamu habis. Silakan masuk lagi.",
  PGRST116: "Data yang dicari tidak ditemukan.",
};

// Ubah error apa pun (Supabase, jaringan, kode sendiri) jadi AppError berbahasa Indonesia.
export function toAppError(err) {
  if (err instanceof AppError) return err;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return new AppError("offline", "Kamu sedang offline. Sambungkan internet lalu coba lagi.", err);
  }
  const serverCode = typeof err === "string" ? err : err?.message;
  if (serverCode && SERVER_MESSAGES[serverCode]) {
    return new AppError(serverCode, SERVER_MESSAGES[serverCode], err);
  }
  if (err && POSTGRES_MESSAGES[err.code]) {
    return new AppError(err.code, POSTGRES_MESSAGES[err.code], err);
  }
  if (err instanceof TypeError) {
    return new AppError("network", "Tidak bisa menghubungi server. Cek koneksi internet kamu.", err);
  }
  return new AppError("unknown", "Terjadi kesalahan. Coba lagi sebentar lagi.", err);
}

// Update atau hapus yang ditolak RLS tidak error, hanya mengubah 0 baris. Anggap itu penolakan.
export function requireRow(rows) {
  if (!rows || rows.length === 0) throw new AppError("TIDAK_DIIZINKAN", SERVER_MESSAGES.TIDAK_DIIZINKAN);
}

export function fromServerCode(code) {
  return new AppError(code, SERVER_MESSAGES[code] ?? "Terjadi kesalahan. Coba lagi sebentar lagi.");
}

export function reportError(err) {
  // Detail teknis hanya ke konsol; pengguna melihat userMessage.
  console.error("[kelasku]", err);
}

export function errorState(err, onRetry) {
  const e = toAppError(err);
  return h(
    "section",
    { class: "state state--error", role: "alert" },
    h("h2", { class: "state__title" }, "Gagal memuat"),
    h("p", {}, e.userMessage),
    onRetry && h("button", { type: "button", class: "btn", onClick: onRetry }, "Coba lagi"),
  );
}

export function emptyState(title, text, action) {
  return h(
    "section",
    { class: "state" },
    h("h2", { class: "state__title" }, title),
    h("p", {}, text),
    action,
  );
}
