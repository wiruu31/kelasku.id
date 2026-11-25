// Status pemasangan PWA. Dipasang sejak awal karena beforeinstallprompt hanya terbit sekali.
let deferred = null;
let installed = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(installState()));

export const isStandalone = () =>
  (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// "installed" | "prompt" (Android/desktop Chrome) | "ios" | "manual" (browser tanpa tombol install)
export function installState() {
  if (installed || isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIOS()) return "ios";
  return "manual";
}

export function initInstall() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Mengembalikan "accepted" atau "dismissed"; prompt hanya bisa dipakai sekali.
export async function promptInstall() {
  if (!deferred) return "dismissed";
  const prompt = deferred;
  deferred = null;
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  if (outcome !== "accepted") emit();
  return outcome;
}

const DISMISS_KEY = "kelasku.banner-install-ditutup";
export function bannerDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}
export function dismissBanner() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* penyimpanan diblokir: banner muncul lagi, tidak apa-apa */
  }
}
