import { h } from "../../core/dom.js";
import { reportError, toAppError } from "../../core/errors.js";
import { liveNote } from "./role-parts.js";
import { withBusy } from "./form.js";
import { blocker, disablePush, enablePush, isConfigured, isSubscribed, loadPrefs, setPref, visibleCategories } from "../../services/push-service.js";

const BLOCK_TEXT = {
  ios_pasang_dulu: "Di iPhone atau iPad, pasang aplikasi ke layar utama dulu (Bagikan, lalu Tambah ke Layar Utama), kemudian buka dari sana.",
  tidak_didukung: "Browser ini belum mendukung notifikasi. Coba Chrome di Android atau komputer.",
  ditolak: "Notifikasi diblokir di pengaturan browser. Izinkan situs ini mengirim notifikasi, lalu muat ulang halaman.",
};

const sk = (cls) => h("span", { class: `sk ${cls}` });

// Bagian Notifikasi di Profil. Disembunyikan sepenuhnya bila kunci VAPID belum diisi.
export function notifSettings() {
  if (!isConfigured()) return null;
  const host = h("section", { class: "note", style: "max-width:520px;margin-top:1.5rem", "aria-busy": "true" },
    h("h2", {}, "Notifikasi"), sk("sk--line"), sk("sk--line sk--w60"));
  const note = liveNote();

  async function draw() {
    const why = blocker();
    const subscribed = await isSubscribed();
    const children = [h("h2", {}, "Notifikasi")];

    if (why && why !== "ditolak" && !subscribed) {
      children.push(h("p", {}, BLOCK_TEXT[why] ?? "Notifikasi belum tersedia di perangkat ini."));
    } else if (why === "ditolak") {
      children.push(h("p", {}, BLOCK_TEXT.ditolak));
    } else if (!subscribed) {
      children.push(h("p", {}, "Dapatkan pemberitahuan pengumuman, tugas, voting, dan piket di perangkat ini, bahkan saat aplikasi tertutup."));
      const on = h("button", { type: "button", class: "btn" }, "Aktifkan notifikasi");
      on.addEventListener("click", async () => {
        note.clear();
        try {
          await withBusy(on, enablePush);
          await draw();
          note.ok("Notifikasi aktif di perangkat ini.");
        } catch (err) {
          reportError(err);
          note.fail(toAppError(err).userMessage);
        }
      });
      children.push(on);
    } else {
      const prefs = await loadPrefs();
      children.push(h("p", { class: "field__hint" }, "Aktif di perangkat ini. Pilih jenis pemberitahuan yang kamu mau."));
      const list = h("ul", { class: "notif-list" });
      visibleCategories().forEach((cat) => {
        const input = h("input", { type: "checkbox", class: "check__input", checked: prefs.get(cat.key) });
        input.addEventListener("change", async () => {
          const wanted = input.checked;
          note.clear();
          input.disabled = true;
          try {
            await setPref(cat.key, wanted);
          } catch (err) {
            reportError(err);
            input.checked = !wanted;
            note.fail(toAppError(err).userMessage);
          } finally {
            input.disabled = false;
          }
        });
        list.append(h("li", {}, h("label", { class: "check notif-row" }, input, h("span", {}, h("span", { class: "notif-row__label" }, cat.label), h("span", { class: "field__hint" }, cat.hint)))));
      });
      children.push(list);
      const off = h("button", { type: "button", class: "btn btn--quiet" }, "Matikan di perangkat ini");
      off.addEventListener("click", async () => {
        note.clear();
        try {
          await withBusy(off, disablePush);
          await draw();
          note.ok("Notifikasi dimatikan di perangkat ini.");
        } catch (err) {
          reportError(err);
          note.fail(toAppError(err).userMessage);
        }
      });
      children.push(off);
    }
    children.push(note.node);
    host.replaceChildren(...children);
    host.removeAttribute("aria-busy");
  }

  draw().catch((err) => {
    reportError(err);
    host.replaceChildren(h("h2", {}, "Notifikasi"), h("p", {}, "Pengaturan notifikasi belum bisa dimuat. Muat ulang halaman untuk mencoba lagi."));
    host.removeAttribute("aria-busy");
  });
  return host;
}
