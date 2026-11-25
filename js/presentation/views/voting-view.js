import { h, icon } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { emptyState, reportError, toAppError } from "../../core/errors.js";
import { formatDateTime } from "../../core/format.js";
import { can, canOnItem } from "../../services/permissions.js";
import * as svc from "../../services/voting-service.js";
import { checkField, field, formMessage, withBusy } from "../components/form.js";
import { confirmAction } from "../components/confirm.js";
import { liveNote } from "../components/role-parts.js";

const meta = (p) => {
  const bits = [svc.modeLabel(p.mode)];
  if (p.state === "berjalan" && p.closes_at) bits.push(`selesai ${formatDateTime(p.closes_at)}`);
  if (p.state === "selesai") bits.push("sudah selesai");
  if (p.voters != null) bits.push(`${p.voters} pemilih`);
  return bits.join(" | ");
};

export async function votingView() {
  const state = appStore.get();
  const note = liveNote();
  const host = h("div", { class: "stack" });
  let polls = await svc.listPolls();

  async function reload() {
    polls = await svc.listPolls();
    draw();
  }

  function pollCard(p) {
    const multi = p.mode === "anonim_banyak";
    const running = p.state === "berjalan";
    const voted = p.my_options.length > 0;
    const locked = voted && p.mode !== "terlihat";
    const total = Math.max(1, ...p.options.map((o) => o.votes ?? 0));
    const name = `poll-${p.id}`;
    const inputs = [];

    const rows = p.options.map((o) => {
      const input = h("input", { type: multi ? "checkbox" : "radio", name, value: o.id, disabled: !running || locked });
      input.checked = p.my_options.includes(o.id);
      inputs.push(input);
      const shown = o.votes != null;
      const row = h(
        "li",
        {},
        h(
          "label",
          { class: "poll__choice" },
          shown && h("span", { class: "poll__fill", style: `width:${Math.round((o.votes / total) * 100)}%` }),
          input,
          h("span", {}, o.label),
          shown && h("span", { class: "poll__count" }, `${o.votes}`),
        ),
        o.names?.length ? h("p", { class: "poll__names" }, o.names.join(", ")) : null,
      );
      return row;
    });

    const card = h(
      "article",
      { class: "note poll" },
      h(
        "div",
        { class: "poll__head" },
        h("h2", { class: "poll__title" }, p.title),
        h("span", { class: `badge ${running ? "badge--live" : "badge--done"}` }, running ? "Berjalan" : "Selesai"),
      ),
      h("p", { class: "poll__meta" }, meta(p)),
      p.description && h("p", {}, p.description),
      h("ul", { class: "poll__options" }, rows),
      !p.results_visible && h("p", { class: "poll__hidden" }, "Hasil akan terbuka setelah voting selesai."),
    );

    if (running) {
      const submit = h("button", { type: "button", class: "btn btn--small", disabled: locked }, voted && !locked ? "Ganti suara" : locked ? "Suaramu tercatat" : "Kirim suara");
      submit.addEventListener("click", async () => {
        note.clear();
        const picked = inputs.filter((i) => i.checked).map((i) => i.value);
        try {
          await withBusy(submit, () => svc.castVote(p.id, picked));
          await reload();
          note.ok("Suaramu tercatat.");
        } catch (err) {
          reportError(err);
          note.fail(toAppError(err).userMessage);
        }
      });
      card.append(h("div", { class: "actions" }, submit));
    }

    const actions = h("div", { class: "actions entry__actions" });
    if (running && canOnItem(state, "voting", "ubah", p)) {
      actions.append(
        confirmAction({
          label: "Tutup voting",
          message: "Tutup voting sekarang? Setelah ditutup tidak ada yang bisa memilih lagi.",
          yesLabel: "Ya, tutup",
          small: true,
          run: () => svc.closePoll(p.id),
          onDone: async () => {
            await reload();
            note.ok("Voting ditutup.");
          },
          onError: (m) => note.fail(m),
        }),
      );
    }
    if (canOnItem(state, "voting", "hapus", p)) {
      actions.append(
        confirmAction({
          label: "Hapus",
          message: "Hapus voting ini beserta semua suaranya? Tindakan ini tidak bisa dibatalkan.",
          yesLabel: "Ya, hapus",
          danger: true,
          small: true,
          run: () => svc.removePoll(p.id),
          onDone: async () => {
            await reload();
            note.ok("Voting dihapus.");
          },
          onError: (m) => note.fail(m),
        }),
      );
    }
    if (actions.children.length) card.append(actions);
    return card;
  }

  function draw() {
    host.replaceChildren();
    if (!polls.length) host.append(emptyState("Belum ada voting", "Voting kelas akan muncul di sini."));
    else host.append(...polls.map(pollCard));
  }
  draw();

  const children = [h("header", { class: "page-head" }, h("h1", {}, "Voting"), h("p", {}, "Ambil keputusan kelas bersama. Tiap voting punya aturan privasinya sendiri."))];
  if (can(state, "voting.tambah")) children.push(createBox(async () => {
    await reload();
    note.ok("Voting dibuat.");
  }));
  children.push(note.node, host);
  return h("div", {}, children);
}

