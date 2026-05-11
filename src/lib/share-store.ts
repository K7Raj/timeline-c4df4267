// Encrypted vault share.
//
// Export   →  gather every IndexedDB store + tracked localStorage keys
//          →  zip (JSZip)
//          →  AES-GCM encrypt with PBKDF2-derived key from a passphrase
//          →  .vault file
//          →  hand to OS share sheet (Bluetooth / AirDrop / Nearby Share / …)
//
// Import   →  reverse: decrypt → unzip → restore everything → reload.
//
// The passphrase never leaves the device. Both sides must agree on it out
// of band ("the wedding date", a 4-word phrase, etc.).

import localforage from "localforage";
import JSZip from "jszip";
import { restoreTrackedKey, snapshotTrackedKeys } from "./storage-bridge";

const STORES = [
  { name: "gayu-vault", store: "meta" },
  { name: "gayu-vault", store: "blobs" },
  { name: "gayu-vault", store: "timeline-meta" },
  { name: "gayu-vault", store: "timeline-blobs" },
  { name: "gayu-vault", store: "rhythm-meta" },
  { name: "gayu-vault", store: "rhythm-blobs" },
  { name: "gayu-vault", store: "wishes" },
  { name: "gayu-vault", store: "traveler-meta" },
  { name: "gayu-vault", store: "traveler-blobs" },
  { name: "gayu-vault", store: "kv-mirror" },
] as const;

const MAGIC = "VAULT1"; // file header
const SALT_LEN = 16;
const IV_LEN = 12;
const PBKDF_ITERS = 200_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

const base64ToBlob = (b64: string, type: string) => {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
};

interface VaultManifest {
  version: 2;
  exportedAt: number;
  trackedKeys: Record<string, string>;
  stores: Record<string, Record<string, unknown>>;
}

// Set of userIds whose data should be included. If null/undefined → include
// everything (admin "share everything" mode or unfiltered import).
type Scope = Set<string> | null;

// Best-effort: many stored values have a `userId` field. Filter if present;
// keep otherwise (e.g. global lookup tables).
function valueMatchesScope(value: unknown, scope: Scope): boolean {
  if (!scope) return true;
  if (!value || typeof value !== "object") return true;
  const v = value as { userId?: string };
  if (typeof v.userId === "string") return scope.has(v.userId);
  // Wishes are stored under key `wishes:<userId>`; the value itself doesn't
  // carry the id, so the key-level filter below handles them.
  return true;
}

function keyMatchesScope(key: string, scope: Scope): boolean {
  if (!scope) return true;
  // Wish-store keys: `wishes:<userId>`
  if (key.startsWith("wishes:")) return scope.has(key.slice("wishes:".length));
  // Settings-store legacy seeded flag: `seeded-v3:<userId>` (no longer
  // written but might exist in older devices)
  if (key.startsWith("seeded-v3:")) return scope.has(key.slice("seeded-v3:".length));
  return true;
}

async function buildManifest(scope: Scope): Promise<VaultManifest> {
  const manifest: VaultManifest = {
    version: 2,
    exportedAt: Date.now(),
    trackedKeys: await snapshotTrackedKeys(),
    stores: {},
  };

  // Filter the user list inside `vault-users` to the chosen scope.
  if (scope && manifest.trackedKeys["vault-users"]) {
    try {
      const arr = JSON.parse(manifest.trackedKeys["vault-users"]) as Array<{ id: string }>;
      manifest.trackedKeys["vault-users"] = JSON.stringify(arr.filter((u) => scope.has(u.id)));
    } catch {
      /* ignore */
    }
  }

  for (const s of STORES) {
    const inst = localforage.createInstance({ name: s.name, storeName: s.store });
    const data: Record<string, unknown> = {};
    const blobRefs: Array<{ key: string; blob: Blob }> = [];
    await inst.iterate((value, key) => {
      // Some stores hold list-shaped values where every entry has its own
      // userId — handle those by filtering the inner array.
      if (Array.isArray(value)) {
        const filtered = (value as unknown[]).filter((item) => valueMatchesScope(item, scope));
        if (filtered.length === 0 && scope) return;
        data[key] = filtered;
        return;
      }
      if (!keyMatchesScope(key, scope) || !valueMatchesScope(value, scope)) return;
      if (value instanceof Blob) blobRefs.push({ key, blob: value });
      else data[key] = value;
    });
    for (const { key, blob } of blobRefs) {
      data[key] = {
        __blob: true,
        type: blob.type || "application/octet-stream",
        data: await blobToBase64(blob),
      };
    }
    manifest.stores[`${s.name}/${s.store}`] = data;
  }
  return manifest;
}

