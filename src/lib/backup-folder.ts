// Optional "encrypted backup folder": admin-chosen directory on the
// device where the app can drop encrypted vault snapshots on demand.
// Uses the File System Access API when available (Chromium / desktop
// Safari 17+); falls back to a download otherwise.

import localforage from "localforage";
import { exportEncryptedVault, suggestedFileName } from "./share-store";

type DirHandle = FileSystemDirectoryHandle & { name: string };

const KEY = "backup-folder-handle-v1";
const NAME_KEY = "backup-folder-name-v1";

const store = localforage.createInstance({
  name: "gayu-vault",
  storeName: "kv-mirror",
});

export function isPickerSupported(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

export async function pickBackupFolder(): Promise<string | null> {
  const w = window as unknown as {
    showDirectoryPicker?: (opts?: { mode?: "read" | "readwrite" }) => Promise<DirHandle>;
  };
  if (!w.showDirectoryPicker) return null;
  const handle = await w.showDirectoryPicker({ mode: "readwrite" });
  await store.setItem(KEY, handle);
  await store.setItem(NAME_KEY, handle.name);
  return handle.name;
}

export async function getBackupFolderName(): Promise<string | null> {
  return (await store.getItem<string>(NAME_KEY)) ?? null;
}

export async function clearBackupFolder() {
  await store.removeItem(KEY);
  await store.removeItem(NAME_KEY);
}

async function ensurePermission(handle: DirHandle): Promise<boolean> {
  const h = handle as DirHandle & {
    queryPermission?: (opts: { mode: "readwrite" }) => Promise<PermissionState>;
    requestPermission?: (opts: { mode: "readwrite" }) => Promise<PermissionState>;
  };
  if (h.queryPermission) {
    const q = await h.queryPermission({ mode: "readwrite" });
    if (q === "granted") return true;
  }
  if (h.requestPermission) {
    const r = await h.requestPermission({ mode: "readwrite" });
    return r === "granted";
  }
  return true;
}

export async function saveEncryptedSnapshot(passphrase: string): Promise<{ method: "folder" | "download"; name: string }> {
  const blob = await exportEncryptedVault(passphrase);
  const name = suggestedFileName();
  const handle = (await store.getItem<DirHandle>(KEY)) ?? null;
  if (handle && (await ensurePermission(handle))) {
    const file = await handle.getFileHandle(name, { create: true });
    const writable = await (file as FileSystemFileHandle & { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
    await writable.write(blob);
    await writable.close();
    return { method: "folder", name };
  }
  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { method: "download", name };
}