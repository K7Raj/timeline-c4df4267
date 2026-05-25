import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Send, Lock, Stars } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/auth-store";
import { addWish, getWishes, type Wish as WishType } from "@/lib/wish-store";
import lampImg from "@/assets/lamp.png";
import genieImg from "@/assets/genie.png";

const SPARK_COLORS = ["#fde68a", "#fbcfe8", "#c4b5fd", "#fda4af", "#fef3c7"];

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
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; size: number; color: string; rot: number }[]>([]);
  const [reacting, setReacting] = useState(false);
  const reactTimer = useRef<number | null>(null);

  const triggerReact = () => {
    setReacting(true);
    if (reactTimer.current) window.clearTimeout(reactTimer.current);
    reactTimer.current = window.setTimeout(() => setReacting(false), 600);
  };

  const spawnStars = () => {
    const batch = Array.from({ length: 18 }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 6 + Math.random() * 28;
      return {
        id: Date.now() + i,
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
        size: 10 + Math.random() * 22,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
        rot: Math.random() * 360,
      };
    });
    setBursts((b) => [...b, ...batch]);
    window.setTimeout(() => {
      setBursts((b) => b.filter((s) => !batch.find((x) => x.id === s.id)));
    }, 1500);
  };

  useEffect(() => {
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    const preload = new Image();
    preload.src = genieImg;
    (async () => {
      const list = await getWishes(user.id);
      setWishes(list);
      if (list.length >= 3) setPhase("done");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, navigate]);

  useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, []);

  const isAdmin = user?.role === "admin";
  const remaining = Math.max(0, 3 - wishes.length);

  const touchLamp = () => setPhase("genie");

  const handleSubmit = async () => {
    if (!user || !text.trim() || wishes.length >= 3) return;
    setSubmitting(true);
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
    <main className="min-h-[100dvh] relative overflow-hidden bg-[radial-gradient(ellipse_at_top,hsl(280_55%_18%)_0%,hsl(250_55%_8%)_55%,hsl(240_60%_5%)_100%)]">
      {/* Aurora glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 w-[36rem] h-[36rem] rounded-full bg-fuchsia-500/15 blur-3xl animate-aurora-1" />
        <div className="absolute top-1/3 -right-40 w-[34rem] h-[34rem] rounded-full bg-amber-400/15 blur-3xl animate-aurora-2" />
        <div className="absolute -bottom-40 -left-20 w-[30rem] h-[30rem] rounded-full bg-violet-500/15 blur-3xl animate-aurora-3" />
        {/* Twinkling star field */}
        {Array.from({ length: 70 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full animate-twinkle"
            style={{
              width: 1 + Math.random() * 3,
              height: 1 + Math.random() * 3,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: SPARK_COLORS[i % SPARK_COLORS.length],
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${1.6 + Math.random() * 3}s`,
              boxShadow: `0 0 6px ${SPARK_COLORS[i % SPARK_COLORS.length]}`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes twinkle {
          0%,100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        .animate-twinkle { animation: twinkle 2.5s ease-in-out infinite; }
        @keyframes aurora-1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,30px) scale(1.1); } }
        @keyframes aurora-2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px,40px) scale(1.05); } }
        @keyframes aurora-3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-40px) scale(1.08); } }
        .animate-aurora-1 { animation: aurora-1 16s ease-in-out infinite; }
        .animate-aurora-2 { animation: aurora-2 19s ease-in-out infinite; }
        .animate-aurora-3 { animation: aurora-3 22s ease-in-out infinite; }
        @keyframes lamp-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-lamp { animation: lamp-float 3.2s ease-in-out infinite; }
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
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3) rotate(0deg); }
          30% { opacity: 1; transform: translate(-50%, -50%) scale(1.3) rotate(60deg); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(2) rotate(220deg); }
        }
        .animate-burst { animation: burst 1.5s ease-out forwards; }
        @keyframes genie-react {
          0%,100% { transform: translateY(0) rotate(0deg) scale(1); }
          30% { transform: translateY(-4px) rotate(-2deg) scale(1.03); }
          70% { transform: translateY(2px) rotate(2deg) scale(1.01); }
        }
        .animate-genie-react { animation: genie-react 0.6s ease-in-out; }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .text-shimmer {
          background: linear-gradient(90deg, #fde68a 0%, #fbcfe8 30%, #c4b5fd 60%, #fde68a 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: shimmer 6s linear infinite;
        }
      `}</style>

      <header className="relative z-20 sticky top-0 backdrop-blur-xl bg-background/30 border-b border-amber-300/10">
        <div className="flex items-center gap-3 px-4 h-14 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" className="rounded-xl text-amber-100 hover:text-amber-50 hover:bg-white/5" onClick={() => navigate("/home")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1 text-shimmer tracking-wide">
            Make a Wish
          </h1>
          <span className="hidden xs:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-amber-300/20 text-[0.65rem] uppercase tracking-wider text-amber-200/80">
            <Stars className="w-3 h-3" /> {remaining}/3 left
          </span>
          <button
            onClick={() => { spawnStars(); triggerReact(); }}
            aria-label="Sprinkle magic"
            className="relative w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-300/90 to-pink-300/90 text-purple-950 shadow-[0_0_18px_rgba(251,191,36,0.6)] hover:shadow-[0_0_28px_rgba(251,191,36,0.85)] hover:scale-105 active:scale-90 transition"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Burst layer centered around genie */}
      <div
        className="pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30"
        style={{ width: "min(90vw,28rem)", height: "min(90vw,28rem)" }}
      >
        {bursts.map((b) => (
          <span
            key={b.id}
            className="absolute animate-burst"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              fontSize: `${b.size}px`,
              color: b.color,
              transform: `rotate(${b.rot}deg)`,
              filter: `drop-shadow(0 0 8px ${b.color})`,
            }}
          >
            ✦
          </span>
        ))}
      </div>

      <section className="relative z-10 px-4 pt-6 pb-16 max-w-2xl mx-auto flex flex-col items-center text-center min-h-[calc(100dvh-3.5rem)] justify-center">
        {phase === "lamp" && wishes.length < 3 && (
          <div className="flex flex-col items-center animate-fade-in">
            <p className="text-[0.7rem] uppercase tracking-[0.3em] text-amber-200/70 mb-2">A whisper away</p>
            <p className="text-base text-amber-100/90 italic mb-7 max-w-xs">
              Touch the magical lamp to summon your genie ✨
            </p>
            <button
              onClick={touchLamp}
              className="relative group active:scale-95 transition animate-lamp"
              aria-label="Touch the lamp"
            >
              <div className="absolute inset-0 -m-12 rounded-full bg-amber-400/30 blur-3xl group-hover:bg-amber-400/60 animate-pulse" />
              <div className="absolute inset-0 -m-6 rounded-full bg-pink-400/15 blur-2xl" />
              <img
                src={lampImg}
                alt="Magical genie lamp"
                className="relative w-44 h-44 sm:w-56 sm:h-56 object-contain drop-shadow-[0_0_36px_rgba(251,191,36,0.7)]"
                draggable={false}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </button>
            <p className="mt-7 text-xs text-amber-200/60 tracking-wider">Tap the lamp</p>
          </div>
        )}

        {phase === "genie" && wishes.length < 3 && (
          <div className="w-full flex flex-col items-center">
            <div
              className={`relative ${snap ? "animate-lamp-shake" : ""} ${reacting ? "animate-genie-react" : ""}`}
            >
              <div className="absolute inset-0 -m-8 rounded-full bg-violet-400/25 blur-3xl" />
              <img
                src={genieImg}
                alt="Genie"
                className="relative w-44 h-44 sm:w-52 sm:h-52 object-contain animate-genie-rise drop-shadow-[0_0_40px_rgba(168,85,247,0.6)]"
                draggable={false}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
              {snap && (
                <span className="absolute top-12 right-4 text-3xl animate-snap">✨</span>
              )}
            </div>

            <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-shimmer">
              I am your genie 🧞‍♂️
            </h2>
            <p className="text-sm text-amber-200/80 italic mt-1">
              Speak your wish — <span className="font-bold text-amber-100">{remaining}</span> of 3 remaining.
            </p>

            <div className="min-h-[1.5rem] mt-3">
              {flash && (
                <p className="text-sm font-medium text-amber-200 animate-fade-in">
                  {flash}
                </p>
              )}
            </div>

            <div className="mt-4 w-full rounded-3xl p-[1px] bg-gradient-to-br from-amber-300/50 via-pink-300/30 to-violet-400/40 shadow-[0_8px_40px_-12px_rgba(251,191,36,0.35)]">
              <div className="rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-purple-900/70 via-purple-950/70 to-slate-900/70 backdrop-blur-xl p-4 sm:p-5">
                <Textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    triggerReact();
                  }}
                  placeholder="Whisper your wish to the genie…"
                  rows={3}
                  maxLength={280}
                  className="resize-none bg-background/20 border-amber-300/20 text-amber-50 placeholder:text-amber-200/40 focus-visible:ring-amber-300/40"
                />
                <div className="mt-2 flex items-center justify-between text-[0.65rem] text-amber-200/60">
                  <span>{text.length}/280</span>
                  <span className="inline-flex items-center gap-1">
                    <Stars className="w-3 h-3" /> {remaining} wish{remaining === 1 ? "" : "es"} left
                  </span>
                </div>
                <Button
                  disabled={!text.trim() || submitting}
                  onClick={handleSubmit}
                  className="mt-3 w-full h-11 rounded-xl bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300 text-purple-950 font-semibold tracking-wide hover:opacity-95 hover:shadow-[0_0_30px_rgba(251,191,36,0.45)] disabled:opacity-60 transition"
                >
                  <Send className="w-4 h-4" /> Send to the genie
                </Button>
              </div>
            </div>
          </div>
        )}

        {(phase === "done" || wishes.length >= 3) && (
          <div className="w-full flex flex-col items-center animate-fade-in">
            <div className="relative">
              <div className="absolute inset-0 -m-6 rounded-full bg-violet-400/20 blur-3xl" />
              <img
                src={genieImg}
                alt="Genie"
                className="relative w-32 h-32 object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.55)]"
                draggable={false}
              />
            </div>
            <h2 className="mt-3 text-2xl font-bold text-shimmer tracking-tight">
              Your three wishes are sealed ✨
            </h2>
            <p className="text-sm text-amber-200/70 italic mt-1 max-w-xs">
              The genie has heard you. The magic is on its way.
            </p>
            {!isAdmin && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-[0.7rem] text-amber-200/60 px-3 py-1 rounded-full bg-white/5 border border-amber-300/15">
                <Lock className="w-3 h-3" /> Only an admin can reset wishes.
              </div>
            )}
          </div>
        )}

        {/* Wish list */}
        {wishes.length > 0 && (
          <div className="mt-10 w-full space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[0.65rem] uppercase tracking-[0.3em] text-amber-200/60">
                Your wishes
              </h3>
              <span className="text-[0.65rem] text-amber-200/50">{wishes.length} of 3</span>
            </div>
            {wishes.map((w, idx) => (
              <div
                key={w.id}
                className="relative text-left p-4 pl-12 rounded-2xl border border-amber-300/20 bg-gradient-to-br from-purple-900/40 via-purple-950/40 to-slate-900/40 backdrop-blur-md hover:border-amber-300/40 transition"
              >
                <div className="absolute left-3 top-3 w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-pink-300 text-purple-950 text-xs font-extrabold flex items-center justify-center shadow-[0_0_14px_rgba(251,191,36,0.5)]">
                  {idx + 1}
                </div>
                <p className="text-sm text-amber-50 leading-relaxed">{w.text}</p>
                <div className="mt-2 inline-flex items-center gap-1 text-[0.6rem] uppercase tracking-wider text-amber-300/70">
                  <Sparkles className="w-3 h-3" /> Sealed by the genie
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default Wish;
