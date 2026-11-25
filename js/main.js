import { createRouter } from "./core/router.js";
import { appStore } from "./core/state.js";
import { isConfigured } from "./core/config.js";
import { reportError } from "./core/errors.js";
import { buildShell } from "./presentation/components/shell.js";
import { madingView } from "./presentation/views/mading-view.js";
import { announcementsView } from "./presentation/views/announcements-view.js";
import { scheduleView } from "./presentation/views/schedule-view.js";
import { tasksView } from "./presentation/views/tasks-view.js";
import { logView } from "./presentation/views/log-view.js";
import { systemNewsView } from "./presentation/views/system-news-view.js";
import { loginView } from "./presentation/views/login-view.js";
import { registerView } from "./presentation/views/register-view.js";
import { waitingView } from "./presentation/views/waiting-view.js";
import { rolesView } from "./presentation/views/roles-view.js";
import { roleEditView } from "./presentation/views/role-edit-view.js";
import { approvalsView } from "./presentation/views/approvals-view.js";
import { classSettingsView } from "./presentation/views/class-settings-view.js";
import { membersView } from "./presentation/views/members-view.js";
import { profileView } from "./presentation/views/profile-view.js";
import { menuView } from "./presentation/views/menu-view.js";
import { piketView } from "./presentation/views/piket-view.js";
import { votingView } from "./presentation/views/voting-view.js";
import { kasView } from "./presentation/views/kas-view.js";
import { organigramView } from "./presentation/views/organigram-view.js";
import { panelView } from "./presentation/views/panel-view.js";
import { withPanel } from "./presentation/components/panel-tabs.js";
import { canEnterApp, clearSession, homePath, refreshSession } from "./services/auth-service.js";
import { onAuthChange } from "./data/auth-repository.js";
import { initInstall } from "./services/install-service.js";
import { syncPush } from "./services/push-service.js";

initInstall();

const shell = buildShell();
document.getElementById("app").replaceWith(shell.root);

// Penjaga rute: publik hanya untuk yang belum masuk; privat untuk anggota aktif.
const publicOnly = () => (canEnterApp(appStore.get()) ? homePath(appStore.get()) : appStore.get().session ? "/menunggu" : true);
const privateOnly = () => {
  const state = appStore.get();
  if (!state.session) return "/masuk";
  return canEnterApp(state) ? true : "/menunggu";
};
const waitingOnly = () => {
  const state = appStore.get();
  if (!state.session) return "/masuk";
  return canEnterApp(state) ? homePath(state) : true;
};

const app = (path, title, skeleton, view) => ({ path, title, skeleton, view, guard: privateOnly, layout: "app" });
const routes = [
  { path: "/masuk", title: "Masuk", skeleton: "form", view: loginView, guard: publicOnly, layout: "auth" },
  { path: "/daftar", title: "Daftar", skeleton: "form", view: registerView, guard: publicOnly, layout: "auth" },
  { path: "/menunggu", title: "Menunggu", skeleton: "form", view: waitingView, guard: waitingOnly, layout: "auth" },
  app("/mading", "Mading", "board", madingView),
  app("/pengumuman", "Pengumuman", "list", announcementsView),
  app("/jadwal", "Jadwal", "list", scheduleView),
  app("/tugas", "Tugas", "list", tasksView),
  app("/menu", "Menu", "list", menuView),
  app("/piket", "Piket", "board", piketView),
  app("/voting", "Voting", "list", votingView),
  app("/kas", "Kas kelas", "list", kasView),
  app("/organigram", "Organigram", "board", organigramView),
  app("/panel", "Panel Admin Kelas", "board", panelView),
  app("/log", "Log aktivitas", "list", withPanel("log", logView)),
  app("/sistem", "Kabar Sistem", "board", systemNewsView),
  app("/anggota", "Anggota", "list", withPanel("anggota", membersView)),
  app("/peran", "Peran", "list", withPanel("peran", rolesView)),
  app("/peran/:id", "Atur role", "form", withPanel("peran", roleEditView)),
  app("/persetujuan", "Persetujuan", "list", withPanel("persetujuan", approvalsView)),
  app("/kelas", "Kode kelas", "form", withPanel("kode", classSettingsView)),
  app("/profil", "Profil", "profile", profileView),
];

const router = createRouter({
  routes,
  outlet: shell.main,
  fallbackPath: "/mading",
  onChange: ({ path, route }) => {
    shell.setLayout(route.layout);
    shell.setActive(path);
  },
});

appStore.subscribe((s) => {
  shell.setOffline(!s.online);
  shell.syncNav(s);
  shell.setIdentity(s);
});
window.addEventListener("online", () => appStore.set({ online: true }));
window.addEventListener("offline", () => appStore.set({ online: false }));
shell.setOffline(!appStore.get().online);

async function boot() {
  if (isConfigured()) {
    try {
      await refreshSession();
      if (appStore.get().session) syncPush();
      // Keluar dari tab lain atau sesi kedaluwarsa: kembali ke halaman masuk.
      onAuthChange(async (event) => {
        if (event === "SIGNED_OUT") {
          clearSession();
          router.go("/masuk");
        }
      });
    } catch (err) {
      reportError(err);
    }
  }
  shell.syncNav(appStore.get());
  shell.setIdentity(appStore.get());
  if (!location.hash) location.replace(appStore.get().session ? `#${homePath(appStore.get())}` : "#/masuk");
  router.start();
}
boot();

// Service worker hanya di http(s); file:// dan localhost tanpa dukungan dilewati diam-diam.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("kelasku-sw.js").catch((err) => reportError(err));
  });
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "push-resubscribe" && appStore.get().session) syncPush();
  });
}
