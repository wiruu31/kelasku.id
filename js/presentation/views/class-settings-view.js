import { h } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { emptyState } from "../../core/errors.js";
import { loadJoinCode, saveJoinCode } from "../../services/admin-service.js";
import { can } from "../../services/permissions.js";
import { codePanel } from "../components/code-panel.js";

export async function classSettingsView() {
  const state = appStore.get();
  const cls = state.member?.class;
  const head = h("header", { class: "page-head" }, h("h1", {}, "Pengaturan kelas"), h("p", {}, cls ? `${cls.name}${cls.school?.name ? `, ${cls.school.name}` : ""}` : ""));
  if (!cls || !can(state, "kode.kelola")) {
    return h("div", {}, head, emptyState("Kamu tidak punya akses", "Halaman ini untuk admin atau pemegang izin Mengelola kode kelas."));
  }
  const code = await loadJoinCode();
  return h("div", {}, head, h("div", { style: "max-width:560px" }, codePanel({ initialCode: code, save: (input) => saveJoinCode(input) })));
}
