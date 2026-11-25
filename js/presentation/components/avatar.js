import { h } from "../../core/dom.js";

const initials = (name) =>
  String(name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

// Foto bila ada, huruf awal bila tidak. Foto dekoratif karena nama selalu tertulis di sebelahnya.
export function avatar(name, url, size = "") {
  const cls = `avatar${size ? ` avatar--${size}` : ""}`;
  if (url) return h("span", { class: cls }, h("img", { src: url, alt: "", loading: "lazy" }));
  return h("span", { class: cls, "aria-hidden": "true" }, initials(name));
}
