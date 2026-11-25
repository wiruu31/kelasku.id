import { h } from "../../core/dom.js";
import { emptyState, reportError, toAppError } from "../../core/errors.js";
import { formatDateTime } from "../../core/format.js";
import { field, withBusy } from "../../presentation/components/form.js";
import { liveNote } from "../../presentation/components/role-parts.js";
import * as repo from "../data/console-repository.js";
import { loadAnnouncements, removeAnnouncement, sendAnnouncement } from "../services/console-service.js";
import { konsolStore } from "../services/auth-service.js";
import { confirmByTyping } from "../components/typed-confirm.js";
import { nav } from "../services/nav.js";

const TARGETS = [["all", "Semua Admin Kelas"], ["school", "Satu sekolah"], ["class", "Satu kelas"]];

export async function broadcastView() {
  const [schools, classes, history] = await Promise.all([repo.fetchSchools(), repo.fetchClasses(), loadAnnouncements()]);
  const schoolName = new Map(schools.map((s) => [s.id, s.name]));
  const className = new Map(classes.map((c) => [c.id, `${c.name} (${schoolName.get(c.school_id) ?? ""})`]));

  const title = field({ label: "Judul", name: "title", maxlength: 120 });
  const body = field({ label: "Isi siaran", name: "body", as: "textarea", rows: 6, maxlength: 4000, hint: "Hanya Admin Kelas di tujuan yang menerima dan membacanya." });
  const schoolSel = field({ label: "Sekolah tujuan", name: "schoolId", as: "select", options: [{ value: "", label: "Pilih sekolah" }, ...schools.filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name }))] });
  const classSel = field({ label: "Kelas tujuan", name: "classId", as: "select", options: [{ value: "", label: "Pilih kelas" }, ...classes.filter((c) => c.is_active).map((c) => ({ value: c.id, label: className.get(c.id) }))] });
  let target = "all";
  const seg = h("div", { class: "seg", role: "group", "aria-label": "Tujuan siaran" });
  const buttons = TARGETS.map(([value, label]) => {
    const b = h("button", { type: "button", "aria-pressed": String(value === target) }, label);
    b.addEventListener("click", () => {
      target = value;
      for (const x of buttons) x.setAttribute("aria-pressed", String(x === b));
      schoolSel.root.hidden = target !== "school";
      classSel.root.hidden = target !== "class";
    });
    return b;
  });
  seg.append(...buttons);
  schoolSel.root.hidden = true;
  classSel.root.hidden = true;

  const note = liveNote();
  const submit = h("button", { type: "submit", class: "btn" }, "Kirim siaran");
  const form = h("form", { class: "form", novalidate: true }, h("div", { class: "field" }, h("span", { class: "field__label" }, "Tujuan"), seg), schoolSel.root, classSel.root, title.root, body.root, note.node, submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.clear();
    for (const f of [title, body, schoolSel, classSel]) f.setError(null);
    try {
      await withBusy(submit, () => sendAnnouncement({ title: title.value(), body: body.value(), targetType: target, schoolId: schoolSel.value(), classId: classSel.value() }, konsolStore.get().profile.id));
      nav.refresh();
    } catch (err) {
      reportError(err);
      const e = toAppError(err);
      if (err.fields) {
        title.setError(err.fields.title);
        body.setError(err.fields.body);
        schoolSel.setError(err.fields.schoolId);
        classSel.setError(err.fields.classId);
      } else note.fail(e.userMessage);
    }
  });

  const label = (r) => (r.target_type === "all" ? "Semua Admin Kelas" : r.target_type === "school" ? schoolName.get(r.school_id) ?? "Sekolah" : className.get(r.class_id) ?? "Kelas");
  const items = history.map((r) =>
    h(
      "article",
      { class: "cast__item" },
      h("h3", {}, r.title),
      h("p", { class: "cast__body" }, r.body),
      h(
        "div",
        { class: "cast__meta" },
        h("span", { class: "tag" }, label(r)),
        h("time", { datetime: r.created_at }, formatDateTime(r.created_at)),
        r.reads != null && h("span", {}, `${r.reads} sudah membaca`),
        h("button", { type: "button", class: "btn btn--quiet btn--small", "aria-label": `Hapus siaran ${r.title}`, onClick: () => confirmByTyping({ title: "Hapus siaran", message: "Siaran hilang dari semua Admin Kelas.", expected: r.title, actionLabel: "Hapus siaran", run: () => removeAnnouncement(r), onDone: () => nav.refresh() }) }, "Hapus"),
      ),
    ),
  );

  return h(
    "div",
    {},
    h("header", { class: "page-head" }, h("div", {}, h("h1", {}, "Siaran Sistem"), h("p", {}, "Kabar dari Main Admin untuk Admin Kelas. Murid tidak ikut menerimanya."))),
    h("section", { class: "panel panel--form" }, form),
    h("div", { class: "section-title" }, h("h2", {}, "Riwayat siaran"), h("small", {}, `${history.length} siaran`)),
    items.length ? h("div", { class: "cast" }, items) : emptyState("Belum ada siaran", "Siaran yang kamu kirim muncul di sini bersama jumlah pembacanya."),
  );
}
