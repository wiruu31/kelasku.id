import { h } from "../../core/dom.js";
import { emptyState, reportError, toAppError } from "../../core/errors.js";
import { field, withBusy } from "../../presentation/components/form.js";
import { liveNote } from "../../presentation/components/role-parts.js";
import { addSchool, loadOverview } from "../services/console-service.js";
import { openSchoolPanel } from "../components/panels.js";
import { rowButton, table } from "../components/table.js";
import { nav } from "../services/nav.js";

export async function schoolsView() {
  const overview = await loadOverview();
  const ctx = { overview, reload: () => nav.refresh() };

  const name = field({ label: "Nama sekolah baru", name: "name", maxlength: 120, required: false });
  const note = liveNote();
  const submit = h("button", { type: "submit", class: "btn" }, "Tambah sekolah");
  const form = h("form", { class: "toolbar", novalidate: true }, name.root, submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.clear();
    name.setError(null);
    try {
      await withBusy(submit, () => addSchool({ name: name.value() }));
      ctx.reload();
    } catch (err) {
      reportError(err);
      const e = toAppError(err);
      if (err.fields?.name) name.setError(err.fields.name);
      else if (e.code === "23505") name.setError("Sekolah dengan nama itu sudah ada.");
      else note.fail(e.userMessage);
    }
  });

  const rows = overview.schools.map((s) => [
    h("a", { class: "row-link", href: `#/ringkasan/${s.id}` }, s.name),
    h("span", { class: "num" }, String(s.classes.length)),
    h("span", { class: "num" }, String(s.students)),
    s.is_active ? h("span", { class: "tag" }, "Aktif") : h("span", { class: "tag tag--off" }, "Arsip"),
    rowButton("Kelola", () => openSchoolPanel(s, ctx), `Kelola ${s.name}`),
  ]);
  return h(
    "div",
    {},
    h("header", { class: "page-head" }, h("div", {}, h("h1", {}, "Sekolah"), h("p", {}, "Tambah, ganti nama, arsipkan, atau pindahkan kelas antar sekolah. Sekolah harus diarsipkan dulu sebelum dihapus permanen."))),
    form,
    note.node,
    rows.length ? table([{ label: "Sekolah" }, { label: "Kelas" }, { label: "Murid aktif" }, { label: "Status" }, { label: "" }], rows, { caption: "Daftar sekolah" }) : emptyState("Belum ada sekolah", "Isi nama sekolah pertama di atas."),
  );
}
