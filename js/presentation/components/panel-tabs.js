import { h } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { isClassAdmin } from "../../services/permissions.js";

export const PANEL_TABS = [
  { id: "ringkasan", path: "/panel", label: "Ringkasan" },
  { id: "anggota", path: "/anggota", label: "Anggota" },
  { id: "persetujuan", path: "/persetujuan", label: "Persetujuan" },
  { id: "peran", path: "/peran", label: "Peran" },
  { id: "log", path: "/log", label: "Log" },
  { id: "kode", path: "/kelas", label: "Kode kelas" },
];

// Tab Panel Admin Kelas. Hanya untuk Admin Kelas; pemegang izin biasa melihat halamannya tanpa tab.
export function panelTabs(active) {
  if (!isClassAdmin(appStore.get())) return null;
  return h(
    "ul",
    { class: "tabs", "aria-label": "Panel Admin Kelas", role: "list" },
    PANEL_TABS.map((t) => h("li", {}, h("a", { class: "tab", href: `#${t.path}`, "aria-current": t.id === active ? "page" : null }, t.label))),
  );
}

// Bungkus view lama dengan tab panel tanpa mengubah isinya.
export const withPanel = (active, view) => async (ctx) => {
  const [node, tabs] = [await view(ctx), panelTabs(active)];
  return tabs ? h("div", {}, h("div", { class: "panel-head" }, h("h1", {}, "Panel Admin Kelas")), tabs, node) : node;
};
