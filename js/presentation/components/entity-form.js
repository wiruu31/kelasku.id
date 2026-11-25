import { h } from "../../core/dom.js";
import { reportError, toAppError } from "../../core/errors.js";
import { checkField, field, formMessage, withBusy } from "./form.js";

// Formulir generik untuk satu entitas (pengumuman, jadwal, tugas).
// fields: [{ name, label, kind?: "check", as?, type?, options?, ... }]
// onSubmit(values) harus melempar galat bila gagal; galat validasi membawa err.fields.
export function entityForm({ fields, initial = {}, submitLabel, onSubmit, onCancel, resetOnDone = false }) {
  const controls = fields.map((f) => (f.kind === "check" ? checkField(f) : field(f)));
  const message = formMessage();
  const submit = h("button", { type: "submit", class: "btn" }, submitLabel);
  const cancel = onCancel && h("button", { type: "button", class: "btn btn--quiet", onClick: onCancel }, "Batal");
  const root = h("form", { class: "form", novalidate: true }, controls.map((c) => c.root), message.node, h("div", { class: "actions" }, submit, cancel));

  const fill = (values) => controls.forEach((c) => c.setValue(values[c.name] ?? (c.input.type === "checkbox" ? false : "")));
  fill(initial);

  root.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hide();
    controls.forEach((c) => c.setError(null));
    const values = Object.fromEntries(controls.map((c) => [c.name, c.value()]));
    try {
      await withBusy(submit, () => onSubmit(values));
      if (resetOnDone) fill(initial);
    } catch (err) {
      reportError(err);
      const e = toAppError(err);
      if (err.fields) {
        let first = null;
        for (const c of controls) {
          if (err.fields[c.name]) {
            c.setError(err.fields[c.name]);
            first ??= c;
          }
        }
        first?.input.focus();
      } else message.show(e.userMessage);
    }
  });
  return { root, focus: () => controls[0]?.input.focus() };
}
