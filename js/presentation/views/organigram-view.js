import { h } from "../../core/dom.js";
import { emptyState } from "../../core/errors.js";
import { fetchActiveMembers } from "../../data/role-repository.js";
import { appStore } from "../../core/state.js";
import { listRoles } from "../../services/role-service.js";
import { avatarUrls } from "../../services/avatar-service.js";
import { avatar } from "../components/avatar.js";

// Semua role kustom di kelas, urut peringkat. Murid dan Admin Kelas tidak ditampilkan.
export async function organigramView() {
  const classId = appStore.get().member?.class?.id;
  const [roles, members] = await Promise.all([listRoles(), fetchActiveMembers(classId)]);
  const custom = roles.filter((r) => !r.is_system).sort((a, b) => a.position - b.position);
  const head = h("header", { class: "page-head" }, h("h1", {}, "Organigram"), h("p", {}, "Susunan pengurus kelas, dari peringkat tertinggi."));
  if (!custom.length) return h("div", {}, head, emptyState("Belum ada role pengurus", "Role seperti ketua atau bendahara akan tampil di sini setelah dibuat Admin Kelas."));

  const holders = (role) => members.filter((m) => (m.member_roles ?? []).some((mr) => mr.role_id === role.id));
  const urls = await avatarUrls(members.map((m) => m.profile?.avatar_path));
  const cards = custom.map((role) => {
    const people = holders(role);
    return h(
      "section",
      { class: "org-card", style: `border-top-color:${role.color}`, "aria-labelledby": `org-${role.id}` },
      h("h2", { class: "org-card__title", id: `org-${role.id}` }, role.name),
      people.length
        ? h("ul", { class: "org-card__people" }, people.map((m) => h("li", {}, avatar(m.display_name, urls.get(m.profile?.avatar_path), "sm"), m.display_name)))
        : h("p", { class: "org-card__none" }, "Belum dipegang siapa pun."),
    );
  });
  return h("div", {}, head, h("div", { class: "org" }, cards));
}
