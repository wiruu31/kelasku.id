// Memastikan PRECACHE tiap service worker lengkap dan tidak menyebut berkas yang tidak ada.
// Jalankan dengan --write untuk menulis ulang daftarnya dari graf impor.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const write = process.argv.includes("--write");
const SW = "kelasku-sw.js";

const APPS = [
  { entry: "js/main.js", html: "kelasku.html", manifest: "kelasku.webmanifest", cssDir: "css", cssTop: true, iconPrefixes: ["ikon-kelasku", "favicon"] , extra: ["favicon.svg"] },
  { entry: "js/konsol/main.js", html: "konsol.html", manifest: "konsol.webmanifest", cssDir: "css/konsol", iconPrefixes: ["ikon-konsol", "favicon-konsol"], extra: [] },
];

function imports(file, seen) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = readFileSync(join(root, file), "utf8");
  for (const m of src.matchAll(/(?:from|import)\s+["'](\.[^"']+)["']/g)) {
    const next = relative(root, resolve(root, dirname(file), m[1]));
    if (existsSync(join(root, next))) imports(next, seen);
  }
}

// Satu service worker melayani dua aplikasi (satu origin, satu cakupan), jadi daftarnya gabungan.
const files = new Set();
for (const app of APPS) {
  const js = new Set();
  imports(app.entry, js);
  for (const f of [app.html, app.manifest, ...app.extra, ...js]) files.add(f);
  for (const f of readdirSync(join(root, app.cssDir))) if (f.endsWith(".css")) files.add(`${app.cssDir}/${f}`);
  for (const f of readdirSync(join(root, "icons"))) if (app.iconPrefixes.some((p) => f.startsWith(p))) files.add(`icons/${f}`);
}
// "./" sengaja tidak dimasukkan: di hosting tanpa index.html alamat akar 404 dan menggagalkan seluruh pemasangan service worker.
const list = [...[...files].sort()];
const path = join(root, SW);
const src = readFileSync(path, "utf8");

if (write) {
  const block = `const PRECACHE = [\n${list.map((f) => `  "${f}"`).join(",\n")}\n];`;
  writeFileSync(path, src.replace(/const PRECACHE = \[[\s\S]*?\n\];/, block));
  console.log(`${SW}: ${list.length} berkas ditulis`);
} else {
  const listed = new Set([...src.matchAll(/^\s+"([^"]+)"/gm)].map((m) => m[1]));
  const missing = list.filter((f) => !listed.has(f));
  const ghost = [...listed].filter((f) => !existsSync(join(root, f)));
  if (missing.length || ghost.length) {
    if (missing.length) console.error(`Belum ada di PRECACHE:\n  ${missing.join("\n  ")}`);
    if (ghost.length) console.error(`Berkas tidak ditemukan:\n  ${ghost.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`${SW}: PRECACHE lengkap (${list.length} berkas)`);
}
