import { h, icon } from "../../core/dom.js";
import { formatDateTime } from "../../core/format.js";
import * as svc from "../../services/content-service.js";
import { crudPage } from "../components/crud-page.js";

const PIN = ["M9 4h6l-1 6 3 3H7l3-3z", "M12 13v7"];

export const announcementsView = crudPage({
  module: "pengumuman",
  noun: "pengumuman",
  title: "Pengumuman",
  description: "Kabar resmi dari pengurus kelas. Yang disematkan selalu di atas.",
  createLabel: "Tulis pengumuman",
  emptyTitle: "Belum ada pengumuman",
  emptyText: "Pengumuman dari pengurus kelas akan muncul di sini.",
  fields: [
    { name: "title", label: "Judul", maxlength: 120 },
    { name: "body", label: "Isi pengumuman", as: "textarea", rows: 5, maxlength: 4000 },
    { name: "pinned", kind: "check", label: "Sematkan di atas daftar" },
  ],
  load: svc.listAnnouncements,
  create: svc.createAnnouncement,
  edit: svc.editAnnouncement,
  remove: svc.removeAnnouncement,
  toForm: (a) => ({ title: a.title, body: a.body, pinned: a.pinned }),
  renderItem: (a) => [
    a.pinned && h("p", { class: "pin-tag" }, icon(PIN), "Disematkan"),
    h("h2", { class: "entry__title" }, a.title),
    h("p", { class: "entry__text" }, a.body),
    h("p", { class: "entry__meta" }, `${a.author?.full_name ?? "Pengurus"} | ${formatDateTime(a.created_at)}`),
  ],
});
