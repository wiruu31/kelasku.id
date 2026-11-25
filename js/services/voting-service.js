import * as repo from "../data/features-repository.js";
import { appStore } from "../core/state.js";
import { AppError } from "../core/errors.js";
import { fromJakartaInput } from "../core/format.js";

// Voting: tiga mode. Aturan suara dan anonimitas dijaga fungsi database; di sini hanya validasi isian.

export const MODES = [
  { value: "terlihat", label: "Terlihat", hint: "Satu pilihan. Nama pemilih dan hasil tampil langsung. Suara boleh diganti sebelum selesai." },
  { value: "anonim_akhir", label: "Anonim, hasil di akhir", hint: "Satu pilihan, suara rahasia. Hasil baru terbuka setelah voting selesai." },
  { value: "anonim_banyak", label: "Anonim, banyak pilihan", hint: "Boleh memilih lebih dari satu, suara rahasia. Hasil tampil langsung." },
];
export const MAX_OPTIONS = 10;

function classId() {
  const id = appStore.get().member?.class?.id;
  if (!id) throw new AppError("no_class", "Kamu belum tergabung di kelas.");
  return id;
}

const clean = (v) => String(v ?? "").trim();

export function validatePoll(v) {
  const e = {};
  const title = clean(v.title);
  if (title.length < 2 || title.length > 120) e.title = "Judul 2 sampai 120 karakter.";
  if (clean(v.description).length > 500) e.description = "Keterangan maksimal 500 karakter.";
  if (!MODES.some((m) => m.value === v.mode)) e.mode = "Pilih mode voting.";
  const options = (v.options ?? []).map(clean).filter(Boolean);
  if (options.length < 2) e.options = "Isi minimal 2 pilihan.";
  else if (options.length > MAX_OPTIONS) e.options = `Maksimal ${MAX_OPTIONS} pilihan.`;
  else if (options.some((o) => o.length > 80)) e.options = "Tiap pilihan maksimal 80 karakter.";
  else if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) e.options = "Ada pilihan yang sama.";
  if (clean(v.closesAt)) {
    const iso = fromJakartaInput(v.closesAt);
    if (!iso || new Date(iso) <= new Date()) e.closesAt = "Tenggat harus di masa depan.";
  }
  return e;
}

export const listPolls = () => repo.fetchPolls(classId());

export async function createPoll(v) {
  const e = validatePoll(v);
  if (Object.keys(e).length) throw Object.assign(new AppError("validation", "Periksa isian."), { fields: e });
  return repo.rpcCreatePoll({
    p_class: classId(),
    p_title: clean(v.title),
    p_description: clean(v.description) || null,
    p_mode: v.mode,
    p_closes_at: clean(v.closesAt) ? fromJakartaInput(v.closesAt) : null,
    p_options: v.options.map(clean).filter(Boolean),
  });
}

export const castVote = (pollId, optionIds) => repo.rpcCastVote(pollId, optionIds);
export const closePoll = (pollId) => repo.rpcClosePoll(pollId);
export const removePoll = (pollId) => repo.deletePoll(pollId);

export const modeLabel = (mode) => MODES.find((m) => m.value === mode)?.label ?? mode;
