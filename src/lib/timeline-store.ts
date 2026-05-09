import localforage from "localforage";
import seed from "@/data/timeline-seed.json";

export interface TimelineEntry {
  id: string;
  userId: string;
  date: number;
  endDate?: number;
  title: string;
  content: string;
  mediaKind?: "image" | "video";
  mediaMime?: string;
  createdAt: number;
}

const metaStore = localforage.createInstance({
  name: "gayu-vault",
  storeName: "timeline-meta",
});

const blobStore = localforage.createInstance({
  name: "gayu-vault",
  storeName: "timeline-blobs",
});

const ENTRIES_KEY = "entries";

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const seededKey = (userId: string) => `seeded-v3:${userId}`;

async function ensureSeeded(userId: string) {
  // Only seed for the special "gayu" user keeping prior memories
  const all = (await metaStore.getItem<TimelineEntry[]>(ENTRIES_KEY)) ?? [];
  const has = all.some((e) => e.userId === userId);
  const flag = await metaStore.getItem<boolean>(seededKey(userId));
  if (flag || has) return;
  if (userId !== "user-gayu") {
    await metaStore.setItem(seededKey(userId), true);
    return;
  }
  const now = Date.now();
  const toLocalTs = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  const seedEntries: TimelineEntry[] = (
    seed as Array<{ date: string; endDate?: string; title: string; content: string }>
  ).map((s, idx) => ({
    id: `seed-${userId}-${idx}-${uid()}`,
    userId,
    date: toLocalTs(s.date),
    endDate: s.endDate ? toLocalTs(s.endDate) : undefined,
    title: s.title,
    content: s.content,
    createdAt: now + idx,
  }));
  await metaStore.setItem(ENTRIES_KEY, [...seedEntries, ...all]);
  await metaStore.setItem(seededKey(userId), true);
}

export async function getEntries(userId: string): Promise<TimelineEntry[]> {
  await ensureSeeded(userId);
  const list = (await metaStore.getItem<TimelineEntry[]>(ENTRIES_KEY)) ?? [];
  return list
    .filter((e) => e.userId === userId)
    .sort((a, b) => b.date - a.date);
}

async function saveEntries(entries: TimelineEntry[]) {
  await metaStore.setItem(ENTRIES_KEY, entries);
}

async function readAll() {
  return (await metaStore.getItem<TimelineEntry[]>(ENTRIES_KEY)) ?? [];
}

export async function createEntry(
  userId: string,
  data: { date: number; endDate?: number; title: string; content: string; file?: File | null },
): Promise<TimelineEntry> {
  const all = await readAll();
  const entry: TimelineEntry = {
    id: uid(),
    userId,
    date: data.date,
    endDate: data.endDate,
    title: data.title,
    content: data.content,
    createdAt: Date.now(),
  };
  if (data.file) {
    entry.mediaKind = data.file.type.startsWith("video") ? "video" : "image";
    entry.mediaMime = data.file.type;
    await blobStore.setItem(entry.id, data.file);
  }
  await saveEntries([entry, ...all]);
  return entry;
}

export async function updateEntry(
  id: string,
  data: { date: number; endDate?: number; title: string; content: string; file?: File | null; removeMedia?: boolean },
) {
  const all = await readAll();
  const next = await Promise.all(
    all.map(async (e) => {
      if (e.id !== id) return e;
      const updated: TimelineEntry = {
        ...e,
        date: data.date,
        endDate: data.endDate,
        title: data.title,
        content: data.content,
      };
      if (data.removeMedia) {
        await blobStore.removeItem(id);
        delete updated.mediaKind;
        delete updated.mediaMime;
      }
      if (data.file) {
        updated.mediaKind = data.file.type.startsWith("video") ? "video" : "image";
        updated.mediaMime = data.file.type;
        await blobStore.setItem(id, data.file);
      }
      return updated;
    }),
  );
  await saveEntries(next);
}

export async function deleteEntry(id: string) {
  await blobStore.removeItem(id);
  const all = await readAll();
  await saveEntries(all.filter((e) => e.id !== id));
}

export async function deleteEntries(ids: string[]) {
  await Promise.all(ids.map((id) => blobStore.removeItem(id)));
  const all = await readAll();
  const set = new Set(ids);
  await saveEntries(all.filter((e) => !set.has(e.id)));
}

export async function deleteAllForUser(userId: string) {
  const all = await readAll();
  const removed = all.filter((e) => e.userId === userId);
  await Promise.all(removed.map((e) => blobStore.removeItem(e.id)));
  await saveEntries(all.filter((e) => e.userId !== userId));
}

export async function getEntryBlobUrl(id: string): Promise<string | null> {
  const blob = await blobStore.getItem<Blob>(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