// Per-user, non-destructive merge. Only data for the userIds covered by
// the manifest is replaced; users not present in the manifest are left
// completely untouched (vault-users, settings, notices, timeline entries,
// traveler plans, rhythm videos, multimedia, wishes, and their blobs).
async function applyManifest(manifest: VaultManifest) {
  // Determine the set of userIds the manifest carries data for. The
  // exporter already filtered `vault-users` to the selected scope, so we
  // can read it back to know who's in play.
  let scopedIds: Set<string> | null = null;
  const usersTracked = manifest.trackedKeys?.["vault-users"];
  if (usersTracked) {
    try {
      const arr = JSON.parse(usersTracked) as Array<{ id: string }>;
      scopedIds = new Set(arr.map((u) => u.id));
    } catch { /* ignore */ }
  }

  // ---- Tracked localStorage keys (merge per user) ----
  if (manifest.trackedKeys) {
    for (const [k, v] of Object.entries(manifest.trackedKeys)) {
      if (k === "theme" || k === "media-view-prefs") continue; // device-local
      if (k === "vault-users") {
        try {
          const incoming = JSON.parse(v) as Array<{ id: string }>;
          const existingRaw = localStorage.getItem("vault-users");
          const existing = existingRaw ? (JSON.parse(existingRaw) as Array<{ id: string }>) : [];
          const incomingIds = new Set(incoming.map((u) => u.id));
          const merged = [
            ...existing.filter((u) => !incomingIds.has(u.id)),
            ...incoming,
          ];
          await restoreTrackedKey("vault-users", JSON.stringify(merged));
        } catch {
          await restoreTrackedKey(k, v);
        }
      } else if (k === "app-settings-v2") {
        try {
          const incoming = JSON.parse(v) as { defaults?: unknown; users?: Record<string, unknown> };
          const existingRaw = localStorage.getItem("app-settings-v2");
          const existing = existingRaw
            ? (JSON.parse(existingRaw) as { defaults?: unknown; users?: Record<string, unknown> })
            : { defaults: incoming.defaults, users: {} };
          const mergedUsers: Record<string, unknown> = { ...(existing.users ?? {}) };
          for (const [uid, settings] of Object.entries(incoming.users ?? {})) {
            if (!scopedIds || scopedIds.has(uid)) mergedUsers[uid] = settings;
          }
          // Preserve current defaults; only seed if device has none yet.
          const merged = {
            defaults: existing.defaults ?? incoming.defaults,
            users: mergedUsers,
          };
          await restoreTrackedKey("app-settings-v2", JSON.stringify(merged));
        } catch {
          await restoreTrackedKey(k, v);
        }
      } else if (k === "notices-v1") {
        try {
          const incoming = JSON.parse(v) as Array<{ userId: string }>;
          const existingRaw = localStorage.getItem("notices-v1");
          const existing = existingRaw ? (JSON.parse(existingRaw) as Array<{ userId: string }>) : [];
          const merged = scopedIds
            ? [...existing.filter((n) => !scopedIds!.has(n.userId)), ...incoming]
            : [...existing, ...incoming];
          await restoreTrackedKey("notices-v1", JSON.stringify(merged));
        } catch {
          await restoreTrackedKey(k, v);
        }
      } else {
        // Legacy keys (e.g. app-settings-v1) – overwrite directly.
        await restoreTrackedKey(k, v);
      }
    }
  }

  // ---- IndexedDB stores (merge per user) ----
  // List-shaped stores: keep records whose userId isn't in scope, and
  // append manifest records (which were filtered by userId at export).
  const LIST_KEYS: Record<string, string> = {
    "gayu-vault/timeline-meta": "entries",
    "gayu-vault/traveler-meta": "plans",
    "gayu-vault/rhythm-meta": "videos",
    "gayu-vault/meta": "", // multi-key (folders + items)
  };
  const META_LIST_KEYS_FOR_META = ["folders", "items"];

  // Helper: the matching blob store for each meta store.
  const BLOB_PAIR: Record<string, string> = {
    "gayu-vault/timeline-meta": "gayu-vault/timeline-blobs",
    "gayu-vault/traveler-meta": "gayu-vault/traveler-blobs",
    "gayu-vault/rhythm-meta": "gayu-vault/rhythm-blobs",
    "gayu-vault/meta": "gayu-vault/blobs",
  };

  const inst = (path: string) => {
    const [name, store] = path.split("/");
    return localforage.createInstance({ name, storeName: store });
  };

  for (const metaPath of Object.keys(LIST_KEYS)) {
    const data = manifest.stores[metaPath];
    if (!data) continue;
    const metaInst = inst(metaPath);
    const blobInst = inst(BLOB_PAIR[metaPath]);
    const incomingBlobs = manifest.stores[BLOB_PAIR[metaPath]] ?? {};

    const listKeys = metaPath === "gayu-vault/meta" ? META_LIST_KEYS_FOR_META : [LIST_KEYS[metaPath]];

    // Track which old blob ids are being dropped so we can remove them.
    const removedIds = new Set<string>();
    // Track new ids to know which incoming blobs to write.
    const incomingIds = new Set<string>();

    for (const listKey of listKeys) {
      const incomingList = (data[listKey] as Array<{ id: string; userId: string }> | undefined) ?? [];
      const existing = ((await metaInst.getItem<Array<{ id: string; userId: string }>>(listKey)) ?? []);
      const dropIds = new Set(
        existing
          .filter((r) => !scopedIds || scopedIds.has(r.userId))
          .map((r) => r.id),
      );
      dropIds.forEach((id) => removedIds.add(id));
      incomingList.forEach((r) => incomingIds.add(r.id));
      const kept = existing.filter((r) => !dropIds.has(r.id));
      // Avoid duplicates: drop any kept record whose id collides with an incoming one.
      const incomingIdSet = new Set(incomingList.map((r) => r.id));
      const merged = [...kept.filter((r) => !incomingIdSet.has(r.id)), ...incomingList];
      await metaInst.setItem(listKey, merged);
    }

    // Drop orphan blobs for replaced records, then write incoming blobs.
    for (const id of removedIds) {
      if (!incomingIds.has(id)) await blobInst.removeItem(id);
    }
    for (const [id, v] of Object.entries(incomingBlobs)) {
      const b = v as { __blob?: boolean; type?: string; data?: string };
      if (b && b.__blob && typeof b.data === "string") {
        await blobInst.setItem(id, base64ToBlob(b.data, b.type ?? "application/octet-stream"));
      }
    }
  }

  // ---- Wishes (one key per user) ----
  const wishData = manifest.stores["gayu-vault/wishes"];
  if (wishData) {
    const wishInst = inst("gayu-vault/wishes");
    for (const [k, v] of Object.entries(wishData)) {
      // key shape: "wishes:<userId>"
      const uid = k.startsWith("wishes:") ? k.slice("wishes:".length) : null;
      if (uid && scopedIds && !scopedIds.has(uid)) continue;
      await wishInst.setItem(k, v);
    }
  }

  // ---- kv-mirror is rebuilt automatically by restoreTrackedKey above ----
}

