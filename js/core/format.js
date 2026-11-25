const DATE_TIME = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function formatDateTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : DATE_TIME.format(d);
}

// 6281234 -> 081234 untuk dibaca orang Indonesia.
export function waForDisplay(wa) {
  return String(wa ?? "").replace(/^62/, "0");
}

// ---- zona Asia/Jakarta (WIB, tanpa DST)
const TZ = "Asia/Jakarta";
const PARTS = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const LONG_DATE = new Intl.DateTimeFormat("id-ID", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" });

export const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const WEEKDAY_INDEX = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };

function parts(date) {
  return Object.fromEntries(PARTS.formatToParts(date).map((p) => [p.type, p.value]));
}

export const formatLongDate = (date = new Date()) => LONG_DATE.format(date);
export const todayDayNumber = (date = new Date()) => WEEKDAY_INDEX[WEEKDAY.format(date)];
export const hhmm = (t) => String(t ?? "").slice(0, 5);

// Nilai input datetime-local (waktu Jakarta) <-> ISO dengan offset +07:00.
export function fromJakartaInput(value) {
  return value ? `${value}:00+07:00` : null;
}
export function toJakartaInput(iso) {
  if (!iso) return "";
  const p = parts(new Date(iso));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const dayKey = (date) => {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
};

// Status tenggat untuk lencana: lewat, hari ini, besok, atau nanti.
export function dueStatus(iso, now = new Date()) {
  if (!iso) return null;
  const due = new Date(iso);
  if (due < now) return "lewat";
  const today = dayKey(now);
  if (dayKey(due) === today) return "hari-ini";
  if (dayKey(due) === dayKey(new Date(now.getTime() + 86400000))) return "besok";
  return "nanti";
}

// ---- kas dan tanggal tanpa jam

const RUPIAH = new Intl.NumberFormat("id-ID");
export const formatRupiah = (n) => `Rp${RUPIAH.format(Number(n) || 0)}`;

const SHORT_DATE = new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
// "2026-11-23" -> "23 Nov 2026". Tanggal polos dibaca sebagai tengah hari WIB supaya tidak bergeser hari.
export const formatShortDate = (ymd) => SHORT_DATE.format(new Date(`${ymd}T12:00:00+07:00`));

// Tanggal hari ini di WIB sebagai YYYY-MM-DD.
export function todayYmd(date = new Date()) {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export const monthKey = (ymd) => ymd.slice(0, 7);

// Minggu ISO: Kamis menentukan tahun minggunya.
export function isoWeekKey(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const periodKey = (period, ymd) => (period === "mingguan" ? isoWeekKey(ymd) : monthKey(ymd));

export function periodLabel(period, key) {
  if (period === "bulanan") {
    const [y, m] = key.split("-");
    return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(+y, +m - 1, 1)));
  }
  return `Minggu ${key.slice(6)} ${key.slice(0, 4)}`;
}
