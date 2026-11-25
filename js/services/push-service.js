import * as repo from "../data/push-repository.js";
import { appStore } from "../core/state.js";
import { AppError } from "../core/errors.js";
import { VAPID_PUBLIC_KEY } from "../core/config.js";
import { can, isClassAdmin } from "./permissions.js";

export const CATEGORIES = [
  { key: "pengumuman", label: "Pengumuman baru", hint: "Saat ada pengumuman kelas." },
  { key: "tugas", label: "Tugas baru", hint: "Saat tugas ditambahkan." },
  { key: "tenggat", label: "Tenggat tugas besok", hint: "Pengingat setiap pukul 16.00 WIB." },
  { key: "voting", label: "Voting baru", hint: "Saat voting dibuat." },
  { key: "piket", label: "Piket hari ini", hint: "Pengingat setiap pukul 06.30 WIB jika kamu bertugas." },
  { key: "siaran", label: "Kabar dari Admin Kelasku.id", hint: "Siaran sistem untuk kelasmu." },
  { key: "pendaftar", label: "Pendaftar baru", hint: "Saat ada akun menunggu persetujuanmu.", needsApproval: true },
];

// Kategori yang relevan untuk akun ini: "pendaftar" hanya untuk yang boleh menyetujui akun.
export function visibleCategories(state = appStore.get()) {
  return CATEGORIES.filter((c) => !c.needsApproval || isClassAdmin(state) || can(state, "akun.approve"));
}

export const isConfigured = () => VAPID_PUBLIC_KEY.length > 20;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

// Alasan notifikasi belum bisa dipakai di perangkat ini, atau null bila bisa.
export function blocker() {
  if (!isConfigured()) return "belum_dikonfigurasi";
  if (isIos() && !isStandalone()) return "ios_pasang_dulu";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "tidak_didukung";
  if (Notification.permission === "denied") return "ditolak";
  return null;
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function isSubscribed() {
  if (blocker() && blocker() !== "ditolak") return false;
  try {
    return (await currentSubscription()) !== null;
  } catch {
    return false;
  }
}

function keyToBytes(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function saveToServer(sub) {
  const json = sub.toJSON();
  await repo.rpcSaveSubscription({
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    userAgent: navigator.userAgent,
  });
}

export async function enablePush() {
  const why = blocker();
  if (why === "ditolak") throw new AppError("notif_ditolak", "Notifikasi diblokir di pengaturan browser. Izinkan dulu di sana, lalu coba lagi.");
  if (why) throw new AppError("notif_tidak_didukung", "Perangkat ini belum bisa menerima notifikasi.");
  const result = await Notification.requestPermission();
  if (result !== "granted") throw new AppError("notif_ditolak", "Izin notifikasi tidak diberikan.");
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }));
  await saveToServer(sub);
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await repo.rpcRemoveSubscription(endpoint);
}

// Dipanggil saat aplikasi dibuka dan sudah masuk: memastikan langganan perangkat tercatat atas akun yang sedang aktif.
export async function syncPush() {
  try {
    if (blocker() || Notification.permission !== "granted") return;
    const sub = await currentSubscription();
    if (sub) await saveToServer(sub);
  } catch {
    // Sinkronisasi gagal tidak mengganggu pemakaian; dicoba lagi saat aplikasi dibuka berikutnya.
  }
}

// Dipanggil sebelum keluar supaya perangkat ini berhenti menerima pesan akun yang keluar.
export async function forgetDevice() {
  try {
    const sub = blocker() ? null : await currentSubscription();
    if (sub) await repo.rpcRemoveSubscription(sub.endpoint);
  } catch {
    // Gagal di sini tidak boleh menahan proses keluar.
  }
}

export async function loadPrefs() {
  const rows = await repo.fetchPrefs();
  const map = new Map(CATEGORIES.map((c) => [c.key, true]));
  rows.forEach((r) => map.set(r.category, r.enabled));
  return map;
}

export async function setPref(category, enabled) {
  const userId = appStore.get().session?.user.id;
  if (!userId) throw new AppError("sesi_habis", "Sesimu berakhir. Masuk lagi.");
  await repo.upsertPref(userId, category, enabled);
}
