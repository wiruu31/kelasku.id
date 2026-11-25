import { h } from "../../core/dom.js";
import { reportError, toAppError } from "../../core/errors.js";
import { field, withBusy } from "../../presentation/components/form.js";
import { liveNote } from "../../presentation/components/role-parts.js";
import { openModal } from "./modal.js";

// Hapus permanen: tombol baru aktif setelah nama diketik persis. Server memeriksa lagi.
export function confirmByTyping({ title, message, expected, actionLabel, run, onDone }) {
  const input = field({ label: `Ketik "${expected}" untuk melanjutkan`, name: "konfirmasi", autocomplete: "off" });
  const note = liveNote();
  const go = h("button", { type: "submit", class: "btn btn--danger", disabled: true }, actionLabel);
  const cancel = h("button", { type: "button", class: "btn btn--quiet" }, "Batal");
  const form = h("form", { class: "form", novalidate: true }, h("p", {}, message), input.root, note.node, h("div", { class: "actions" }, go, cancel));
  const modal = openModal({ title, content: form, variant: "dialog" });
  input.input.addEventListener("input", () => {
    go.disabled = input.value().trim() !== expected;
  });
  cancel.addEventListener("click", modal.close);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.clear();
    try {
      await withBusy(go, () => run(input.value().trim()));
      modal.close();
      onDone?.();
    } catch (err) {
      reportError(err);
      note.fail(toAppError(err).userMessage);
    }
  });
}
