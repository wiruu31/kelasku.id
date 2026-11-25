import { h } from "../../core/dom.js";
import { DAY_NAMES, todayDayNumber } from "../../core/format.js";
import * as svc from "../../services/content-service.js";
import { crudPage } from "../components/crud-page.js";

const dayOptions = DAY_NAMES.map((name, i) => ({ value: String(i + 1), label: name }));

export const scheduleView = crudPage({
  module: "jadwal",
  noun: "jadwal",
  title: "Jadwal pelajaran",
  description: "Mata pelajaran per hari, berurutan menurut jam.",
  createLabel: "Tambah jadwal",
  emptyTitle: "Belum ada jadwal",
  emptyText: "Jadwal pelajaran yang ditambahkan pengurus akan tampil di sini, dikelompokkan per hari.",
  fields: [
    { name: "day", label: "Hari", as: "select", options: dayOptions },
    { name: "subject", label: "Mata pelajaran", maxlength: 80 },
    { name: "start", label: "Jam mulai", type: "time" },
    { name: "end", label: "Jam selesai", type: "time" },
    { name: "teacher", label: "Guru", required: false, maxlength: 80 },
    { name: "room", label: "Ruang", required: false, maxlength: 40 },
  ],
  load: svc.listSchedules,
  create: svc.createSchedule,
  edit: svc.editSchedule,
  remove: svc.removeSchedule,
  toForm: (s) => ({ day: String(s.day_of_week), subject: s.subject, start: s.start_time, end: s.end_time, teacher: s.teacher, room: s.room }),
  renderItem: (s) => [
    h("p", { class: "entry__time" }, `${s.start_time} - ${s.end_time}`),
    h("h3", { class: "entry__title" }, s.subject),
    (s.teacher || s.room) && h("p", { class: "entry__meta" }, [s.teacher, s.room && `Ruang ${s.room}`].filter(Boolean).join(" | ")),
  ],
  layout: (items, card) => {
    const today = todayDayNumber();
    let index = 0;
    return DAY_NAMES.map((name, i) => {
      const day = items.filter((s) => s.day_of_week === i + 1);
      if (!day.length) return null;
      return h(
        "section",
        { class: "day-group", "aria-labelledby": `day-${i + 1}` },
        h("h2", { id: `day-${i + 1}`, class: "day-group__title" }, name, i + 1 === today && h("span", { class: "badge" }, "Hari ini")),
        h("div", { class: "board" }, day.map((s) => card(s, index++))),
      );
    });
  },
});
