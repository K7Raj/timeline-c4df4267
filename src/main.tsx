import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply persisted theme before first paint to avoid mode-flicker bugs
try {
  const saved = localStorage.getItem("theme");
  if (saved === "light") document.documentElement.classList.add("light");
  else document.documentElement.classList.remove("light");
} catch {
  /* ignore */
}

createRoot(document.getElementById("root")!).render(<App />);
