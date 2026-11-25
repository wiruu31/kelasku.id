import { h } from "../../core/dom.js";
import { ROLE_COLORS } from "../../services/permissions.js";

const HEX = /^#[0-9a-fA-F]{6}$/;

// Lencana berwarna. Warna datang dari database, jadi divalidasi sebelum dipasang ke style.
export function roleBadge(role) {
  const badge = h("span", { class: "badge" }, role.name);
  if (HEX.test(role.color)) badge.style.backgroundColor = role.color;
  return badge;
}

let radioGroup = 0;

// Pilihan warna sebagai radio dengan nama warna terbaca, bukan hanya swatch.
export function colorPicker(selected) {
  const group = `warna-${++radioGroup}`;
  const inputs = ROLE_COLORS.map((c) => {
    const input = h("input", {
      type: "radio",
      name: group,
      value: c.value,
      class: "swatch__input",
      checked: c.value === selected,
    });
    const label = h(
      "label",
      { class: "swatch" },
      input,
      h("span", { class: "swatch__chip", style: `background:${c.value}` }),
      h("span", { class: "swatch__name" }, c.name),
    );
    return { input, label };
  });
  if (!inputs.some((i) => i.input.checked)) inputs[0].input.checked = true;
  const root = h(
    "fieldset",
    { class: "fieldset" },
    h("legend", { class: "field__label" }, "Warna lencana"),
    h("div", { class: "swatches" }, inputs.map((i) => i.label)),
  );
  return { root, value: () => inputs.find((i) => i.input.checked)?.input.value };
}

// Pesan hasil yang dibacakan pembaca layar.
export function liveNote() {
  const node = h("p", { class: "live-note", role: "status" });
  return {
    node,
    ok(text) {
      node.className = "live-note live-note--ok";
      node.textContent = text;
    },
    fail(text) {
      node.className = "live-note live-note--fail";
      node.textContent = text;
    },
    clear() {
      node.className = "live-note";
      node.textContent = "";
    },
  };
}
