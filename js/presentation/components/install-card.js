import { h } from "../../core/dom.js";
import { bannerDismissed, dismissBanner, installState, onInstallChange, promptInstall } from "../../services/install-service.js";

const IOS_STEPS = [
  "Buka Kelasku.id di Safari.",
  "Ketuk tombol Bagikan (kotak dengan panah ke atas).",
  "Pilih Tambah ke Layar Utama, lalu Tambah.",
];

// variant "card": bagian tetap di Profil. variant "banner": ajakan di Mading yang bisa ditutup.
// Tidak tampil sama sekali bila aplikasi sudah terpasang.
export function installCard(variant = "card") {
  const root = h("section", { class: `install install--${variant}`, "aria-label": "Pasang aplikasi" });
  const note = h("p", { class: "install__note", role: "status" });

  const draw = (state) => {
    root.replaceChildren();
    root.hidden = true;
    if (state === "installed") return;
    if (variant === "banner" && (state === "manual" || bannerDismissed())) return;
    root.hidden = false;
    root.append(h("h2", { class: "note__label" }, "Pasang di ponselmu"), h("p", {}, "Buka Kelasku.id langsung dari layar utama, tanpa mengetik alamat."));
    if (state === "prompt") {
      const btn = h("button", { type: "button", class: "btn" }, "Pasang aplikasi");
      btn.addEventListener("click", async () => {
        const outcome = await promptInstall();
        if (outcome !== "accepted") note.textContent = "Pemasangan dibatalkan. Kamu bisa mencobanya lagi kapan saja.";
      });
      root.append(btn);
    } else if (state === "ios") {
      root.append(h("ol", { class: "install__steps" }, IOS_STEPS.map((t) => h("li", {}, t))));
    } else {
      root.append(h("p", {}, "Di browsermu, buka menu lalu pilih Instal aplikasi atau Tambahkan ke layar utama."));
    }
    if (variant === "banner") {
      const later = h("button", { type: "button", class: "btn btn--quiet" }, "Nanti saja");
      later.addEventListener("click", () => {
        dismissBanner();
        root.hidden = true;
      });
      root.append(later);
    }
    root.append(note);
  };

  draw(installState());
  const off = onInstallChange((state) => {
    if (!root.isConnected) return off();
    draw(state);
  });
  return root;
}
