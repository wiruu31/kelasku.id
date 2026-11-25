import { h } from "../../core/dom.js";
import { reportError, toAppError } from "../../core/errors.js";
import { field, withBusy } from "../../presentation/components/form.js";
import { liveNote } from "../../presentation/components/role-parts.js";
import * as repo from "../data/console-repository.js";
import { saveDefaultLimit } from "../services/console-service.js";
import { changeOwnName, changeOwnPassword, konsolStore, logout } from "../services/auth-service.js";

// Satu formulir kecil per pengaturan supaya tiap simpan jelas hasilnya.
function block({ title, hint, fields, submitLabel, run, okText }) {
  const note = liveNote();
  const submit = h("button", { type: "submit", class: "btn" }, submitLabel);
  const form = h("form", { class: "form", novalidate: true }, ...fields.map((f) => f.root), note.node, submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.clear();
    for (const f of fields) f.setError(null);
    try {
      await withBusy(submit, run);
      note.ok(okText);
      for (const f of fields) if (f.input.type === "password") f.input.value = "";
    } catch (err) {
      reportError(err);
      const e = toAppError(err);
      if (err.fields) for (const f of fields) f.setError(err.fields[f.name] ?? null);
      else note.fail(e.userMessage);
    }
  });
  return h("section", { class: "panel panel--form" }, h("h2", {}, title), hint && h("p", { class: "muted", style: "margin:0.25rem 0 1rem" }, hint), form);
}

export async function settingsView({ go }) {
  const profile = konsolStore.get().profile;
  const current = await repo.fetchMaxAdminsDefault();

  const name = field({ label: "Nama lengkap", name: "fullName", maxlength: 80 });
  name.setValue(profile.full_name);
  const limit = field({ label: "Batas bawaan Admin Kelas per kelas", name: "limit", inputmode: "numeric", hint: "Berlaku untuk kelas yang tidak punya batas sendiri. Angka 1 sampai 20." });
  limit.setValue(current);
  const pw = field({ label: "Kata sandi baru", name: "password", type: "password", autocomplete: "new-password", hint: "Minimal 8 karakter." });
  const pw2 = field({ label: "Ulangi kata sandi baru", name: "confirm", type: "password", autocomplete: "new-password" });

  const exit = h("button", { type: "button", class: "btn btn--quiet" }, "Keluar dari Konsol");
  exit.addEventListener("click", async () => {
    await logout().catch(reportError);
    go("/masuk");
  });

  return h(
    "div",
    {},
    h("header", { class: "page-head" }, h("div", {}, h("h1", {}, "Pengaturan"), h("p", {}, `Masuk sebagai @${profile.username}.`))),
    h("div", { class: "group", style: "gap:1rem" },
      block({ title: "Batas Admin Kelas", fields: [limit], submitLabel: "Simpan batas", okText: "Batas bawaan disimpan.", run: () => saveDefaultLimit(limit.value()) }),
      block({ title: "Profil", fields: [name], submitLabel: "Simpan nama", okText: "Nama disimpan.", run: () => changeOwnName(name.value()) }),
      block({ title: "Kata sandi", fields: [pw, pw2], submitLabel: "Ganti kata sandi", okText: "Kata sandi diganti.", run: () => changeOwnPassword(pw.value(), pw2.value()) }),
      h("div", { class: "actions" }, exit),
    ),
  );
}
