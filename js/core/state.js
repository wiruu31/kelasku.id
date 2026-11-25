// Penyimpan state kecil dengan langganan. Satu-satunya state global aplikasi.
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const appStore = createStore({
  session: null,
  profile: null,
  memberships: [],
  member: null,
  myRoles: [],
  perms: new Map(),
  rank: null,
  online: typeof navigator === "undefined" ? true : navigator.onLine,
});
