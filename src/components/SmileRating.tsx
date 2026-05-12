// 5-smile enjoyment rating used in Memory Map and Time Traveler entries.

const FACES = ["😞", "🙁", "😐", "🙂", "😄"];
const LABELS = ["Awful", "Meh", "OK", "Good", "Loved it"];

interface Props {
  value: number | undefined;
  onChange?: (v: number) => void;
  size?: "sm" | "md";
  readOnly?: boolean;
}

export const SmileRating = ({ value, onChange, size = "md", readOnly }: Props) => {
  const cls = size === "sm" ? "text-base" : "text-2xl";
  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label="Enjoyment rating"
    >
      {FACES.map((f, i) => {
        const n = i + 1;
        const active = value === n;
        const dim = value && value !== n;
        if (readOnly) {
          return (
            <span
              key={n}
              className={`${cls} transition ${active ? "scale-110" : "opacity-30"}`}
              aria-label={LABELS[i]}
            >
              {f}
            </span>
          );
        }
        return (
          <button
            key={n}
            type="button"
            data-no-sound
            onClick={() => onChange?.(n)}
            className={`${cls} px-1 transition active:scale-95 ${
              active ? "scale-125 drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" : dim ? "opacity-40 hover:opacity-80" : "hover:scale-110"
            }`}
            aria-checked={active}
            role="radio"
            title={LABELS[i]}
          >
            {f}
          </button>
        );
      })}
    </div>
  );
};

export const SmileBadge = ({ value }: { value?: number }) => {
  if (!value || value < 1 || value > 5) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-[0.7rem]"
      title={LABELS[value - 1]}
    >
      <span className="leading-none">{FACES[value - 1]}</span>
    </span>
  );
};
