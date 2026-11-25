import { h } from "../../core/dom.js";
import { reportError, toAppError } from "../../core/errors.js";
import { field, formMessage, withBusy } from "../../presentation/components/form.js";
import { brandMark } from "../components/icons.js";
import { login } from "../services/auth-service.js";

export function loginView({ go }) {
  const identifier = field({ label: "Username, email, atau nomor WA", name: "identifier", autocomplete: "username" });
  const password = field({ label: "Kata sandi", name: "password", type: "password", autocomplete: "current-password" });
  const message = formMessage();
  const submit = h("button", { type: "submit", class: "btn" }, "Masuk ke Konsol");
  const form = h("form", { class: "form", novalidate: true }, identifier.root, password.root, message.node, submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hide();
    try {
      await withBusy(submit, () => login(identifier.value(), password.value()));
      go("/dashboard");
    } catch (err) {
      reportError(err);
      password.input.value = "";
      message.show(toAppError(err).userMessage);
    }
  });
  return h(
    "div",
    { class: "gate" },
    h(
      "section",
      { class: "gate__card" },
      h("div", { class: "gate__brand" }, brandMark(), h("div", {}, h("h1", {}, "Admin Kelasku.id"), h("p", { class: "lead" }, "Konsol Main Admin"))),
      h("p", { class: "lead" }, "Khusus Main Admin. Akun murid dan Admin Kelas masuk lewat aplikasi Kelasku.id."),
      form,
    ),
  );
}
