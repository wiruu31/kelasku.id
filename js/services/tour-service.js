import { appStore } from "../core/state.js";
import { reportError } from "../core/errors.js";
import { updateTourDone } from "../data/member-repository.js";
import { installState } from "./install-service.js";
import { can, isClassAdmin } from "./permissions.js";

// Langkah tutorial dibentuk dari izin pengguna, bukan dari nama role.
// path: menu yang disorot. railOnly: hanya ada di rel samping desktop. compactOnly: hanya untuk layar sempit.

const power = (s) => isClassAdmin(s);

const WRITE_MODULES = [
  { perm: "jadwal.tambah", path: "/jadwal", phrase: "menambah jadwal" },
  { perm: "tugas.tambah", path: "/tugas", phrase: "menambah tugas" },
  { perm: "pengumuman.tambah", path: "/pengumuman", phrase: "menulis pengumuman" },
];

const joinList = (items) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} dan ${items[items.length - 1]}` : items[0]);

export function buildSteps(state) {
  const steps = [];
  const inClass = state.member?.status === "active";
  if (inClass) {
    steps.push(
      { id: "mading", path: "/mading", title: "Mading", body: "Papan utama kelas: jadwal hari ini, pengumuman terbaru, dan tugas yang tenggatnya dekat." },
      { id: "kabar", path: "/pengumuman", railOnly: true, title: "Pengumuman", body: "Pengumuman dari pengurus kelas. Yang disematkan selalu di atas." },
      { id: "jadwal", path: "/jadwal", title: "Jadwal", body: "Jadwal pelajaran per hari. Hari ini ditandai supaya mudah dicari." },
      { id: "tugas", path: "/tugas", title: "Tugas", body: "Daftar tugas dan tenggatnya. Lencana Terlewat, Hari ini, dan Besok membantu memilih mana yang dikerjakan dulu." },
    );
    const writable = WRITE_MODULES.filter((m) => can(state, m.perm));
    if (writable.length) {
      steps.push({
        id: "tulis",
        path: writable[0].path,
        title: "Menulis dan menambah",
        body: `Kamu boleh ${joinList(writable.map((m) => m.phrase))}. Buka menunya, lalu pilih tombol Tulis atau Tambah.`,
      });
    }
  }

  if (inClass) {
    const extras = [];
    for (const f of [
      { key: "piket", path: "/piket", title: "Piket", body: "Jadwal piket kelas per hari. Hari ini ditandai." },
      { key: "voting", path: "/voting", title: "Voting", body: "Ambil keputusan kelas. Ada voting terlihat dan voting anonim; hasil anonim dijaga sistem." },
      { key: "kas", path: "/kas", title: "Kas", body: "Saldo kelas, riwayat pemasukan dan pengeluaran, serta iuran tetap." },
      { key: "organigram", path: "/organigram", title: "Organigram", body: "Susunan pengurus kelas berdasarkan role." },
    ]) {
      if (can(state, `${f.key}.akses`)) {
        extras.push(f.title.toLowerCase());
        steps.push({ id: f.key, path: f.path, railOnly: true, title: f.title, body: f.body });
      }
    }
    steps.push({ id: "anggota", path: "/anggota", railOnly: true, title: "Anggota", body: "Daftar teman sekelas beserta foto dan role-nya." });
    if (!power(state) && can(state, "akun.approve")) {
      steps.push({ id: "persetujuan", path: "/persetujuan", railOnly: true, title: "Persetujuan akun", body: "Pendaftar baru menunggu di sini. Setujui hanya orang yang kamu kenal sebagai anggota kelas." });
    }
    if (!power(state) && can(state, "kode.kelola")) {
      steps.push({ id: "kelas", path: "/kelas", railOnly: true, title: "Kode kelas", body: "Lihat dan ganti kode kelas yang dibagikan ke calon anggota." });
    }
    if (power(state)) {
      steps.push(
        { id: "panel", path: "/panel", railOnly: true, title: "Panel Admin Kelas", body: "Satu tempat untuk anggota, persetujuan, peran, log aktivitas, dan kode kelas." },
        { id: "sistem", path: "/sistem", railOnly: true, title: "Kabar Sistem", body: "Siaran dari pengelola Kelasku.id untuk Admin Kelas." },
      );
    }
    steps.push({
      id: "menu",
      path: "/menu",
      compactOnly: true,
      title: "Menu",
      body: `Pengumuman${extras.length ? `, ${joinList(extras)}` : ""}, anggota${power(state) ? ", dan Panel Admin" : ""} ada di tab Menu.`,
    });
  }

  steps.push({
    id: "profil",
    path: "/profil",
    title: "Profil",
    body: inClass ? "Pasang foto, isi nomor absen dan NIS, ganti kata sandi, dan ulangi tutorial ini kapan saja." : "Ganti kata sandi dan ulangi tutorial ini kapan saja.",
  });
  if (installState() !== "installed") {
    steps.push({ id: "pasang", path: "/profil", title: "Pasang aplikasi", body: "Dari Profil kamu bisa memasang Kelasku.id ke layar utama supaya terbuka seperti aplikasi biasa." });
  }
  return steps;
}

let shownThisSession = false;

// Muncul otomatis sekali: anggota aktif yang belum pernah menyelesaikan atau melewati tur.
export function shouldAutoStart(state) {
  return !shownThisSession && state.member?.status === "active" && !!state.profile && !state.profile.tour_done_at;
}

export function noteShown() {
  shownThisSession = true;
}

// Gagal menyimpan tidak boleh mengganggu pengguna; tur hanya akan muncul lagi di sesi berikutnya.
export async function markTourDone() {
  const state = appStore.get();
  if (!state.profile || state.profile.tour_done_at) return;
  const at = new Date().toISOString();
  try {
    await updateTourDone(state.profile.id, at);
    appStore.set({ profile: { ...appStore.get().profile, tour_done_at: at } });
  } catch (err) {
    reportError(err);
  }
}
