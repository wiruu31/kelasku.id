import { h } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { logout } from "../../services/auth-service.js";
import { changeOwnPassword } from "../../services/admin-service.js";
import { reportError, toAppError } from "../../core/errors.js";
import { field, withBusy } from "../components/form.js";
import { liveNote } from "../components/role-parts.js";
import { can, isClassAdmin } from "../../services/permissions.js";
import { saveOwnMember } from "../../services/content-service.js";
import { startTour } from "../components/tour.js";
import { buildSteps } from "../../services/tour-service.js";
import { installCard } from "../components/install-card.js";
import { refreshSession } from "../../services/auth-service.js";
import { roleBadge } from "../components/role-parts.js";
import { avatar } from "../components/avatar.js";
import { avatarUrls, changeMyAvatar, removeMyAvatar } from "../../services/avatar-service.js";
import { notifSettings } from "../components/notif-settings.js";

export async function profileView({ go }) {
  const { profile, member } = appStore.get();
  const exit = h("button", { type: "button", class: "btn btn--quiet" }, "Keluar");
  exit.addEventListener("click", async () => {
    await logout();
    go("/masuk");
  });

  const state = appStore.get();
  const active = state.member?.status === "active";
  const links = [
    active && ["#/anggota", "Anggota kelas"],
    active && isClassAdmin(state) && ["#/panel", "Panel Admin Kelas"],
    active && !isClassAdmin(state) && can(state, "akun.approve") && ["#/persetujuan", "Persetujuan akun"],
    active && !isClassAdmin(state) && can(state, "kode.kelola") && ["#/kelas", "Kode kelas"],
    active && isClassAdmin(state) && ["#/sistem", "Kabar Sistem"],
  ].filter(Boolean);

  const pw = field({ label: "Kata sandi baru", name: "newPassword", type: "password", autocomplete: "new-password", hint: "Minimal 8 karakter." });
  const pw2 = field({ label: "Ulangi kata sandi baru", name: "confirmPassword", type: "password", autocomplete: "new-password" });
  const pwNote = liveNote();
  const pwSubmit = h("button", { type: "submit", class: "btn" }, "Ganti kata sandi");
  const pwForm = h("form", { class: "note form", style: "max-width:520px;margin-top:1.5rem", novalidate: true }, h("h2", {}, "Ganti kata sandi"), pw.root, pw2.root, pwNote.node, pwSubmit);
  pwForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    pwNote.clear();
    pw.setError(null);
    pw2.setError(null);
    try {
      await withBusy(pwSubmit, () => changeOwnPassword(pw.value(), pw2.value()));
      pw.input.value = "";
      pw2.input.value = "";
      pwNote.ok("Kata sandi diganti.");
    } catch (err) {
      reportError(err);
      const e = toAppError(err);
      if (err.fields) pw.setError(e.userMessage);
      else pwNote.fail(e.userMessage);
    }
  });
  // Nomor absen dan NIS: milik anggota sendiri, hanya tampil bila sudah jadi anggota aktif.
  const absen = field({ label: "Nomor absen", name: "nomorAbsen", inputmode: "numeric", maxlength: 20, required: false });
  const nis = field({ label: "NIS", name: "nis", inputmode: "numeric", maxlength: 30, required: false });
  absen.setValue(member?.nomor_absen);
  nis.setValue(member?.nis);
  const dataNote = liveNote();
  const dataSubmit = h("button", { type: "submit", class: "btn" }, "Simpan data kelas");
  const dataForm = h("form", { class: "note form", style: "max-width:520px;margin-top:1.5rem", novalidate: true }, h("h2", {}, "Data di kelas"), h("p", { class: "field__hint" }, "Boleh dikosongkan. Hanya kamu dan pengurus yang bisa mengubahnya."), absen.root, nis.root, dataNote.node, dataSubmit);
  dataForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    dataNote.clear();
    absen.setError(null);
    nis.setError(null);
    try {
      await withBusy(dataSubmit, async () => {
        await saveOwnMember({ nomorAbsen: absen.value(), nis: nis.value() });
        await refreshSession();
      });
      const fresh = appStore.get().member;
      for (const [key, value] of [["nomor", fresh.nomor_absen], ["nis", fresh.nis]]) {
        const dd = document.querySelector(`.facts [data-key="${key}"]`);
        if (dd) dd.textContent = value || "-";
      }
      dataNote.ok("Data kelas disimpan.");
    } catch (err) {
      reportError(err);
      const e = toAppError(err);
      if (err.fields) {
        absen.setError(err.fields.nomorAbsen);
        nis.setError(err.fields.nis);
      } else dataNote.fail(e.userMessage);
    }
  });
  // Foto profil: dikompres di perangkat sampai maksimal 300 KB sebelum diunggah.
  const myPath = profile?.avatar_path ?? null;
  const urls = await avatarUrls([myPath]);
  const photoHost = h("div", { class: "photo-box" });
  const photoNote = liveNote();
  const drawPhoto = (url) => {
    const input = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", class: "file-input" });
    const pick = h("label", { class: "btn btn--quiet btn--small" }, input, url ? "Ganti foto" : "Pilih foto");
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      photoNote.clear();
      pick.setAttribute("aria-busy", "true");
      try {
        const path = await changeMyAvatar(file);
        const fresh = await avatarUrls([path]);
        drawPhoto(fresh.get(path));
        photoNote.ok("Foto profil diperbarui.");
      } catch (err) {
        reportError(err);
        pick.removeAttribute("aria-busy");
        photoNote.fail(toAppError(err).userMessage);
      }
    });
    const actions = h("div", { class: "photo-box__actions" }, pick);
    if (url) {
      const del = h("button", { type: "button", class: "btn btn--quiet btn--small" }, "Hapus foto");
      del.addEventListener("click", async () => {
        photoNote.clear();
        try {
          await withBusy(del, removeMyAvatar);
          drawPhoto(null);
          photoNote.ok("Foto profil dihapus.");
        } catch (err) {
          reportError(err);
          photoNote.fail(toAppError(err).userMessage);
        }
      });
      actions.append(del);
    }
    photoHost.replaceChildren(avatar(profile?.full_name, url, "lg"), actions);
  };
  drawPhoto(urls.get(myPath));

  const replayNote = h("p", { class: "field__hint", role: "status" });
  const replayBtn = h("button", { type: "button", class: "btn btn--quiet" }, "Ulangi tutorial");
  replayBtn.addEventListener("click", () => {
    replayNote.textContent = "";
    if (!startTour(buildSteps(appStore.get()))) replayNote.textContent = "Belum ada langkah tutorial untuk akunmu.";
  });
  const rows = [
    ["Nama lengkap", profile?.full_name],
    ["Username", profile?.username && `@${profile.username}`],
    ["Kelas", member?.class?.name],
    member?.class?.school?.name && ["Sekolah", member.class.school.name],
    member?.status === "active" && ["Nomor absen", member.nomor_absen, "nomor"],
    member?.status === "active" && ["NIS", member.nis, "nis"],
  ].filter(Boolean);
  const myRoles = state.myRoles ?? [];

  return h(
    "div",
    {},
    h("header", { class: "page-head" }, h("h1", {}, "Profil"), h("p", {}, "Data akunmu di kelas ini.")),
    h(
      "section",
      { class: "note", style: "max-width:520px" },
      photoHost,
      photoNote.node,
      h("dl", { class: "facts" }, rows.map(([k, v, key]) => [h("dt", {}, k), h("dd", { dataset: key ? { key } : {} }, v || "-")]).flat()),
      myRoles.length > 0 && h("div", { class: "member__badges" }, myRoles.map(roleBadge)),
      h("nav", { class: "link-list", "aria-label": "Pengelolaan" }, links.map(([href, text]) => h("a", { class: "btn btn--quiet", href }, text))),
      h("div", { class: "actions" }, exit),
    ),
    state.member?.status === "active" && dataForm,
    state.member?.status === "active" && notifSettings(),
    pwForm,
    h("div", { style: "max-width:520px;margin-top:1.5rem" }, installCard("card")),
    h("section", { class: "note", style: "max-width:520px;margin-top:1.5rem" }, h("h2", {}, "Tutorial"), h("p", {}, "Lihat lagi pengenalan singkat fitur Kelasku.id."), replayBtn, replayNote),
  );
}
