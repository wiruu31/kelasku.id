import { h } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { DAY_NAMES, todayDayNumber } from "../../core/format.js";
import { reportError, toAppError } from "../../core/errors.js";
import { can } from "../../services/permissions.js";
import * as svc from "../../services/piket-service.js";
import { avatarUrls } from "../../services/avatar-service.js";
import { avatar } from "../components/avatar.js";
import { liveNote } from "../components/role-parts.js";
import { withBusy } from "../components/form.js";

export async function piketView() {
  const state = appStore.get();
  const canAdd = can(state, "piket.tambah");
  const canRemove = can(state, "piket.hapus");
  const note = liveNote();
  const host = h("div", { class: "piket-grid" });
  let byDay = await svc.loadPiket();
  const members = canAdd ? await svc.activeMembersForPiket() : [];
  let urls = await avatarUrls([...byDay.values()].flat().map((p) => p.avatarPath));

  async function reload() {
    byDay = await svc.loadPiket();
    urls = await avatarUrls([...byDay.values()].flat().map((p) => p.avatarPath));
    draw();
  }

  function dayCard(day) {
    const people = byDay.get(day) ?? [];
    const taken = new Set(people.map((p) => p.memberId));
    const list = h(
      "ul",
      { class: "chips" },
      people.map((p) => {
        const remove =
          canRemove &&
          h("button", { type: "button", class: "chip__remove", "aria-label": `Cabut ${p.name} dari piket ${DAY_NAMES[day - 1]}` }, "×");
        remove?.addEventListener("click", async () => {
          note.clear();
          try {
            await withBusy(remove, () => svc.removePiket(p.id));
            await reload();
            note.ok(`${p.name} dicabut dari piket ${DAY_NAMES[day - 1]}.`);
          } catch (err) {
            reportError(err);
            note.fail(toAppError(err).userMessage);
          }
        });
        return h("li", { class: "chip" }, avatar(p.name, urls.get(p.avatarPath), "sm"), p.name, remove);
      }),
    );
    const card = h(
      "section",
      { class: `piket-day${day === todayDayNumber() ? " piket-day--today" : ""}`, "aria-labelledby": `piket-h-${day}` },
      h("h2", { class: "piket-day__title", id: `piket-h-${day}` }, DAY_NAMES[day - 1], day === todayDayNumber() && h("span", { class: "badge" }, "Hari ini")),
      people.length ? list : h("p", { class: "note__none" }, "Belum ada yang bertugas."),
    );
    if (canAdd) {
      const options = members.filter((m) => !taken.has(m.id));
      if (options.length) {
        const select = h(
          "select",
          { class: "input input--select", "aria-label": `Pilih murid untuk piket ${DAY_NAMES[day - 1]}` },
          h("option", { value: "" }, "Pilih murid"),
          options.map((m) => h("option", { value: m.id }, m.display_name)),
        );
        const add = h("button", { type: "button", class: "btn btn--small" }, "Tambah");
        add.addEventListener("click", async () => {
          note.clear();
          if (!select.value) return note.fail("Pilih murid dulu.");
          try {
            await withBusy(add, () => svc.addPiket(day, select.value));
            await reload();
            note.ok(`Jadwal piket ${DAY_NAMES[day - 1]} diperbarui.`);
          } catch (err) {
            reportError(err);
            note.fail(toAppError(err).userMessage);
          }
        });
        card.append(h("div", { class: "piket-add" }, select, add));
      }
    }
    return card;
  }

  function draw() {
    host.replaceChildren(...[1, 2, 3, 4, 5, 6, 7].map(dayCard));
  }
  draw();

  return h(
    "div",
    {},
    h("header", { class: "page-head" }, h("h1", {}, "Piket"), h("p", {}, "Jadwal piket kelas per hari. Pengurus mengaturnya secara manual.")),
    note.node,
    host,
  );
}
