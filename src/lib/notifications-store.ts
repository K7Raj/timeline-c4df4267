// Lightweight per-user notification log. Admin actions on a user push a
// notification record so the user sees it in the bell on next visit.

export interface Notice {
  id: string;
  userId: string; // recipient
  message: string;
  createdAt: number;
  read: boolean;
}

const KEY = "notices-v1";
const listeners = new Set<() => void>();

const uid = () =>
  `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function readAll(): Notice[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Notice[];
  } catch {
    return [];
  }
}
function writeAll(list: Notice[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
  listeners.forEach((l) => l());
}

export function pushNotice(userId: string, message: string) {
  const all = readAll();
  all.unshift({ id: uid(), userId, message, createdAt: Date.now(), read: false });
  writeAll(all);
}

export function getNotices(userId: string): Notice[] {
  return readAll().filter((n) => n.userId === userId);
}

export function markAllRead(userId: string) {
  const all = readAll();
  writeAll(all.map((n) => (n.userId === userId ? { ...n, read: true } : n)));
}

export function clearNotices(userId: string) {
  writeAll(readAll().filter((n) => n.userId !== userId));
}

export function subscribeNotices(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

import { useEffect, useState } from "react";
export function useNotices(userId: string | undefined) {
  const [list, setList] = useState<Notice[]>(() =>
    userId ? getNotices(userId) : [],
  );
  useEffect(() => {
    if (!userId) return;
    setList(getNotices(userId));
    const off = subscribeNotices(() => setList(getNotices(userId)));
    return () => {
      off();
    };
  }, [userId]);
  return list;
}
