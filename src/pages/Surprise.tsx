import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { ArrowLeft, Cake, Gift, Heart, Sparkles, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth-store";
import { useSettings } from "@/lib/settings-store";

const Surprise = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const settings = useSettings(user?.id);
  const name = user?.profileName || user?.username || "Friend";
  const wishes = (settings.surpriseWishes.length ? settings.surpriseWishes : [
    "Happy Birthday {name} 💖",
  ]).map((w) => w.replace(/\{name\}/g, name));
  const [revealed, setRevealed] = useState(false);
  const [wishIndex, setWishIndex] = useState(0);
  const fireRef = useRef<number | null>(null);

  // Cycle wishes
  useEffect(() => {
    if (!revealed) return;
    const id = window.setInterval(() => {
      setWishIndex((i) => (i + 1) % wishes.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [revealed]);

  const fireConfetti = () => {
    const colors = ["#ff5ec4", "#a855f7", "#22d3ee", "#facc15", "#fb7185"];

    // Left popper
    confetti({
      particleCount: 120,
      angle: 60,
      spread: 75,
      origin: { x: 0, y: 0.8 },
      colors,
      scalar: 1.1,
    });
    // Right popper
    confetti({
      particleCount: 120,
      angle: 120,
      spread: 75,
      origin: { x: 1, y: 0.8 },
      colors,
      scalar: 1.1,
    });
    // Center burst
    confetti({
      particleCount: 160,
      spread: 360,
      startVelocity: 35,
      origin: { x: 0.5, y: 0.5 },
      colors,
      shapes: ["circle", "square"],
      scalar: 1.2,
    });
  };

  const startCelebration = () => {
    setRevealed(true);
    fireConfetti();

    // Continuous gentle confetti for a few seconds
    const end = Date.now() + 5000;
    const colors = ["#ff5ec4", "#a855f7", "#22d3ee", "#facc15"];
    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.9 },
        colors,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.9 },
        colors,
      });
      if (Date.now() < end) {
        fireRef.current = requestAnimationFrame(frame);
      }
    };
    frame();
  };

  useEffect(() => {
    return () => {
      if (fireRef.current) cancelAnimationFrame(fireRef.current);
    };
  }, []);

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Floating decorative shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-primary/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-accent/20 blur-3xl animate-pulse" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/60 border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => navigate("/home")}
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-gradient flex-1">Surprise</h1>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl text-primary hover:bg-primary/10"
            onClick={fireConfetti}
            aria-label="Pop confetti"
            title="Pop confetti"
          >
            <PartyPopper className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <section className="relative z-10 px-4 sm:px-5 pt-8 pb-12 max-w-2xl mx-auto flex flex-col items-center">
        {!revealed ? (
          <div className="w-full flex flex-col items-center text-center animate-fade-in">
            <div className="relative mb-6">
              <div className="w-40 h-40 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow animate-pulse">
                <Gift className="w-20 h-20 text-primary-foreground" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-7 h-7 text-accent animate-pulse" />
              <Sparkles className="absolute -bottom-2 -left-2 w-6 h-6 text-primary-glow animate-pulse" />
            </div>

            <h2 className="font-bold leading-tight tracking-tight text-balance text-[clamp(1.5rem,7vw,2.25rem)]">
              A little surprise for you 🎁
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-md">
              Tap the gift to unwrap something special, {name} 💖
            </p>

            <Button
              onClick={startCelebration}
              size="lg"
              className="mt-8 h-12 px-8 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-elegant hover:opacity-95 active:scale-95 transition"
            >
              <PartyPopper className="w-5 h-5" />
              Unwrap surprise
            </Button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center text-center animate-scale-in">
            {/* Cake */}
            <div className="relative mb-6">
              <div className="w-44 h-44 rounded-3xl bg-gradient-card border border-border flex items-center justify-center shadow-elegant">
                <Cake className="w-24 h-24 text-primary animate-pulse" />
              </div>
              <Heart className="absolute -top-3 -right-3 w-7 h-7 text-primary fill-primary animate-pulse" />
              <Heart className="absolute -bottom-3 -left-3 w-6 h-6 text-accent fill-accent animate-pulse" />
              <Sparkles className="absolute top-1/2 -right-6 w-6 h-6 text-primary-glow animate-pulse" />
              <Sparkles className="absolute top-1/3 -left-6 w-5 h-5 text-accent animate-pulse" />
            </div>

            <h2 className="font-extrabold leading-tight tracking-tight text-balance text-gradient text-[clamp(1.5rem,7vw,2.5rem)]">
              🎉 Surprise! 🎉
            </h2>

            {/* Rotating wishes */}
            <div className="mt-4 min-h-[3.5rem] flex items-center justify-center px-2">
              <p
                key={wishIndex}
                className="text-base sm:text-lg italic text-foreground/90 animate-fade-in text-balance"
              >
                {wishes[wishIndex]}
              </p>
            </div>

            {/* Quote card */}
            <div className="mt-6 w-full bg-gradient-card border border-border rounded-2xl p-5 shadow-elegant">
              <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
                ✨ Today the universe celebrates the day it became luckier — the
                day <span className="text-gradient font-semibold">you</span>{" "}
                arrived. Stay magical, stay you. 💖
              </p>
            </div>

            <Button
              onClick={fireConfetti}
              variant="outline"
              size="lg"
              className="mt-6 h-12 px-8 rounded-2xl border-primary/40 hover:bg-primary/10"
            >
              <PartyPopper className="w-5 h-5 text-primary" />
              Pop again!
            </Button>
          </div>
        )}
      </section>
    </main>
  );
};

export default Surprise;
