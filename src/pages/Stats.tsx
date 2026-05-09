import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, CalendarDays, Clock3, Image as ImageIcon, Video, Sparkles, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth-store";
import { getEntries, type TimelineEntry } from "@/lib/timeline-store";

interface Bucket {
  key: string;
  label: string;
  count: number;
}

const Stats = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);

  useEffect(() => {
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    getEntries(user.id).then(setEntries);
  }, [user, navigate]);

  const summary = useMemo(() => {
    if (entries.length === 0) {
      return null;
    }
    const sorted = [...entries].sort((a, b) => a.date - b.date);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const span = Math.max(1, Math.round((last.date - first.date) / 86400000) + 1);
    const days = new Set(sorted.map((e) => new Date(e.date).toDateString())).size;
    const withMedia = sorted.filter((e) => e.mediaKind);
    const images = withMedia.filter((e) => e.mediaKind === "image").length;
    const videos = withMedia.filter((e) => e.mediaKind === "video").length;
    const multiDay = sorted.filter((e) => e.endDate && e.endDate > e.date).length;

    // Category buckets via title keywords
    const cats: Record<string, RegExp> = {
      Travel: /travel|trip|visit|drive|flight|station|airport|tour/i,
      Birthday: /birth/i,
      Food: /food|dinner|lunch|breakfast|cafe|restaurant|cook/i,
      Memory: /memory|moment|first|together/i,
      Celebration: /celebr|party|surprise/i,
    };
    const buckets: Bucket[] = Object.entries(cats).map(([label, re]) => ({
      key: label,
      label,
      count: sorted.filter((e) => re.test(e.title) || re.test(e.content)).length,
    }));
    const other = sorted.length - buckets.reduce((a, b) => a + b.count, 0);
    if (other > 0) buckets.push({ key: "Other", label: "Other", count: other });

    // Per month
    const months = new Map<string, number>();
    sorted.forEach((e) => {
      const d = new Date(e.date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.set(k, (months.get(k) ?? 0) + 1);
    });
    const monthList = Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b));
    const peakMonth = monthList.reduce(
      (acc, [k, v]) => (v > acc[1] ? [k, v] : acc),
      ["", 0] as [string, number],
    );

    return {
      total: sorted.length,
      span,
      days,
      images,
      videos,
      multiDay,
      buckets: buckets.filter((b) => b.count > 0).sort((a, b) => b.count - a.count),
      first,
      last,
      monthList,
      peakMonth,
      sorted,
    };
  }, [entries]);

  // "On this day" – memories that share today's day+month from any year
  const onThisDay = useMemo(() => {
    if (!summary) return [] as TimelineEntry[];
    const today = new Date();
    return summary.sorted.filter((e) => {
      const d = new Date(e.date);
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
    });
  }, [summary]);

  const ago = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 0) return "in the future";
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "just now";
    if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
    const d = Math.floor(h / 24);
    if (d < 31) return `${d} day${d === 1 ? "" : "s"} ago`;
    const m = Math.floor(d / 30);
    if (m < 12) return `${m} month${m === 1 ? "" : "s"} ago`;
    const y = Math.floor(d / 365);
    const rem = Math.floor((d % 365) / 30);
    return rem > 0 ? `${y}y ${rem}mo ago` : `${y} year${y === 1 ? "" : "s"} ago`;
  };

  const fmt = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

  return (
    <main className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="flex items-center gap-2 px-3 sm:px-4 h-14 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/home")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-bold text-gradient flex-1">Statistics</h1>
        </div>
      </header>

      <section className="px-4 pt-5 pb-12 max-w-2xl mx-auto">
        {!summary ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            Add memories to your Memory Map to see statistics ✨
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard icon={Sparkles} label="Total memories" value={summary.total} />
              <StatCard icon={CalendarDays} label="Days covered" value={summary.span} suffix="d" />
              <StatCard icon={Clock3} label="Unique days" value={summary.days} />
              <StatCard icon={ImageIcon} label="Photos" value={summary.images} />
              <StatCard icon={Video} label="Videos" value={summary.videos} />
              <StatCard icon={CalendarDays} label="Multi-day events" value={summary.multiDay} />
            </div>

            <div className="mt-5 bg-gradient-card border border-border rounded-2xl p-4 shadow-elegant">
              <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" /> By category
              </h2>
              <div className="space-y-3">
                {summary.buckets.map((b) => {
                  const pct = Math.round((b.count / summary.total) * 100);
                  return (
                    <div key={b.key}>
                      <div className="flex items-baseline justify-between gap-2 mb-1.5">
                        <span className="text-sm font-semibold">{b.label}</span>
                        <span className="text-xs text-muted-foreground">
                          <span className="text-foreground font-bold">{b.count}</span>
                          {" of "}{summary.total}
                          <span className="ml-2 px-1.5 py-0.5 rounded-md bg-primary/15 text-primary font-bold">
                            {pct}%
                          </span>
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-secondary overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[0.7rem] text-muted-foreground">
                Percentages show each category's share of your {summary.total} memories.
              </p>
            </div>

            <div className="mt-5 bg-gradient-card border border-border rounded-2xl p-4 shadow-elegant">
              <h2 className="text-sm font-bold flex items-center gap-2 mb-1">
                <History className="w-4 h-4 text-primary" /> On this day
              </h2>
              <p className="text-[0.7rem] text-muted-foreground mb-3">
                Memories from {new Date().toLocaleDateString(undefined, { day: "2-digit", month: "long" })} across the years.
              </p>
              {onThisDay.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nothing recorded on this date yet — come back another day ✨
                </p>
              ) : (
                <ul className="space-y-2">
                  {onThisDay.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 p-2 rounded-xl bg-background/40">
                      <div className="w-9 h-9 rounded-lg bg-gradient-primary flex flex-col items-center justify-center text-primary-foreground shrink-0">
                        <span className="text-[0.55rem] uppercase leading-none">{new Date(e.date).toLocaleDateString(undefined, { month: "short" })}</span>
                        <span className="text-xs font-bold leading-none mt-0.5">{new Date(e.date).getFullYear()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{e.title}</p>
                        <p className="text-[0.7rem] text-muted-foreground">{ago(e.date)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5 grid sm:grid-cols-2 gap-3">
              <InfoCard
                label="First memory"
                title={summary.first.title}
                sub={`${fmt(summary.first.date)} · ${ago(summary.first.date)}`}
              />
              <InfoCard
                label="Latest memory"
                title={summary.last.title}
                sub={`${fmt(summary.last.date)} · ${ago(summary.last.date)}`}
              />
            </div>
          </>
        )}
      </section>
    </main>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: typeof Sparkles;
  label: string;
  value: number;
  suffix?: string;
}) => (
  <div className="bg-gradient-card border border-border rounded-2xl p-3 shadow-elegant">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-[0.65rem] uppercase tracking-wider font-semibold">{label}</span>
    </div>
    <p className="mt-1 text-2xl font-bold text-gradient">
      {value}
      {suffix && <span className="text-base ml-1 text-muted-foreground">{suffix}</span>}
    </p>
  </div>
);

const InfoCard = ({ label, title, sub }: { label: string; title: string; sub: string }) => (
  <div className="bg-gradient-card border border-border rounded-2xl p-3 shadow-elegant">
    <p className="text-[0.65rem] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
    <p className="mt-1 font-semibold truncate">{title}</p>
    <p className="text-xs text-muted-foreground">{sub}</p>
  </div>
);

export default Stats;
