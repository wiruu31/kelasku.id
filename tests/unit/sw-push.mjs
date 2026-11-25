// Uji penangan push dan klik notifikasi di kelasku-sw.js tanpa browser: service worker dijalankan di vm dengan self tiruan.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../kelasku-sw.js", import.meta.url), "utf8");
let pass = 0, failN = 0;
const check = (name, cond) => { cond ? pass++ : failN++; console.log(`${cond ? "LULUS" : "GAGAL"}  ${name}`); };

function boot(clientsList = []) {
  const handlers = {};
  const shown = [], opened = [], navigated = [], focused = [];
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    registration: { scope: "https://kelas.contoh.id/", showNotification: async (title, opts) => { shown.push({ title, opts }); } },
    clients: {
      matchAll: async () => clientsList.map((c) => ({ url: c, navigate: async (u) => { navigated.push(u); return { focus: async () => focused.push(u) }; }, focus: async () => focused.push(c) })),
      openWindow: async (u) => { opened.push(u); },
      claim: async () => {},
    },
    skipWaiting: async () => {},
    location: { origin: "https://kelas.contoh.id" },
  };
  vm.runInNewContext(src, { self, caches: {}, URL, fetch: async () => {}, Response, Promise, JSON, String, console });
  return { handlers, shown, opened, navigated, focused };
}
const run = async (fn, event) => { let p; await fn({ ...event, waitUntil: (x) => { p = x; } }); await p; };

{
  const sw = boot();
  await run(sw.handlers.push, { data: { json: () => ({ title: "Tugas baru", body: "Matematika: Latihan", url: "#/tugas", category: "tugas", id: 7 }), text: () => "" } });
  check("push: notifikasi tampil dengan judul dan isi", sw.shown[0]?.title === "Tugas baru" && sw.shown[0].opts.body === "Matematika: Latihan");
  check("push: tujuan tersimpan di data notifikasi", sw.shown[0].opts.data.url === "#/tugas");
  check("push: ikon dan tag terisi", sw.shown[0].opts.icon.endsWith(".png") && sw.shown[0].opts.tag === "tugas-7");
}
{
  const sw = boot();
  await run(sw.handlers.push, { data: { json: () => { throw new Error("bukan json"); }, text: () => "halo" } });
  check("push: isi bukan JSON tetap tampil", sw.shown[0]?.title === "Kelasku.id" && sw.shown[0].opts.body === "halo");
}
{
  const sw = boot();
  await run(sw.handlers.push, { data: null });
  check("push: tanpa isi tetap tampil dengan judul bawaan", sw.shown[0]?.title === "Kelasku.id");
}
{
  const sw = boot();
  let closed = false;
  await run(sw.handlers.notificationclick, { notification: { close: () => { closed = true; }, data: { url: "#/voting" } } });
  check("klik: jendela baru terbuka ke halaman tujuan bila belum ada", closed && sw.opened[0] === "https://kelas.contoh.id/kelasku.html#/voting");
}
{
  const sw = boot(["https://kelas.contoh.id/kelasku.html#/mading"]);
  await run(sw.handlers.notificationclick, { notification: { close() {}, data: { url: "#/piket" } } });
  check("klik: jendela yang terbuka dipindah ke halaman tujuan", sw.navigated[0] === "https://kelas.contoh.id/kelasku.html#/piket" && sw.opened.length === 0);
}
{
  const sw = boot();
  await run(sw.handlers.notificationclick, { notification: { close() {}, data: { url: "https://jahat.example/x" } } });
  check("klik: tujuan di luar aplikasi ditolak, jatuh ke Mading", sw.opened[0] === "https://kelas.contoh.id/kelasku.html#/mading");
}
console.log(`\n${pass} lulus, ${failN} gagal`);
process.exit(failN ? 1 : 0);
