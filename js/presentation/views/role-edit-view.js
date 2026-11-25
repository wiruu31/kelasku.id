import { h } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { AppError, emptyState, reportError, toAppError } from "../../core/errors.js";
import { getRole, saveRole, removeRole, validateRole } from "../../services/role-service.js";
import { PERMISSION_GROUPS, can, canEditPerms, isClassAdmin } from "../../services/permissions.js";
import { field, withBusy } from "../components/form.js";
import { colorPicker, liveNote } from "../components/role-parts.js";

const SCOPE_LABEL = { "": "Tidak", milik: "Milik sendiri", semua: "Semua" };
const TOGGLE_LABEL = { "": "Tidak", semua: "Ya" };

export async function roleEditView({ params, go }) {
  const state = appStore.get();
  const back = h("a", { href: "#/peran" }, "Kembali ke daftar peran");
  const role = await getRole(params.id);
  if (!role || !isClassAdmin(state)) {
    return h("div", {}, emptyState("Role tidak ditemukan", "Role ini tidak ada atau kamu tidak punya akses."), h("p", {}, back));
  }
  if (!canEditPerms(state, role)) {
    return h("div", {}, emptyState("Izin role ini terkunci", "Admin Kelas selalu punya semua izin dan tidak bisa diubah."), h("p", {}, back));
  }

  const name = field({ label: "Nama role", name: "roleName", maxlength: 30 });
  name.input.value = role.name;
  if (role.is_system) name.input.disabled = true;
  const picker = colorPicker(role.color);
  const note = liveNote();

  // Satu select per izin. Pilihan yang melebihi izin milikku dimatikan.
  const current = new Map(role.role_permissions.map((p) => [p.permission, p.scope]));
  const selects = new Map();
  const groups = PERMISSION_GROUPS.map((group) =>
    h(
      "fieldset",
      { class: "fieldset note" },
      h("legend", { class: "fieldset__legend" }, group.title),
      group.items.map((item) => {
        const labels = item.kind === "scope" ? SCOPE_LABEL : TOGGLE_LABEL;
        const canAll = can(state, item.key, "semua");
        const canOwn = can(state, item.key, "milik");
        const select = h(
          "select",
          { class: "input input--select", id: `izin-${item.key}`, disabled: !canOwn },
          Object.entries(labels).map(([value, text]) =>
            h("option", { value, disabled: (value === "semua" && !canAll) || (value === "milik" && !canOwn) }, text),
          ),
        );
        select.value = current.get(item.key) ?? "";
        selects.set(item.key, select);
        return h(
          "div",
          { class: "perm-row" },
          h("label", { class: "perm-row__label", for: select.id }, item.label),
          select,
          !canOwn && h("p", { class: "field__hint perm-row__hint" }, "Kamu tidak punya izin ini."),
        );
      }),
    ),
  );

  const submit = h("button", { type: "submit", class: "btn" }, "Simpan");
  const form = h(
    "form",
    { class: "form", novalidate: true },
    h("section", { class: "note form" }, name.root, picker.root),
    h("p", { class: "field__hint" }, role.is_system ? "Role Murid dipegang semua anggota. Nama dan warnanya tetap, izinnya boleh diatur." : "Izin tambahan di luar izin dasar Murid."),
    ...groups,
    note.node,
    submit,
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.clear();
    name.setError(null);
    const problems = role.is_system ? {} : validateRole({ name: name.value(), color: picker.value() });
    if (problems.name) return name.setError(problems.name);
    const grants = new Map();
    for (const [key, select] of selects) if (select.value) grants.set(key, select.value);
    try {
      const fresh = await withBusy(submit, () => saveRole(role, { name: name.value(), color: picker.value(), grants }));
      Object.assign(role, fresh);
      note.ok("Tersimpan.");
    } catch (err) {
      reportError(err);
      const e = toAppError(err);
      if (e.code === "23505") name.setError("Nama role itu sudah ada di kelas ini.");
      else note.fail(e.userMessage);
    }
  });

  // Hapus dua langkah supaya tidak terpencet tidak sengaja.
  const askDelete = h("button", { type: "button", class: "btn btn--quiet" }, "Hapus role");
  const confirmBox = h(
    "div",
    { class: "confirm", hidden: true, role: "alertdialog", "aria-label": "Konfirmasi hapus role" },
    h("p", {}, "Hapus role ini? Anggota yang memilikinya akan kehilangan role dan izinnya. Ini tidak bisa dibatalkan."),
    h("div", { class: "actions" }),
  );
  const yes = h("button", { type: "button", class: "btn btn--danger" }, "Ya, hapus");
  const no = h("button", { type: "button", class: "btn btn--quiet" }, "Batal");
  confirmBox.querySelector(".actions").append(yes, no);
  askDelete.addEventListener("click", () => {
    confirmBox.hidden = false;
    askDelete.hidden = true;
    no.focus();
  });
  no.addEventListener("click", () => {
    confirmBox.hidden = true;
    askDelete.hidden = false;
    askDelete.focus();
  });
  yes.addEventListener("click", async () => {
    try {
      await withBusy(yes, () => removeRole(role));
      go("/peran");
    } catch (err) {
      reportError(err);
      note.fail(toAppError(err).userMessage);
      confirmBox.hidden = true;
      askDelete.hidden = false;
    }
  });

  return h(
    "div",
    {},
    h("header", { class: "page-head" }, h("h1", {}, `Atur ${role.name}`), h("p", {}, back)),
    form,
    !role.is_system && h("section", { class: "danger-zone" }, askDelete, confirmBox),
  );
}
