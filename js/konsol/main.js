import { createRouter } from "../core/router.js";
import { isConfigured } from "../core/config.js";
import { reportError } from "../core/errors.js";
import { buildShell } from "./components/shell.js";
import { konsolSkeleton } from "./components/skeleton.js";
import { isSignedIn, konsolStore, logout, restore } from "./services/auth-service.js";
import { onAuthChange } from "./data/console-repository.js";
import { nav } from "./services/nav.js";
import { loginView } from "./views/login-view.js";
import { dashboardView } from "./views/dashboard-view.js";
import { ringkasanView } from "./views/ringkasan-view.js";
import { roleView } from "./views/role-view.js";
import { addClassView } from "./views/add-class-view.js";
import { schoolsView } from "./views/schools-view.js";
import { broadcastView } from "./views/broadcast-view.js";
import { logView } from "./views/log-view.js";
import { settingsView } from "./views/settings-view.js";

const shell = buildShell({
  onLogout: async () => {
    await logout().catch(reportError);
    router.go("/masuk");
  },
});
document.getElementById("app").replaceWith(shell.root);

const privateOnly = () => (isSignedIn() ? true : "/masuk");
const publicOnly = () => (isSignedIn() ? "/dashboard" : true);
const app = (path, title, skeleton, view) => ({ path, title, skeleton, view, guard: privateOnly, layout: "app" });

const routes = [
  { path: "/masuk", title: "Masuk", skeleton: "form", view: loginView, guard: publicOnly, layout: "gate" },
  app("/dashboard", "Dashboard", "tiles", dashboardView),
  app("/ringkasan", "Ringkasan", "table", ringkasanView),
  app("/ringkasan/:schoolId", "Ringkasan", "table", ringkasanView),
  app("/ringkasan/:schoolId/:classId", "Ringkasan", "table", ringkasanView),
  app("/role", "Atur Role", "table", roleView),
  app("/kelas-baru", "Tambah Kelas", "form", addClassView),
  app("/sekolah", "Sekolah", "table", schoolsView),
  app("/siaran", "Siaran Sistem", "form", broadcastView),
  app("/log", "Log", "table", logView),
  app("/pengaturan", "Pengaturan", "form", settingsView),
];

const router = createRouter({
  routes,
  outlet: shell.main,
  fallbackPath: "/dashboard",
  brand: "Admin Kelasku.id",
  makeSkeleton: konsolSkeleton,
  onChange: ({ path, route }) => {
    // Halaman masuk tidak memakai rel dan bilah atas.
    shell.root.classList.toggle("shell--gate", route.layout === "gate");
    shell.setActive(path, route.title);
  },
});
nav.refresh = () => router.refresh();
nav.go = router.go;

konsolStore.subscribe((s) => {
  shell.setUser(s.profile?.full_name);
  shell.setOffline(!s.online);
});
window.addEventListener("online", () => konsolStore.set({ online: true }));
window.addEventListener("offline", () => konsolStore.set({ online: false }));

async function boot() {
  if (isConfigured()) {
    try {
      await restore();
    } catch (err) {
      // Akun bukan Main Admin sudah dikeluarkan oleh restore; galat lain cukup dicatat.
      reportError(err);
    }
    onAuthChange((event) => {
      if (event === "SIGNED_OUT") {
        konsolStore.set({ session: null, profile: null });
        router.go("/masuk");
      }
    });
  }
  if (!location.hash) location.replace(isSignedIn() ? "#/dashboard" : "#/masuk");
  router.start();
}
boot();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("kelasku-sw.js").catch((err) => reportError(err));
  });
}
