import { h } from "../../core/dom.js";

// cols: [{ label, right? }]. Sel pertama jadi judul baris di ponsel; sel lain memakai label kolom.
export function table(cols, rows, { caption } = {}) {
  const head = h("thead", {}, h("tr", {}, cols.map((c) => h("th", { scope: "col", class: c.right ? "right" : null }, c.label))));
  const body = h(
    "tbody",
    {},
    rows.map((cells) =>
      h(
        "tr",
        {},
        cells.map((cell, i) => h("td", { class: [i === 0 ? "cell-main" : "", cols[i]?.right ? "right" : ""].join(" ").trim() || null, dataset: { label: cols[i]?.label ?? "" } }, cell)),
      ),
    ),
  );
  return h("div", { class: "tbl-wrap" }, h("table", { class: "tbl" }, caption && h("caption", { class: "sr-only" }, caption), head, body));
}

export const rowButton = (label, onClick, aria) => h("button", { type: "button", class: "btn btn--quiet btn--small", "aria-label": aria ?? label, onClick }, label);

export function meter(used, limit) {
  const full = used >= limit;
  return h(
    "span",
    { class: `meter${full ? " meter--full" : ""}`, title: `${used} dari ${limit}` },
    h("span", { class: "meter__bar", "aria-hidden": "true" }, h("span", { class: "meter__fill", style: `width:${Math.min(100, (used / Math.max(limit, 1)) * 100)}%` })),
    `${used}/${limit}`,
  );
}
