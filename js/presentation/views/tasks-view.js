import { h } from "../../core/dom.js";
import { dueStatus, formatDateTime, toJakartaInput } from "../../core/format.js";
import * as svc from "../../services/content-service.js";
import { crudPage } from "../components/crud-page.js";

export const DUE_LABEL = { lewat: "Terlewat", "hari-ini": "Hari ini", besok: "Besok", nanti: null };

export function dueBadge(iso) {
  const status = dueStatus(iso);
  const text = DUE_LABEL[status];
  return text ? h("span", { class: `badge badge--due badge--${status}` }, text) : null;
}

export const tasksView = crudPage({
  module: "tugas",
  noun: "tugas",
  title: "Tugas",
  description: "Tugas yang harus dikumpulkan, tenggat terdekat di atas.",
  createLabel: "Tambah tugas",
  emptyTitle: "Belum ada tugas",
  emptyText: "Tugas yang ditambahkan pengurus akan tampil di sini beserta tenggatnya.",
  fields: [
    { name: "title", label: "Judul tugas", maxlength: 120 },
    { name: "subject", label: "Mata pelajaran", required: false, maxlength: 80 },
    { name: "due", label: "Tenggat (WIB)", type: "datetime-local", required: false },
    { name: "description", label: "Keterangan", as: "textarea", rows: 4, required: false, maxlength: 4000 },
  ],
  load: svc.listTasks,
  create: svc.createTask,
  edit: svc.editTask,
  remove: svc.removeTask,
  toForm: (t) => ({ title: t.title, subject: t.subject, due: toJakartaInput(t.due_at), description: t.description }),
  renderItem: (t) => [
    h("div", { class: "entry__row" }, t.subject && h("span", { class: "badge badge--subject" }, t.subject), dueBadge(t.due_at)),
    h("h2", { class: "entry__title" }, t.title),
    t.description && h("p", { class: "entry__text" }, t.description),
    h("p", { class: "entry__meta" }, t.due_at ? `Tenggat ${formatDateTime(t.due_at)}` : "Tanpa tenggat"),
  ],
});
