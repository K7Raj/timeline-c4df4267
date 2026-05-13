// Reusable icon picker for Memory Map and Time Traveler entries.
// Selection is encoded as one of:
//   "lucide:<Name>"   — built-in lucide icon
//   "emoji:<char>"    — emoji glyph (admin-managed emotions)
//   "custom:<id>"     — admin-uploaded custom icon (PNG/SVG data url)

import { useMemo } from "react";
import {
  Heart, Star, Sparkles, Gift, Cake, Music, Camera, MapPin, Plane, Train,
  Utensils, ShoppingBag, Sun, Coffee, Film, Briefcase, Stethoscope,
  PartyPopper, Car, Bike, Activity, Compass, Smile, Image as ImageIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLibrary } from "@/lib/library-store";

export const LUCIDE_MAP: Record<string, LucideIcon> = {
  Heart, Star, Sparkles, Gift, Cake, Music, Camera, MapPin, Plane, Train,
  Utensils, ShoppingBag, Sun, Coffee, Film, Briefcase, Stethoscope,
  PartyPopper, Car, Bike, Activity, Compass, Smile,
};

const LUCIDE_ORDER = Object.keys(LUCIDE_MAP);

interface Props {
  value?: string;
  onChange: (v: string) => void;
}

export const IconPicker = ({ value, onChange }: Props) => {
  const lib = useLibrary();

  return (
    <div className="space-y-3">
      <Section label="Built-in">
        <div className="grid grid-cols-8 gap-1.5">
          {LUCIDE_ORDER.map((name) => {
            const C = LUCIDE_MAP[name];
            const key = `lucide:${name}`;
            const active = value === key;
            return (
              <button
                key={key}
                type="button"
                data-no-sound
                onClick={() => onChange(key)}
                className={`aspect-square rounded-lg flex items-center justify-center border transition ${
                  active
                    ? "bg-gradient-primary border-transparent text-primary-foreground"
                    : "bg-secondary/50 border-border text-foreground hover:border-primary/40"
                }`}
                aria-label={name}
              >
                <C className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </Section>

      {lib.icons.length > 0 && (
        <Section label="Custom icons">
          <div className="grid grid-cols-8 gap-1.5">
            {lib.icons.map((i) => {
              const key = `custom:${i.id}`;
              const active = value === key;
              return (
                <button
                  key={i.id}
                  type="button"
                  data-no-sound
                  onClick={() => onChange(key)}
                  title={i.label}
                  className={`aspect-square rounded-lg flex items-center justify-center border p-1 transition ${
                    active
                      ? "bg-gradient-primary border-transparent"
                      : "bg-secondary/50 border-border hover:border-primary/40"
                  }`}
                >
                  <img src={i.dataUrl} alt={i.label} className="w-full h-full object-contain" />
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {lib.emotions.length > 0 && (
        <Section label="Emotions">
          <div className="grid grid-cols-8 gap-1.5">
            {lib.emotions.map((e) => {
              const key = `emoji:${e.emoji}`;
              const active = value === key;
              return (
                <button
                  key={e.id}
                  type="button"
                  data-no-sound
                  onClick={() => onChange(key)}
                  title={e.label}
                  className={`aspect-square rounded-lg flex items-center justify-center border text-lg transition ${
                    active
                      ? "bg-gradient-primary border-transparent"
                      : "bg-secondary/50 border-border hover:border-primary/40"
                  }`}
                >
                  {e.emoji}
                </button>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
};

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[0.65rem] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">
      {label}
    </p>
    {children}
  </div>
);

// Resolve a stored iconKey to a renderable element. Lucide → component;
// emoji/custom → glyph/image. Returns null if key is unknown.
export const ResolvedIcon = ({
  iconKey,
  className = "w-4 h-4",
}: { iconKey?: string; className?: string }) => {
  const lib = useLibrary();
  const node = useMemo(() => {
    if (!iconKey) return null;
    if (iconKey.startsWith("lucide:")) {
      const C = LUCIDE_MAP[iconKey.slice(7)];
      return C ? <C className={className} /> : null;
    }
    if (iconKey.startsWith("emoji:")) {
      return <span className={`${className} inline-flex items-center justify-center text-base leading-none`}>{iconKey.slice(6)}</span>;
    }
    if (iconKey.startsWith("custom:")) {
      const found = lib.icons.find((i) => i.id === iconKey.slice(7));
      return found ? <img src={found.dataUrl} alt={found.label} className={`${className} object-contain`} /> : null;
    }
    return null;
  }, [iconKey, lib, className]);
  return node;
};
