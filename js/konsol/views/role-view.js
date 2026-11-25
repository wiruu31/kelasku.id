import { h } from "../../core/dom.js";
import { emptyState, reportError, toAppError } from "../../core/errors.js";
import { field } from "../../presentation/components/form.js";
import { liveNote } from "../../presentation/components/role-parts.js";
import * as repo from "../data/console-repository.js";
import { loadOverview, setAdmin } from "../services/console-service.js";
import { openMemberPanel } from "../components/panels.js";
import { meter, rowButton, table } from "../components/table.js";
import { nav } from "../services/nav.js";

const option = (value, label) => ({ value, label });

// Atur Role: Main Admin mengangkat dan mencabut Admin Kelas. Batas jumlah dijaga di database.
export async function roleView() {
  const [overview, admins] = await Promise.all([loadOverview(), repo.fetchAdmins()]);
  const ctx = { overview, reload: () => nav.refresh() };
  const note = liveNote();

  const adminRows = admins.map((a) => {
    const cls = overview.classes.find((c) => c.id === a.class_id);
    return [
      a.display_name,
      h("span", { class: "mono" }, a.username ? `@${a.username}` : "-"),
      `${a.school_name}, ${a.class_name}`,
      h("span", { class: "muted" }, a.wa ? a.wa.replace(/^62/, "0") : a.email ?? "-"),
      rowButton("Kelola", async () => {
        const members = await repo.fetchClassMembers(a.class_id);
        const m = members.find((x) => x.member_id === a.member_id);
        if (m && cls) openMemberPanel(m, cls, ctx);
      }, `Kelola ${a.display_name}`),
    ];
  });

  const schoolSel = field({ label: "Sekolah", name: "sekolah", as: "select", options: [option("", "Pilih sekolah"), ...overview.schools.filter((s) => s.is_active).map((s) => option(s.id, s.name))] });
  const classSel = field({ label: "Kelas", name: "kelas", as: "select", options: [option("", "Pilih sekolah dulu")] });
  classSel.input.disabled = true;
  const host = h("div", { "aria-live": "polite" });

  schoolSel.input.addEventListener("change", () => {
    const classes = overview.classes.filter((c) => c.school_id === schoolSel.value() && c.is_active);
    classSel.input.replaceChildren(...[option("", classes.length ? "Pilih kelas" : "Sekolah ini belum punya kelas aktif"), ...classes.map((c) => option(c.id, c.name))].map((o) => h("option", { value: o.value }, o.label)));
    classSel.input.disabled = !classes.length;
    host.replaceChildren();
  });

  classSel.input.addEventListener("change", async () => {
    note.clear();
    const cls = overview.classes.find((c) => c.id === classSel.value());
    host.replaceChildren();
    if (!cls) return;
    try {
      const members = (await repo.fetchClassMembers(cls.id)).filter((m) => m.status === "active");
      const draw = () => {
        const used = members.filter((m) => m.is_admin).length;
        const live = { ...cls, admins: used };
        host.replaceChildren(
          h("p", { class: "muted", style: "margin-bottom:0.75rem" }, "Admin Kelas terpakai ", meter(used, cls.limit)),
          members.length
            ? table(
                [{ label: "Murid" }, { label: "Username" }, { label: "Peran" }, { label: "" }],
                members.map((m) => [
                  m.display_name,
                  h("span", { class: "mono" }, m.username ? `@${m.username}` : "-"),
                  m.is_admin ? h("span", { class: "tag tag--ember" }, "Admin Kelas") : h("span", { class: "muted" }, "Murid"),
                  h(
                    "button",
                    {
                      type: "button",
                      class: m.is_admin ? "btn btn--quiet btn--small" : "btn btn--small",
                      disabled: !m.is_admin && used >= cls.limit,
                      "aria-label": `${m.is_admin ? "Cabut" : "Angkat"} ${m.display_name}`,
                      onClick: async (event) => {
                        note.clear();
                        const btn = event.currentTarget;
                        btn.disabled = true;
                        try {
                          await setAdmin(m, !m.is_admin, live);
                          m.is_admin = !m.is_admin;
                          note.ok(`${m.display_name} ${m.is_admin ? "kini Admin Kelas" : "bukan Admin Kelas lagi"}.`);
                        } catch (err) {
                          reportError(err);
                          note.fail(toAppError(err).userMessage);
                        }
                        draw();
                      },
                    },
                    m.is_admin ? "Cabut" : "Angkat",
                  ),
                ]),
                { caption: `Murid aktif ${cls.name}` },
              )
            : emptyState("Belum ada murid aktif", "Murid harus disetujui dulu sebelum bisa diangkat jadi Admin Kelas."),
        );
      };
      draw();
    } catch (err) {
      reportError(err);
      note.fail(toAppError(err).userMessage);
    }
  });

  return h(
    "div",
    {},
    h("header", { class: "page-head" }, h("div", {}, h("h1", {}, "Atur Role"), h("p", {}, "Hanya Main Admin yang bisa mengangkat dan mencabut Admin Kelas. Batas jumlah per kelas diatur di panel kelas, bawaannya ada di Pengaturan."))),
    h("section", { class: "panel" }, h("h2", {}, "Angkat atau cabut Admin Kelas"), h("div", { class: "toolbar", style: "margin-top:1rem" }, schoolSel.root, classSel.root), note.node, host),
    h("div", { class: "section-title" }, h("h2", {}, "Semua Admin Kelas"), h("small", {}, `${admins.length} orang`)),
    adminRows.length ? table([{ label: "Nama" }, { label: "Username" }, { label: "Kelas" }, { label: "Kontak" }, { label: "" }], adminRows, { caption: "Daftar Admin Kelas" }) : emptyState("Belum ada Admin Kelas", "Angkat murid aktif lewat form di atas."),
  );
}
