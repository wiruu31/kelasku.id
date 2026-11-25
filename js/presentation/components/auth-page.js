import { h } from "../../core/dom.js";

// Kerangka halaman tanpa menu: kartu catatan di tengah papan.
export function authPage({ title, lead, body, footer }) {
  return h(
    "div",
    { class: "auth" },
    h("p", { class: "auth__brand", "aria-hidden": "true" }, "Kelasku.id"),
    h(
      "section",
      { class: "note auth__card" },
      h("h1", {}, title),
      lead && h("p", { class: "auth__lead" }, lead),
      body,
    ),
    footer && h("div", { class: "auth__footer" }, footer),
  );
}
