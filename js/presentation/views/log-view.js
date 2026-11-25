import { h } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { emptyState, reportError, toAppError } from "../../core/errors.js";
import { formatDateTime } from "../../core/format.js";
import { loadLogs } from "../../services/content-service.js";
import { isClassAdmin } from "../../services/permissions.js";
import { withBusy } from "../components/form.js";
import { liveNote } from "../components/role-parts.js";

const PAGE = 40;

export async function logView() {
  const head = h("header", { class: "page-head" }, h("h1", {}, "Log aktivitas"), h("p", {}, "Catatan perubahan di kelas ini, terbaru di atas."));
  if (!isClassAdmin(appStore.get())) {
    return h("div", {}, head, emptyState("Kamu tidak punya akses", "Halaman ini khusus Admin Kelas."));
  }

  const list = h("ol", { class: "log-list" });
  const note = liveNote();
  const more = h("button", { type: "button", class: "btn btn--quiet" }, "Muat lebih banyak");
  const empty = emptyState("Belum ada aktivitas", "Perubahan di kelas akan tercatat di sini.");
  let lastId = null;

  const add = (rows) => {
    for (const r of rows) {
      list.append(
        h("li", { class: "log-item" }, h("p", { class: "log-item__text" }, h("strong", {}, r.who), ` ${r.text}`), h("time", { class: "log-item__time", datetime: r.at }, formatDateTime(r.at))),
      );
    }
    if (rows.length) lastId = rows[rows.length - 1].id;
    more.hidden = rows.length < PAGE;
    empty.hidden = list.children.length > 0;
  };

  const first = await loadLogs(null);
  add(first);
  more.addEventListener("click", async () => {
    note.clear();
    try {
      add(await withBusy(more, () => loadLogs(lastId)));
    } catch (err) {
      reportError(err);
      note.fail(toAppError(err).userMessage);
    }
  });
  return h("div", {}, head, note.node, list, empty, h("div", { class: "actions" }, more));
}