// ---- Crypto ----

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF_ITERS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

// Copy any Uint8Array view into a fresh ArrayBuffer-backed one so it
// satisfies `BufferSource` (TS dislikes ArrayBufferLike from generic views).
function toBufSource(u: Uint8Array): Uint8Array {
  const fresh = new Uint8Array(new ArrayBuffer(u.byteLength));
  fresh.set(u);
  return fresh;
}

// ---- Public API ----

export async function exportEncryptedVault(
  passphrase: string,
  opts?: { userIds?: string[] },
): Promise<Blob> {
  if (!passphrase || passphrase.length < 4) {
    throw new Error("Passphrase must be at least 4 characters");
  }
  const scope = opts?.userIds && opts.userIds.length > 0 ? new Set(opts.userIds) : null;
  const manifest = await buildManifest(scope);

  // Pack manifest into a zip first (gives compression on huge base64 blobs).
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest));
  const zipped = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  // Encrypt the zipped bytes.
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(passphrase, salt);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, zipped as BufferSource),
  );

  // File layout: MAGIC(6) | salt(16) | iv(12) | ciphertext
  const file = concatBytes(enc.encode(MAGIC), salt, iv, cipher);
  return new Blob([file as BlobPart], { type: "application/octet-stream" });
}

export async function importEncryptedVault(
  file: File | Blob,
  passphrase: string,
  mode: "merge" | "replace" = "replace",
) {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.length < MAGIC.length + SALT_LEN + IV_LEN + 16) {
    throw new Error("File is too small to be a vault");
  }
  const magic = dec.decode(buf.slice(0, MAGIC.length));
  if (magic !== MAGIC) {
    throw new Error("Not a Surprise Vault file");
  }
  const salt = buf.slice(MAGIC.length, MAGIC.length + SALT_LEN);
  const iv = buf.slice(MAGIC.length + SALT_LEN, MAGIC.length + SALT_LEN + IV_LEN);
  const cipher = buf.slice(MAGIC.length + SALT_LEN + IV_LEN);

  const key = await deriveKey(passphrase, salt);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, cipher as BufferSource);
  } catch {
    throw new Error("Wrong passphrase or corrupted file");
  }

  const zip = await JSZip.loadAsync(plain);
  const file0 = zip.file("manifest.json");
  if (!file0) throw new Error("Vault missing manifest");
  const manifest = JSON.parse(await file0.async("string")) as VaultManifest;
  if (manifest.version !== 2) {
    throw new Error("Unsupported vault version");
  }
  void mode;
  await applyManifest(manifest);
}

