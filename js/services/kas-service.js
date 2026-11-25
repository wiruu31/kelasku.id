import * as repo from "../data/features-repository.js";
import { appStore } from "../core/state.js";
import { AppError } from "../core/errors.js";
import { fetchActiveMembers } from "../data/role-repository.js";
import { periodKey, periodLabel, todayYmd } from "../core/format.js";

// Kas kelas: catatan pemasukan dan pengeluaran, saldo, dan iuran tetap.
// Menandai iuran lunas membuat pemasukan otomatis; keduanya satu transaksi di database.

function classId() {
  const id = appStore.get().member?.class?.id;
  if (!id) throw new AppError("no_class", "Kamu belum tergabung di kelas.");
  return id;
}

const clean = (v) => String(v ?? "").trim();
const invalid = (fields) => Object.assign(new AppError("validation", "Periksa isian."), { fields });

// Terima "50.000", "50000", atau "Rp 50.000". Hanya bilangan bulat rupiah.
export function parseAmount(input) {
  const digits = clean(input).replace(/^rp\s*/i, "").replace(/[.\s]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : NaN;
}

export function validateEntry(v) {
  const e = {};
  if (!["masuk", "keluar"].includes(v.kind)) e.kind = "Pilih pemasukan atau pengeluaran.";
  const amount = parseAmount(v.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) e.amount = "Isi jumlah dalam rupiah, lebih dari 0.";
  else if (amount > 1_000_000_000_000) e.amount = "Jumlah terlalu besar.";
  const note = clean(v.note);
  if (note.length < 1 || note.length > 120) e.note = "Catatan wajib diisi, maksimal 120 karakter.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(v.date))) e.date = "Isi tanggal.";
  return e;
}

const entryRow = (v) => ({ kind: v.kind, amount: parseAmount(v.amount), note: clean(v.note), entry_date: clean(v.date) });

export async function loadKas() {
  const id = classId();
  const [summary, entries] = await Promise.all([repo.fetchKasSummary(id), repo.fetchKasEntries(id)]);
  return { summary, entries };
}

export async function addEntry(v) {
  const e = validateEntry(v);
  if (Object.keys(e).length) throw invalid(e);
  await repo.insertKasEntry({ class_id: classId(), ...entryRow(v) });
}

export async function editEntry(id, v) {
  const e = validateEntry(v);
  if (Object.keys(e).length) throw invalid(e);
  await repo.updateKasEntry(id, entryRow(v));
}

export const removeEntry = (id) => repo.deleteKasEntry(id);

// ---- iuran tetap

export function validateDue(v) {
  const e = {};
  const name = clean(v.name);
  if (name.length < 2 || name.length > 60) e.name = "Nama iuran 2 sampai 60 karakter.";
  const amount = parseAmount(v.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) e.amount = "Isi nominal per murid, lebih dari 0.";
  else if (amount > 1_000_000_000) e.amount = "Nominal terlalu besar.";
  if (!["mingguan", "bulanan"].includes(v.period)) e.period = "Pilih periode.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(v.startsOn))) e.startsOn = "Isi tanggal mulai.";
  return e;
}

export async function addDue(v) {
  const e = validateDue(v);
  if (Object.keys(e).length) throw invalid(e);
  await repo.insertDue({ class_id: classId(), name: clean(v.name), amount: parseAmount(v.amount), period: v.period, starts_on: clean(v.startsOn) });
}

export const setDueActive = (id, active) => repo.updateDue(id, { is_active: active });
export const removeDue = (id) => repo.deleteDue(id);

// Iuran beserta murid aktif dan status lunas untuk periode berjalan.
export async function loadDues() {
  const id = classId();
  const [dues, members] = await Promise.all([repo.fetchDues(id), fetchActiveMembers(id)]);
  const payments = await repo.fetchPayments(dues.map((d) => d.id));
  const today = todayYmd();
  return dues.map((d) => {
    const key = periodKey(d.period, today);
    const paid = new Set(payments.filter((p) => p.due_id === d.id && p.period_key === key).map((p) => p.member_id));
    return {
      ...d,
      periodKey: key,
      periodLabel: periodLabel(d.period, key),
      started: d.starts_on <= today,
      members: members.map((m) => ({ id: m.id, name: m.display_name, paid: paid.has(m.id) })),
    };
  });
}

export const markPaid = (due, memberId, paid) =>
  repo.rpcSetDuePaid({ p_due: due.id, p_member: memberId, p_period_key: due.periodKey, p_paid: paid, p_date: todayYmd() });
