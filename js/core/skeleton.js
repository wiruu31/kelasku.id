import { h } from "./dom.js";

const sk = (cls = "") => h("span", { class: `sk ${cls}`.trim() });

function noteSkeleton() {
  return h(
    "div",
    { class: "note" },
    sk("sk--title"),
    sk("sk--line"),
    sk("sk--line sk--w80"),
    sk("sk--line sk--w60"),
  );
}

// Tiap varian meniru bentuk halaman yang akan muncul.
const VARIANTS = {
  board: () => h("div", { class: "board" }, [1, 2, 3, 4].map(noteSkeleton)),
  list: () => h("div", {}, [1, 2, 3, 4, 5, 6].map(() => sk("sk--row"))),
  profile: () =>
    h(
      "div",
      { class: "note", style: "display:flex;gap:1rem;align-items:center" },
      sk("sk--avatar"),
      h("div", { style: "flex:1" }, sk("sk--title"), sk("sk--line sk--w40")),
    ),
  form: () =>
    h("div", { class: "note" }, [1, 2, 3].map(() => h("div", {}, sk("sk--line sk--w40"), sk("sk--row")))),
};

export function skeleton(variant = "board") {
  const build = VARIANTS[variant] ?? VARIANTS.board;
  const wrap = h("div", { "aria-busy": "true", "aria-live": "polite" }, build());
  wrap.prepend(h("span", { class: "sr-only" }, "Memuat"));
  return wrap;
}
