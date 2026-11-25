import { h } from "../../core/dom.js";

const sk = (cls = "") => h("span", { class: `sk ${cls}`.trim() });

const VARIANTS = {
  tiles: () => [
    h("div", { class: "stats" }, [1, 2, 3, 4, 5].map(() => sk("sk--tile"))),
    h("div", { style: "margin-top:1.5rem" }, [1, 2, 3, 4].map(() => sk("sk--row"))),
  ],
  table: () => [sk("sk--title"), ...[1, 2, 3, 4, 5, 6].map(() => sk("sk--row"))],
  form: () => h("div", { class: "panel panel--form" }, [1, 2, 3].map(() => h("div", {}, sk("sk--line sk--w40"), sk("sk--row")))),
};

// Tiap varian meniru bentuk halaman yang akan muncul.
export function konsolSkeleton(variant = "table") {
  const wrap = h("div", { "aria-busy": "true", "aria-live": "polite" }, VARIANTS[variant]?.() ?? VARIANTS.table());
  wrap.prepend(h("span", { class: "sr-only" }, "Memuat"));
  return wrap;
}
