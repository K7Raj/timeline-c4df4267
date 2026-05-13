// Admin-managed custom library: emotion emojis + uploaded icons.
// Used by both Memory Map and Time Traveler icon pickers.

import { useEffect, useState } from "react";

export interface CustomEmotion {
  id: string;          // stable id
  emoji: string;       // single emoji char(s)
  label: string;       // user-supplied name
}

export interface CustomIcon {
  id: string;
  label: string;
  dataUrl: string;     // image/png|svg+xml (base64 data url)
}

interface Library {
  emotions: CustomEmotion[];
  icons: CustomIcon[];
}

const KEY = "custom-library-v1";
const empty: Library = { emotions: [], icons: [] };

const listeners = new Set<() => void>();

function read(): Library {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...empty };
    const p = JSON.parse(raw) as Partial<Library>;
    return { emotions: p.emotions ?? [], icons: p.icons ?? [] };
  } catch {
    return { ...empty };
  }
}

function write(l: Library) {
  localStorage.setItem(KEY, JSON.stringify(l));
  listeners.forEach((fn) => fn());
}

export const getLibrary = read;

export function addEmotion(emoji: string, label: string) {
  const l = read();
  const id = `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  l.emotions.push({ id, emoji, label });
  write(l);
}
export function removeEmotion(id: string) {
  const l = read();
  l.emotions = l.emotions.filter((e) => e.id !== id);
  write(l);
}

export function addIcon(label: string, dataUrl: string) {
  const l = read();
  const id = `i-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  l.icons.push({ id, label, dataUrl });
  write(l);
}
export function removeIcon(id: string) {
  const l = read();
  l.icons = l.icons.filter((i) => i.id !== id);
  write(l);
}

export function useLibrary() {
  const [l, setL] = useState<Library>(read);
  useEffect(() => {
    const fn = () => setL(read());
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return l;
}
