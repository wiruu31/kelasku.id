import { h, icon } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { emptyState, reportError, toAppError } from "../../core/errors.js";
import { formatRupiah, formatShortDate, todayYmd } from "../../core/format.js";
import { can, canOnItem } from "../../services/permissions.js";
import * as svc from "../../services/kas-service.js";
import { entityForm } from "../components/entity-form.js";
import { confirmAction } from "../components/confirm.js";
import { withBusy } from "../components/form.js";
import { liveNote } from "../components/role-parts.js";

const KIND_OPTIONS = [
  { value: "masuk", label: "Pemasukan" },
  { value: "keluar", label: "Pengeluaran" },
];
const ENTRY_FIELDS = [
  { name: "kind", label: "Jenis", as: "select", options: KIND_OPTIONS },
  { name: "amount", label: "Jumlah (rupiah)", inputmode: "numeric", maxlength: 16, hint: "Contoh: 50000 atau 50.000" },
  { name: "note", label: "Catatan", maxlength: 120 },
  { name: "date", label: "Tanggal", type: "date" },
];
const DUE_FIELDS = [
  { name: "name", label: "Nama iuran", maxlength: 60 },
  { name: "amount", label: "Nominal per murid (rupiah)", inputmode: "numeric", maxlength: 12 },
  { name: "period", label: "Periode", as: "select", options: [{ value: "bulanan", label: "Bulanan" }, { value: "mingguan", label: "Mingguan" }] },
  { name: "startsOn", label: "Mulai tanggal", type: "date" },
];

const plus = () => icon(["M12 5v14", "M5 12h14"]);
const stat = (label, value, cls = "") => h("div", { class: `stat ${cls}`.trim() }, h("p", { class: "stat__label" }, label), h("p", { class: "stat__value" }, value));

