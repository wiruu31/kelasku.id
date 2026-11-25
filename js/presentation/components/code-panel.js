import { h } from "../../core/dom.js";
import { copyText } from "../../core/clipboard.js";
import { reportError, toAppError } from "../../core/errors.js";
import { field, withBusy } from "./form.js";
import { liveNote } from "./role-parts.js";

// Panel kode kelas: tampil, salin, ganti manual, atau acak baru.
export function codePanel({ initialCode, save }) {
  const note = liveNote();
  const codeText = h("code", { class: "joincode" }, initialCode);
  const copy = h("button", { type: "button", class: "btn btn--small" }, "Salin kode");
  const input = field({
    label: "Kode baru (kosongkan untuk kode acak)",
    name: "newCode",
    maxlength: 12,
    required: false,
    hint: "6 sampai 12 huruf dan angka, tanpa huruf O, I dan angka 0, 1. Kode lama langsung tidak berlaku untuk pendaftar baru. Anggota yang sudah aktif tidak terpengaruh.",
  });
  input.input.classList.add("input--code");
  const submit = h("button", { type: "submit", class: "btn" }, "Ganti kode");
  const form = h("form", { class: "form", novalidate: true }, input.root, submit);

  copy.addEventListener("click", async () => {
    note.clear();
    (await copyText(codeText.textContent)) ? note.ok("Kode tersalin.") : note.fail("Gagal menyalin. Salin manual dari kotak kode.");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.clear();
    input.setError(null);
    try {
      const code = await withBusy(submit, () => save(input.value()));
      codeText.textContent = code;
      input.input.value = "";
      note.ok("Kode diganti.");
    } catch (err) {
      reportError(err);
      const e = toAppError(err);
      if (e.code === "KODE_FORMAT_SALAH" || e.code === "KODE_SUDAH_DIPAKAI") input.setError(e.userMessage);
      else note.fail(e.userMessage);
    }
  });

  return h(
    "section",
    { class: "note form" },
    h("h2", {}, "Kode kelas"),
    h("p", {}, "Bagikan kode ini ke calon anggota. Mereka tetap harus disetujui sebelum bisa masuk."),
    h("div", { class: "joincode-row" }, codeText, copy),
    form,
    note.node,
  );
}
