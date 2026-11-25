import { h } from "../../core/dom.js";
import { emptyState } from "../../core/errors.js";
import { field } from "../../presentation/components/form.js";
import { loadClassDetail, loadOverview } from "../services/console-service.js";
import { openClassPanel, openMemberPanel, openSchoolPanel } from "../components/panels.js";
import { nav } from "../services/nav.js";
import { meter, rowButton, table } from "../components/table.js";

const crumbs = (items) =>
  h("nav", { class: "crumbs", "aria-label": "Jejak" }, items.flatMap((c, i) => [i ? h("span", { "aria-hidden": "true" }, "/") : null, c.href ? h("a", { href: c.href }, c.label) : h("span", { "aria-current": "page" }, c.label)]).filter(Boolean));

const STATUS = { active: ["Aktif", "tag"], pending: ["Menunggu", "tag tag--ember"], rejected: ["Ditolak", "tag tag--off"], removed: ["Dikeluarkan", "tag tag--off"] };

// Satu view melayani tiga tingkat: sekolah, kelas, murid. Tingkat ditentukan dari parameter rute.
export async function ringkasanView({ params }) {
  const overview = await loadOverview();
  const ctx = { overview, reload: () => nav.refresh() };

  if (!params.schoolId) return schoolLevel(overview, ctx);
  const school = overview.schools.find((s) => s.id === params.schoolId);
  if (!school) return h("div", {}, crumbs([{ label: "Ringkasan", href: "#/ringkasan" }]), emptyState("Sekolah tidak ditemukan", "Sekolah ini sudah dihapus atau tautannya keliru."));
  if (!params.classId) return classLevel(overview, school, ctx);
  const cls = overview.classes.find((c) => c.id === params.classId);
  if (!cls) return h("div", {}, crumbs([{ label: "Ringkasan", href: "#/ringkasan" }, { label: school.name, href: `#/ringkasan/${school.id}` }]), emptyState("Kelas tidak ditemukan", "Kelas ini sudah dihapus atau tautannya keliru."));
  return studentLevel(overview, school, cls, ctx);
}

function schoolLevel(overview, ctx) {
  const rows = overview.schools.map((s) => [
    h("a", { class: "row-link", href: `#/ringkasan/${s.id}` }, s.name),
    h("span", { class: "num" }, String(s.classes.length)),
    h("span", { class: "num" }, String(s.students)),
    h("span", { class: s.pending ? "tag tag--ember" : "muted" }, String(s.pending)),
    h("span", { class: "num" }, String(s.admins)),
    s.is_active ? h("span", { class: "tag" }, "Aktif") : h("span", { class: "tag tag--off" }, "Arsip"),
    rowButton("Kelola", () => openSchoolPanel(s, ctx), `Kelola ${s.name}`),
  ]);
  return h(
    "div",
    {},
    crumbs([{ label: "Ringkasan" }]),
    h("header", { class: "page-head" }, h("div", {}, h("h1", {}, "Ringkasan"), h("p", {}, "Pilih sekolah untuk melihat kelasnya, lalu kelas untuk melihat murid."))),
    rows.length
      ? table([{ label: "Sekolah" }, { label: "Kelas" }, { label: "Murid aktif" }, { label: "Menunggu" }, { label: "Admin Kelas" }, { label: "Status" }, { label: "" }], rows, { caption: "Daftar sekolah" })
      : emptyState("Belum ada sekolah", "Tambahkan sekolah pertama di menu Sekolah."),
  );
}

function classLevel(overview, school, ctx) {
  const rows = school.classes.map((c) => [
    h("a", { class: "row-link", href: `#/ringkasan/${school.id}/${c.id}` }, c.name),
    h("span", { class: "num" }, String(c.active)),
    h("span", { class: c.pending ? "tag tag--ember" : "muted" }, String(c.pending)),
    meter(c.admins, c.limit),
    c.is_active ? h("span", { class: "tag" }, "Aktif") : h("span", { class: "tag tag--off" }, "Nonaktif"),
    rowButton("Kelola", () => openClassPanel(c, ctx), `Kelola ${c.name}`),
  ]);
  return h(
    "div",
    {},
    crumbs([{ label: "Ringkasan", href: "#/ringkasan" }, { label: school.name }]),
    h("header", { class: "page-head" }, h("div", {}, h("h1", {}, school.name), h("p", {}, `${school.classes.length} kelas, ${school.students} murid aktif.`)), h("a", { class: "btn btn--quiet", href: "#/kelas-baru" }, "Tambah kelas")),
    rows.length
      ? table([{ label: "Kelas" }, { label: "Murid aktif" }, { label: "Menunggu" }, { label: "Admin Kelas" }, { label: "Status" }, { label: "" }], rows, { caption: `Kelas di ${school.name}` })
      : emptyState("Belum ada kelas", "Sekolah ini belum punya kelas. Tambahkan lewat menu Tambah Kelas."),
  );
}

async function studentLevel(overview, school, cls, ctx) {
  const { members } = await loadClassDetail(cls.id);
  const search = field({ label: "Cari murid", name: "cari", required: false, hint: "Nama atau username." });
  const host = h("div", {});
  const draw = () => {
    const q = search.value().trim().toLowerCase();
    const list = members.filter((m) => !q || m.display_name.toLowerCase().includes(q) || (m.username ?? "").includes(q));
    host.replaceChildren(
      list.length
        ? table(
            [{ label: "Nama" }, { label: "Username" }, { label: "Status" }, { label: "Role" }, { label: "NIS" }, { label: "" }],
            list.map((m) => [
              h("button", { type: "button", class: "row-link btn--link", style: "background:none;border:0;padding:0;min-height:2.75rem;text-align:left;font:inherit", onClick: () => openMemberPanel(m, cls, ctx) }, m.display_name),
              h("span", { class: "mono" }, m.username ? `@${m.username}` : "-"),
              h("span", { class: (STATUS[m.status] ?? STATUS.active)[1] }, (STATUS[m.status] ?? [m.status])[0]),
              m.is_admin ? h("span", { class: "tag tag--ember" }, "Admin Kelas") : h("span", { class: "muted" }, "Murid"),
              h("span", { class: "mono" }, m.nis || "-"),
              rowButton("Kelola", () => openMemberPanel(m, cls, ctx), `Kelola ${m.display_name}`),
            ]),
            { caption: `Murid ${cls.name}` },
          )
        : emptyState(q ? "Tidak ada yang cocok" : "Belum ada murid", q ? "Coba kata kunci lain." : "Murid muncul di sini setelah mendaftar dengan kode kelas."),
    );
  };
  search.input.addEventListener("input", draw);
  draw();
  return h(
    "div",
    {},
    crumbs([{ label: "Ringkasan", href: "#/ringkasan" }, { label: school.name, href: `#/ringkasan/${school.id}` }, { label: cls.name }]),
    h("header", { class: "page-head" }, h("div", {}, h("h1", {}, cls.name), h("p", {}, `${cls.active} murid aktif, ${cls.pending} menunggu, ${cls.admins} dari ${cls.limit} Admin Kelas.`)), rowButton("Kelola kelas", () => openClassPanel(cls, ctx))),
    h("div", { class: "toolbar" }, search.root),
    host,
  );
}