export async function kasView() {
  const state = appStore.get();
  const note = liveNote();
  const summaryHost = h("div", { class: "stat-row" });
  const duesHost = h("div", { class: "stack" });
  const listHost = h("ul", { class: "kas-list" });
  const emptyHost = h("div");
  let kas = await svc.loadKas();
  let dues = await svc.loadDues();

  async function reload() {
    [kas, dues] = await Promise.all([svc.loadKas(), svc.loadDues()]);
    draw();
  }

  function drawSummary() {
    const { masuk, keluar, saldo } = kas.summary;
    summaryHost.replaceChildren(stat("Saldo", formatRupiah(saldo)), stat("Total masuk", formatRupiah(masuk), "stat--in"), stat("Total keluar", formatRupiah(keluar), "stat--out"));
  }

  function entryRow(entry) {
    const row = h(
      "li",
      { class: "kas-row" },
      h("div", {}, h("p", { class: "kas-row__note" }, entry.note), h("p", { class: "kas-row__meta" }, `${formatShortDate(entry.entry_date)}${entry.source === "iuran" ? " | dari iuran" : ""}`)),
      h("span", { class: `kas-row__amount kas-row__amount--${entry.kind === "masuk" ? "in" : "out"}` }, `${entry.kind === "masuk" ? "+" : "-"}${formatRupiah(entry.amount)}`),
    );
    const actions = h("div", { class: "actions" });
    if (entry.source == null && canOnItem(state, "kas", "ubah", entry)) {
      const btn = h("button", { type: "button", class: "btn btn--quiet btn--small", "aria-label": `Ubah catatan ${entry.note}` }, "Ubah");
      btn.addEventListener("click", () => {
        note.clear();
        const form = entityForm({
          fields: ENTRY_FIELDS,
          initial: { kind: entry.kind, amount: String(entry.amount), note: entry.note, date: entry.entry_date },
          submitLabel: "Simpan perubahan",
          onCancel: draw,
          onSubmit: async (v) => {
            await svc.editEntry(entry.id, v);
            await reload();
            note.ok("Catatan diperbarui.");
          },
        });
        row.replaceChildren(h("div", { style: "grid-column:1/-1" }, form.root));
        form.focus();
      });
      actions.append(btn);
    }
    if (canOnItem(state, "kas", "hapus", entry)) {
      actions.append(
        confirmAction({
          label: "Hapus",
          message: entry.source === "iuran" ? "Hapus catatan ini? Murid yang bersangkutan kembali berstatus belum bayar." : "Hapus catatan ini? Saldo akan dihitung ulang.",
          yesLabel: "Ya, hapus",
          danger: true,
          small: true,
          run: () => svc.removeEntry(entry.id),
          onDone: async () => {
            await reload();
            note.ok("Catatan dihapus.");
          },
          onError: (m) => note.fail(m),
        }),
      );
    }
    if (actions.children.length) row.append(actions);
    return row;
  }

  function dueCard(due) {
    const canMark = can(state, "kas.ubah");
    const paidCount = due.members.filter((m) => m.paid).length;
    const card = h(
      "article",
      { class: "note due-card" },
      h("div", {}, h("h3", {}, due.name), h("p", { class: "kas-row__meta" }, `${formatRupiah(due.amount)} per murid | ${due.period} | ${due.periodLabel} | ${paidCount} dari ${due.members.length} lunas${due.is_active ? "" : " | nonaktif"}`)),
    );
    if (!due.started) card.append(h("p", { class: "note__none" }, `Dimulai ${formatShortDate(due.starts_on)}.`));
    else
      card.append(
        h(
          "ul",
          { class: "due-members" },
          due.members.map((m) => {
            const box = h("input", { type: "checkbox", class: "check__input", disabled: !canMark || !due.is_active });
            box.checked = m.paid;
            box.addEventListener("change", async () => {
              note.clear();
              try {
                await withBusy(box, () => svc.markPaid(due, m.id, box.checked));
                await reload();
              } catch (err) {
                reportError(err);
                box.checked = !box.checked;
                note.fail(toAppError(err).userMessage);
              }
            });
            return h("li", {}, h("label", { class: "check" }, box, h("span", {}, m.name)), h("span", { class: "kas-row__meta" }, m.paid ? "Lunas" : "Belum"));
          }),
        ),
      );
    const actions = h("div", { class: "actions" });
    if (can(state, "kas.ubah")) {
      const toggle = h("button", { type: "button", class: "btn btn--quiet btn--small" }, due.is_active ? "Nonaktifkan" : "Aktifkan");
      toggle.addEventListener("click", async () => {
        note.clear();
        try {
          await withBusy(toggle, () => svc.setDueActive(due.id, !due.is_active));
          await reload();
        } catch (err) {
          reportError(err);
          note.fail(toAppError(err).userMessage);
        }
      });
      actions.append(toggle);
    }
    if (can(state, "kas.hapus")) {
      actions.append(
        confirmAction({
          label: "Hapus iuran",
          message: "Hapus iuran ini? Catatan pemasukan dari iuran ini ikut terhapus dan saldo dihitung ulang.",
          yesLabel: "Ya, hapus",
          danger: true,
          small: true,
          run: () => svc.removeDue(due.id),
          onDone: async () => {
            await reload();
            note.ok("Iuran dihapus.");
          },
          onError: (m) => note.fail(m),
        }),
      );
    }
    if (actions.children.length) card.append(actions);
    return card;
  }

  function draw() {
    drawSummary();
    duesHost.replaceChildren(...dues.map(dueCard));
    if (!dues.length) duesHost.replaceChildren(emptyState("Belum ada iuran tetap", "Iuran yang dibuat bendahara akan tampil di sini."));
    listHost.replaceChildren(...kas.entries.map(entryRow));
    emptyHost.replaceChildren(kas.entries.length ? "" : emptyState("Belum ada catatan kas", "Pemasukan dan pengeluaran kelas akan tercatat di sini."));
  }
  draw();

  const boxes = [];
  if (can(state, "kas.tambah")) {
    const entryForm = entityForm({
      fields: ENTRY_FIELDS,
      initial: { kind: "masuk", date: todayYmd() },
      submitLabel: "Simpan catatan",
      onSubmit: async (v) => {
        note.clear();
        await svc.addEntry(v);
        await reload();
        entryDetails.open = false;
        note.ok("Catatan kas disimpan.");
      },
    });
    var entryDetails = h("details", { class: "create-box" }, h("summary", { class: "btn" }, h("span", { class: "btn__icon" }, plus()), "Catat kas"), h("div", { class: "note create-box__form" }, entryForm.root));
    entryDetails.addEventListener("toggle", () => entryDetails.open && entryForm.focus());

    const dueForm = entityForm({
      fields: DUE_FIELDS,
      initial: { period: "bulanan", startsOn: todayYmd() },
      submitLabel: "Buat iuran",
      onSubmit: async (v) => {
        note.clear();
        await svc.addDue(v);
        await reload();
        dueDetails.open = false;
        note.ok("Iuran dibuat.");
      },
    });
    var dueDetails = h("details", { class: "create-box" }, h("summary", { class: "btn btn--quiet" }, h("span", { class: "btn__icon" }, plus()), "Buat iuran tetap"), h("div", { class: "note create-box__form" }, dueForm.root));
    boxes.push(h("div", { class: "actions" }, entryDetails, dueDetails));
  }

  return h(
    "div",
    {},
    h("header", { class: "page-head" }, h("h1", {}, "Kas kelas"), h("p", {}, "Saldo, iuran tetap, dan riwayat pemasukan serta pengeluaran.")),
    summaryHost,
    ...boxes,
    note.node,
    h("h2", { class: "section-title" }, "Iuran tetap"),
    duesHost,
    h("h2", { class: "section-title" }, "Riwayat"),
    emptyHost,
    listHost,
  );
}
