import { h } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { emptyState, reportError, toAppError } from "../../core/errors.js";
import { listMembers, listRoles, setMemberRole } from "../../services/role-service.js";
import { removeMember, resetMemberPassword } from "../../services/admin-service.js";
import { can, canAssignRole, isClassAdmin, memberRank, myRank } from "../../services/permissions.js";
import { confirmAction } from "../components/confirm.js";
import { liveNote, roleBadge } from "../components/role-parts.js";
import { secretBox } from "../components/secret-box.js";
import { avatar } from "../components/avatar.js";
import { avatarUrls, clearMemberAvatar } from "../../services/avatar-service.js";

export async function membersView() {
  let [members, roles] = await Promise.all([listMembers(), listRoles()]);
  const roleIndex = new Map(roles.map((r) => [r.id, r]));
  let urls = await avatarUrls(members.map((m) => m.profile?.avatar_path));
  const note = liveNote();
  const secretHost = h("div", {});

  const head = h(
    "header",
    { class: "page-head" },
    h("h1", {}, "Anggota"),
    h("p", {}, `${members.length} anggota aktif di ${appStore.get().member?.class?.name ?? "kelas ini"}.`),
  );
  if (!members.length) return h("div", {}, head, emptyState("Belum ada anggota aktif", "Anggota muncul di sini setelah akunnya disetujui."));

  const list = h("ul", { class: "member-list" });
  const draw = () => {
    list.replaceChildren(...members.map(memberRow));
    head.querySelector("p").textContent = `${members.length} anggota aktif di ${appStore.get().member?.class?.name ?? "kelas ini"}.`;
  };

  function badgesFor(member) {
    const own = (member.member_roles ?? []).map((mr) => roleIndex.get(mr.role_id)).filter(Boolean);
    own.sort((a, b) => a.position - b.position);
    const nodes = [];
    own.filter((r) => r.system_key !== "murid").forEach((r) => nodes.push(roleBadge(r)));
    return nodes.length ? nodes : [h("span", { class: "role-row__meta" }, "Belum ada role")];
  }

  function memberRow(member) {
    const current = appStore.get();
    const isSelf = member.user_id === current.session?.user.id;
    const below = memberRank(member, roleIndex) > myRank(current);
    const badgeHost = h("div", { class: "member__badges" }, badgesFor(member));
    const parts = [];

    const assignable = roles.filter((r) => canAssignRole(current, r, member, roleIndex));
    if (assignable.length) {
      const boxes = assignable.map((role) => {
        const input = h("input", {
          type: "checkbox",
          class: "check__input",
          checked: (member.member_roles ?? []).some((mr) => mr.role_id === role.id),
        });
        input.addEventListener("change", async () => {
          const wanted = input.checked;
          note.clear();
          input.disabled = true;
          try {
            await setMemberRole(member, role, wanted);
            member.member_roles = wanted
              ? [...(member.member_roles ?? []), { role_id: role.id }]
              : (member.member_roles ?? []).filter((mr) => mr.role_id !== role.id);
            badgeHost.replaceChildren(...badgesFor(member));
            note.ok(`${member.display_name}: ${role.name} ${wanted ? "dipasang" : "dilepas"}.`);
          } catch (err) {
            reportError(err);
            input.checked = !wanted;
            note.fail(toAppError(err).userMessage);
          } finally {
            input.disabled = false;
          }
        });
        return h("label", { class: "check" }, input, roleBadge(role));
      });
      parts.push(h("div", { class: "check-group" }, boxes));
    }

    const actions = [];
    if (isClassAdmin(current) && !isSelf && below) {
      actions.push(
        confirmAction({
          label: "Reset kata sandi",
          small: true,
          message: `Buat kata sandi sementara untuk ${member.display_name}? Kata sandi lamanya langsung tidak berlaku.`,
          yesLabel: "Ya, reset",
          run: () => resetMemberPassword(member),
          onDone: (password) => {
            note.clear();
            secretHost.replaceChildren(
              secretBox({ title: `Kata sandi sementara untuk ${member.display_name}:`, value: password, hint: "Hanya tampil sekarang. Beri tahu orangnya, lalu minta ia menggantinya di Profil." }),
            );
          },
          onError: (msg) => note.fail(msg),
        }),
      );
    }
    if (can(current, "akun.approve") && !isSelf && below) {
      actions.push(
        confirmAction({
          label: "Keluarkan dari kelas",
          small: true,
          danger: true,
          message: `Keluarkan ${member.display_name} dari kelas? Ia tidak bisa lagi membuka isi kelas. Admin bisa memulihkannya di halaman Persetujuan.`,
          yesLabel: "Ya, keluarkan",
          run: () => removeMember(member, roleIndex),
          onDone: () => {
            members = members.filter((m) => m.id !== member.id);
            draw();
            note.ok(`${member.display_name} dikeluarkan dari kelas.`);
          },
          onError: (msg) => note.fail(msg),
        }),
      );
    }
    if (isClassAdmin(current) && !isSelf && below && member.profile?.avatar_path) {
      actions.push(
        confirmAction({
          label: "Cabut foto profil",
          small: true,
          message: `Cabut foto profil ${member.display_name}? Foto dihapus dan yang tampil kembali huruf awal.`,
          yesLabel: "Ya, cabut",
          run: () => clearMemberAvatar(member.user_id),
          onDone: () => {
            member.profile = { avatar_path: null };
            draw();
            note.ok(`Foto profil ${member.display_name} dicabut.`);
          },
          onError: (msg) => note.fail(msg),
        }),
      );
    }
    if (actions.length) parts.push(h("div", { class: "actions" }, actions));

    const panel = parts.length
      ? h("details", { class: "member__assign" }, h("summary", { class: "member__summary" }, `Atur ${member.display_name}`), ...parts)
      : null;

    return h(
      "li",
      { class: "note member" },
      h("div", { class: "member__head" }, avatar(member.display_name, urls.get(member.profile?.avatar_path)), h("p", { class: "member__name" }, member.display_name)),
      badgeHost,
      panel,
    );
  }

  const canAny = isClassAdmin(appStore.get()) || can(appStore.get(), "akun.approve") || can(appStore.get(), "role.beri");
  const hint = canAny
    ? "Buka \"Atur\" pada anggota untuk mengubah role, mereset kata sandi, atau mengeluarkannya."
    : "Hanya Admin Kelas atau pemegang izin khusus yang bisa mengubah anggota.";
  draw();
  return h("div", {}, head, h("p", { class: "field__hint" }, hint), note.node, secretHost, list);
}
