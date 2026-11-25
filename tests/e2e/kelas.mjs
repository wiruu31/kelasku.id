// Uji klik aplikasi Kelas (hierarki role, Kabar Sistem, menu). Jalankan: node tests/e2e/kelas.mjs [folder-tangkapan]
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");

const root = new URL("../..", import.meta.url).pathname;
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const p = join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!existsSync(p) || p.endsWith("/")) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(p)] ?? "application/octet-stream" }).end(readFileSync(p));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const fake = readFileSync(join(root, "tests/e2e/fake-supabase-kelas.js"), "utf8");
let pass = 0, failN = 0;
const check = (name, cond) => { cond ? pass++ : failN++; console.log(`${cond ? "LULUS" : "GAGAL"}  ${name}`); };

const browser = await chromium.launch();
// Browser asli tidak bisa berlangganan push di sandbox: pendaftar, izin, dan pushManager ditiru di sini.
const PUSH_MOCK = (perm) => `
  window.__perm = ${JSON.stringify(perm)};
  window.__push = { sub: null };
  Object.defineProperty(Notification, "permission", { get: () => window.__perm, configurable: true });
  Notification.requestPermission = async () => { if (window.__perm === "default") window.__perm = "granted"; return window.__perm; };
  const reg = { pushManager: {
    getSubscription: async () => window.__push.sub,
    subscribe: async () => {
      const sub = { endpoint: "https://push.test/e1", toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "P".repeat(40), auth: "A".repeat(16) } }; }, unsubscribe: async () => { window.__push.sub = null; return true; } };
      window.__push.sub = sub; return sub;
    } } };
  Object.defineProperty(navigator.serviceWorker, "ready", { get: () => Promise.resolve(reg), configurable: true });`;
async function open(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: "block", ...(opts.userAgent ? { userAgent: opts.userAgent } : {}) });
  if (opts.push) await ctx.addInitScript(PUSH_MOCK(opts.perm ?? "default"));
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (opts.push && u.endsWith("/js/core/config.js")) {
      return route.fulfill({ contentType: "text/javascript", body: readFileSync(join(root, "js/core/config.js"), "utf8").replace('VAPID_PUBLIC_KEY = ""', 'VAPID_PUBLIC_KEY = "' + "B".repeat(87) + '"') });
    }
    if (u.includes("supabase-js")) return route.fulfill({ contentType: "text/javascript", body: fake });
    if (u.startsWith(base)) return route.continue();
    return route.fulfill({ status: 200, contentType: "text/css", body: "" });
  });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("[kelasku]") && page.errors.push(m.text()));
  return page;
}
async function login(page, who) {
  await page.goto(`${base}/kelasku.html`);
  await page.waitForSelector('input[name="identifier"]');
  await page.fill('input[name="identifier"]', who);
  await page.fill('input[name="password"]', "sandi12345");
  await page.click('button[type="submit"]');
  await page.waitForSelector(".board, .nav, nav");
}
const text = (page) => page.locator("body").innerText();
const navText = (page) => page.locator("nav").first().innerText();

