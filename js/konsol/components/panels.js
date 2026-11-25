import { h } from "../../core/dom.js";
import { copyText } from "../../core/clipboard.js";
import { reportError, toAppError } from "../../core/errors.js";
import { formatDateTime } from "../../core/format.js";
import { field, withBusy } from "../../presentation/components/form.js";
import { liveNote } from "../../presentation/components/role-parts.js";
import { secretBox } from "../../presentation/components/secret-box.js";
import * as svc from "../services/console-service.js";
import { loadClassDetail } from "../services/console-service.js";
import { openModal } from "./modal.js";
import { confirmByTyping } from "./typed-confirm.js";

// Panel samping untuk sekolah, kelas, dan murid. Dipakai bersama oleh Ringkasan, Sekolah, dan Atur Role.
// ctx.reload() memuat ulang halaman di belakang panel setelah ada perubahan.

const kv = (rows) => h("dl", { class: "kv" }, rows.filter(Boolean).flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v ?? "-")]));
const group = (title, ...nodes) => h("section", { class: "group" }, h("h3", {}, title), ...nodes);
const schoolOptions = (schools, includeOff) => schools.filter((s) => s.is_active || includeOff).map((s) => ({ value: s.id, label: s.is_active ? s.name : `${s.name} (arsip)` }));

// Jalankan tugas, tampilkan hasil di catatan, dan petakan galat ke field bila ada.
async function submitForm({ button, note, fields, task, okText, after }) {
  note.clear();
  for (const f of Object.values(fields)) f.setError(null);
  try {
    const result = await withBusy(button, task);
    note.ok(okText);
    await after?.(result);
  } catch (err) {
    reportError(err);
    const e = toAppError(err);
    if (err.fields) {
      for (const [key, message] of Object.entries(err.fields)) fields[key]?.setError(message);
      if (!Object.keys(err.fields).some((k) => fields[k])) note.fail(e.userMessage);
    } else if (e.code === "23505") fields.name?.setError("Nama itu sudah dipakai.");
    else note.fail(e.userMessage);
  }
}

// ---------------------------------------------------------------- sekolah

export function openSchoolPanel(school, { overview, reload }) {
  const modal = openModal({ title: school.name, subtitle: school.is_active ? "Sekolah aktif" : "Sekolah diarsipkan", content: [] });
  const note = liveNote();

  const name = field({ label: "Nama sekolah", name: "name", maxlength: 120 });
  name.setValue(school.name);
  const save = h("button", { type: "submit", class: "btn" }, "Simpan nama");
  const rename = h("form", { class: "form", novalidate: true }, name.root, save);
  rename.addEventListener("submit", (event) => {
    event.preventDefault();
    submitForm({ button: save, note, fields: { name }, task: () => svc.renameSchool(school, { name: name.value() }), okText: "Nama sekolah disimpan.", after: reload });
  });

  const toggle = h("button", { type: "button", class: "btn btn--quiet" }, school.is_active ? "Arsipkan sekolah" : "Aktifkan kembali");
  toggle.addEventListener("click", async () => {
    note.clear();
    try {
      await withBusy(toggle, () => svc.setSchoolActive(school, !school.is_active));
      modal.close();
      await reload();
    } catch (err) {
      reportError(err);
      note.fail(toAppError(err).userMessage);
    }
  });

  const targets = overview.schools.filter((s) => s.is_active && s.id !== school.id);
  const classRows = school.classes.map((c) => {
    const select = field({ label: `Pindahkan ${c.name} ke`, name: `pindah-${c.id}`, as: "select", options: [{ value: "", label: "Pilih sekolah tujuan" }, ...schoolOptions(targets)] });
    const go = h("button", { type: "button", class: "btn btn--quiet btn--small" }, "Pindahkan");
    go.addEventListener("click", async () => {
      note.clear();
      if (!select.value()) return select.setError("Pilih sekolah tujuan.");
      select.setError(null);
      try {
        await withBusy(go, () => svc.saveClass(c, { name: c.name, schoolId: select.value(), maxAdmins: c.max_admins ?? "" }));
        modal.close();
        await reload();
      } catch (err) {
        reportError(err);
        note.fail(toAppError(err).userMessage);
      }
    });
    return h("div", { class: "group" }, h("p", {}, h("strong", {}, c.name), " ", h("span", { class: "muted" }, `${c.active} murid`, c.is_active ? "" : ", nonaktif")), targets.length ? [select.root, h("div", { class: "actions" }, go)] : null);
  });

  const danger = !school.is_active
    ? h(
        "section",
        { class: "danger-zone" },
        h("h3", {}, "Hapus permanen"),
        h("p", { class: "muted" }, "Menghapus sekolah juga menghapus semua kelas dan datanya. Tidak bisa dibatalkan. Semua kelasnya harus sudah nonaktif."),
        h("div", { class: "actions" }, h("button", { type: "button", class: "btn btn--danger", onClick: () => confirmByTyping({ title: `Hapus ${school.name}`, message: "Sekolah dan semua kelas di dalamnya dihapus permanen.", expected: school.name, actionLabel: "Hapus permanen", run: (typed) => svc.removeSchool(school, typed), onDone: () => { modal.close(); reload(); } }) }, "Hapus permanen")),
      )
    : null;

  modal.set([
    kv([["Kelas", String(school.classes.length)], ["Murid aktif", String(school.students)], ["Admin Kelas", String(school.admins)], ["Dibuat", formatDateTime(school.created_at)]]),
    group("Nama", rename),
    note.node,
    group("Status", toggle),
    school.classes.length ? group("Kelas di sekolah ini", ...classRows) : null,
    danger,
  ]);
  return modal;
}

