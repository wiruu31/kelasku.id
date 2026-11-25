// Uji klik Konsol di Chromium dengan supabase-js palsu. Jalankan: node tests/e2e/konsol.mjs [folder-tangkapan]
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
const fake = readFileSync(join(root, "tests/e2e/fake-supabase.js"), "utf8");

let pass = 0, failN = 0;
const check = (name, cond) => { cond ? pass++ : failN++; console.log(`${cond ? "LULUS" : "GAGAL"}  ${name}`); };

const browser = await chromium.launch();
async function session(viewport, tag) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: "block" });
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.includes("supabase-js")) return route.fulfill({ contentType: "text/javascript", body: fake });
    if (u.startsWith(base)) return route.continue();
    return route.fulfill({ status: 200, contentType: "text/css", body: "" });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("[kelasku]") && errors.push(m.text()));
  page.snap = async (n) => shots && page.screenshot({ path: join(shots, `${tag}-${n}.png`), fullPage: true });
  page.errors = errors;
  return page;
}
const text = (page) => page.locator("body").innerText();

// ------------------------------------------------------------ desktop
{
  const page = await session({ width: 1280, height: 800 }, "desktop");
  await page.goto(`${base}/konsol.html`);
  await page.waitForSelector("h1");
  check("belum masuk: diarahkan ke halaman masuk", (await page.locator("h1").innerText()) === "Admin Kelasku.id" && page.url().endsWith("#/masuk"));
  await page.snap("01-masuk");

  await page.fill('input[name="identifier"]', "geris");
  await page.fill('input[name="password"]', "salah");
  await page.click('button[type="submit"]');
  await page.waitForSelector(".form-message:not([hidden])");
  check("sandi salah menampilkan pesan", (await page.locator(".form-message").innerText()).length > 5);

  await page.fill('input[name="password"]', "sandi12345");
  await page.click('button[type="submit"]');
  await page.waitForSelector(".stats");
  check("login Main Admin membuka dashboard", page.url().endsWith("#/dashboard"));
  const dash = await text(page);
  check("dashboard menampilkan jam dan total", /Halo, Geris Wiru/.test(dash) && /Sekolah aktif/.test(dash) && /\d\d\.\d\d\.\d\d/.test(dash));
  check("dashboard menandai kelas tanpa admin dan pendaftar menunggu", /1 menunggu/.test(dash) && /Belum ada Admin Kelas/.test(dash));
  await page.snap("02-dashboard");

  await page.click('.rail a[href="#/ringkasan"]');
  await page.waitForSelector(".tbl");
  check("ringkasan tingkat sekolah", (await text(page)).includes("SMA Negeri 1 Contoh"));
  await page.click("text=SMA Negeri 1 Contoh >> nth=0");
  await page.waitForSelector("text=XI IPA 1");
  check("drill-down ke kelas", (await text(page)).includes("XI IPA 2"));
  await page.click("a.row-link:has-text('XI IPA 1')");
  await page.waitForSelector("text=Ayu Lestari");
  check("drill-down ke murid, breadcrumb benar", /Ringkasan\s*\/\s*SMA Negeri 1 Contoh\s*\/\s*XI IPA 1/.test(await text(page)));
  await page.fill('input[name="cari"]', "budi");
  check("pencarian murid menyaring", !(await text(page)).includes("Ayu Lestari") && (await text(page)).includes("Budi Santoso"));
  await page.snap("03-murid");

  await page.click("button.row-link:has-text('Budi Santoso')");
  await page.waitForSelector(".drawer");
  check("panel murid terbuka dan fokus di dalamnya", await page.evaluate(() => !!document.activeElement.closest(".drawer")));
  await page.fill('.drawer input[name="fullName"]', "Budi Santoso Putra");
  await page.click('.drawer button:has-text("Simpan akun")');
  await page.waitForSelector(".drawer .live-note--ok");
  check("ubah nama akun berhasil", true);
  await page.fill('.drawer input[name="username"]', "ayu");
  await page.fill('.drawer input[name="fullName"]', "Budi Santoso Putra");
  await page.click('.drawer button:has-text("Simpan akun")');
  await page.waitForSelector('.drawer .field__error:not([hidden])');
  check("username bentrok tampil di field", /sudah dipakai/i.test(await page.locator(".drawer .field__error:not([hidden])").first().innerText()));
  await page.click('.drawer button:has-text("Buat kata sandi sementara")');
  await page.waitForSelector(".secret__value");
  check("sandi sementara tampil sekali", (await page.locator(".secret__value").innerText()) === "Tmp7Kq2mXz");
  await page.snap("04-panel-murid");
  await page.keyboard.press("Escape");
  check("Escape menutup panel", (await page.locator(".drawer").count()) === 0);

  await page.click('.rail a[href="#/role"]');
  await page.waitForSelector("select[name=sekolah]");
  await page.selectOption("select[name=sekolah]", { label: "SMA Negeri 1 Contoh" });
  await page.selectOption("select[name=kelas]", { label: "XI IPA 2" });
  await page.waitForSelector("text=Dimas Putra");
  await page.click('button[aria-label="Angkat Dimas Putra"]');
  await page.waitForSelector(".live-note--ok");
  check("angkat Admin Kelas", /kini Admin Kelas/.test(await text(page)));
  await page.snap("05-atur-role");

  await page.click('.rail a[href="#/kelas-baru"]');
  await page.fill('input[name="name"]', "XII IPS 1");
  await page.selectOption("select[name=schoolId]", { label: "SMK Harapan" });
  await page.click('button:has-text("Buat kelas")');
  await page.waitForSelector(".joincode");
  check("tambah kelas menampilkan kode", (await page.locator(".joincode").innerText()) === "ZXCV2468");

  await page.click('.rail a[href="#/sekolah"]');
  await page.waitForSelector(".tbl");
  await page.fill('input[name="name"]', "SMA Baru");
  await page.click('button:has-text("Tambah sekolah")');
  await page.waitForSelector("text=SMA Baru");
  check("tambah sekolah", true);
  await page.click('button[aria-label="Kelola SMP Lama"]');
  await page.waitForSelector(".danger-zone");
  await page.click('.danger-zone button:has-text("Hapus permanen")');
  await page.waitForSelector(".dialog");
  check("tombol hapus terkunci sebelum nama diketik", await page.locator('.dialog button[type="submit"]').isDisabled());
  await page.fill('.dialog input[name="konfirmasi"]', "salah");
  check("nama salah tetap terkunci", await page.locator('.dialog button[type="submit"]').isDisabled());
  await page.fill('.dialog input[name="konfirmasi"]', "SMP Lama");
  await page.click('.dialog button[type="submit"]');
  await page.waitForFunction(() => !document.body.innerText.includes("SMP Lama"));
  check("hapus sekolah arsip setelah mengetik nama", true);
  await page.snap("06-sekolah");

  await page.click('.rail a[href="#/siaran"]');
  await page.waitForSelector("textarea");
  await page.click('button:has-text("Kirim siaran")');
  await page.waitForSelector(".field__error:not([hidden])");
  check("siaran kosong ditolak per field", true);
  await page.fill('input[name="title"]', "Pemeliharaan sistem");
  await page.fill("textarea", "Sistem libur sebentar malam ini.");
  await page.click('button:has-text("Satu sekolah")');
  await page.selectOption("select[name=schoolId]", { label: "SMA Negeri 1 Contoh" });
  await page.click('button:has-text("Kirim siaran")');
  await page.waitForSelector(".cast__item");
  check("siaran terkirim dan masuk riwayat", /Pemeliharaan sistem/.test(await text(page)));
  await page.snap("07-siaran");

  await page.click('.rail a[href="#/log"]');
  await page.waitForSelector(".log-list");
  check("log sistem tampil", /masuk ke Konsol/.test(await text(page)));

  await page.click('.rail a[href="#/pengaturan"]');
  await page.waitForSelector('input[name="limit"]');
  await page.fill('input[name="limit"]', "99");
  await page.click('button:has-text("Simpan batas")');
  await page.waitForSelector(".field__error:not([hidden]), .live-note--fail");
  check("batas di luar 1 sampai 20 ditolak", true);
  await page.fill('input[name="limit"]', "5");
  await page.click('button:has-text("Simpan batas")');
  await page.waitForSelector(".live-note--ok");
  check("batas bawaan tersimpan", true);
  await page.snap("08-pengaturan");

  await page.click('button:has-text("Keluar dari Konsol")');
  await page.waitForSelector('input[name="identifier"]');
  check("keluar kembali ke halaman masuk", page.url().endsWith("#/masuk"));
  await page.goto(`${base}/konsol.html#/sekolah`);
  await page.waitForSelector('input[name="identifier"]');
  check("rute privat tanpa sesi dialihkan ke masuk", page.url().endsWith("#/masuk"));
  check("tidak ada galat JS (desktop)", page.errors.length === 0 || (console.log(page.errors), false));
}

