import { h } from "../../core/dom.js";
import { reportError, toAppError } from "../../core/errors.js";
import { withBusy } from "./form.js";

// Tombol berisi konfirmasi dua langkah di tempat. Mengembalikan elemen siap pasang.
// run: fungsi async yang dijalankan setelah "ya". onDone(hasil) dan onError(pesan) dipanggil sesudahnya.
export function confirmAction({ label, message, yesLabel = "Ya", danger = false, small = false, run, onDone, onError }) {
  const askBtn = h("button", { type: "button", class: `btn btn--quiet${small ? " btn--small" : ""}` }, label);
  const yes = h("button", { type: "button", class: `btn btn--small${danger ? " btn--danger" : ""}` }, yesLabel);
  const no = h("button", { type: "button", class: "btn btn--quiet btn--small" }, "Batal");
  const box = h(
    "div",
    { class: "confirm", hidden: true, role: "group", "aria-label": label },
    h("p", {}, message),
    h("div", { class: "actions" }, yes, no),
  );
  const root = h("div", { class: "confirm-wrap" }, askBtn, box);

  const close = () => {
    box.hidden = true;
    askBtn.hidden = false;
  };
  askBtn.addEventListener("click", () => {
    askBtn.hidden = true;
    box.hidden = false;
    no.focus();
  });
  no.addEventListener("click", () => {
    close();
    askBtn.focus();
  });
  yes.addEventListener("click", async () => {
    try {
      const result = await withBusy(yes, run);
      close();
      onDone?.(result);
    } catch (err) {
      reportError(err);
      close();
      onError?.(toAppError(err).userMessage);
    }
  });
  return root;
}
