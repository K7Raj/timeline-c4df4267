import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { bootStorageBridge } from "@/lib/storage-bridge";
import { installSoundDelegate } from "@/lib/sound";

// Apply persisted theme before first paint to avoid mode-flicker bugs
try {
  const saved = localStorage.getItem("theme");
  if (saved === "light") document.documentElement.classList.add("light");
  else document.documentElement.classList.remove("light");
} catch {
  /* ignore */
}

// Hydrate any tracked keys from IndexedDB (covers fresh devices that just
// imported a vault) and start mirroring future writes. Then mount React.
void bootStorageBridge().finally(() => {
  installSoundDelegate();
  createRoot(document.getElementById("root")!).render(<App />);
});
