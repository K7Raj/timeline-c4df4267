// Per-user app settings: welcome heading, quotes, enabled tabs, surprise
// wishes, and per-user CRUD permissions on Memory Map. Admin can edit any
// user's settings; users can edit their own (except permissions).
//
// Storage shape (v2):
//   {
//     defaults: AppSettings,                // global fallback
//     users: { [userId]: Partial<AppSettings> }   // per-user override
//   }
// Older v1 data ({...AppSettings}) is migrated into `defaults` on read.

export type TabKey = "timeline" | "stats" | "traveler" | "surprise" | "media" | "wish" | "rhythm";

export interface AppSettings {
  welcomeHeading: string;
  quotes: string[];
  enabledTabs: Record<TabKey, boolean>;
  tabNames: Record<TabKey, string>;
  memoryMapCrud: Record<string, { create: boolean; update: boolean; delete: boolean }>;
  travelerCrud: Record<string, { create: boolean; update: boolean; delete: boolean }>;
  surpriseWishes: string[];
  rhythmName: string;
  soundEnabled: boolean;
}

const KEY = "app-settings-v2";
const LEGACY_KEY = "app-settings-v1";

export const DEFAULT_TAB_NAMES: Record<TabKey, string> = {
  timeline: "Memory Map",
  stats: "Statistics",
  traveler: "Time Traveler",
  surprise: "Surprise",
  media: "Multimedia",
  wish: "Make a Wish",
  rhythm: "Rhythm of Us",
};

const defaults: AppSettings = {
  welcomeHeading: "Your special surprise awaits ✨",
  quotes: [
    "✨ You are the magic in every ordinary day.",
    "💖 Loved, celebrated, and forever special.",
  ],
  enabledTabs: {
    timeline: true, stats: true, traveler: true,
    surprise: true, media: true, wish: true, rhythm: true,
  },
  tabNames: { ...DEFAULT_TAB_NAMES },
  memoryMapCrud: {},
  travelerCrud: {},
  surpriseWishes: [
    "Happy Birthday {name} 💖",
    "May your day sparkle as bright as you ✨",
    "You are loved beyond words 💕",
  ],
  rhythmName: DEFAULT_TAB_NAMES.rhythm,
  soundEnabled: true,
};

interface Store {
  defaults: AppSettings;
  users: Record<string, Partial<AppSettings>>;
}

const normalizeSettings = (input?: Partial<AppSettings>): AppSettings => {
  const tabNames: Record<TabKey, string> = {
    ...DEFAULT_TAB_NAMES,
    ...(input?.tabNames ?? {}),
    rhythm: input?.rhythmName ?? input?.tabNames?.rhythm ?? DEFAULT_TAB_NAMES.rhythm,
  };

  return {
    ...defaults,
    ...input,
    enabledTabs: { ...defaults.enabledTabs, ...(input?.enabledTabs ?? {}) },
    tabNames,
    memoryMapCrud: { ...(input?.memoryMapCrud ?? {}) },
    travelerCrud: { ...(input?.travelerCrud ?? {}) },
    rhythmName: input?.rhythmName ?? tabNames.rhythm,
  };
};

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Store>;
      return {
        defaults: normalizeSettings(parsed.defaults),
        users: parsed.users ?? {},
      };
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const p = JSON.parse(legacy) as Partial<AppSettings>;
      const migrated: Store = {
        defaults: normalizeSettings(p),
        users: {},
      };
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    /* ignore */
  }
  return { defaults: normalizeSettings(), users: {} };
}

function writeStore(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Merge defaults + per-user override into a complete AppSettings.
function merge(d: AppSettings, o?: Partial<AppSettings>): AppSettings {
  if (!o) return d;
  const tabNames: Record<TabKey, string> = {
    ...d.tabNames,
    ...(o.tabNames ?? {}),
    rhythm: o.rhythmName ?? o.tabNames?.rhythm ?? d.tabNames.rhythm,
  };
  return {
    welcomeHeading: o.welcomeHeading ?? d.welcomeHeading,
    quotes: o.quotes ?? d.quotes,
    enabledTabs: { ...d.enabledTabs, ...(o.enabledTabs ?? {}) },
    tabNames,
    memoryMapCrud: d.memoryMapCrud,
    travelerCrud: d.travelerCrud,
    surpriseWishes: o.surpriseWishes ?? d.surpriseWishes,
    rhythmName: o.rhythmName ?? tabNames.rhythm,
    soundEnabled: o.soundEnabled ?? d.soundEnabled,
  };
}

// Global (admin-default) settings.
export function getSettings(): AppSettings {
  return readStore().defaults;
}

export function saveSettings(next: AppSettings) {
  const s = readStore();
  s.defaults = normalizeSettings(next);
  writeStore(s);
}

// Per-user settings (used by Home/Surprise/Wish UI).
export function getUserSettings(userId: string | undefined | null): AppSettings {
  const s = readStore();
  if (!userId) return s.defaults;
  return merge(s.defaults, s.users[userId]);
}

export function saveUserSettings(
  userId: string,
  patch: Partial<AppSettings>,
) {
  const s = readStore();
  const nextTabNames: Record<TabKey, string> = {
    ...DEFAULT_TAB_NAMES,
    ...(s.users[userId]?.tabNames ?? {}),
    ...(patch.tabNames ?? {}),
    rhythm:
      patch.rhythmName
      ?? patch.tabNames?.rhythm
      ?? s.users[userId]?.tabNames?.rhythm
      ?? DEFAULT_TAB_NAMES.rhythm,
  };
  s.users[userId] = {
    ...(s.users[userId] ?? {}),
    ...patch,
    tabNames: nextTabNames,
    rhythmName: patch.rhythmName ?? nextTabNames.rhythm ?? s.users[userId]?.rhythmName,
  };
  writeStore(s);
}

import { useEffect, useState } from "react";

// Hook returns settings scoped to the given user (falls back to defaults).
export function useSettings(userId?: string | null) {
  const [s, setS] = useState<AppSettings>(() => getUserSettings(userId));
  useEffect(() => {
    setS(getUserSettings(userId));
    const off = subscribeSettings(() => setS(getUserSettings(userId)));
    return () => {
      off();
    };
  }, [userId]);
  return s;
}

import type { User } from "./auth-store";
export function getMemoryMapPerms(user: User | null, targetUserId: string) {
  if (!user) return { create: false, update: false, delete: false };
  if (user.role === "admin") return { create: true, update: true, delete: true };
  if (user.id !== targetUserId) return { create: false, update: false, delete: false };
  const s = readStore();
  return s.defaults.memoryMapCrud[user.id] ?? { create: false, update: false, delete: false };
}

export function getTravelerPerms(user: User | null, targetUserId: string) {
  if (!user) return { create: false, update: false, delete: false };
  if (user.role === "admin") return { create: true, update: true, delete: true };
  if (user.id !== targetUserId) return { create: false, update: false, delete: false };
  const s = readStore();
  return s.defaults.travelerCrud[user.id] ?? { create: false, update: false, delete: false };
}
