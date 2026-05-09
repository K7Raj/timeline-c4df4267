// Make-a-Wish store. A user submits up to 3 wishes; once submitted they are
// locked and cannot be cleared by the user. Only admin can reset.

import localforage from "localforage";

export interface Wish {
  id: string;
  text: string;
  createdAt: number;
}

const store = localforage.createInstance({
  name: "gayu-vault",
  storeName: "wishes",
});

const key = (userId: string) => `wishes:${userId}`;

export async function getWishes(userId: string): Promise<Wish[]> {
  return (await store.getItem<Wish[]>(key(userId))) ?? [];
}

export async function addWish(userId: string, text: string): Promise<Wish[]> {
  const list = await getWishes(userId);
  if (list.length >= 3) return list;
  const w: Wish = {
    id: `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    text: text.trim(),
    createdAt: Date.now(),
  };
  const next = [...list, w];
  await store.setItem(key(userId), next);
  return next;
}

export async function clearWishes(userId: string) {
  await store.removeItem(key(userId));
}
