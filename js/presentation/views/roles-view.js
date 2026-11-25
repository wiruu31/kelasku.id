import { h } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { emptyState, reportError, toAppError } from "../../core/errors.js";
import { listRoles, createRole, moveRole, validateRole } from "../../services/role-service.js";
import { canEditPerms, canManageRole, isClassAdmin } from "../../services/permissions.js";
import { field, withBusy } from "../components/form.js";
import { colorPicker, liveNote, roleBadge } from "../components/role-parts.js";

export async function rolesView() {
  const state = appStore.get();
  const head = h(
    "header",
    { class: "page-head" },
    h("h1", {}, "Peran"),
    h("p", {}, "Atur siapa boleh melakukan apa di kelas. Urutan dari atas ke bawah adalah peringkat. Hanya Admin Kelas yang bisa membuat dan mengubah role."),
  );
  if (!isClassAdmin(state)) {
    return h("div", {}, head, emptyState("Kamu tidak punya akses", "Halaman ini khusus Admin Kelas."));
  }

  let roles = await listRoles();
  const note = liveNote();
  const listHost = h("div", { class: "stack" });

  async function reload() {
    roles = await listRoles();
    drawList();
  }

  async function shift(role, direction) {
    note.clear();
    try {
      await moveRole(roles, role, direction);
      await reload();
      note.ok(`${role.name} dipindah ${direction < 0 ? "naik" : "turun"}.`);
    } catch (err) {
      reportError(err);
      note.fail(toAppError(err).userMessage);
    }
  }

  function drawList() {
    listHost.replaceChildren();
    if (!roles.length) {
      listHost.append(emptyState("Belum ada role", "Buat role pertama di atas, misalnya Ketua kelas atau Sekretaris."));
      return;
    }
    const current = appStore.get();
    const sorted = [...roles].sort((a, b) => a.position - b.position);
    sorted.forEach((role, i) => {
      const manageable = canEditPerms(current, role);
      const movable = canManageRole(current, role);
      const above = sorted[i - 1];
      const below = sorted[i + 1];
      const count = role.role_permissions.length;
      const label = role.is_system ? "Sistem" : null;
      const moveBtn = (dir, neighbor, label) =>
        h(
          "button",
          {
            type: "button",
            class: "btn btn--quiet btn--small",
            disabled: !movable || !neighbor || !canManageRole(current, neighbor),
            "aria-label": `${label} ${role.name}`,
            onClick: () => shift(role, dir),
          },
          dir < 0 ? "Naik" : "Turun",
        );
      listHost.append(
        h(
          "article",
          { class: "note role-row" },
          h(
            "div",
            { class: "role-row__main" },
            roleBadge(role),
            label && h("span", { class: "badge badge--muted" }, label),
            h("span", { class: "role-row__meta" }, role.system_key === "admin_kelas" ? "Semua izin" : count ? `${count} izin` : "Belum ada izin"),
          ),
          h(
            "div",
            { class: "role-row__actions" },
            moveBtn(-1, above, "Naikkan"),
            moveBtn(1, below, "Turunkan"),
            manageable
              ? h("a", { class: "btn btn--small", href: `#/peran/${role.id}`, "aria-label": `Atur ${role.name}` }, "Atur")
              : h("span", { class: "role-row__meta" }, "Izin terkunci"),
          ),
        ),
      );
    });
  }

  const name = field({ label: "Nama role baru", name: "roleName", maxlength: 30, hint: "Contoh: Ketua kelas, Sekretaris, Bendahara." });
  const picker = colorPicker();
  const submit = h("button", { type: "submit", class: "btn" }, "Tambah role");
  const form = h("form", { class: "note form", novalidate: true }, h("h2", {}, "Role baru"), name.root, picker.root, submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    note.clear();
    name.setError(null);
    const problems = validateRole({ name: name.value(), color: picker.value() });
    if (problems.name) return name.setError(problems.name);
    try {
      const role = await withBusy(submit, () => createRole({ name: name.value(), color: picker.value() }, roles));
      name.input.value = "";
      await reload();
      note.ok(`Role ${role.name} dibuat.`);
    } catch (err) {
      reportError(err);
      const e = toAppError(err);
      if (e.code === "23505") name.setError("Nama role itu sudah ada di kelas ini.");
      else note.fail(e.userMessage);
    }
  });

  drawList();
  return h("div", {}, head, form, note.node, h("h2", { class: "section-title" }, "Daftar role"), listHost);
}
