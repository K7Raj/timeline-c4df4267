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
import { restoreTrackedKey, snapshotTrackedKeys, TRACKED_KEYS } from "./storage-bridge";

const STORES = [
  { name: "gayu-vault", store: "meta" },
  { name: "gayu-vault", store: "blobs" },
  { name: "gayu-vault", store: "timeline-meta" },
  { name: "gayu-vault", store: "timeline-blobs" },
  { name: "gayu-vault", store: "rhythm-meta" },
  { name: "gayu-vault", store: "rhythm-blobs" },
  { name: "gayu-vault", store: "wishes" },
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

async function buildManifest(): Promise<VaultManifest> {
  const manifest: VaultManifest = {
    version: 2,
    exportedAt: Date.now(),
    trackedKeys: await snapshotTrackedKeys(),
    stores: {},
  };
  for (const s of STORES) {
    const inst = localforage.createInstance({ name: s.name, storeName: s.store });
    const data: Record<string, unknown> = {};
    const blobRefs: Array<{ key: string; blob: Blob }> = [];
    await inst.iterate((value, key) => {
      if (value instanceof Blob) {
        blobRefs.push({ key, blob: value });
      } else {
        data[key] = value;
      }
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

async function applyManifest(manifest: VaultManifest, mode: "merge" | "replace") {
  if (manifest.trackedKeys) {
    if (mode === "replace") {
      for (const k of TRACKED_KEYS) await restoreTrackedKey(k, null);
    }
    for (const [k, v] of Object.entries(manifest.trackedKeys)) {
      await restoreTrackedKey(k, v);
    }
  }
  for (const s of STORES) {
    const key = `${s.name}/${s.store}`;
    const data = manifest.stores[key];
    if (!data) continue;
    const inst = localforage.createInstance({ name: s.name, storeName: s.store });
    if (mode === "replace") await inst.clear();
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

export async function exportEncryptedVault(passphrase: string): Promise<Blob> {
  if (!passphrase || passphrase.length < 4) {
    throw new Error("Passphrase must be at least 4 characters");
  }
  const manifest = await buildManifest();

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
  await applyManifest(manifest, mode);
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
