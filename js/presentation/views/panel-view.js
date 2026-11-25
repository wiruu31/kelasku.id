import { h } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { emptyState } from "../../core/errors.js";
import { isClassAdmin } from "../../services/permissions.js";
import { countPendingMembers } from "../../services/content-service.js";
import { listMembers, listRoles } from "../../services/role-service.js";
import { PANEL_TABS, panelTabs } from "../components/panel-tabs.js";

const BLURB = {
  anggota: "Lihat anggota, pasang role, reset kata sandi, keluarkan, dan cabut foto.",
  persetujuan: "Setujui atau tolak pendaftar baru, dan pulihkan anggota yang dikeluarkan.",
  peran: "Buat role pengurus dan atur izin fitur untuk tiap role, termasuk Murid.",
  log: "Catatan siapa mengubah apa di kelas ini.",
  kode: "Lihat dan ganti kode kelas yang dibagikan ke calon anggota.",
};

export async function panelView() {
  if (!isClassAdmin(appStore.get())) {
    return emptyState("Kamu tidak punya akses", "Panel ini khusus Admin Kelas.");
  }
  const [members, roles, pending] = await Promise.all([listMembers(), listRoles(), countPendingMembers()]);
  const stat = (label, value) => h("div", { class: "stat" }, h("p", { class: "stat__label" }, label), h("p", { class: "stat__value" }, String(value)));
  return h(
    "div",
    {},
    h("div", { class: "panel-head" }, h("h1", {}, "Panel Admin Kelas")),
    panelTabs("ringkasan"),
    h("div", { class: "stat-row" }, stat("Anggota aktif", members.length), stat("Menunggu persetujuan", pending), stat("Role pengurus", roles.filter((r) => !r.is_system).length)),
    h(
      "ul",
      { class: "menu-grid" },
      PANEL_TABS.filter((t) => BLURB[t.id]).map((t) => h("li", {}, h("a", { class: "menu-tile", href: `#${t.path}` }, t.label, h("span", { class: "kas-row__meta" }, BLURB[t.id])))),
    ),
  );
}
