import localforage from "localforage";

// Snapshots / restores ALL app data (timeline + media metadata + blobs) to a
// single portable JSON bundle. The user transfers the file between phones via
// any local channel (WiFi hotspot file share, AirDrop, Quick Share, etc.).

const STORES = [
  { name: "gayu-vault", store: "meta" },
  { name: "gayu-vault", store: "blobs" },
  { name: "gayu-vault", store: "timeline-meta" },
  { name: "gayu-vault", store: "timeline-blobs" },
] as const;

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

export interface VaultBundle {
  version: 1;
  exportedAt: number;
  stores: Record<string, Record<string, unknown>>;
}

export async function exportBundle(): Promise<VaultBundle> {
  const bundle: VaultBundle = { version: 1, exportedAt: Date.now(), stores: {} };
  for (const s of STORES) {
    const inst = localforage.createInstance({ name: s.name, storeName: s.store });
    const data: Record<string, unknown> = {};
    await inst.iterate((value, key) => {
      // Encode Blob/File for JSON portability
      if (value instanceof Blob) {
        // We'll mark and convert async after iterate
        data[key] = { __blob: true, type: value.type, _ref: value };
      } else {
        data[key] = value;
      }
    });
    // Resolve blob refs to base64 (sequentially to avoid memory spikes)
    for (const k of Object.keys(data)) {
      const v = data[k] as { __blob?: boolean; type?: string; _ref?: Blob };
      if (v && v.__blob && v._ref) {
        const b64 = await blobToBase64(v._ref);
        data[k] = { __blob: true, type: v.type ?? "application/octet-stream", data: b64 };
      }
    }
    bundle.stores[`${s.name}/${s.store}`] = data;
  }
  return bundle;
}

export async function downloadBundle() {
  const bundle = await exportBundle();
  const text = JSON.stringify(bundle);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.download = `myvault-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importBundle(file: File, mode: "merge" | "replace" = "replace") {
  const text = await file.text();
  const bundle = JSON.parse(text) as VaultBundle;
  if (!bundle || bundle.version !== 1 || !bundle.stores) {
    throw new Error("Invalid vault bundle file");
  }
  for (const s of STORES) {
    const key = `${s.name}/${s.store}`;
    const data = bundle.stores[key];
    if (!data) continue;
    const inst = localforage.createInstance({ name: s.name, storeName: s.store });
    if (mode === "replace") await inst.clear();
    for (const [k, v] of Object.entries(data)) {
      const b = v as { __blob?: boolean; type?: string; data?: string };
      if (b && b.__blob && b.data) {
        await inst.setItem(k, base64ToBlob(b.data, b.type ?? "application/octet-stream"));
      } else {
        await inst.setItem(k, v);
      }
    }
  }
}
