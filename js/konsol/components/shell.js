import { h } from "../../core/dom.js";
import { brandMark, icon } from "./icons.js";
import { openModal } from "./modal.js";

export const NAV = [
  { path: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { path: "/ringkasan", label: "Ringkasan", icon: "ringkasan" },
  { path: "/role", label: "Atur Role", icon: "role" },
  { path: "/kelas-baru", label: "Tambah Kelas", icon: "kelas" },
  { path: "/sekolah", label: "Sekolah", icon: "sekolah" },
  { path: "/siaran", label: "Siaran Sistem", icon: "siaran" },
  { path: "/log", label: "Log", icon: "log" },
  { path: "/pengaturan", label: "Pengaturan", icon: "atur" },
];

const brand = () => h("a", { class: "brand", href: "#/dashboard" }, brandMark(), h("span", {}, "Admin ", h("span", { class: "brand__sub" }, "Kelasku.id")));

const navList = (onPick) =>
  h(
    "ul",
    { class: "nav" },
    NAV.map((item) =>
      h(
        "li",
        {},
        h("a", { class: "nav__link", href: `#${item.path}`, dataset: { path: item.path }, onClick: onPick }, icon(item.icon), item.label),
      ),
    ),
  );

export function buildShell({ onLogout }) {
  const main = h("main", { id: "isi", class: "main", tabindex: "-1" });
  const offline = h("div", { class: "offline-bar", role: "status", hidden: true }, "Kamu offline. Data baru tidak bisa dimuat sampai internet tersambung.");
  const pageLabel = h("span", { class: "topbar__page" });
  const who = h("span", {});
  const logout = h("button", { type: "button", class: "btn btn--quiet btn--small" }, icon("keluar", 16), "Keluar");
  logout.addEventListener("click", onLogout);

  const menuBtn = h("button", { type: "button", class: "btn btn--quiet btn--small", "aria-haspopup": "dialog" }, icon("menu", 18), "Menu");
  menuBtn.addEventListener("click", () => {
    const modal = openModal({
      title: "Menu",
      content: [h("nav", { class: "sheet-nav", "aria-label": "Menu utama" }, navList(() => setTimeout(() => modal.close(), 0))), h("div", { class: "actions" }, logout.cloneNode(true))],
    });
    modal.body.querySelector(".actions button").addEventListener("click", () => {
      modal.close();
      onLogout();
    });
    markCurrent(modal.body);
  });

  const rail = h("aside", { class: "rail" }, brand(), h("nav", { "aria-label": "Menu utama" }, navList()), h("div", { class: "rail__foot" }, who, logout));
  const topbar = h("header", { class: "topbar" }, brand(), pageLabel, menuBtn);
  const root = h("div", { class: "shell" }, h("a", { class: "skip-link", href: "#isi" }, "Lompat ke isi halaman"), offline, topbar, rail, main);

  let current = "";
  function markCurrent(scope) {
    for (const a of scope.querySelectorAll(".nav__link")) {
      if (current.startsWith(a.dataset.path)) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  }
  return {
    root,
    main,
    setActive(path, title) {
      current = path;
      markCurrent(root);
      pageLabel.textContent = title ?? "";
    },
    setUser: (name) => (who.textContent = name ?? ""),
    setOffline: (isOffline) => (offline.hidden = !isOffline),
  };
}
