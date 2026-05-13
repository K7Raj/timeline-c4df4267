// Time Traveler: future trips/activities/visits/event plans, per-user.
// Same persistence pattern as timeline-store so it ships in vault exports.

import localforage from "localforage";

export type PlanKind = "trip" | "activity" | "visit" | "event" | "other";

export interface TravelerPlan {
  id: string;
  userId: string;
  title: string;
  notes: string;
  kind: PlanKind;
  startDate: number;
  endDate?: number;
  location?: string;
  enjoyment?: number; // 1..5
  iconKey?: string;   // lucide:<Name> | emoji:<char> | custom:<id>
  mediaKind?: "image";
  mediaMime?: string;
  createdAt: number;
}

const meta = localforage.createInstance({
  name: "gayu-vault",
  storeName: "traveler-meta",
});
const blobs = localforage.createInstance({
  name: "gayu-vault",
  storeName: "traveler-blobs",
});

const KEY = "plans";
const uid = () =>
  `tp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function readAll(): Promise<TravelerPlan[]> {
  return (await meta.getItem<TravelerPlan[]>(KEY)) ?? [];
}
async function writeAll(list: TravelerPlan[]) {
  await meta.setItem(KEY, list);
}

export async function listPlans(userId: string): Promise<TravelerPlan[]> {
  return (await readAll())
    .filter((p) => p.userId === userId)
    .sort((a, b) => a.startDate - b.startDate);
}

export async function createPlan(
  userId: string,
  data: Omit<TravelerPlan, "id" | "userId" | "createdAt" | "mediaKind" | "mediaMime"> & { file?: File | null },
): Promise<TravelerPlan> {
  const all = await readAll();
  const p: TravelerPlan = {
    id: uid(),
    userId,
    title: data.title,
    notes: data.notes,
    kind: data.kind,
    startDate: data.startDate,
    endDate: data.endDate,
    location: data.location,
    enjoyment: (data as { enjoyment?: number }).enjoyment,
    iconKey: (data as { iconKey?: string }).iconKey,
    createdAt: Date.now(),
  };
  if (data.file) {
    p.mediaKind = "image";
    p.mediaMime = data.file.type;
    await blobs.setItem(p.id, data.file);
  }
  await writeAll([p, ...all]);
  return p;
}

export async function updatePlan(
  id: string,
  data: Partial<Omit<TravelerPlan, "id" | "userId" | "createdAt">> & { file?: File | null; removeMedia?: boolean },
) {
  const all = await readAll();
  const next = await Promise.all(
    all.map(async (p) => {
      if (p.id !== id) return p;
      const u: TravelerPlan = { ...p, ...data };
      if (data.removeMedia) {
        await blobs.removeItem(id);
        delete u.mediaKind;
        delete u.mediaMime;
      }
      if (data.file) {
        u.mediaKind = "image";
        u.mediaMime = data.file.type;
        await blobs.setItem(id, data.file);
      }
      return u;
    }),
  );
  await writeAll(next);
}

export async function deletePlan(id: string) {
  await blobs.removeItem(id);
  await writeAll((await readAll()).filter((p) => p.id !== id));
}

export async function getPlanImageUrl(id: string): Promise<string | null> {
  const b = await blobs.getItem<Blob>(id);
  return b ? URL.createObjectURL(b) : null;
}
