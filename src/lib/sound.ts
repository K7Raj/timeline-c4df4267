// Lightweight Web Audio "UI sounds" engine. No asset files — synthesised
// on the fly so it's instant and works offline.
//
// Use:
//   playSound("tap" | "open" | "success" | "sparkle" | "back" | "navigate" | "error" | "wish")
// Global tap delegation auto-plays a soft click for any <button>, <a>,
// <[role=button]> or anything with [data-sound]. Disable per-element with
//   data-no-sound or data-sound="off".
//
// Enable / disable via setSoundEnabled(); persisted in localStorage so it
// also affects the very first click.

const KEY = "app-sound-enabled-v1";

let enabled = (() => {
  try { return localStorage.getItem(KEY) !== "false"; } catch { return true; }
})();

export function isSoundEnabled() { return enabled; }
export function setSoundEnabled(v: boolean) {
  enabled = v;
  try { localStorage.setItem(KEY, v ? "true" : "false"); } catch { /* ignore */ }
}

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneOpts { freq: number; dur: number; type?: OscillatorType; gain?: number; slideTo?: number; }

function tone({ freq, dur, type = "sine", gain = 0.06, slideTo }: ToneOpts, delay = 0) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export type SoundName = "tap" | "open" | "success" | "sparkle" | "back" | "navigate" | "error" | "wish";

export function playSound(name: SoundName) {
  if (!enabled) return;
  switch (name) {
    case "tap":      tone({ freq: 880, dur: 0.06, type: "triangle", gain: 0.04 }); break;
    case "open":     tone({ freq: 520, dur: 0.10, type: "triangle", gain: 0.05 });
                     tone({ freq: 780, dur: 0.10, type: "sine", gain: 0.04 }, 0.05); break;
    case "back":     tone({ freq: 620, dur: 0.10, type: "triangle", gain: 0.05, slideTo: 320 }); break;
    case "navigate": tone({ freq: 660, dur: 0.08, type: "sine", gain: 0.05 });
                     tone({ freq: 990, dur: 0.10, type: "sine", gain: 0.04 }, 0.06); break;
    case "success":  [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.16, type: "triangle", gain: 0.06 }, i * 0.08)); break;
    case "sparkle":  [1568, 1976, 2349].forEach((f, i) => tone({ freq: f, dur: 0.12, type: "sine", gain: 0.035 }, i * 0.05)); break;
    case "wish":     [392, 523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.18, type: "sine", gain: 0.05 }, i * 0.07)); break;
    case "error":    tone({ freq: 220, dur: 0.18, type: "sawtooth", gain: 0.05, slideTo: 140 }); break;
  }
}

// ---------- Global tap delegation ----------
let installed = false;
export function installSoundDelegate() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener(
    "pointerdown",
    (ev) => {
      if (!enabled) return;
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      const el = t.closest<HTMLElement>(
        "button, a, [role='button'], [data-sound], input[type='checkbox'], input[type='radio'], [role='switch'], [role='tab'], [role='menuitem']",
      );
      if (!el) return;
      if (el.hasAttribute("data-no-sound") || el.getAttribute("data-sound") === "off") return;
      const explicit = el.getAttribute("data-sound") as SoundName | null;
      playSound(explicit && explicit !== "off" ? explicit : "tap");
    },
    { capture: true, passive: true },
  );
}
