import { useEffect, useMemo, useState } from "react";
import { Download, X, Share } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const COOLDOWN_MS = 3 * 86400000;

export const InstallPrompt = () => {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosVisible, setIosVisible] = useState(false);
  const [hidden, setHidden] = useState(false);
  const isPreviewHost = useMemo(
    () =>
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com"),
    [],
  );

  useEffect(() => {
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (Date.now() - dismissedAt < COOLDOWN_MS) return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS-only
      window.navigator.standalone === true;
    if (isStandalone) return;

    if (isPreviewHost) {
      setEvt({
        prompt: async () => {
          window.open(window.location.origin, "_blank", "noopener,noreferrer");
        },
        userChoice: Promise.resolve({ outcome: "accepted" as const }),
      } as BeforeInstallPromptEvent);
      return;
    }

    const ua = navigator.userAgent || "";
    const isIos = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari) {
      // Safari iOS does not fire beforeinstallprompt — show instructions.
      setIosVisible(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isPreviewHost]);

  if ((!evt && !iosVisible) || hidden) return null;

  const install = async () => {
    try {
      if (isPreviewHost && evt) {
        setHidden(true);
        return;
      }
      if (evt) {
        await evt.prompt();
        await evt.userChoice;
      }
    } finally {
      setHidden(true);
      setEvt(null);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[min(100vw-1rem,24rem)] rounded-2xl border border-border bg-gradient-card shadow-elegant p-3 flex items-center gap-3 animate-fade-in">
      <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-primary-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">Install Timeline</p>
        <p className="text-[0.7rem] text-muted-foreground leading-tight">
          {isPreviewHost
            ? "Open the published app, then install it on your phone."
            : iosVisible && !evt
              ? <span className="inline-flex items-center gap-1">Tap <Share className="w-3 h-3" /> then "Add to Home Screen".</span>
              : "Add to your home screen for a native-app feel."}
        </p>
      </div>
      {(evt || isPreviewHost) && (
        <button
          type="button"
          onClick={install}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-gradient-primary text-primary-foreground text-xs font-semibold"
        >
          {isPreviewHost ? "Open app" : "Install"}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default InstallPrompt;
