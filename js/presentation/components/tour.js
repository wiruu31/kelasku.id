import { h } from "../../core/dom.js";

const COMPACT = "(max-width: 879px)";
const GAP = 14;
const EDGE = 8;

const isCompact = () => matchMedia(COMPACT).matches;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

// Cari elemen menu yang disorot. Null bila tidak terlihat (mis. menu rel samping di ponsel).
function resolveTarget(step) {
  if (step.railOnly && isCompact()) return null;
  if (step.compactOnly && !isCompact()) return null;
  const el = document.querySelector(`.app-nav li:not([hidden]) a[data-path="${step.path}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

// Tur sorot. onClose("done" | "skipped") dipanggil sekali saat selesai atau dilewati.
export function startTour(steps, { onClose } = {}) {
  const usable = steps.filter(resolveTarget);
  if (!usable.length || document.querySelector(".tour")) return false;

  const previousFocus = document.activeElement;
  let index = 0;
  let closed = false;

  const title = h("h2", { id: "tour-title", class: "note__label" });
  const body = h("p", { id: "tour-body", class: "tour__body" });
  const count = h("p", { class: "tour__count" });
  const back = h("button", { type: "button", class: "btn btn--quiet" }, "Kembali");
  const next = h("button", { type: "button", class: "btn" }, "Lanjut");
  const skip = h("button", { type: "button", class: "btn btn--quiet tour__skip" }, "Lewati");
  const card = h("div", { class: "tour__card note" }, count, title, body, h("div", { class: "actions tour__actions" }, back, next, skip));
  const spot = h("div", { class: "tour__spot", "aria-hidden": "true" });
  const root = h("div", { class: "tour", role: "dialog", "aria-modal": "true", "aria-labelledby": "tour-title", "aria-describedby": "tour-body" }, spot, card);

  function place(el) {
    const rect = el.getBoundingClientRect();
    const pad = 6;
    Object.assign(spot.style, { left: `${rect.left - pad}px`, top: `${rect.top - pad}px`, width: `${rect.width + pad * 2}px`, height: `${rect.height + pad * 2}px` });
    const vw = innerWidth;
    const vh = innerHeight;
    card.style.width = `${Math.min(340, vw - EDGE * 2)}px`;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const centered = clamp(rect.left + rect.width / 2 - cw / 2, EDGE, vw - cw - EDGE);
    let left;
    let top;
    if (rect.right + GAP + cw <= vw - EDGE) {
      left = rect.right + GAP;
      top = clamp(rect.top, EDGE, vh - ch - EDGE);
    } else if (rect.top - GAP - ch >= EDGE) {
      left = centered;
      top = rect.top - GAP - ch;
    } else if (rect.bottom + GAP + ch <= vh - EDGE) {
      left = centered;
      top = rect.bottom + GAP;
    } else {
      left = centered;
      top = EDGE;
    }
    Object.assign(card.style, { left: `${left}px`, top: `${top}px` });
  }

  function show(dir = 1) {
    // Lewati langkah yang targetnya tidak ada lagi (layar berubah ukuran).
    while (index >= 0 && index < usable.length && !resolveTarget(usable[index])) index += dir;
    if (index < 0) index = 0;
    if (index >= usable.length) return close("done");
    const step = usable[index];
    title.textContent = step.title;
    body.textContent = step.body;
    count.textContent = `Langkah ${index + 1} dari ${usable.length}`;
    back.hidden = index === 0;
    next.textContent = index === usable.length - 1 ? "Selesai" : "Lanjut";
    place(resolveTarget(step));
    next.focus();
  }

  function close(reason) {
    if (closed) return;
    closed = true;
    removeEventListener("resize", onResize);
    document.removeEventListener("keydown", onKey, true);
    root.remove();
    previousFocus?.focus?.();
    onClose?.(reason);
  }

  const onResize = () => !closed && show(1);
  function onKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close("skipped");
    } else if (event.key === "Tab") {
      // Fokus dikunci di kartu selama tur.
      const items = [back, next, skip].filter((b) => !b.hidden);
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!card.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  next.addEventListener("click", () => {
    index += 1;
    show(1);
  });
  back.addEventListener("click", () => {
    index -= 1;
    show(-1);
  });
  skip.addEventListener("click", () => close("skipped"));
  addEventListener("resize", onResize);
  document.addEventListener("keydown", onKey, true);

  document.body.append(root);
  show(1);
  return true;
}
