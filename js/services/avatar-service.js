import * as repo from "../data/features-repository.js";
import { appStore } from "../core/state.js";
import { AppError } from "../core/errors.js";

export const MAX_AVATAR_BYTES = 300 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const SIDES = [640, 512, 384, 320, 256];
const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35];

function loadBitmap(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AppError("foto_rusak", "Berkas itu tidak bisa dibaca sebagai gambar."));
    };
    img.src = url;
  });
}

function toBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

// Potong persegi dari tengah, kecilkan, lalu turunkan kualitas sampai muat 300 KB.
export async function compressAvatar(file) {
  if (!ACCEPTED.includes(file.type)) throw new AppError("foto_format", "Pakai foto JPG, PNG, atau WebP.");
  const img = await loadBitmap(file);
  const crop = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - crop) / 2;
  const sy = (img.naturalHeight - crop) / 2;
  for (const side of SIDES) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(side, crop);
    canvas.getContext("2d").drawImage(img, sx, sy, crop, crop, 0, 0, canvas.width, canvas.height);
    for (const q of QUALITIES) {
      const blob = await toBlob(canvas, q);
      if (blob && blob.size <= MAX_AVATAR_BYTES) return blob;
    }
  }
  throw new AppError("foto_besar", "Foto terlalu besar dan tidak bisa dikecilkan sampai 300 KB. Coba foto lain.");
}

// Unggah dulu, baru tunjuk di profil, lalu hapus berkas lama. Gagal menghapus tidak membatalkan ganti foto.
export async function changeMyAvatar(file) {
  const userId = appStore.get().session?.user.id;
  if (!userId) throw new AppError("TIDAK_DIIZINKAN", "Kamu belum masuk.");
  const blob = await compressAvatar(file);
  const path = await repo.uploadAvatar(userId, blob);
  const old = await repo.rpcSetMyAvatar(path);
  await repo.removeAvatarFiles([old]).catch(() => {});
  appStore.set({ profile: { ...appStore.get().profile, avatar_path: path } });
  return path;
}

export async function removeMyAvatar() {
  const userId = appStore.get().session?.user.id;
  const old = await repo.rpcClearAvatar(userId);
  await repo.removeAvatarFiles([old]).catch(() => {});
  appStore.set({ profile: { ...appStore.get().profile, avatar_path: null } });
}

// Admin Kelas mencabut foto anggota.
export async function clearMemberAvatar(userId) {
  const old = await repo.rpcClearAvatar(userId);
  await repo.removeAvatarFiles([old]).catch(() => {});
}

// Peta path ke URL bertanda tangan; kegagalan tidak menghentikan halaman (huruf awal dipakai).
export async function avatarUrls(paths) {
  try {
    return await repo.signAvatarUrls(paths);
  } catch {
    return new Map();
  }
}
