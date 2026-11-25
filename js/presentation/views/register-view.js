import { h } from "../../core/dom.js";
import { isConfigured } from "../../core/config.js";
import { reportError, toAppError } from "../../core/errors.js";
import { register, validateRegister } from "../../services/auth-service.js";
import { field, formMessage, withBusy } from "../components/form.js";
import { authPage } from "../components/auth-page.js";
import { notConnectedState } from "./pending-module.js";

export function registerView({ go }) {
  if (!isConfigured()) return authPage({ title: "Daftar", body: notConnectedState() });

  const fields = {
    fullName: field({ label: "Nama lengkap", name: "fullName", autocomplete: "name", maxlength: 80 }),
    username: field({
      label: "Username",
      name: "username",
      autocomplete: "username",
      maxlength: 20,
      hint: "Huruf kecil, angka, atau garis bawah. 3 sampai 20 karakter.",
    }),
    email: field({
      label: "Email",
      name: "email",
      type: "email",
      autocomplete: "email",
      hint: "Tidak perlu diverifikasi. Dipakai untuk masuk.",
    }),
    wa: field({
      label: "Nomor WA",
      name: "wa",
      type: "tel",
      autocomplete: "tel",
      inputmode: "tel",
      hint: "Contoh: 081234567890",
    }),
    password: field({
      label: "Kata sandi",
      name: "password",
      type: "password",
      autocomplete: "new-password",
      hint: "Minimal 8 karakter.",
    }),
    joinCode: field({
      label: "Kode kelas",
      name: "joinCode",
      autocomplete: "off",
      maxlength: 12,
      hint: "Minta ke ketua atau admin kelasmu.",
    }),
  };
  fields.joinCode.input.classList.add("input--code");

  const message = formMessage();
  const submit = h("button", { type: "submit", class: "btn btn--block" }, "Daftar");
  const form = h(
    "form",
    { class: "form", novalidate: true },
    ...Object.values(fields).map((f) => f.root),
    message.node,
    submit,
  );

  const showErrors = (errors) => {
    let first = null;
    for (const [name, f] of Object.entries(fields)) {
      f.setError(errors[name]);
      if (errors[name] && !first) first = f;
    }
    first?.input.focus();
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hide();
    const values = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.value()]));
    const local = validateRegister(values);
    showErrors(local);
    if (Object.keys(local).length) return;
    try {
      await withBusy(submit, () => register(values));
      go("/menunggu");
    } catch (err) {
      reportError(err);
      const e = toAppError(err);
      if (err.field && fields[err.field]) showErrors({ [err.field]: e.userMessage });
      else message.show(e.userMessage);
    }
  });

  return authPage({
    title: "Daftar ke kelas",
    lead: "Setelah daftar, admin kelas akan menyetujui akunmu sebelum kamu bisa masuk.",
    body: form,
    footer: h("p", {}, "Sudah punya akun? ", h("a", { href: "#/masuk" }, "Masuk")),
  });
}
