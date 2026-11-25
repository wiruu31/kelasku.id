import { h } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { emptyState, reportError, toAppError } from "../../core/errors.js";
import { formatDateTime, waForDisplay } from "../../core/format.js";
import { approveMember, loadApprovals, rejectMember } from "../../services/admin-service.js";
import { can } from "../../services/permissions.js";
import { liveNote } from "../components/role-parts.js";

export async function approvalsView() {
  const head = h(
    "header",
    { class: "page-head" },
    h("h1", {}, "Persetujuan"),
    h("p", {}, "Cek pendaftar baru sebelum mereka bisa masuk ke kelas."),
  );
  if (!can(appStore.get(), "akun.approve")) {
    return h("div", {}, head, emptyState("Kamu tidak punya akses", "Halaman ini untuk admin atau pemegang izin Menyetujui akun baru."));
  }

  const { pending, inactive } = await loadApprovals();
  const note = liveNote();
  const pendingHost = h("div", { class: "stack" });
  const inactiveHost = h("div", { class: "stack" });
  const state = { pending, inactive };

  const drawPending = () => {
    pendingHost.replaceChildren();
    if (!state.pending.length) {
      pendingHost.append(emptyState("Tidak ada pendaftar baru", "Pendaftar yang menunggu persetujuan akan muncul di sini."));
      return;
    }
    for (const m of state.pending) pendingHost.append(pendingRow(m));
  };

  const drawInactive = () => {
    inactiveHost.replaceChildren();
    if (!state.inactive.length) return;
    inactiveHost.append(h("h2", { class: "section-title" }, "Ditolak dan dikeluarkan"));
    for (const m of state.inactive) inactiveHost.append(inactiveRow(m));
  };

  async function decide(member, task, doneText, after) {
    note.clear();
    try {
      await task(member);
      after(member);
      note.ok(doneText(member));
    } catch (err) {
      reportError(err);
      const e = toAppError(err);
      note.fail(e.code === "23505" ? `Nama ${member.display_name} sudah dipakai anggota aktif lain di kelas ini.` : e.userMessage);
    }
  }

  function pendingRow(m) {
    const wa = m.contact ? `WA ${waForDisplay(m.contact.wa)}` : null;
    const approve = h("button", { type: "button", class: "btn btn--small", "aria-label": `Setujui ${m.display_name}` }, "Setujui");
    const reject = h("button", { type: "button", class: "btn btn--quiet btn--small", "aria-label": `Tolak ${m.display_name}` }, "Tolak");
    approve.addEventListener("click", () =>
      decide(m, approveMember, (x) => `${x.display_name} disetujui.`, () => {
        state.pending = state.pending.filter((x) => x.id !== m.id);
        drawPending();
      }),
    );
    reject.addEventListener("click", () =>
      decide(m, rejectMember, (x) => `${x.display_name} ditolak.`, () => {
        state.pending = state.pending.filter((x) => x.id !== m.id);
        state.inactive = [{ ...m, status: "rejected" }, ...state.inactive];
        drawPending();
        drawInactive();
      }),
    );
    return h(
      "article",
      { class: "note role-row" },
      h(
        "div",
        { class: "role-row__main" },
        h("div", {}, h("p", { class: "member__name" }, m.display_name), h("p", { class: "role-row__meta" }, [`Mendaftar ${formatDateTime(m.created_at)}`, wa].filter(Boolean).join(" | "))),
      ),
      h("div", { class: "role-row__actions" }, approve, reject),
    );
  }

  function inactiveRow(m) {
    const restore = h("button", { type: "button", class: "btn btn--quiet btn--small", "aria-label": `Pulihkan ${m.display_name}` }, "Pulihkan");
    restore.addEventListener("click", () =>
      decide(m, approveMember, (x) => `${x.display_name} dipulihkan sebagai anggota.`, () => {
        state.inactive = state.inactive.filter((x) => x.id !== m.id);
        drawInactive();
      }),
    );
    return h(
      "article",
      { class: "note role-row" },
      h("div", { class: "role-row__main" }, h("p", { class: "member__name" }, m.display_name), h("span", { class: "badge badge--muted" }, m.status === "rejected" ? "Ditolak" : "Dikeluarkan")),
      h("div", { class: "role-row__actions" }, restore),
    );
  }

  drawPending();
  drawInactive();
  return h("div", {}, head, note.node, pendingHost, inactiveHost);
}
