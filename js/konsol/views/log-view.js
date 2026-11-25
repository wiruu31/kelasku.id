import { h } from "../../core/dom.js";
import { emptyState, reportError, toAppError } from "../../core/errors.js";
import { formatDateTime } from "../../core/format.js";
import { withBusy } from "../../presentation/components/form.js";
import { liveNote } from "../../presentation/components/role-parts.js";
import { loadSystemLogs } from "../services/console-service.js";

const PAGE = 40;

export async function logView() {
  const list = h("ol", { class: "log-list" });
  const note = liveNote();
  const more = h("button", { type: "button", class: "btn btn--quiet" }, "Muat lebih banyak");
  const empty = emptyState("Belum ada aktivitas", "Perubahan sekolah, kelas, pengaturan, dan siaran tercatat di sini.");
  let lastId = null;

  const add = (rows) => {
    for (const r of rows) list.append(h("li", { class: "log-item" }, h("p", {}, h("strong", {}, r.who), ` ${r.text}`), h("time", { class: "log-item__time", datetime: r.at }, formatDateTime(r.at))));
    if (rows.length) lastId = rows[rows.length - 1].id;
    more.hidden = rows.length < PAGE;
    list.hidden = list.children.length === 0;
    empty.hidden = list.children.length > 0;
  };
  add(await loadSystemLogs(null));
  more.addEventListener("click", async () => {
    note.clear();
    try {
      add(await withBusy(more, () => loadSystemLogs(lastId)));
    } catch (err) {
      reportError(err);
      note.fail(toAppError(err).userMessage);
    }
  });
  return h("div", {}, h("header", { class: "page-head" }, h("div", {}, h("h1", {}, "Log"), h("p", {}, "Catatan tingkat sistem, terbaru di atas. Aktivitas di dalam kelas tidak ditampilkan di sini."))), list, empty, note.node, h("div", { class: "actions", style: "margin-top:1rem" }, more));
}
