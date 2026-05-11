import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Send, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/auth-store";
import { addWish, getWishes, type Wish as WishType } from "@/lib/wish-store";
import lampImg from "@/assets/lamp.png";
import genieImg from "@/assets/genie.png";

const Wish = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [phase, setPhase] = useState<"lamp" | "genie" | "done">("lamp");
  const [wishes, setWishes] = useState<WishType[]>([]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [snap, setSnap] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; size: number }[]>([]);
  const [reacting, setReacting] = useState(false);
  const reactTimer = useRef<number | null>(null);

  const triggerReact = () => {
    setReacting(true);
    if (reactTimer.current) window.clearTimeout(reactTimer.current);
    reactTimer.current = window.setTimeout(() => setReacting(false), 600);
  };

  const spawnStars = () => {
    // Cluster sparkles around the genie (center, ~40-60% horizontally,
    // ~35-65% vertically) instead of all over the screen.
    const batch = Array.from({ length: 14 }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * 22; // % from center
      return {
        id: Date.now() + i,
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
        size: 12 + Math.random() * 20,
      };
    });
    setBursts((b) => [...b, ...batch]);
    window.setTimeout(() => {
      setBursts((b) => b.filter((s) => !batch.find((x) => x.id === s.id)));
    }, 1400);
  };

  useEffect(() => {
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    // Preload genie ahead of the lamp tap so the transition feels instant
    const preload = new Image();
    preload.src = genieImg;
    (async () => {
      const list = await getWishes(user.id);
      setWishes(list);
      if (list.length >= 3) setPhase("done");
    })();
  }, [user, navigate]);

  useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, []);

  const isAdmin = user?.role === "admin";
  const remaining = Math.max(0, 3 - wishes.length);

  const touchLamp = () => setPhase("genie");

  const handleSubmit = async () => {
    if (!user || !text.trim() || wishes.length >= 3) return;
    setSubmitting(true);
    // Snap finger + reaction
    setSnap(true);
    triggerReact();
    spawnStars();
    window.setTimeout(() => setSnap(false), 700);

    const next = await addWish(user.id, text);
    setWishes(next);
    setText("");
    const left = 3 - next.length;
    setFlash(
      `✨ Your genie will fulfill the wish — ${left} wish${left === 1 ? "" : "es"} remaining.`,
    );
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 4000);
    if (next.length >= 3) {
      window.setTimeout(() => setPhase("done"), 800);
    }
    setSubmitting(false);
  };

  if (!user) return null;

  return (
    <main className="min-h-[100dvh] relative overflow-hidden bg-[radial-gradient(ellipse_at_top,hsl(265_60%_22%)_0%,hsl(245_50%_8%)_60%)]">
      {/* Twinkling stars */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 60 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-amber-100 animate-twinkle"
            style={{
              width: 1 + Math.random() * 3,
              height: 1 + Math.random() * 3,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${1.5 + Math.random() * 3}s`,
              boxShadow: "0 0 6px rgba(254, 243, 199, 0.9)",
            }}
          />
        ))}
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-purple-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-400/15 blur-3xl" />
      </div>

      <style>{`
        @keyframes twinkle {
          0%,100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.4); }
        }
        .animate-twinkle { animation: twinkle 2.5s ease-in-out infinite; }
        @keyframes lamp-float {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-lamp { animation: lamp-float 3s ease-in-out infinite; }
        @keyframes lamp-shake {
          0%,100% { transform: rotate(0deg) translateY(0); }
          25% { transform: rotate(-3deg) translateY(-2px); }
          75% { transform: rotate(3deg) translateY(2px); }
        }
        .animate-lamp-shake { animation: lamp-shake 0.6s ease-in-out 3; }
        @keyframes genie-rise {
          from { transform: translateY(40px) scale(0.6); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .animate-genie-rise { animation: genie-rise 0.8s ease-out; }
        @keyframes snap-flash {
          0% { opacity: 0; transform: scale(0.5); }
          30% { opacity: 1; transform: scale(1.4); }
          100% { opacity: 0; transform: scale(2); }
        }
        .animate-snap { animation: snap-flash 0.7s ease-out; }
        @keyframes burst {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4) rotate(0deg); }
          30% { opacity: 1; transform: translate(-50%, -50%) scale(1.3) rotate(45deg); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(2) rotate(180deg); }
        }
        .animate-burst { animation: burst 1.4s ease-out forwards; }
        @keyframes genie-react {
          0%,100% { transform: translateY(0) rotate(0deg) scale(1); }
          30% { transform: translateY(-4px) rotate(-2deg) scale(1.03); }
          70% { transform: translateY(2px) rotate(2deg) scale(1.01); }
        }
        .animate-genie-react { animation: genie-react 0.6s ease-in-out; }
      `}</style>

      <header className="relative z-20 sticky top-0 backdrop-blur-xl bg-background/40 border-b border-amber-300/10">
        <div className="flex items-center gap-3 px-4 h-14 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/home")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1 bg-gradient-to-r from-amber-300 to-pink-300 bg-clip-text text-transparent">
            Make a Wish
          </h1>
          <button
            onClick={() => {
              spawnStars();
              triggerReact();
            }}
            aria-label="Sprinkle magic"
            className="relative w-9 h-9 rounded-xl flex items-center justify-center text-amber-200 hover:text-amber-100 hover:bg-amber-300/10 active:scale-95 transition"
          >
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Burst stars layer */}
      <div className="pointer-events-none fixed inset-0 z-30">
        {bursts.map((b) => (
          <span
            key={b.id}
            className="absolute text-amber-200 animate-burst"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              fontSize: `${b.size}px`,
              filter: "drop-shadow(0 0 6px rgba(254, 243, 199, 0.9))",
            }}
          >
            ✨
          </span>
        ))}
      </div>

      <section className="relative z-10 px-4 pt-6 pb-12 max-w-2xl mx-auto flex flex-col items-center text-center min-h-[calc(100dvh-3.5rem)] justify-center">
        {phase === "lamp" && wishes.length < 3 && (
          <div className="flex flex-col items-center animate-fade-in">
            <p className="text-sm text-amber-200/80 italic mb-6">
              Touch the magical lamp to summon your genie ✨
            </p>
            <button
              onClick={touchLamp}
              className="relative group active:scale-95 transition animate-lamp"
              aria-label="Touch the lamp"
            >
              <div className="absolute inset-0 -m-10 rounded-full bg-amber-400/30 blur-3xl group-hover:bg-amber-400/60 animate-pulse" />
              <img
                src={lampImg}
                alt="Magical genie lamp"
                className="relative w-44 h-44 sm:w-56 sm:h-56 object-contain drop-shadow-[0_0_30px_rgba(251,191,36,0.6)]"
                draggable={false}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </button>
            <p className="mt-6 text-xs text-amber-200/60">Tap the lamp</p>
          </div>
        )}

        {phase === "genie" && wishes.length < 3 && (
          <div className="w-full flex flex-col items-center">
            <div
              className={`relative ${snap ? "animate-lamp-shake" : ""} ${reacting ? "animate-genie-react" : ""}`}
            >
              <img
                src={genieImg}
                alt="Genie"
                className="w-48 h-48 sm:w-56 sm:h-56 object-contain animate-genie-rise drop-shadow-[0_0_40px_rgba(168,85,247,0.6)]"
                draggable={false}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
              {snap && (
                <span className="absolute top-12 right-4 text-3xl animate-snap">✨</span>
              )}
            </div>

            <h2 className="mt-2 text-2xl font-bold bg-gradient-to-r from-amber-200 to-pink-300 bg-clip-text text-transparent">
              I am your genie 🧞‍♂️
            </h2>
            <p className="text-sm text-amber-200/80 italic mt-1">
              Speak your wish — {remaining} of 3 remaining.
            </p>

            {/* Inline magical message instead of toast */}
            <div className="min-h-[1.5rem] mt-3">
              {flash && (
                <p className="text-sm font-medium text-amber-200 animate-fade-in">
                  {flash}
                </p>
              )}
            </div>

            <div className="mt-4 w-full bg-gradient-to-br from-purple-900/40 to-amber-900/30 border border-amber-300/30 rounded-2xl p-4 backdrop-blur">
              <Textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  triggerReact();
                }}
                placeholder="Whisper your wish to the genie…"
                rows={3}
                className="resize-none bg-background/30 border-amber-300/20 text-amber-50 placeholder:text-amber-200/40"
              />
              <Button
                disabled={!text.trim() || submitting}
                onClick={handleSubmit}
                className="mt-3 w-full h-11 bg-gradient-to-r from-amber-400 to-pink-400 text-purple-950 font-semibold hover:opacity-90"
              >
                <Send className="w-4 h-4" /> Submit wish
              </Button>
            </div>
          </div>
        )}

        {(phase === "done" || wishes.length >= 3) && (
          <div className="w-full flex flex-col items-center animate-fade-in">
            <img
              src={genieImg}
              alt="Genie"
              className="w-32 h-32 object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]"
              draggable={false}
            />
            <h2 className="mt-2 text-xl font-bold text-amber-200">
              Your three wishes are sealed ✨
            </h2>
            <p className="text-sm text-amber-200/70 italic mt-1">
              The genie has heard you. Wait for the magic.
            </p>
            {!isAdmin && (
              <div className="mt-3 flex items-center gap-1.5 text-[0.7rem] text-amber-200/60">
                <Lock className="w-3 h-3" /> Only an admin can reset wishes.
              </div>
            )}
          </div>
        )}

        {/* Wish list */}
        {wishes.length > 0 && (
          <div className="mt-8 w-full space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-amber-200/60 text-left">
              Your wishes
            </h3>
            {wishes.map((w, idx) => (
              <div
                key={w.id}
                className="text-left p-4 rounded-2xl border border-amber-300/20 bg-gradient-to-br from-purple-900/30 to-amber-900/20 backdrop-blur"
              >
                <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-wider text-amber-300 font-bold mb-1">
                  <Sparkles className="w-3 h-3" />
                  Wish {idx + 1}
                </div>
                <p className="text-sm text-amber-50 leading-relaxed">{w.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default Wish;
