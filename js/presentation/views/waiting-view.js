import { h } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { reportError, toAppError } from "../../core/errors.js";
import { logout, refreshSession, canEnterApp } from "../../services/auth-service.js";
import { withBusy } from "../components/form.js";
import { authPage } from "../components/auth-page.js";

const COPY = {
  pending: {
    title: "Menunggu persetujuan",
    text: (cls) =>
      `Akunmu sudah masuk daftar ${cls}. Admin kelas akan mengeceknya. Kamu boleh menutup halaman ini dan kembali nanti.`,
  },
  rejected: {
    title: "Pendaftaran ditolak",
    text: (cls) => `Admin ${cls} menolak pendaftaranmu. Hubungi admin kelas kalau menurutmu ini keliru.`,
  },
  removed: {
    title: "Kamu sudah dikeluarkan dari kelas",
    text: (cls) => `Akunmu tidak lagi menjadi anggota ${cls}. Hubungi admin kelas untuk bergabung lagi.`,
  },
  none: {
    title: "Akunmu belum terhubung ke kelas",
    text: () => "Hubungi admin kelasmu atau Main Admin untuk dihubungkan.",
  },
};

export function waitingView({ go }) {
  const { member } = appStore.get();
  const kind = member?.status ?? "none";
  const copy = COPY[kind] ?? COPY.none;
  const className = member?.class?.name ?? "kelas";

  const status = h("p", { class: "form-message", role: "status", hidden: true });
  const check = h("button", { type: "button", class: "btn" }, "Cek status");
  const exit = h("button", { type: "button", class: "btn btn--quiet" }, "Keluar");

  check.addEventListener("click", async () => {
    status.hidden = true;
    try {
      await withBusy(check, refreshSession);
      if (canEnterApp(appStore.get())) return go("/mading");
      status.textContent = "Belum ada perubahan. Coba lagi nanti.";
      status.hidden = false;
    } catch (err) {
      reportError(err);
      status.textContent = toAppError(err).userMessage;
      status.hidden = false;
    }
  });
  exit.addEventListener("click", async () => {
    await logout();
    go("/masuk");
  });

  return authPage({
    title: copy.title,
    lead: copy.text(className),
    body: h("div", {}, status, h("div", { class: "actions" }, check, exit)),
  });
}