{
  const page = await open({ width: 1280, height: 800 });
  await login(page, "ayu");
  await page.waitForTimeout(400);
  const nav = await page.evaluate(() => document.body.innerText);
  check("Admin Kelas: menu Panel Admin dan Kabar Sistem ada, fitur baru terlihat", /Panel Admin/.test(nav) && /Kabar Sistem/.test(nav) && /Piket/.test(nav) && /Voting/.test(nav) && /Kas/.test(nav) && /Organigram/.test(nav));
  check("tidak ada menu Pemilik", !/Pemilik/.test(nav));
  if (shots) await page.screenshot({ path: join(shots, "kelas-01-mading.png"), fullPage: true });

  await page.goto(`${base}/kelasku.html#/peran`);
  await page.waitForSelector(".role-row, .state");
  const peran = await text(page);
  check("Peran memuat role sistem dan kustom", /Admin Kelas/.test(peran) && /Ketua/.test(peran) && /Murid/.test(peran));
  check("role sistem diberi label dan Admin Kelas terkunci", /Sistem/.test(peran) && /Semua izin/.test(peran) && /Izin terkunci/.test(peran));
  if (shots) await page.screenshot({ path: join(shots, "kelas-02-peran.png"), fullPage: true });

  await page.goto(`${base}/kelasku.html#/peran/${"00000000-0000-4000-8000-000000000051"}`);
  await page.waitForSelector("form");
  const edit = await text(page);
  check("matriks izin punya aksi akses, lihat, tambah, ubah, hapus", /Membuka menu pengumuman/.test(edit) && /Melihat isi pengumuman/.test(edit) && /Menambah pengumuman/.test(edit) && /Mengubah pengumuman/.test(edit) && /Menghapus pengumuman/.test(edit));
  check("izin Memberi role ke murid di bawahnya ada", /Memberi role ke murid di bawahnya/.test(edit));
  check("izin tersimpan terbaca di form (Ketua: tambah pengumuman = Ya)", (await page.inputValue("#izin-pengumuman\\.tambah")) === "semua" && (await page.inputValue("#izin-jadwal\\.tambah")) === "");
  if (shots) await page.screenshot({ path: join(shots, "kelas-03-role-edit.png"), fullPage: true });

  await page.goto(`${base}/kelasku.html#/peran/${"00000000-0000-4000-8000-000000000050"}`);
  await page.waitForSelector(".state, form");
  check("Admin Kelas tidak bisa diubah izinnya", /terkunci/.test(await text(page)));

  await page.goto(`${base}/kelasku.html#/anggota`);
  await page.waitForSelector("text=Budi Santoso");
  const anggota = await text(page);
  check("daftar anggota tampil, Murid tidak jadi lencana", /Citra Dewi/.test(anggota) && /Ketua/.test(anggota));
  if (shots) await page.screenshot({ path: join(shots, "kelas-04-anggota.png"), fullPage: true });

  await page.goto(`${base}/kelasku.html#/sistem`);
  await page.waitForSelector(".board");
  const sis = await text(page);
  check("Kabar Sistem menampilkan siaran dan penanda Baru", /Pembaruan sistem v0.3.0/.test(sis) && /Baru/.test(sis));
  if (shots) await page.screenshot({ path: join(shots, "kelas-05-sistem.png"), fullPage: true });

  await page.goto(`${base}/kelasku.html#/pemilik`);
  await page.waitForTimeout(300);
  check("rute /pemilik sudah tidak ada", !/Panel Pemilik/.test(await text(page)));

  // ---- fitur baru v0.4.0 (Admin Kelas)
  await page.goto(`${base}/kelasku.html#/piket`);
  await page.waitForSelector(".piket-day");
  check("Piket: tujuh hari tampil, Budi di Senin", (await page.locator(".piket-day").count()) === 7 && /Budi Santoso/.test(await page.locator('.piket-day:has(h2:text("Senin"))').innerText()));
  const selasa = page.locator('.piket-day:has(h2:text("Selasa"))');
  await selasa.locator("select").selectOption({ label: "Citra Dewi" });
  await selasa.getByRole("button", { name: "Tambah" }).click();
  await page.waitForSelector('.piket-day:has(h2:text("Selasa")) .chip');
  check("Piket: menambah murid ke hari", /Citra Dewi/.test(await selasa.locator(".chip").innerText()));
  await page.getByRole("button", { name: /Cabut Citra Dewi dari piket Selasa/ }).click();
  await page.waitForFunction(() => !document.querySelector(".piket-day .chip__remove[aria-label*='Citra']"));
  check("Piket: mencabut murid dari hari", (await selasa.locator(".chip").count()) === 0);
  if (shots) await page.screenshot({ path: join(shots, "kelas-06-piket.png"), fullPage: true });

  await page.goto(`${base}/kelasku.html#/voting`);
  await page.waitForSelector(".poll");
  check("Voting: dua voting awal tampil dengan mode", /Warna kaos kelas/.test(await text(page)) && /Ketua panitia/.test(await text(page)));
  const kaos = page.locator('.poll:has-text("Warna kaos kelas")');
  await kaos.locator('label:has-text("Merah") input').check();
  await kaos.getByRole("button", { name: "Kirim suara" }).click();
  await page.waitForSelector('.poll:has-text("Warna kaos kelas") .poll__names');
  check("Voting terlihat: nama pemilih dan hitungan tampil", /Ayu Lestari/.test(await kaos.innerText()) && /1 pemilih/.test(await kaos.innerText()));
  const panitia = page.locator('.poll:has-text("Ketua panitia")');
  await panitia.locator('label:has-text("Ani") input').check();
  await panitia.getByRole("button", { name: "Kirim suara" }).click();
  await page.waitForSelector('.poll:has-text("Ketua panitia") button:disabled');
  check("Voting anonim akhir: hasil disembunyikan saat berjalan", /Hasil akan terbuka setelah voting selesai/.test(await panitia.innerText()) && !/pemilih/.test(await panitia.innerText()));
  await panitia.getByRole("button", { name: "Tutup voting" }).click();
  await panitia.getByRole("button", { name: "Ya, tutup" }).click();
  await page.waitForSelector('.poll:has-text("Ketua panitia"):has-text("Selesai")');
  check("Voting anonim akhir: hasil terbuka setelah ditutup", /1 pemilih/.test(await panitia.innerText()) && !/Hasil akan terbuka/.test(await panitia.innerText()));
  await page.click('summary:has-text("Buat voting")');
  await page.fill('input[name="pollTitle"]', "Tempat study tour");
  await page.locator('input[aria-label="Pilihan 1"]').fill("Bandung");
  await page.locator('input[aria-label="Pilihan 2"]').fill("Yogyakarta");
  await page.getByRole("button", { name: "Tambah pilihan" }).click();
  await page.locator('input[aria-label="Pilihan 3"]').fill("Bali");
  await page.getByRole("button", { name: "Buat voting" }).last().click();
  await page.waitForSelector('.poll:has-text("Tempat study tour")');
  check("Voting: membuat voting baru dengan tiga pilihan", (await page.locator('.poll:has-text("Tempat study tour") .poll__choice').count()) === 3);
  await page.click('summary:has-text("Buat voting")');
  await page.fill('input[name="pollTitle"]', "X");
  await page.getByRole("button", { name: "Buat voting" }).last().click();
  await page.waitForSelector(".field__error:not([hidden])");
  check("Voting: judul dan pilihan tidak valid ditolak dengan pesan", /Judul 2 sampai 120/.test(await text(page)) && /minimal 2 pilihan/.test(await text(page)));
  if (shots) await page.screenshot({ path: join(shots, "kelas-07-voting.png"), fullPage: true });

  await page.goto(`${base}/kelasku.html#/kas`);
  await page.waitForSelector(".kas-row");
  check("Kas: saldo awal Rp50.000", /Rp50\.000/.test(await page.locator(".stat-row").innerText()));
  await page.click('summary:has-text("Catat kas")');
  const entryBox = page.locator('details:has(summary:text("Catat kas"))');
  await entryBox.locator('select[name="kind"]').selectOption("keluar");
  await entryBox.locator('input[name="amount"]').fill("12.000");
  await entryBox.locator('input[name="note"]').fill("Spidol");
  await entryBox.getByRole("button", { name: "Simpan catatan" }).click();
  await page.waitForSelector('.kas-row:has-text("Spidol")');
  check("Kas: pengeluaran mengurangi saldo jadi Rp38.000", /Rp38\.000/.test(await page.locator(".stat-row").innerText()));
  await entryBox.locator("summary").click();
  await entryBox.locator('input[name="amount"]').fill("abc");
  await entryBox.locator('input[name="note"]').fill("Salah");
  await entryBox.getByRole("button", { name: "Simpan catatan" }).click();
  await page.waitForSelector(".field__error:not([hidden])");
  check("Kas: jumlah bukan angka ditolak dengan pesan", /Isi jumlah dalam rupiah/.test(await text(page)));
  const budiRow = page.locator('.due-members li:has-text("Budi Santoso")');
  await budiRow.locator("input").check();
  await page.waitForSelector('.kas-row:has-text("dari iuran")');
  check("Kas: iuran lunas membuat pemasukan dan saldo Rp43.000", /Rp43\.000/.test(await page.locator(".stat-row").innerText()) && /1 dari 3 lunas/.test(await text(page)));
  await budiRow.locator("input").uncheck();
  await page.waitForFunction(() => !document.body.innerText.includes("dari iuran"));
  check("Kas: membatalkan lunas mengembalikan saldo Rp38.000", /Rp38\.000/.test(await page.locator(".stat-row").innerText()));
  if (shots) await page.screenshot({ path: join(shots, "kelas-08-kas.png"), fullPage: true });

  await page.goto(`${base}/kelasku.html#/organigram`);
  await page.waitForSelector(".org-card, .state");
  const org = await text(page);
  check("Organigram: role kustom tampil dengan pemegang, tanpa Admin Kelas dan Murid", /Ketua/.test(org) && /Citra Dewi/.test(org) && !(await page.locator(".org-card__title", { hasText: /^(Admin Kelas|Murid)$/ }).count()));
  if (shots) await page.screenshot({ path: join(shots, "kelas-09-organigram.png"), fullPage: true });

  await page.goto(`${base}/kelasku.html#/panel`);
  await page.waitForSelector(".tabs");
  const panel = await text(page);
  check("Panel Admin Kelas: tab dan ringkasan angka", /Anggota aktif/.test(panel) && (await page.locator(".tab").count()) === 6);
  await page.click('.tab:has-text("Peran")');
  await page.waitForSelector(".role-row");
  check("Tab Peran membuka daftar peran dengan tab tetap tampil", (await page.locator(".tab").count()) === 6 && (await page.locator('.tab[aria-current="page"]').innerText()) === "Peran");
  if (shots) await page.screenshot({ path: join(shots, "kelas-10-panel.png"), fullPage: true });

  await page.goto(`${base}/kelasku.html#/profil`);
  await page.waitForSelector(".photo-box");
  const prof = await text(page);
  check("Profil: foto, sekolah, dan tombol pilih foto ada", /Pilih foto/.test(prof) && /SMA Negeri 1 Contoh/.test(prof));
  if (shots) await page.screenshot({ path: join(shots, "kelas-11-profil.png"), fullPage: true });
  check("tidak ada galat JS (Admin Kelas)", page.errors.length === 0 || (console.log(page.errors), false));
}
{
  const page = await open({ width: 375, height: 740 });
  await login(page, "budi");
  await page.waitForTimeout(400);
  const body = await text(page);
  check("Murid: tidak ada Panel Admin, Kabar Sistem, Kas, Piket", !/Kabar Sistem/.test(body) && !/Panel Admin/.test(body) && !/\bKas\b/.test(body) && !/Piket/.test(body));
  await page.goto(`${base}/kelasku.html#/sistem`);
  await page.waitForSelector(".state");
  check("Murid ditolak di Kabar Sistem", /tidak punya akses/.test(await text(page)));
  await page.goto(`${base}/kelasku.html#/log`);
  await page.waitForSelector(".state");
  check("Murid ditolak di Log", /tidak punya akses/.test(await text(page)));
  await page.goto(`${base}/kelasku.html#/peran`);
  await page.waitForSelector(".state");
  check("Murid ditolak di Peran", /tidak punya akses|khusus/i.test(await text(page)));
  await page.goto(`${base}/kelasku.html#/mading`);
  await page.waitForSelector(".bento");
  const nav2 = await page.locator("nav").first().innerText();
  check("Murid ponsel: bilah bawah berisi Mading, Jadwal, Tugas, Menu, Profil", ["Mading", "Jadwal", "Tugas", "Menu", "Profil"].every((x) => nav2.includes(x)) && !/Voting/.test(nav2));
  await page.click('nav a:has-text("Menu")');
  await page.waitForSelector(".menu-grid");
  const menu = await text(page);
  check("Halaman Menu: Pengumuman, Voting, Organigram, Anggota ada; Kas dan Piket tidak", /Pengumuman/.test(menu) && /Voting/.test(menu) && /Organigram/.test(menu) && /Anggota/.test(menu) && !/\bKas\b/.test(menu) && !/Piket/.test(menu));
  if (shots) await page.screenshot({ path: join(shots, "kelas-12-menu-ponsel.png"), fullPage: true });
  await page.goto(`${base}/kelasku.html#/voting`);
  await page.waitForSelector(".poll");
  check("Murid: tidak ada tombol Buat voting atau Tutup voting", !(await page.locator('summary:has-text("Buat voting")').count()) && !(await page.getByRole("button", { name: "Tutup voting" }).count()));
  const anon = page.locator('.poll:has-text("Ketua panitia")');
  await anon.locator('label:has-text("Budi") input').check();
  await anon.getByRole("button", { name: "Kirim suara" }).click();
  await page.waitForSelector('.poll:has-text("Ketua panitia") button:disabled');
  check("Murid: suara anonim tercatat dan tidak bisa diganti", /Suaramu tercatat/.test(await anon.innerText()));
  const noHoriz = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  check("Voting di 375px tanpa gulir mendatar", noHoriz);
  if (shots) await page.screenshot({ path: join(shots, "kelas-13-voting-ponsel.png"), fullPage: true });
  await page.goto(`${base}/kelasku.html#/mading`);
  await page.waitForSelector(".bento");
  check("Mading ponsel tanpa gulir mendatar", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  if (shots) await page.screenshot({ path: join(shots, "kelas-14-mading-ponsel.png"), fullPage: true });
  check("tidak ada galat JS (Murid)", page.errors.length === 0 || (console.log(page.errors), false));
}

// ---- notifikasi push v1.0.0
{
  const page = await open({ width: 1280, height: 800 });
  await login(page, "ayu");
  await page.goto(`${base}/kelasku.html#/profil`);
  await page.waitForSelector(".photo-box");
  check("Push: tanpa kunci VAPID bagian Notifikasi disembunyikan", !(await text(page)).includes("Notifikasi"));
}
{
  const page = await open({ width: 375, height: 800 }, { push: true });
  await login(page, "budi");
  await page.goto(`${base}/kelasku.html#/profil`);
  await page.getByRole("button", { name: "Aktifkan notifikasi" }).waitFor();
  check("Push: murid melihat tombol Aktifkan notifikasi", true);
  await page.getByRole("button", { name: "Aktifkan notifikasi" }).click();
  await page.waitForSelector(".notif-list");
  const log1 = await page.evaluate(() => window.__fakeLog);
  check("Push: langganan perangkat disimpan ke server", log1.some((l) => l.rpc === "save_push_subscription" && l.args.p_endpoint === "https://push.test/e1" && l.args.p_p256dh.length >= 20));
  const body = await text(page);
  check("Push: murid melihat enam kategori tanpa Pendaftar baru", ["Pengumuman baru", "Tugas baru", "Tenggat tugas besok", "Voting baru", "Piket hari ini", "Kabar dari Admin Kelasku.id"].every((x) => body.includes(x)) && !body.includes("Pendaftar baru"));
  check("Push: semua kategori nyala bawaan", (await page.locator(".notif-list input:checked").count()) === 6);
  await page.locator('.notif-row:has-text("Tugas baru") input').uncheck();
  await page.waitForFunction(() => window.__fakeLog.some((l) => l.prefs));
  const prefLog = await page.evaluate(() => window.__fakeLog.find((l) => l.prefs).prefs);
  check("Push: mematikan kategori tersimpan", prefLog.category === "tugas" && prefLog.enabled === false);
  check("Push: tombol kategori memenuhi tinggi ketuk 44px", await page.locator(".notif-row").first().evaluate((el) => el.getBoundingClientRect().height >= 44));
  check("Push: profil 375px tanpa gulir mendatar", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  if (shots) await page.screenshot({ path: join(shots, "kelas-15-notifikasi.png"), fullPage: true });
  await page.getByRole("button", { name: "Matikan di perangkat ini" }).click();
  await page.getByRole("button", { name: "Aktifkan notifikasi" }).waitFor();
  check("Push: mematikan di perangkat melepas langganan", (await page.evaluate(() => window.__fakeLog)).some((l) => l.rpc === "remove_push_subscription"));
  await page.getByRole("button", { name: "Aktifkan notifikasi" }).click();
  await page.waitForSelector(".notif-list");
  await page.evaluate(() => (window.__fakeLog.length = 0));
  await page.getByRole("button", { name: "Keluar" }).click();
  await page.waitForSelector('input[name="identifier"]');
  check("Push: keluar melepas langganan perangkat", (await page.evaluate(() => window.__fakeLog)).some((l) => l.rpc === "remove_push_subscription"));
  check("tidak ada galat JS (Push murid)", page.errors.length === 0 || (console.log(page.errors), false));
}
{
  const page = await open({ width: 1280, height: 800 }, { push: true });
  await login(page, "ayu");
  await page.goto(`${base}/kelasku.html#/profil`);
  await page.getByRole("button", { name: "Aktifkan notifikasi" }).click();
  await page.waitForSelector(".notif-list");
  check("Push: Admin Kelas melihat kategori Pendaftar baru", (await text(page)).includes("Pendaftar baru") && (await page.locator(".notif-row").count()) === 7);
}
{
  const page = await open({ width: 375, height: 800 }, { push: true, perm: "denied" });
  await login(page, "budi");
  await page.goto(`${base}/kelasku.html#/profil`);
  await page.waitForSelector(".note:has(h2:text('Notifikasi')) p");
  const t = await text(page);
  check("Push: izin diblokir menampilkan petunjuk, tanpa tombol aktifkan", /diblokir/.test(t) && !(await page.getByRole("button", { name: "Aktifkan notifikasi" }).count()));
}
{
  const page = await open({ width: 375, height: 800 }, { push: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" });
  await login(page, "budi");
  await page.goto(`${base}/kelasku.html#/profil`);
  await page.waitForSelector(".note:has(h2:text('Notifikasi')) p");
  check("Push: iPhone di browser diminta memasang ke layar utama dulu", /Layar Utama/.test(await text(page)));
}
await browser.close();
server.close();
console.log(`\n${pass} lulus, ${failN} gagal`);
process.exit(failN ? 1 : 0);
