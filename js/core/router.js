import { clear } from "./dom.js";
import { skeleton } from "./skeleton.js";
import { errorState, reportError } from "./errors.js";

function compile(path) {
  const keys = [];
  const source = path.replace(/:([a-zA-Z]+)/g, (_, key) => {
    keys.push(key);
    return "([^/]+)";
  });
  return { regex: new RegExp(`^${source}$`), keys };
}

// routes: [{ path, view(ctx) -> Node, skeleton?, guard?(ctx) -> true | "/jalur-lain", title }]
export function createRouter({ routes, outlet, fallbackPath, onChange, brand = "Kelasku.id", makeSkeleton = skeleton }) {
  const table = routes.map((r) => ({ ...r, ...compile(r.path) }));
  let token = 0;

  function match(hash) {
    const [path] = hash.replace(/^#/, "").split("?");
    const clean = path === "" ? "/" : path;
    for (const route of table) {
      const m = clean.match(route.regex);
      if (m) {
        const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        return { route, params, path: clean };
      }
    }
    return null;
  }

  async function render() {
    const current = ++token;
    const found = match(location.hash);
    if (!found) {
      location.replace(`#${fallbackPath}`);
      return;
    }
    const ctx = { params: found.params, path: found.path, go };

    if (found.route.guard) {
      const verdict = await found.route.guard(ctx);
      if (current !== token) return;
      if (verdict !== true) {
        location.replace(`#${verdict}`);
        return;
      }
    }

    clear(outlet);
    outlet.append(makeSkeleton(found.route.skeleton));
    document.title = found.route.title ? `${found.route.title} | ${brand}` : brand;
    onChange?.(found);

    try {
      const node = await found.route.view(ctx);
      if (current !== token) return;
      clear(outlet);
      outlet.append(node);
    } catch (err) {
      if (current !== token) return;
      reportError(err);
      clear(outlet);
      outlet.append(errorState(err, render));
    }
    outlet.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  // Ke alamat yang sudah aktif tidak merender ulang, supaya dua pemicu navigasi
  // (mis. pendengar SIGNED_OUT dan tombol Keluar) tidak menghapus isian form.
  function go(path) {
    if (location.hash !== `#${path}`) location.hash = path;
  }

  return {
    go,
    refresh: render,
    start() {
      window.addEventListener("hashchange", render);
      render();
    },
  };
}
