import { h, icon } from "../../core/dom.js";
import { appStore } from "../../core/state.js";
import { emptyState } from "../../core/errors.js";
import { can, canOnItem } from "../../services/permissions.js";
import { confirmAction } from "./confirm.js";
import { entityForm } from "./entity-form.js";
import { liveNote } from "./role-parts.js";

// Halaman daftar dengan tambah, ubah, hapus. Satu kerangka untuk pengumuman, jadwal, dan tugas.
// Tombol hanya ditampilkan sesuai izin; keputusan akhirnya tetap di RLS database.
export function crudPage({ module, title, description, fields, load, create, edit, remove, toForm, renderItem, layout, createLabel, emptyTitle, emptyText, noun }) {
  return async () => {
    const head = h("header", { class: "page-head" }, h("h1", {}, title), h("p", {}, description));
    const note = liveNote();
    const host = h("div", { class: "stack" });
    let items = await load();

    const reload = async () => {
      items = await load();
      draw();
    };

    function card(item, index) {
      const state = appStore.get();
      const body = h("div", { class: "entry__body" }, renderItem(item));
      const article = h("article", { class: "note entry" }, body);
      const actions = h("div", { class: "actions entry__actions" });
      if (canOnItem(state, module, "ubah", item)) {
        const btn = h("button", { type: "button", class: "btn btn--quiet btn--small", "aria-label": `Ubah ${noun}: ${item.title ?? item.subject}` }, "Ubah");
        btn.addEventListener("click", () => openEdit(article, item));
        actions.append(btn);
      }
      if (canOnItem(state, module, "hapus", item)) {
        actions.append(
          confirmAction({
            label: "Hapus",
            message: `Hapus ${noun} ini? Tindakan ini tidak bisa dibatalkan.`,
            yesLabel: "Ya, hapus",
            danger: true,
            small: true,
            run: () => remove(item.id),
            onDone: () => {
              items = items.filter((x) => x.id !== item.id);
              draw();
              note.ok(`${cap(noun)} dihapus.`);
            },
            onError: (msg) => note.fail(msg),
          }),
        );
      }
      if (actions.children.length) article.append(actions);
      return article;
    }

    function openEdit(article, item) {
      note.clear();
      const form = entityForm({
        fields,
        initial: toForm(item),
        submitLabel: "Simpan perubahan",
        onCancel: () => draw(),
        onSubmit: async (values) => {
          note.clear();
          await edit(item.id, values);
          await reload();
          note.ok(`${cap(noun)} diperbarui.`);
        },
      });
      article.replaceChildren(h("h2", { class: "note__label" }, `Ubah ${noun}`), form.root);
      form.focus();
    }

    function draw() {
      host.replaceChildren();
      if (!items.length) {
        host.append(emptyState(emptyTitle, emptyText));
        return;
      }
      host.append(...[].concat(layout ? layout(items, card) : items.map(card)).filter(Boolean));
    }

    const children = [head];
    if (can(appStore.get(), `${module}.tambah`)) {
      const form = entityForm({
        fields,
        initial: {},
        submitLabel: createLabel,
        resetOnDone: true,
        onSubmit: async (values) => {
          note.clear();
          await create(values);
          await reload();
          details.open = false;
          note.ok(`${cap(noun)} ditambahkan.`);
        },
      });
      const summary = h("summary", { class: "btn" }, h("span", { class: "btn__icon" }, icon(["M12 5v14", "M5 12h14"])), createLabel);
      var details = h("details", { class: "create-box" }, summary, h("div", { class: "note create-box__form" }, form.root));
      details.addEventListener("toggle", () => details.open && form.focus());
      children.push(details);
    }
    children.push(note.node, host);
    draw();
    return h("div", {}, children);
  };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
