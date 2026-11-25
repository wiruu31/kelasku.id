import { h } from "../../core/dom.js";
import { formatLongDate, formatDateTime } from "../../core/format.js";
import { loadOverview, loadSystemLogs } from "../services/console-service.js";
import { konsolStore } from "../services/auth-service.js";

const CLOCK = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const stat = (label, value, note, hot) => h("div", { class: `stat${hot ? " stat--hot" : ""}` }, h("p", { class: "stat__label" }, label), h("p", { class: "stat__value" }, String(value)), note && h("p", { class: "stat__note" }, note));

export async function dashboardView() {
  const [overview, logs] = await Promise.all([loadOverview(), loadSystemLogs(null).catch(() => [])]);
  const { totals } = overview;
  const name = konsolStore.get().profile?.full_name ?? "Main Admin";

  const time = h("p", { class: "clock", role: "timer", "aria-live": "off" }, CLOCK.format(new Date()));
  const date = h("p", { class: "clock-date" }, `${formatLongDate()}, WIB`);
  const timer = setInterval(() => {
    if (!time.isConnected) return clearInterval(timer);
    time.textContent = CLOCK.format(new Date());
    date.textContent = `${formatLongDate()}, WIB`;
  }, 1000);

  const attention = overview.classes
    .filter((c) => c.is_active && (c.pending > 0 || c.admins === 0))
    .sort((a, b) => b.pending - a.pending)
    .slice(0, 6);
  const schoolName = new Map(overview.schools.map((s) => [s.id, s.name]));

  return h(
    "div",
    {},
    h("header", { class: "page-head" }, h("div", {}, h("h1", {}, `Halo, ${name}`), h("p", {}, "Ringkasan seluruh sekolah dan kelas.")), h("div", {}, time, date)),
    h(
      "div",
      { class: "stats" },
      stat("Sekolah aktif", totals.schools, totals.schoolsOff ? `${totals.schoolsOff} diarsipkan` : null),
      stat("Kelas aktif", totals.classes, totals.classesOff ? `${totals.classesOff} nonaktif` : null),
      stat("Murid aktif", totals.students),
      stat("Menunggu persetujuan", totals.pending, "di semua kelas", totals.pending > 0),
      stat("Admin Kelas", totals.admins),
    ),
    h(
      "div",
      { class: "split" },
      h(
        "section",
        {},
        h("div", { class: "section-title" }, h("h2", {}, "Perlu perhatian"), h("a", { href: "#/ringkasan" }, "Buka Ringkasan")),
        attention.length
          ? h(
              "ul",
              { class: "log-list" },
              attention.map((c) =>
                h(
                  "li",
                  { class: "log-item" },
                  h("p", {}, h("a", { href: `#/ringkasan/${c.school_id}/${c.id}` }, c.name), h("span", { class: "muted" }, `, ${schoolName.get(c.school_id) ?? ""}`)),
                  h("span", { class: "actions" }, c.pending > 0 && h("span", { class: "tag tag--ember" }, `${c.pending} menunggu`), c.admins === 0 && h("span", { class: "tag tag--danger" }, "Belum ada Admin Kelas")),
                ),
              ),
            )
          : h("section", { class: "state" }, h("h3", { class: "state__title" }, "Semua beres"), h("p", {}, "Tidak ada pendaftar menunggu dan setiap kelas aktif punya Admin Kelas.")),
      ),
      h(
        "section",
        {},
        h("div", { class: "section-title" }, h("h2", {}, "Aktivitas sistem"), h("a", { href: "#/log" }, "Semua log")),
        logs.length
          ? h("ol", { class: "log-list" }, logs.slice(0, 6).map((r) => h("li", { class: "log-item" }, h("p", {}, h("strong", {}, r.who), ` ${r.text}`), h("time", { class: "log-item__time", datetime: r.at }, formatDateTime(r.at)))))
          : h("section", { class: "state" }, h("h3", { class: "state__title" }, "Belum ada aktivitas"), h("p", {}, "Perubahan sekolah, kelas, dan pengaturan tercatat di sini.")),
      ),
    ),
  );
}
