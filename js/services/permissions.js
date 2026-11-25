// Katalog izin dan pemeriksaan di sisi klien. Ini hanya untuk menampilkan atau
// menyembunyikan tombol; keputusan sebenarnya selalu diambil RLS di database.

export const NO_ROLE_RANK = 2147483647;

// kind "toggle": ya atau tidak. kind "scope": tidak, milik sendiri, atau semua.
export const PERMISSION_GROUPS = [
  {
    title: "Pengumuman",
    items: [
      { key: "pengumuman.akses", label: "Membuka menu pengumuman", kind: "toggle" },
      { key: "pengumuman.lihat", label: "Melihat isi pengumuman", kind: "toggle" },
      { key: "pengumuman.tambah", label: "Menambah pengumuman", kind: "toggle" },
      { key: "pengumuman.ubah", label: "Mengubah pengumuman", kind: "scope" },
      { key: "pengumuman.hapus", label: "Menghapus pengumuman", kind: "scope" },
    ],
  },
  {
    title: "Jadwal pelajaran",
    items: [
      { key: "jadwal.akses", label: "Membuka menu jadwal", kind: "toggle" },
      { key: "jadwal.lihat", label: "Melihat isi jadwal", kind: "toggle" },
      { key: "jadwal.tambah", label: "Menambah jadwal", kind: "toggle" },
      { key: "jadwal.ubah", label: "Mengubah jadwal", kind: "scope" },
      { key: "jadwal.hapus", label: "Menghapus jadwal", kind: "scope" },
    ],
  },
  {
    title: "Tugas",
    items: [
      { key: "tugas.akses", label: "Membuka menu tugas", kind: "toggle" },
      { key: "tugas.lihat", label: "Melihat isi tugas", kind: "toggle" },
      { key: "tugas.tambah", label: "Menambah tugas", kind: "toggle" },
      { key: "tugas.ubah", label: "Mengubah tugas", kind: "scope" },
      { key: "tugas.hapus", label: "Menghapus tugas", kind: "scope" },
    ],
  },
  {
    title: "Piket",
    items: [
      { key: "piket.akses", label: "Membuka menu piket", kind: "toggle" },
      { key: "piket.lihat", label: "Melihat jadwal piket", kind: "toggle" },
      { key: "piket.tambah", label: "Menambah murid ke jadwal piket", kind: "toggle" },
      { key: "piket.hapus", label: "Mencabut murid dari jadwal piket", kind: "toggle" },
    ],
  },
  {
    title: "Voting",
    items: [
      { key: "voting.akses", label: "Membuka menu voting", kind: "toggle" },
      { key: "voting.lihat", label: "Melihat dan ikut memilih", kind: "toggle" },
      { key: "voting.tambah", label: "Membuat voting", kind: "toggle" },
      { key: "voting.ubah", label: "Menutup voting", kind: "scope" },
      { key: "voting.hapus", label: "Menghapus voting", kind: "scope" },
    ],
  },
  {
    title: "Kas kelas",
    items: [
      { key: "kas.akses", label: "Membuka menu kas", kind: "toggle" },
      { key: "kas.lihat", label: "Melihat saldo dan riwayat kas", kind: "toggle" },
      { key: "kas.tambah", label: "Mencatat kas dan membuat iuran", kind: "toggle" },
      { key: "kas.ubah", label: "Mengubah catatan dan menandai iuran lunas", kind: "scope" },
      { key: "kas.hapus", label: "Menghapus catatan dan iuran", kind: "scope" },
    ],
  },
  {
    title: "Organigram",
    items: [{ key: "organigram.akses", label: "Membuka menu organigram", kind: "toggle" }],
  },
  {
    title: "Pengelolaan kelas",
    items: [
      { key: "akun.approve", label: "Menyetujui akun baru", kind: "toggle" },
      { key: "role.beri", label: "Memberi role ke murid di bawahnya", kind: "toggle" },
      { key: "kode.kelola", label: "Mengelola kode kelas", kind: "toggle" },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

// Warna role dibatasi ke palet terang supaya teks tinta selalu terbaca (kontras AA).
export const ROLE_COLORS = [
  { value: "#d7f36b", name: "Lime" },
  { value: "#f9c5d5", name: "Merah muda" },
  { value: "#bfe3ff", name: "Biru langit" },
  { value: "#ffe2a8", name: "Pasir" },
  { value: "#cff5e0", name: "Mint" },
  { value: "#e3d4ff", name: "Lilac" },
  { value: "#ffcbb0", name: "Persik" },
  { value: "#e6e6e6", name: "Abu" },
];

// Gabungkan izin dari banyak role. "semua" mengalahkan "milik".
export function mergePermissions(roles) {
  const merged = new Map();
  for (const role of roles) {
    for (const p of role.role_permissions ?? []) {
      if (merged.get(p.permission) !== "semua") merged.set(p.permission, p.scope);
    }
  }
  return merged;
}

export function topRank(roles) {
  return roles.length ? Math.min(...roles.map((r) => r.position)) : NO_ROLE_RANK;
}

export const ADMIN_KEY = "admin_kelas";

const isOwner = (state) => !!state.profile?.is_platform_owner;

// Admin Kelas adalah role sistem, bukan flag di anggota.
export const isClassAdmin = (state) => (state.myRoles ?? []).some((r) => r.system_key === ADMIN_KEY);

const isPower = (state) => isOwner(state) || isClassAdmin(state);

// Main Admin -1, Admin Kelas 0, role kustom 1 dan seterusnya, Murid paling bawah.
export function myRank(state) {
  if (isOwner(state)) return -1;
  return state.rank ?? NO_ROLE_RANK;
}

// Cermin has_perm di database. Cakupan "milik" dipenuhi "milik" maupun "semua".
export function can(state, permission, scope = "semua") {
  if (isPower(state)) return true;
  const held = state.perms?.get(permission);
  if (!held) return false;
  return held === "semua" || scope === "milik";
}

// Izin atas satu item: item milikku diperiksa dengan cakupan "milik", item orang lain dengan "semua".
export function canOnItem(state, module, action, item) {
  const mine = item.created_by === state.session?.user.id;
  return can(state, `${module}.${action}`, mine ? "milik" : "semua");
}

// Hanya Main Admin dan Admin Kelas yang boleh membuat, mengubah, atau menghapus role kustom.
export function canManageRole(state, role) {
  return isPower(state) && !role.is_system;
}

// Role izin Admin Kelas terkunci; role Murid tetap boleh diatur izinnya.
export function canEditPerms(state, role) {
  return isPower(state) && role.system_key !== ADMIN_KEY;
}

// Memberi role: role di bawah peringkatku ke anggota yang juga di bawahku. Role sistem tidak lewat sini.
export function canAssignRole(state, role, member, roleIndex) {
  if (role.is_system) return false;
  if (!(isPower(state) || can(state, "role.beri"))) return false;
  const rank = myRank(state);
  return role.position > rank && memberRank(member, roleIndex) > rank;
}

export function memberRank(member, roleIndex) {
  const ranks = (member.member_roles ?? []).map((mr) => roleIndex.get(mr.role_id)?.position).filter((p) => p != null);
  return ranks.length ? Math.min(...ranks) : NO_ROLE_RANK;
}
