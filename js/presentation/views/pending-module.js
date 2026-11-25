import { h } from "../../core/dom.js";
import { isConfigured } from "../../core/config.js";
import { emptyState } from "../../core/errors.js";

// Pengganti sementara tiap modul sampai tugas 6. Jujur soal status, tanpa data karangan.
export function pendingModuleView(title, description) {
  return async () => {
    const head = h("header", { class: "page-head" }, h("h1", {}, title), h("p", {}, description));
    if (!isConfigured()) return h("div", {}, head, notConnectedState());
    return h("div", {}, head, emptyState("Modul ini belum aktif", "Fitur ini akan tersedia di pembaruan berikutnya."));
  };
}

export function notConnectedState() {
  return h(
    "section",
    { class: "state" },
    h("h2", { class: "state__title" }, "Database belum tersambung"),
    h(
      "p",
      {},
      "Isi SUPABASE_URL dan SUPABASE_ANON_KEY di js/core/config.js, lalu muat ulang halaman. Langkah lengkap ada di docs/SUPABASE_SETUP.md.",
    ),
  );
}
