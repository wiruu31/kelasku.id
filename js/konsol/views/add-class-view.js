import { h } from "../../core/dom.js";
import { copyText } from "../../core/clipboard.js";
import { reportError, toAppError } from "../../core/errors.js";
import { field, withBusy } from "../../presentation/components/form.js";
import { liveNote } from "../../presentation/components/role-parts.js";
import * as repo from "../data/console-repository.js";
import { addClass } from "../services/console-service.js";

export async function addClassView() {
  const schools = (await repo.fetchSchools()).filter((s) => s.is_active);
  if (!schools.length) {
    return h(
      "div",
      {},
      h("header", { class: "page-head" }, h("h1", {}, "Tambah Kelas")),
      h("section", { class: "state" }, h("h2", { class: "state__title" }, "Belum ada sekolah aktif"), h("p", {}, "Kelas harus berada di satu sekolah. Tambahkan sekolahnya dulu."), h("a", { class: "btn", href: "#/sekolah" }, "Buka Sekolah")),
    );
  }
  const name = field({ label: "Nama kelas", name: "name", maxlength: 80, hint: "Contoh: XI IPA 2." });
  const school = field({ label: "Sekolah", name: "schoolId", as: "select", options: [{ value: "", label: "Pilih sekolah" }, ...schools.map((s) => ({ value: s.id, label: s.name }))] });
  const note = liveNote();
  const result = h("div", { "aria-live": "polite" });
  const submit = h("button", { type: "submit", class: "btn" }, "Buat kelas");
  const form = h("form", { class: "form", novalidate: true }, name.root, school.root, note.node, submit);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.clear();
    name.setError(null);
    school.setError(null);
    result.replaceChildren();
    try {
      const cls = await withBusy(submit, () => addClass({ name: name.value(), schoolId: school.value() }));
      const code = await repo.fetchJoinCode(cls.id);
      const copy = h("button", { type: "button", class: "btn btn--quiet btn--small" }, "Salin kode");
      const status = h("span", { class: "muted", role: "status" });
      copy.addEventListener("click", async () => {
        status.textContent = (await copyText(code)) ? "Kode tersalin." : "Gagal menyalin. Salin manual.";
      });
      result.replaceChildren(
        h("section", { class: "panel", style: "margin-top:1rem" }, h("h2", {}, `${cls.name} berhasil dibuat`), h("p", { class: "muted" }, "Bagikan kode ini ke calon murid. Angkat Admin Kelas pertamanya setelah ada murid aktif."), h("div", { class: "joincode-row", style: "margin:1rem 0" }, h("code", { class: "joincode" }, code), copy, status), h("a", { class: "btn btn--quiet", href: "#/role" }, "Lanjut ke Atur Role")),
      );
      name.input.value = "";
    } catch (err) {
      reportError(err);
      const e = toAppError(err);
      if (err.fields) {
        name.setError(err.fields.name);
        school.setError(err.fields.schoolId);
      } else note.fail(e.userMessage);
    }
  });

  return h("div", {}, h("header", { class: "page-head" }, h("div", {}, h("h1", {}, "Tambah Kelas"), h("p", {}, "Kelas baru mendapat kode pendaftaran otomatis."))), h("section", { class: "panel panel--form" }, form), result);
}
