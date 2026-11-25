import { h } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { emptyState, reportError } from "../../core/errors.js";
import { formatDateTime } from "../../core/format.js";
import { loadSystemNews, markNewsRead } from "../../services/content-service.js";
import { isClassAdmin } from "../../services/permissions.js";

export async function systemNewsView() {
  const head = h("header", { class: "page-head" }, h("h1", {}, "Kabar Sistem"), h("p", {}, "Pesan dari pengelola Kelasku.id untuk Admin Kelas."));
  if (!isClassAdmin(appStore.get())) return h("div", {}, head, emptyState("Kamu tidak punya akses", "Halaman ini khusus Admin Kelas."));

  const rows = await loadSystemNews();
  // Penanda dibaca dikirim setelah daftar tampil; kegagalannya tidak mengganggu pembacaan.
  markNewsRead(rows).catch(reportError);

  return h(
    "div",
    {},
    head,
    rows.length
      ? h(
          "div",
          { class: "board" },
          rows.map((r) =>
            h(
              "article",
              { class: "note" },
              r.unread && h("p", { class: "pin-tag" }, "Baru"),
              h("h2", { class: "entry__title" }, r.title),
              h("p", { class: "entry__text", style: "white-space:pre-wrap" }, r.body),
              h("p", { class: "entry__meta" }, `Pengelola Kelasku.id | ${formatDateTime(r.created_at)}`),
            ),
          ),
        )
      : emptyState("Belum ada kabar", "Siaran dari pengelola akan muncul di sini."),
  );
}
