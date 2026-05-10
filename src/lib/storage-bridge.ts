// Unified storage bridge.
//
// Goal: keep every piece of app data (users, settings, notices, theme, plus
// the existing IndexedDB stores) in ONE place — IndexedDB — so that an
// encrypted vault export captures everything, and a fresh device that
// imports the vault gets the full state.
//
// Existing modules use synchronous localStorage APIs (e.g. getCurrentUser).
// Rewriting them to async would touch every page. Instead we run a tiny
// "bridge":
//   1) On boot, read the mirror from IndexedDB and seed localStorage so
//      synchronous reads keep working.
//   2) Patch localStorage.setItem / removeItem / clear so every write to a
//      tracked key is also persisted to IndexedDB.
// Result: localStorage acts as a fast in-memory cache; IndexedDB is the
// source of truth and the thing we export.

import localforage from "localforage";

const mirror = localforage.createInstance({
  name: "gayu-vault",
  storeName: "kv-mirror",
});

// Keys we want unified into IndexedDB. Anything not in this list stays
// localStorage-only (e.g. transient UI flags).
export const TRACKED_KEYS = [
  "vault-users",
  "app-settings-v2",
  "app-settings-v1", // legacy migration
  "notices-v1",
  "theme",
  "media-view-prefs", // grid/list + size for Rhythm > Photos
];

let booted = false;

export async function bootStorageBridge(): Promise<void> {
  if (booted) return;
  booted = true;

  // 1) Hydrate localStorage from IndexedDB (only fill what's missing —
  // localStorage wins if both have data, so we never lose newer in-flight
  // edits across reloads).
  for (const key of TRACKED_KEYS) {
    try {
      if (localStorage.getItem(key) != null) continue;
      const stored = await mirror.getItem<string>(key);
      if (stored != null) localStorage.setItem(key, stored);
    } catch {
      /* ignore */
    }
  }

  // 2) Patch localStorage to mirror writes for tracked keys.
  const origSet = localStorage.setItem.bind(localStorage);
  const origRemove = localStorage.removeItem.bind(localStorage);
  const origClear = localStorage.clear.bind(localStorage);

  localStorage.setItem = (key: string, value: string) => {
    origSet(key, value);
    if (TRACKED_KEYS.includes(key)) {
      void mirror.setItem(key, value);
    }
  };
  localStorage.removeItem = (key: string) => {
    origRemove(key);
    if (TRACKED_KEYS.includes(key)) {
      void mirror.removeItem(key);
    }
  };
  localStorage.clear = () => {
    origClear();
    void Promise.all(TRACKED_KEYS.map((k) => mirror.removeItem(k)));
  };
}

// Used by the share/import flow to push restored values back into both
// stores in one shot.
export async function restoreTrackedKey(key: string, value: string | null) {
  if (value == null) {
    localStorage.removeItem(key);
    await mirror.removeItem(key);
  } else {
    localStorage.setItem(key, value);
    await mirror.setItem(key, value);
  }
}

export async function snapshotTrackedKeys(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of TRACKED_KEYS) {
    const v = localStorage.getItem(key);
    if (v != null) out[key] = v;
  }
  return out;
}