// ---------------------------------------------------------------- kelas

export function openClassPanel(cls, { overview, reload }) {
  const school = overview.schools.find((s) => s.id === cls.school_id);
  const modal = openModal({ title: cls.name, subtitle: `${school?.name ?? ""}${cls.is_active ? "" : ", nonaktif"}`, content: [] });
  const note = liveNote();

  const code = h("code", { class: "joincode" }, "......");
  const copy = h("button", { type: "button", class: "btn btn--quiet btn--small" }, "Salin kode");
  loadClassDetail(cls.id)
    .then(({ code: value }) => (code.textContent = value))
    .catch((err) => {
      reportError(err);
      code.textContent = "Gagal memuat";
    });
  copy.addEventListener("click", async () => {
    note.clear();
    (await copyText(code.textContent)) ? note.ok("Kode tersalin.") : note.fail("Gagal menyalin. Salin manual dari kotak kode.");
  });

  const name = field({ label: "Nama kelas", name: "name", maxlength: 80 });
  const schoolSel = field({ label: "Sekolah", name: "schoolId", as: "select", options: schoolOptions(overview.schools, true) });
  const limit = field({ label: "Batas Admin Kelas", name: "maxAdmins", inputmode: "numeric", required: false, hint: `Kosongkan untuk ikut bawaan sistem (${overview.defaultLimit}). Saat ini ${cls.admins} admin.` });
  name.setValue(cls.name);
  schoolSel.setValue(cls.school_id);
  limit.setValue(cls.max_admins ?? "");
  const save = h("button", { type: "submit", class: "btn" }, "Simpan kelas");
  const form = h("form", { class: "form", novalidate: true }, name.root, schoolSel.root, limit.root, save);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitForm({
      button: save,
      note,
      fields: { name, schoolId: schoolSel, maxAdmins: limit },
      task: () => svc.saveClass(cls, { name: name.value(), schoolId: schoolSel.value(), maxAdmins: limit.value() }),
      okText: "Kelas disimpan.",
      after: reload,
    });
  });

  const toggle = h("button", { type: "button", class: "btn btn--quiet" }, cls.is_active ? "Nonaktifkan kelas" : "Aktifkan kembali");
  toggle.addEventListener("click", async () => {
    note.clear();
    try {
      await withBusy(toggle, () => svc.setClassActive(cls, !cls.is_active));
      modal.close();
      await reload();
    } catch (err) {
      reportError(err);
      note.fail(toAppError(err).userMessage);
    }
  });

  const danger = !cls.is_active
    ? h(
        "section",
        { class: "danger-zone" },
        h("h3", {}, "Hapus permanen"),
        h("p", { class: "muted" }, "Semua anggota, role, dan isi kelas ikut terhapus. Tidak bisa dibatalkan."),
        h("div", { class: "actions" }, h("button", { type: "button", class: "btn btn--danger", onClick: () => confirmByTyping({ title: `Hapus ${cls.name}`, message: "Kelas dan seluruh isinya dihapus permanen.", expected: cls.name, actionLabel: "Hapus permanen", run: (typed) => svc.removeClass(cls, typed), onDone: () => { modal.close(); reload(); } }) }, "Hapus permanen")),
      )
    : null;

  modal.set([
    kv([["Murid aktif", String(cls.active)], ["Menunggu persetujuan", String(cls.pending)], ["Admin Kelas", `${cls.admins} dari ${cls.limit}`], ["Dibuat", formatDateTime(cls.created_at)]]),
    group("Kode kelas", h("div", { class: "joincode-row" }, code, copy)),
    group("Ubah kelas", form),
    note.node,
    group("Status", toggle),
    danger,
  ]);
  return modal;
}

