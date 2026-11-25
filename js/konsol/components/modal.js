import { h } from "../../core/dom.js";
import { icon } from "./icons.js";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Panel samping (drawer) atau dialog tengah. Escape dan klik latar menutup; fokus dikunci di dalam.
export function openModal({ title, subtitle, content, variant = "drawer", onClose }) {
  const opener = document.activeElement;
  const titleId = `modal-${Math.random().toString(36).slice(2, 8)}`;
  const body = h("div", { class: "drawer__body" });
  const closeBtn = h("button", { type: "button", class: "drawer__close", "aria-label": "Tutup" }, icon("tutup"));
  const panel = h(
    "div",
    { class: `drawer${variant === "dialog" ? " dialog" : ""}`, role: "dialog", "aria-modal": "true", "aria-labelledby": titleId },
    h("div", { class: "drawer__head" }, h("div", {}, h("h2", { id: titleId }, title), subtitle && h("p", {}, subtitle)), closeBtn),
    body,
  );
  const scrim = h("div", { class: `scrim${variant === "dialog" ? " scrim--center" : ""}` }, panel);
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    scrim.remove();
    document.body.style.overflow = "";
    if (opener?.isConnected) opener.focus();
    onClose?.();
  };
  function onKey(event) {
    if (event.key === "Escape") return close();
    if (event.key !== "Tab") return;
    const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest("[hidden]"));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  scrim.addEventListener("mousedown", (event) => {
    if (event.target === scrim) close();
  });
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.style.overflow = "hidden";
  document.body.append(scrim);

  const api = {
    body,
    close,
    set(nodes) {
      body.replaceChildren(...[].concat(nodes).filter(Boolean));
    },
  };
  api.set(content);
  (panel.querySelector("input, select, textarea") ?? closeBtn).focus();
  return api;
}