// Formulir buat voting: pilihan bisa ditambah sampai 10.
function createBox(onCreated) {
  const title = field({ label: "Pertanyaan", name: "pollTitle", maxlength: 120 });
  const desc = field({ label: "Keterangan (boleh kosong)", name: "pollDesc", as: "textarea", rows: 2, maxlength: 500, required: false });
  const mode = field({ label: "Mode voting", name: "pollMode", as: "select", options: svc.MODES.map((m) => ({ value: m.value, label: m.label })) });
  const modeHint = h("p", { class: "field__hint" });
  const syncHint = () => (modeHint.textContent = svc.MODES.find((m) => m.value === mode.value())?.hint ?? "");
  mode.input.addEventListener("change", syncHint);
  syncHint();
  const closes = field({ label: "Selesai pada (boleh kosong)", name: "pollCloses", type: "datetime-local", required: false, hint: "Waktu Jakarta. Kosongkan bila ditutup manual." });

  const optionsHost = h("div", { class: "opt-list" });
  const optErr = h("p", { class: "field__error", hidden: true, role: "alert" });
  const addOpt = h("button", { type: "button", class: "btn btn--quiet btn--small" }, "Tambah pilihan");
  const optInputs = [];
  function newOption() {
    if (optInputs.length >= svc.MAX_OPTIONS) return;
    const n = optInputs.length + 1;
    const input = h("input", { class: "input", type: "text", maxlength: 80, "aria-label": `Pilihan ${n}` });
    optInputs.push(input);
    optionsHost.append(h("div", { class: "opt-row" }, input));
    addOpt.hidden = optInputs.length >= svc.MAX_OPTIONS;
  }
  newOption();
  newOption();
  addOpt.addEventListener("click", () => {
    newOption();
    optInputs.at(-1).focus();
  });

  const message = formMessage();
  const submit = h("button", { type: "submit", class: "btn" }, "Buat voting");
  const form = h(
    "form",
    { class: "form", novalidate: true },
    title.root,
    desc.root,
    mode.root,
    modeHint,
    closes.root,
    h("fieldset", { class: "fieldset" }, h("legend", { class: "field__label" }, "Pilihan (2 sampai 10)"), optionsHost, optErr, addOpt),
    message.node,
    h("div", { class: "actions" }, submit),
  );
  const fields = { title, description: desc, mode, closesAt: closes };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hide();
    optErr.hidden = true;
    Object.values(fields).forEach((f) => f.setError(null));
    const values = {
      title: title.value(),
      description: desc.value(),
      mode: mode.value(),
      closesAt: closes.value(),
      options: optInputs.map((i) => i.value),
    };
    try {
      await withBusy(submit, () => svc.createPoll(values));
      form.reset();
      optInputs.forEach((i) => (i.value = ""));
      syncHint();
      details.open = false;
      await onCreated();
    } catch (err) {
      reportError(err);
      const e = toAppError(err);
      if (err.fields) {
        for (const [k, f] of Object.entries(fields)) if (err.fields[k]) f.setError(err.fields[k]);
        if (err.fields.options) {
          optErr.textContent = err.fields.options;
          optErr.hidden = false;
        }
      } else message.show(e.userMessage);
    }
  });

  const summary = h("summary", { class: "btn" }, h("span", { class: "btn__icon" }, icon(["M12 5v14", "M5 12h14"])), "Buat voting");
  const details = h("details", { class: "create-box" }, summary, h("div", { class: "note create-box__form" }, form));
  return details;
}