// ---------------------------------------------------------------- murid

const GENDER = [{ value: "", label: "Belum diisi" }, { value: "L", label: "Laki-laki" }, { value: "P", label: "Perempuan" }];

export function openMemberPanel(member, cls, { reload }) {
  const modal = openModal({ title: member.display_name, subtitle: `${cls.name}${member.is_admin ? ", Admin Kelas" : ""}`, content: [] });
  const note = liveNote();
  const secretHost = h("div", {});

  const roles = (member.roles ?? []).map((r) => h("span", { class: "tag" }, r.name));
  const adminBtn = h("button", { type: "button", class: member.is_admin ? "btn btn--quiet" : "btn" }, member.is_admin ? "Cabut Admin Kelas" : "Angkat jadi Admin Kelas");
  const full = !member.is_admin && cls.admins >= cls.limit;
  adminBtn.disabled = member.status !== "active" || full;
  adminBtn.addEventListener("click", async () => {
    note.clear();
    try {
      await withBusy(adminBtn, () => svc.setAdmin(member, !member.is_admin, cls));
      modal.close();
      await reload();
    } catch (err) {
      reportError(err);
      note.fail(toAppError(err).userMessage);
    }
  });
  const adminHint = member.status !== "active" ? "Murid ini belum aktif di kelas." : full ? `Kelas sudah punya ${cls.admins} dari ${cls.limit} Admin Kelas. Naikkan batas di panel kelas atau cabut admin lain.` : `${cls.admins} dari ${cls.limit} Admin Kelas terpakai.`;

  const f = {
    fullName: field({ label: "Nama lengkap", name: "fullName", maxlength: 80 }),
    username: field({ label: "Username", name: "username", maxlength: 20, autocomplete: "off" }),
    email: field({ label: "Email", name: "email", type: "email", autocomplete: "off" }),
    wa: field({ label: "Nomor WA", name: "wa", inputmode: "tel", autocomplete: "off" }),
    jenisKelamin: field({ label: "Jenis kelamin", name: "jenisKelamin", as: "select", options: GENDER, required: false }),
    password: field({ label: "Kata sandi baru", name: "password", type: "password", autocomplete: "new-password", required: false, hint: "Kosongkan bila tidak diganti. Minimal 8 karakter." }),
  };
  f.fullName.setValue(member.display_name);
  f.username.setValue(member.username);
  f.email.setValue(member.email);
  f.wa.setValue(member.wa ? member.wa.replace(/^62/, "0") : "");
  f.jenisKelamin.setValue(member.jenis_kelamin ?? "");
  const save = h("button", { type: "submit", class: "btn" }, "Simpan akun");
  const form = h("form", { class: "form", novalidate: true }, Object.values(f).map((x) => x.root), save);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitForm({
      button: save,
      note,
      fields: f,
      task: () => svc.saveAccount(member, { fullName: f.fullName.value(), username: f.username.value(), email: f.email.value(), wa: f.wa.value(), jenisKelamin: f.jenisKelamin.value(), password: f.password.value() }),
      okText: "Akun disimpan.",
      after: async () => {
        f.password.setValue("");
        await reload();
      },
    });
  });

  const reset = h("button", { type: "button", class: "btn btn--quiet" }, "Buat kata sandi sementara");
  reset.addEventListener("click", async () => {
    note.clear();
    try {
      const password = await withBusy(reset, () => svc.resetPassword(member));
      secretHost.replaceChildren(secretBox({ title: `Kata sandi sementara untuk ${member.display_name}:`, value: password, hint: "Hanya tampil sekarang. Beri tahu orangnya, lalu minta ia menggantinya di Profil." }));
    } catch (err) {
      reportError(err);
      note.fail(toAppError(err).userMessage);
    }
  });

  modal.set([
    kv([["Status", member.status === "active" ? "Aktif" : member.status === "pending" ? "Menunggu persetujuan" : member.status], ["Role", roles.length ? h("span", { class: "actions" }, roles) : "Murid"], ["NIS", member.nis], ["Nomor absen", member.nomor_absen]]),
    group("Admin Kelas", h("p", { class: "muted" }, adminHint), h("div", { class: "actions" }, adminBtn)),
    group("Data akun", form),
    note.node,
    group("Kata sandi", reset, secretHost),
  ]);
  return modal;
}
