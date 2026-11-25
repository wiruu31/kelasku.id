import { h } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { formatLongDate, todayDayNumber, dueStatus, formatDateTime, formatRupiah } from "../../core/format.js";
import * as svc from "../../services/content-service.js";
import { can } from "../../services/permissions.js";
import { startTour } from "../components/tour.js";
import { buildSteps, markTourDone, noteShown, shouldAutoStart } from "../../services/tour-service.js";
import { installCard } from "../components/install-card.js";
import { dueBadge } from "./tasks-view.js";
import { loadPiket } from "../../services/piket-service.js";
import { loadKas } from "../../services/kas-service.js";
import { listPolls } from "../../services/voting-service.js";

const snippet = (text, n = 110) => (text.length > n ? `${text.slice(0, n).trimEnd()}...` : text);
const failed = () => h("p", { class: "note__fail" }, "Bagian ini gagal dimuat. Buka halamannya langsung untuk mencoba lagi.");
const none = (text) => h("p", { class: "note__none" }, text);

// Satu ubin. Kegagalan satu ubin tidak merusak yang lain.
function tile({ label, href, linkText, result, build, empty, cls = "" }) {
  const body = result.status === "rejected" ? failed() : build(result.value) ?? none(empty);
  return h(
    "section",
    { class: `tile ${cls}`.trim(), "aria-label": label },
    h("h2", { class: "tile__label" }, label),
    body,
    h("a", { class: "tile__link", href }, linkText),
  );
}

const ok = (feature) => (s) => s.member?.status === "active" && can(s, `${feature}.lihat`);

export async function madingView() {
  const state = appStore.get();
  const canApprove = can(state, "akun.approve");
  const wantPiket = ok("piket")(state);
  const wantKas = ok("kas")(state);
  const wantVote = ok("voting")(state);
  const [schedules, announcements, tasks, pending, piket, kas, polls] = await Promise.allSettled([
    svc.listSchedules(),
    svc.listAnnouncements(),
    svc.listTasks(),
    canApprove ? svc.countPendingMembers() : Promise.resolve(0),
    wantPiket ? loadPiket() : Promise.resolve(null),
    wantKas ? loadKas() : Promise.resolve(null),
    wantVote ? listPolls() : Promise.resolve(null),
  ]);

  const first = (state.member?.display_name ?? "").split(" ")[0];
  const school = state.member?.class?.school?.name;
  const head = h(
    "header",
    { class: "mading-head" },
    h("p", { class: "mading-head__hello" }, first ? `Halo, ${first}` : "Halo"),
    h("h1", {}, state.member?.class?.name ?? "Mading kelas"),
    h("p", { class: "mading-head__date" }, [formatLongDate(), school].filter(Boolean).join(" | ")),
  );

  const today = todayDayNumber();
  const tiles = [
    tile({
      label: "Jadwal hari ini",
      href: "#/jadwal",
      linkText: "Lihat semua jadwal",
      result: schedules,
      cls: "tile--night tile--hero",
      empty: "Tidak ada pelajaran terjadwal hari ini.",
      build: (rows) => {
        const todays = rows.filter((s) => s.day_of_week === today);
        return todays.length
          ? h("ul", { class: "mini-list" }, todays.map((s) => h("li", {}, h("strong", { class: "mini-time" }, `${s.start_time} - ${s.end_time}`), " ", s.subject, s.room ? h("span", { class: "mini-list__sub" }, ` | ${s.room}`) : null)))
          : null;
      },
    }),
    tile({
      label: "Pengumuman",
      href: "#/pengumuman",
      linkText: "Semua pengumuman",
      result: announcements,
      cls: "tile--wide",
      empty: "Belum ada pengumuman.",
      build: (rows) =>
        rows.length
          ? h("ul", { class: "mini-list" }, rows.slice(0, 3).map((a) => h("li", {}, h("strong", {}, a.title), h("br"), h("span", { class: "mini-list__sub" }, snippet(a.body)))))
          : null,
    }),
    tile({
      label: "Tugas mendatang",
      href: "#/tugas",
      linkText: "Semua tugas",
      result: tasks,
      cls: "tile--wide",
      empty: "Tidak ada tugas dengan tenggat dekat.",
      build: (rows) => {
        const soon = rows.filter((t) => t.due_at && dueStatus(t.due_at) !== "lewat").slice(0, 4);
        return soon.length
          ? h("ul", { class: "mini-list" }, soon.map((t) => h("li", {}, h("strong", {}, t.title), " ", dueBadge(t.due_at), h("br"), h("span", { class: "mini-list__sub" }, `Tenggat ${formatDateTime(t.due_at)}`))))
          : null;
      },
    }),
  ];

  if (wantPiket) {
    tiles.push(
      tile({
        label: "Piket hari ini",
        href: "#/piket",
        linkText: "Jadwal piket",
        result: piket,
        empty: "Belum ada jadwal piket hari ini.",
        build: (byDay) => {
          const names = (byDay.get(today) ?? []).map((p) => p.name);
          return names.length ? h("p", { class: "tile__big" }, names.join(", ")) : null;
        },
      }),
    );
  }
  if (wantKas) {
    tiles.push(
      tile({
        label: "Saldo kas",
        href: "#/kas",
        linkText: "Buka kas",
        result: kas,
        empty: "Kas belum tersedia.",
        build: (data) => h("p", { class: "tile__big" }, formatRupiah(data.summary.saldo)),
      }),
    );
  }
  if (wantVote) {
    tiles.push(
      tile({
        label: "Voting",
        href: "#/voting",
        linkText: "Buka voting",
        result: polls,
        empty: "Tidak ada voting yang berjalan.",
        build: (rows) => {
          const open = rows.filter((p) => p.state === "berjalan");
          const waiting = open.filter((p) => p.my_options.length === 0).length;
          return open.length ? h("div", {}, h("p", { class: "tile__big" }, `${open.length} berjalan`), h("p", { class: "mini-list__sub" }, waiting ? `${waiting} belum kamu pilih` : "Semua sudah kamu pilih")) : null;
        },
      }),
    );
  }
  if (canApprove) {
    tiles.push(
      tile({
        label: "Perlu persetujuan",
        href: "#/persetujuan",
        linkText: "Buka persetujuan",
        result: pending,
        empty: "Tidak ada pendaftar yang menunggu.",
        build: (n) => (n > 0 ? h("p", { class: "tile__big" }, `${n} pendaftar`) : null),
      }),
    );
  }

  const view = h("div", {}, head, installCard("banner"), h("div", { class: "bento" }, tiles));
  // Tur otomatis sekali; ditunda sampai tampilan terpasang dan skeleton hilang.
  if (shouldAutoStart(state)) {
    noteShown();
    setTimeout(() => {
      if (view.isConnected && location.hash === "#/mading") startTour(buildSteps(appStore.get()), { onClose: markTourDone });
    }, 500);
  }
  return view;
}
