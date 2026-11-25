import { h } from "../../core/dom.js";
import { copyText } from "../../core/clipboard.js";

// Menampilkan nilai rahasia sekali pakai (sandi sementara) dengan tombol salin.
export function secretBox({ title, value, hint }) {
  const status = h("span", { class: "secret__status", role: "status" });
  const copy = h("button", { type: "button", class: "btn btn--small" }, "Salin");
  copy.addEventListener("click", async () => {
    const done = await copyText(value);
    status.textContent = done ? "Tersalin." : "Gagal menyalin. Salin manual dari kotak di samping.";
  });
  return h(
    "div",
    { class: "secret" },
    h("p", { class: "secret__title" }, title),
    h("div", { class: "secret__row" }, h("code", { class: "secret__value" }, value), copy, status),
    hint && h("p", { class: "field__hint" }, hint),
  );
}
