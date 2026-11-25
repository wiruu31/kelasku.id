import { h, icon } from "../../core/dom.js";
import { can, isClassAdmin } from "../../services/permissions.js";

export const ICONS = {
  mading: ["M4 4h16v12H8l-4 4z"],
  pengumuman: ["M4 10v4h3l7 4V6l-7 4z", "M18 9a4 4 0 0 1 0 6"],
  jadwal: ["M4 6h16v14H4z", "M4 10h16", "M8 3v4", "M16 3v4"],
  tugas: ["M5 12l4 4 10-10"],
  profil: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"],
  anggota: ["M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M3 20a6 6 0 0 1 12 0", "M16 5a3 3 0 0 1 0 6", "M18 14a6 6 0 0 1 3 6"],
  persetujuan: ["M5 12l4 4 10-10", "M4 20h16"],
  kelas: ["M4 6h16v12H4z", "M9 10h6", "M9 14h4"],
  sistem: ["M4 8a8 8 0 0 1 16 0v4l2 3H2l2-3z", "M10 19a2 2 0 0 0 4 0"],
  piket: ["M5 20l4-12", "M9 8l9 3", "M4 20h8"],
  voting: ["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2"],
  kas: ["M3 7h18v12H3z", "M3 11h18", "M16 15h2"],
  organigram: ["M9 3h6v5H9z", "M3 16h6v5H3z", "M15 16h6v5h-6z", "M12 8v4", "M6 16v-4h12v4"],
  panel: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M9 12l2 2 4-4"],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
};

const inClass = (state) => state.member?.status === "active";
const feature = (key) => (s) => inClass(s) && can(s, `${key}.akses`);

// extra: hanya di rel samping; di ponsel dijangkau lewat halaman Menu karena bilah bawah hanya muat 5 tab.
// mobileOnly: hanya di bilah bawah.
export const NAV_ITEMS = [
  { path: "/mading", label: "Mading", icon: "mading", show: inClass },
  { path: "/pengumuman", label: "Pengumuman", icon: "pengumuman", extra: true, show: feature("pengumuman") },
  { path: "/jadwal", label: "Jadwal", icon: "jadwal", show: inClass },
  { path: "/tugas", label: "Tugas", icon: "tugas", show: inClass },
  { path: "/piket", label: "Piket", icon: "piket", extra: true, show: feature("piket") },
  { path: "/voting", label: "Voting", icon: "voting", extra: true, show: feature("voting") },
  { path: "/kas", label: "Kas", icon: "kas", extra: true, show: feature("kas") },
  { path: "/organigram", label: "Organigram", icon: "organigram", extra: true, show: feature("organigram") },
  { path: "/anggota", label: "Anggota", icon: "anggota", extra: true, show: inClass },
  { path: "/persetujuan", label: "Persetujuan", icon: "persetujuan", extra: true, show: (s) => inClass(s) && !isClassAdmin(s) && can(s, "akun.approve") },
  { path: "/kelas", label: "Kode kelas", icon: "kelas", extra: true, show: (s) => inClass(s) && !isClassAdmin(s) && can(s, "kode.kelola") },
  { path: "/panel", label: "Panel Admin", icon: "panel", extra: true, show: (s) => inClass(s) && isClassAdmin(s) },
  { path: "/sistem", label: "Kabar Sistem", icon: "sistem", extra: true, show: (s) => inClass(s) && isClassAdmin(s) },
  { path: "/menu", label: "Menu", icon: "menu", mobileOnly: true, show: inClass },
  { path: "/profil", label: "Profil", icon: "profil", show: () => true },
];

export function buildShell() {
  const offlineBar = h(
    "div",
    { class: "offline-bar", role: "status", hidden: true },
    "Kamu offline. Data baru tidak bisa dimuat sampai internet tersambung.",
  );
  const main = h("main", { id: "isi", class: "app-main", tabindex: "-1" });
  const school = h("p", { class: "app-nav__school" });
  const topSchool = h("p", { class: "app-topbar__school" });
  const topbar = h("div", { class: "app-topbar" }, h("span", { class: "app-topbar__brand", "aria-hidden": "true" }, "Kelasku.id"), topSchool);
  const links = NAV_ITEMS.map((item) =>
    h(
      "li",
      { class: [item.extra && "nav-extra", item.mobileOnly && "nav-mobile-only"].filter(Boolean).join(" ") || null, hidden: true, dataset: { path: item.path } },
      h("a", { class: "nav-link", href: `#${item.path}`, dataset: { path: item.path } }, icon(ICONS[item.icon]), item.label),
    ),
  );
  const nav = h(
    "nav",
    { class: "app-nav", "aria-label": "Menu utama" },
    h("div", { class: "app-nav__brand", "aria-hidden": "true" }, "Kelasku.id"),
    school,
    h("ul", { class: "app-nav__list" }, links),
  );
  const root = h(
    "div",
    { class: "app-shell" },
    h("a", { class: "skip-link", href: "#isi" }, "Lompat ke isi halaman"),
    offlineBar,
    topbar,
    nav,
    main,
  );

  return {
    root,
    main,
    setActive(path) {
      for (const a of nav.querySelectorAll(".nav-link")) {
        if (path.startsWith(a.dataset.path)) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      }
    },
    // Tampilkan menu tambahan sesuai izin pengguna saat ini.
    syncNav(state) {
      for (const item of NAV_ITEMS) {
        nav.querySelector(`li[data-path="${item.path}"]`).hidden = !item.show(state);
      }
    },
    setLayout(mode) {
      root.classList.toggle("app-shell--auth", mode === "auth");
    },
    // Nama kelas dan sekolah di rel samping (desktop) dan bilah atas (ponsel).
    setIdentity(state) {
      const cls = state.member?.status === "active" ? state.member.class : null;
      const text = cls ? [cls.name, cls.school?.name].filter(Boolean).join(" | ") : "";
      school.textContent = text;
      topSchool.textContent = text;
    },
    setOffline(isOffline) {
      offlineBar.hidden = !isOffline;
    },
  };
}