// ------------------------------------------------------------ ponsel
{
  const page = await session({ width: 375, height: 740 }, "ponsel");
  await page.goto(`${base}/konsol.html`);
  await page.waitForSelector('input[name="identifier"]');
  await page.fill('input[name="identifier"]', "geris");
  await page.fill('input[name="password"]', "sandi12345");
  await page.click('button[type="submit"]');
  await page.waitForSelector(".stats");
  const overflow = (n) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth).then((o) => check(`ponsel: tanpa scroll horizontal di ${n}`, !o));
  await overflow("dashboard");
  check("ponsel: rel disembunyikan, bilah atas dengan tombol Menu", !(await page.locator(".rail").isVisible()) && (await page.locator('.topbar button:has-text("Menu")').isVisible()));
  await page.snap("01-dashboard");
  await page.click('.topbar button:has-text("Menu")');
  await page.waitForSelector(".drawer .nav");
  await page.snap("02-menu");
  await page.click('.drawer a[href="#/ringkasan"]');
  await page.waitForSelector(".tbl");
  check("ponsel: menu menutup setelah memilih", (await page.locator(".drawer").count()) === 0);
  await overflow("ringkasan");
  await page.snap("03-ringkasan");
  for (const path of ["sekolah", "role", "siaran", "log", "pengaturan", "kelas-baru"]) {
    await page.goto(`${base}/konsol.html#/${path}`);
    await page.waitForSelector("h1");
    await page.waitForTimeout(150);
    await overflow(path);
  }
  const small = await page.evaluate(() => [...document.querySelectorAll("button, a.btn, select, input")].filter((e) => e.offsetParent && !e.classList.contains("check__input")).filter((e) => { const r = e.getBoundingClientRect(); return r.height < 43.5; }).map((e) => e.outerHTML.slice(0, 80)));
  check("ponsel: target sentuh minimal 44px", small.length === 0 || (console.log(small), false));
  check("tidak ada galat JS (ponsel)", page.errors.length === 0 || (console.log(page.errors), false));
}

await browser.close();
server.close();
console.log(`\n${pass} lulus, ${failN} gagal`);
process.exit(failN ? 1 : 0);
