import { h } from "../../core/dom.js";
import { isConfigured } from "../../core/config.js";
import { reportError, toAppError } from "../../core/errors.js";
import { appStore } from "../../core/state.js";
import { homePath, login } from "../../services/auth-service.js";
import { field, formMessage, withBusy } from "../components/form.js";
import { authPage } from "../components/auth-page.js";
import { notConnectedState } from "./pending-module.js";

export function loginView({ go }) {
  if (!isConfigured()) return authPage({ title: "Masuk", body: notConnectedState() });

  const identity = field({
    label: "Nama lengkap, username, email, atau nomor WA",
    name: "identifier",
    autocomplete: "username",
  });
  const password = field({ label: "Kata sandi", name: "password", type: "password", autocomplete: "current-password" });
  const message = formMessage();
  const submit = h("button", { type: "submit", class: "btn btn--block" }, "Masuk");

  const form = h(
    "form",
    { class: "form", novalidate: true },
    identity.root,
    password.root,
    message.node,
    submit,
    h("p", { class: "form__aside" }, "Lupa kata sandi? Minta admin kelasmu untuk mereset."),
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hide();
    identity.setError(null);
    password.setError(null);
    if (!identity.value().trim()) return identity.setError("Isi salah satu identitasmu.");
    if (!password.value()) return password.setError("Isi kata sandi.");
    try {
      await withBusy(submit, () => login(identity.value(), password.value()));
      go(homePath(appStore.get()));
    } catch (err) {
      reportError(err);
      message.show(toAppError(err).userMessage);
    }
  });

  return authPage({
    title: "Masuk ke kelasmu",
    lead: "Pakai nama lengkap, username, email, atau nomor WA yang kamu daftarkan.",
    body: form,
    footer: h("p", {}, "Belum punya akun? ", h("a", { href: "#/daftar" }, "Daftar dengan kode kelas")),
  });
}
