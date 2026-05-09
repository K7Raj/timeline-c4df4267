import localforage from "localforage";

export type MediaKind = "image" | "video" | "audio";

export interface MediaItem {
  id: string;
  userId: string;
  folderId: string;
  name: string;
  kind: MediaKind;
  mime: string;
  size: number;
  createdAt: number;
}

export interface Folder {
  id: string;
  userId: string;
  name: string;
  emoji?: string;
  createdAt: number;
}

const metaStore = localforage.createInstance({
  name: "gayu-vault",
  storeName: "meta",
});

const blobStore = localforage.createInstance({
  name: "gayu-vault",
  storeName: "blobs",
});

const FOLDERS_KEY = "folders";
const ITEMS_KEY = "items";

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

async function readFolders(): Promise<Folder[]> {
  return (await metaStore.getItem<Folder[]>(FOLDERS_KEY)) ?? [];
}
async function writeFolders(f: Folder[]) {
  await metaStore.setItem(FOLDERS_KEY, f);
}
async function readItems(): Promise<MediaItem[]> {
  return (await metaStore.getItem<MediaItem[]>(ITEMS_KEY)) ?? [];
}
async function writeItems(i: MediaItem[]) {
  await metaStore.setItem(ITEMS_KEY, i);
}

// Folders
export async function getFolders(userId: string): Promise<Folder[]> {
  return (await readFolders()).filter((f) => f.userId === userId);
}

export async function createFolder(userId: string, name: string, emoji?: string) {
  const all = await readFolders();
  const f: Folder = { id: uid(), userId, name, emoji, createdAt: Date.now() };
  await writeFolders([f, ...all]);
  return f;
}

export async function renameFolder(id: string, name: string) {
  const all = await readFolders();
  await writeFolders(all.map((f) => (f.id === id ? { ...f, name } : f)));
}

export async function deleteFolder(id: string) {
  const all = await readFolders();
  await writeFolders(all.filter((f) => f.id !== id));
  const items = await readItems();
  const toDelete = items.filter((i) => i.folderId === id);
  for (const it of toDelete) await blobStore.removeItem(it.id);
  await writeItems(items.filter((i) => i.folderId !== id));
}

// Items
export async function getItems(userId: string): Promise<MediaItem[]> {
  return (await readItems()).filter((i) => i.userId === userId);
}

export async function getItemsByFolder(folderId: string) {
  return (await readItems()).filter((i) => i.folderId === folderId);
}

export async function addMediaFiles(userId: string, folderId: string, files: FileList | File[]) {
  const all = await readItems();
  const added: MediaItem[] = [];
  for (const file of Array.from(files)) {
    const kind: MediaKind = file.type.startsWith("video")
      ? "video"
      : file.type.startsWith("audio")
        ? "audio"
        : "image";
    const item: MediaItem = {
      id: uid(),
      userId,
      folderId,
      name: file.name,
      kind,
      mime:
        file.type ||
        (kind === "video" ? "video/mp4" : kind === "audio" ? "audio/mpeg" : "image/jpeg"),
      size: file.size,
      createdAt: Date.now(),
    };
    await blobStore.setItem(item.id, file);
    added.push(item);
  }
  await writeItems([...added, ...all]);
  return added;
}

export async function deleteItems(ids: string[]) {
  for (const id of ids) await blobStore.removeItem(id);
  const items = await readItems();
  await writeItems(items.filter((i) => !ids.includes(i.id)));
}

export async function moveItems(ids: string[], toFolderId: string) {
  const items = await readItems();
  await writeItems(
    items.map((i) => (ids.includes(i.id) ? { ...i, folderId: toFolderId } : i)),
  );
}

export async function getBlobUrl(id: string): Promise<string | null> {
  const blob = await blobStore.getItem<Blob>(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
