import { h, icon } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { ICONS, NAV_ITEMS } from "../components/shell.js";

// Daftar semua tujuan untuk ponsel, karena bilah bawah hanya memuat lima tab.
export function menuView() {
  const state = appStore.get();
  const items = NAV_ITEMS.filter((i) => i.extra && i.show(state));
  return h(
    "div",
    {},
    h("header", { class: "page-head" }, h("h1", {}, "Menu"), h("p", {}, "Semua bagian kelas yang bisa kamu buka.")),
    h(
      "ul",
      { class: "menu-grid" },
      items.map((i) => h("li", {}, h("a", { class: "menu-tile", href: `#${i.path}` }, icon(ICONS[i.icon]), i.label))),
    ),
  );
}
