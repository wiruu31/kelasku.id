import * as roleRepo from "../data/role-repository.js";
import { appStore } from "../core/state.js";
import { mergePermissions, topRank } from "./permissions.js";

// Hitung izin dan peringkat pengguna dari role yang dimiliki, lalu simpan ke state.
export async function loadMyAccess() {
  const { member } = appStore.get();
  if (!member || member.status !== "active") {
    appStore.set({ myRoles: [], perms: new Map(), rank: null });
    return;
  }
  const roles = await roleRepo.fetchMemberRoles(member.id);
  appStore.set({ myRoles: roles, perms: mergePermissions(roles), rank: topRank(roles) });
}
