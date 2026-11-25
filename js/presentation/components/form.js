import { h } from "../../core/dom.js";

let counter = 0;

// Field berlabel: label terlihat, petunjuk, dan pesan galat terhubung lewat aria.
export function field({ label, name, type = "text", as = "input", options = [], rows = 4, autocomplete, hint, inputmode, maxlength, required = true }) {
  const id = `f-${name}-${++counter}`;
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const common = { id, name, required, class: as === "select" ? "input input--select" : "input", "aria-describedby": hint ? `${hintId} ${errId}` : errId };
  let input;
  if (as === "textarea") input = h("textarea", { ...common, rows, maxlength, class: "input input--area" });
  else if (as === "select") input = h("select", common, options.map((o) => h("option", { value: o.value }, o.label)));
  else input = h("input", { ...common, type, autocomplete, inputmode, maxlength });
  const err = h("p", { id: errId, class: "field__error", hidden: true });
  const control = type === "password" ? passwordWrap(input) : input;
  const root = h(
    "div",
    { class: "field" },
    h("label", { class: "field__label", for: id }, label),
    hint && h("p", { id: hintId, class: "field__hint" }, hint),
    control,
    err,
  );
  return {
    root,
    input,
    name,
    value: () => input.value,
    setValue: (v) => {
      input.value = v ?? "";
    },
    setError(message) {
      err.textContent = message ?? "";
      err.hidden = !message;
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    },
  };
}

// Kotak centang berlabel. value() mengembalikan boolean.
export function checkField({ label, name, hint }) {
  const input = h("input", { type: "checkbox", name, class: "check__input" });
  const root = h("div", { class: "field" }, h("label", { class: "check" }, input, h("span", {}, label)), hint && h("p", { class: "field__hint" }, hint));
  return { root, input, name, value: () => input.checked, setValue: (v) => (input.checked = !!v), setError() {} };
}

function passwordWrap(input) {
  const toggle = h(
    "button",
    { type: "button", class: "input-toggle", "aria-pressed": "false" },
    "Tampilkan",
  );
  toggle.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    toggle.textContent = show ? "Sembunyikan" : "Tampilkan";
    toggle.setAttribute("aria-pressed", String(show));
  });
  return h("div", { class: "input-wrap" }, input, toggle);
}

export function formMessage() {
  const node = h("p", { class: "form-message", role: "alert", hidden: true });
  return {
    node,
    show(text) {
      node.textContent = text;
      node.hidden = false;
    },
    hide() {
      node.hidden = true;
    },
  };
}

// Tombol kirim yang mengunci diri selama permintaan berjalan.
export async function withBusy(button, task) {
  const label = button.textContent;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Memproses";
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = label;
  }
}