// ---- Trigger native share sheet ----

export function suggestedFileName() {
  const stamp = new Date().toISOString().slice(0, 10);
  return `surprise-vault-${stamp}.vault`;
}

interface ShareResult {
  method: "native" | "download";
}

export async function shareOrDownload(blob: Blob, filename: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: "Surprise Vault",
        text: "Encrypted memory vault",
      });
      return { method: "native" };
    } catch (e) {
      // user cancelled or share failed — fall through to download
      const err = e as { name?: string };
      if (err.name !== "AbortError") {
        // fall through to download
      } else {
        throw e;
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { method: "download" };
}

// ---- Legacy compatibility (old JSON exports) ----
// Kept so anyone with a v1 .json bundle from before the encryption update
// can still import. Detected by file extension / magic mismatch.

export async function importLegacyJson(file: File) {
  const text = await file.text();
  const bundle = JSON.parse(text) as {
    version: 1;
    stores: Record<string, Record<string, unknown>>;
  };
  if (!bundle || bundle.version !== 1 || !bundle.stores) {
    throw new Error("Invalid legacy bundle");
  }
  for (const [storeKey, data] of Object.entries(bundle.stores)) {
    const [name, store] = storeKey.split("/");
    const inst = localforage.createInstance({ name, storeName: store });
    await inst.clear();
    for (const [k, v] of Object.entries(data)) {
      const b = v as { __blob?: boolean; type?: string; data?: string };
      if (b && b.__blob && typeof b.data === "string") {
        await inst.setItem(k, base64ToBlob(b.data, b.type ?? "application/octet-stream"));
      } else {
        await inst.setItem(k, v);
      }
    }
  }
}

// Backwards-compat aliases for any code that still imports the old names.
export const downloadBundle = async () => {
  throw new Error("Plain-JSON export removed. Use the new encrypted share dialog.");
};
export const importBundle = async (file: File) => {
  if (file.name.endsWith(".json")) return importLegacyJson(file);
  throw new Error("Use the encrypted import flow with a passphrase.");
};
