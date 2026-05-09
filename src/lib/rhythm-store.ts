// Rhythm-of-Us: a dedicated, simple video library that lives entirely in
// browser local storage (IndexedDB via localforage). Reuses the media-store
// blob layer but keeps its own metadata namespace so it doesn't mix with
// the Multimedia tab.

import localforage from "localforage";

export interface RhythmVideo {
  id: string;
  userId: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
  thumb?: string; // data URL
}

const meta = localforage.createInstance({
  name: "gayu-vault",
  storeName: "rhythm-meta",
});

const blobs = localforage.createInstance({
  name: "gayu-vault",
  storeName: "rhythm-blobs",
});

const KEY = "videos";
const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

async function readAll(): Promise<RhythmVideo[]> {
  return (await meta.getItem<RhythmVideo[]>(KEY)) ?? [];
}

export async function listVideos(userId: string): Promise<RhythmVideo[]> {
  const all = await readAll();
  return all.filter((v) => v.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

async function captureThumb(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      const cleanup = () => URL.revokeObjectURL(url);
      const fail = () => { cleanup(); resolve(undefined); };
      video.onloadedmetadata = () => {
        try { video.currentTime = Math.min(0.5, (video.duration || 1) / 2); } catch { fail(); }
      };
      video.onseeked = () => {
        try {
          const w = 320;
          const h = Math.round((video.videoHeight / video.videoWidth) * w) || 180;
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return fail();
          ctx.drawImage(video, 0, 0, w, h);
          const data = canvas.toDataURL("image/jpeg", 0.7);
          cleanup();
          resolve(data);
        } catch { fail(); }
      };
      video.onerror = fail;
      // Safety timeout
      setTimeout(fail, 4000);
    } catch { resolve(undefined); }
  });
}

export async function addVideos(userId: string, files: FileList | File[]) {
  const all = await readAll();
  const added: RhythmVideo[] = [];
  for (const file of Array.from(files)) {
    if (!file.type.startsWith("video")) continue;
    const thumb = await captureThumb(file);
    const v: RhythmVideo = {
      id: uid(),
      userId,
      name: file.name,
      mime: file.type || "video/mp4",
      size: file.size,
      createdAt: Date.now(),
      thumb,
    };
    await blobs.setItem(v.id, file);
    added.push(v);
  }
  await meta.setItem(KEY, [...added, ...all]);
  return added;
}

export async function renameVideo(id: string, name: string) {
  const all = await readAll();
  await meta.setItem(
    KEY,
    all.map((v) => (v.id === id ? { ...v, name } : v)),
  );
}

export async function deleteVideos(ids: string[]) {
  for (const id of ids) await blobs.removeItem(id);
  const all = await readAll();
  await meta.setItem(KEY, all.filter((v) => !ids.includes(v.id)));
}

export async function getVideoUrl(id: string): Promise<string | null> {
  const blob = await blobs.getItem<Blob>(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
