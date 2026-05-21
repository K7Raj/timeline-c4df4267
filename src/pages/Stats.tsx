import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, BarChart3, CalendarDays, Clock3, Image as ImageIcon, Video,
  Sparkles, History, CalendarRange, Flame, Hourglass, Trophy, Heart, Star,
  Compass, ArrowRightCircle, Smile, MapPin, ChevronDown, CalendarCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth-store";
import { createEntry, getEntries, getEntryBlobUrl, type TimelineEntry } from "@/lib/timeline-store";
import { listPlans, updatePlan, type TravelerPlan } from "@/lib/traveler-store";
import localforage from "localforage";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface Bucket { key: string; label: string; count: number }

const Stats = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [plans, setPlans] = useState<TravelerPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstMedia, setFirstMedia] = useState<{ url: string; kind: string } | null>(null);
  const [lastMedia, setLastMedia] = useState<{ url: string; kind: string } | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<TravelerPlan | null>(null);

  const reloadPlans = () => { if (user) listPlans(user.id).then(setPlans); };

  useEffect(() => {
    if (!user) { navigate("/", { replace: true }); return; }
    let live = true;
    Promise.all([getEntries(user.id), listPlans(user.id)]).then(([e, p]) => {
      if (!live) return;
      setEntries(e);
      setPlans(p);
      setLoading(false);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, navigate]);

  const todayMid = useMemo(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0); return t.getTime();
  }, []);
  const upcomingPlans = useMemo(
    () => plans.filter((p) => (p.endDate ?? p.startDate) >= todayMid).sort((a, b) => a.startDate - b.startDate),
    [plans, todayMid],
  );
  const overduePlans = useMemo(
    () => plans.filter((p) => (p.endDate ?? p.startDate) < todayMid).sort((a, b) => b.startDate - a.startDate),
    [plans, todayMid],
  );

  const answerOutcome = async (didHappen: boolean) => {
    if (!user || !promoteTarget) return;
    const p = promoteTarget;
    if (didHappen) {
      let file: File | null = null;
      if (p.mediaKind) {
        try {
          const blobs = localforage.createInstance({ name: "gayu-vault", storeName: "traveler-blobs" });
          const b = await blobs.getItem<Blob>(p.id);
          if (b) file = new File([b], `${p.title}.${(b.type.split("/")[1] ?? "jpg")}`, { type: b.type || "image/jpeg" });
        } catch { /* ignore */ }
      }
      const created = await createEntry(user.id, {
        date: p.startDate,
        endDate: p.endDate,
        title: p.title,
        content: p.notes,
        location: p.location,
        enjoyment: p.enjoyment,
        iconKey: p.iconKey,
        file,
      });
      await updatePlan(p.id, { outcome: "happened", outcomeAt: Date.now(), timelineEntryId: created.id });
      toast({ title: `Added "${p.title}" to your Memory Map ✨` });
    } else {
      await updatePlan(p.id, { outcome: "missed", outcomeAt: Date.now() });
      toast({ title: "Marked as didn't happen" });
    }
    setPromoteTarget(null);
    reloadPlans();
    getEntries(user.id).then(setEntries);
  };

  const summary = useMemo(() => {
    if (entries.length === 0) return null;
    const sorted = [...entries].sort((a, b) => a.date - b.date);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const span = Math.max(1, Math.round((last.date - first.date) / 86400000) + 1);
    const days = new Set(sorted.map((e) => new Date(e.date).toDateString())).size;
    const withMedia = sorted.filter((e) => e.mediaKind);
    const images = withMedia.filter((e) => e.mediaKind === "image").length;
    const videos = withMedia.filter((e) => e.mediaKind === "video").length;
    const multiDay = sorted.filter((e) => e.endDate && e.endDate > e.date).length;

    const cats: Record<string, RegExp> = {
      Travel: /travel|trip|visit|drive|flight|station|airport|tour/i,
      Birthday: /birth/i,
      Food: /food|dinner|lunch|breakfast|cafe|restaurant|cook/i,
      Memory: /memory|moment|first|together/i,
      Celebration: /celebr|party|surprise/i,
    };
    const buckets: Bucket[] = Object.entries(cats).map(([label, re]) => ({
      key: label, label,
      count: sorted.filter((e) => re.test(e.title) || re.test(e.content)).length,
    }));
    const other = sorted.length - buckets.reduce((a, b) => a + b.count, 0);
    if (other > 0) buckets.push({ key: "Other", label: "Other", count: other });

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
      total: sorted.length, span, days, images, videos, multiDay,
      buckets: buckets.filter((b) => b.count > 0).sort((a, b) => b.count - a.count),
      first, last, monthList, peakMonth, sorted,
    };
  }, [entries]);

  // Resolve random media for first/last cards (if the entry has media)
  useEffect(() => {
    let live = true;
    const pickRandomWithMedia = (list: TimelineEntry[], fallback: TimelineEntry) => {
      const withMedia = list.filter((e) => e.mediaKind);
      if (withMedia.length === 0) return fallback;
      return withMedia[Math.floor(Math.random() * withMedia.length)];
    };
    (async () => {
      if (!summary) return;
      // First card: pick a random media entry from the EARLIEST 5 entries
      const earliest = summary.sorted.slice(0, 5);
      const firstPick = pickRandomWithMedia(earliest, summary.first);
      const fUrl = firstPick.mediaKind ? await getEntryBlobUrl(firstPick.id) : null;
      if (live) setFirstMedia(fUrl ? { url: fUrl, kind: firstPick.mediaKind! } : null);

      const latest = summary.sorted.slice(-5);
      const lastPick = pickRandomWithMedia(latest, summary.last);
      const lUrl = lastPick.mediaKind ? await getEntryBlobUrl(lastPick.id) : null;
      if (live) setLastMedia(lUrl ? { url: lUrl, kind: lastPick.mediaKind! } : null);
    })();
    return () => {
      live = false;
      if (firstMedia) URL.revokeObjectURL(firstMedia.url);
      if (lastMedia) URL.revokeObjectURL(lastMedia.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary]);

  // ──────────────────────────── Insights ────────────────────────────

  const today = new Date();

  // Same date across months/years (matches day-of-month, ANY month)
  const sameDateMatches = useMemo(() => {
    if (!summary) return [] as { monthLabel: string; entries: TimelineEntry[] }[];
    const dom = today.getDate();
    const groups = new Map<string, TimelineEntry[]>();
    summary.sorted.forEach((e) => {
      const d = new Date(e.date);
      if (d.getDate() !== dom) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const list = groups.get(key) ?? [];
      list.push(e);
      groups.set(key, list);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([k, list]) => {
        const [y, m] = k.split("-").map(Number);
        return {
          monthLabel: new Date(y, m - 1, 1).toLocaleDateString(undefined, {
            month: "long", year: "numeric",
          }),
          entries: list,
        };
      });
  }, [summary, today]);

  const onThisDayExact = useMemo(() => {
    if (!summary) return [] as TimelineEntry[];
    return summary.sorted.filter((e) => {
      const d = new Date(e.date);
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
    });
  }, [summary, today]);

  const lastWeek = useMemo(() => {
    if (!summary) return [] as TimelineEntry[];
    const cutoff = Date.now() - 7 * 86400000;
    return summary.sorted.filter((e) => e.date >= cutoff).sort((a, b) => b.date - a.date);
  }, [summary]);

  // Current daily streak (consecutive days ending today with at least one entry)
  const streak = useMemo(() => {
    if (!summary) return 0;
    const dayKeys = new Set(summary.sorted.map((e) => new Date(e.date).toDateString()));
    let n = 0;
    const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    while (dayKeys.has(cursor.toDateString())) {
      n++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return n;
  }, [summary, today]);

  const longestGap = useMemo(() => {
    if (!summary || summary.sorted.length < 2) return 0;
    let max = 0;
    for (let i = 1; i < summary.sorted.length; i++) {
      const gap = Math.round((summary.sorted[i].date - summary.sorted[i - 1].date) / 86400000);
      if (gap > max) max = gap;
    }
    return max;
  }, [summary]);

  const upcomingAnniversaries = useMemo(() => {
    if (!summary) return [] as { entry: TimelineEntry; inDays: number; years: number }[];
    const out: { entry: TimelineEntry; inDays: number; years: number }[] = [];
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    summary.sorted.forEach((e) => {
      const d = new Date(e.date);
      let next = new Date(today.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (next < todayMid) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate()).getTime();
      const inDays = Math.round((next - todayMid) / 86400000);
      if (inDays <= 60) {
        const years = new Date(next).getFullYear() - d.getFullYear();
        out.push({ entry: e, inDays, years });
      }
    });
    return out.sort((a, b) => a.inDays - b.inDays).slice(0, 4);
  }, [summary, today]);

  // Enjoyment / emotions distribution from both Memory Map and Time Traveler
  const FACES = ["😞", "🙁", "😐", "🙂", "😄"];
  const FACE_LABELS = ["Awful", "Meh", "OK", "Good", "Loved"];
  const emotions = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    let total = 0, sum = 0;
    [...entries, ...plans].forEach((it) => {
      const v = (it as { enjoyment?: number }).enjoyment;
      if (v && v >= 1 && v <= 5) { dist[v - 1]++; total++; sum += v; }
    });
    let topIdx = -1, topCount = 0;
    dist.forEach((c, i) => { if (c > topCount) { topCount = c; topIdx = i; } });
    return { dist, total, avg: total ? sum / total : 0, topIdx, topCount };
  }, [entries, plans]);

  // Busiest weekday across all memories
  const busiestDay = useMemo(() => {
    if (!summary) return null as null | { label: string; count: number };
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    summary.sorted.forEach((e) => { counts[new Date(e.date).getDay()]++; });
    let bestIdx = 0;
    counts.forEach((c, i) => { if (c > counts[bestIdx]) bestIdx = i; });
    return counts[bestIdx] > 0 ? { label: dayNames[bestIdx], count: counts[bestIdx] } : null;
  }, [summary]);

  // All distinct locations across memories + plans
  const locations = useMemo(() => {
    const map = new Map<string, number>();
    [...entries, ...plans].forEach((it) => {
      const loc = (it as { location?: string }).location?.trim();
      if (loc) map.set(loc, (map.get(loc) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [entries, plans]);
  const [locOpen, setLocOpen] = useState(false);
  const [detail, setDetail] = useState<{ title: string; icon: typeof Sparkles; body: React.ReactNode } | null>(null);

  const ago = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 0) return "in the future";
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 31) return `${d}d ago`;
    const m = Math.floor(d / 30);
    if (m < 12) return `${m}mo ago`;
    const y = Math.floor(d / 365);
    const rem = Math.floor((d % 365) / 30);
    return rem > 0 ? `${y}y ${rem}mo ago` : `${y}y ago`;
  };

  const fmt = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

  const peakMonthLabel = summary && summary.peakMonth[1] > 0
    ? new Date(`${summary.peakMonth[0]}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "—";

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
        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Skeleton className="h-44 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
            </div>
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        ) : !summary ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            Add memories to your Memory Map to see statistics ✨
          </div>
        ) : (
          <>
            {/* Top stat tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard icon={Sparkles} label="Total memories" value={summary.total}
                onClick={() => setDetail({ title: "Total memories", icon: Sparkles, body: (
                  <div className="space-y-1.5 text-sm">
                    <p><b>{summary.total}</b> memories saved so far.</p>
                    <p className="text-muted-foreground">First: {fmt(summary.first.date)} — “{summary.first.title}”</p>
                    <p className="text-muted-foreground">Latest: {fmt(summary.last.date)} — “{summary.last.title}”</p>
                  </div>
                )})} />
              <StatCard icon={CalendarDays} label="Days covered" value={summary.span} suffix="d"
                onClick={() => setDetail({ title: "Days covered", icon: CalendarDays, body: (
                  <div className="space-y-1.5 text-sm">
                    <p><b>{summary.span}</b> days from your first to latest memory.</p>
                    <p className="text-muted-foreground">{fmt(summary.first.date)} → {fmt(summary.last.date)}</p>
                  </div>
                )})} />
              <StatCard icon={Clock3} label="Unique days" value={summary.days}
                onClick={() => setDetail({ title: "Unique days", icon: Clock3, body: (
                  <div className="space-y-1.5 text-sm">
                    <p>You've logged memories on <b>{summary.days}</b> different days.</p>
                    <p className="text-muted-foreground">That's {Math.round((summary.days / summary.span) * 100)}% of your timeline span.</p>
                  </div>
                )})} />
              <StatCard icon={ImageIcon} label="Photos" value={summary.images}
                onClick={() => setDetail({ title: "Photos", icon: ImageIcon, body: (
                  <div className="space-y-1.5 text-sm">
                    <p><b>{summary.images}</b> memories include a photo.</p>
                    <p className="text-muted-foreground">{summary.total ? Math.round((summary.images / summary.total) * 100) : 0}% of your timeline has imagery.</p>
                  </div>
                )})} />
              <StatCard icon={Video} label="Videos" value={summary.videos}
                onClick={() => setDetail({ title: "Videos", icon: Video, body: (
                  <div className="space-y-1.5 text-sm">
                    <p><b>{summary.videos}</b> memories include a video.</p>
                    <p className="text-muted-foreground">{summary.total ? Math.round((summary.videos / summary.total) * 100) : 0}% of your timeline.</p>
                  </div>
                )})} />
              <StatCard icon={CalendarDays} label="Multi-day" value={summary.multiDay}
                onClick={() => setDetail({ title: "Multi-day memories", icon: CalendarDays, body: (
                  <div className="space-y-1.5 text-sm">
                    <p><b>{summary.multiDay}</b> memories span more than one day.</p>
                    <p className="text-muted-foreground">Trips, events and stretches you wanted to remember in full.</p>
                  </div>
                )})} />
              <StatCard icon={Flame} label="Day streak" value={streak}
                onClick={() => setDetail({ title: "Day streak", icon: Flame, body: (
                  <div className="space-y-1.5 text-sm">
                    {streak > 0 ? (
                      <p>You've added memories <b>{streak}</b> day{streak === 1 ? "" : "s"} in a row, including today 🔥</p>
                    ) : (
                      <p>No active streak. Add a memory today to start one ✨</p>
                    )}
                  </div>
                )})} />
              <StatCard icon={Hourglass} label="Longest gap" value={longestGap} suffix="d"
                onClick={() => setDetail({ title: "Longest gap", icon: Hourglass, body: (
                  <div className="space-y-1.5 text-sm">
                    <p>The biggest pause between two memories was <b>{longestGap}</b> day{longestGap === 1 ? "" : "s"}.</p>
                    <p className="text-muted-foreground">Every quiet stretch is part of the story too.</p>
                  </div>
                )})} />
              <StatCard icon={Trophy} label="Top month" value={summary.peakMonth[1]} sub={peakMonthLabel}
                onClick={() => setDetail({ title: "Top month", icon: Trophy, body: (
                  <div className="space-y-1.5 text-sm">
                    <p><b>{peakMonthLabel}</b> was your busiest month.</p>
                    <p className="text-muted-foreground">{summary.peakMonth[1]} memories logged that month.</p>
                  </div>
                )})} />
              <StatCard
                icon={Smile}
                label="Top emotion"
                value={emotions.topIdx >= 0 ? FACES[emotions.topIdx] : "—"}
                sub={emotions.topIdx >= 0 ? `${FACE_LABELS[emotions.topIdx]} · ${emotions.topCount}` : "rate to track"}
                emoji={emotions.topIdx >= 0}
                onClick={() => setDetail({ title: "Top emotion", icon: Smile, body: (
                  <div className="space-y-1.5 text-sm">
                    {emotions.topIdx >= 0 ? (
                      <>
                        <p className="text-3xl">{FACES[emotions.topIdx]}</p>
                        <p><b>{FACE_LABELS[emotions.topIdx]}</b> appears most often — <b>{emotions.topCount}</b> time{emotions.topCount === 1 ? "" : "s"}.</p>
                        <p className="text-muted-foreground">Across {emotions.total} rated memories &amp; plans.</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Rate memories with a smile to track your top emotion.</p>
                    )}
                  </div>
                )})}
              />
              {emotions.total > 0 && (
                <StatCard
                  icon={Heart}
                  label="Avg mood"
                  value={emotions.avg.toFixed(1)}
                  suffix="/5"
                  sub={`${emotions.total} rated`}
                  onClick={() => setDetail({ title: "Average mood", icon: Heart, body: (
                    <div className="space-y-1.5 text-sm">
                      <p className="text-3xl">{FACES[Math.round(emotions.avg) - 1] ?? "🙂"}</p>
                      <p>Average mood across {emotions.total} ratings: <b>{emotions.avg.toFixed(2)} / 5</b>.</p>
                      <p className="text-muted-foreground">Closest feeling: {FACE_LABELS[Math.round(emotions.avg) - 1] ?? "Good"}.</p>
                    </div>
                  )})}
                />
              )}
              {busiestDay && (
                <StatCard
                  icon={CalendarCheck}
                  label="Busiest day"
                  value={busiestDay.label}
                  sub={`${busiestDay.count} memories`}
                  onClick={() => setDetail({ title: "Busiest day of the week", icon: CalendarCheck, body: (
                    <div className="space-y-1.5 text-sm">
                      <p><b>{busiestDay.label}</b> is when you log the most memories.</p>
                      <p className="text-muted-foreground">{busiestDay.count} memories fall on a {busiestDay.label}.</p>
                    </div>
                  )})}
                />
              )}
            </div>

            {/* First / Last with random media */}
            <div className="mt-5 grid sm:grid-cols-2 gap-3">
              <button onClick={() => navigate(`/timeline?focus=${summary.first.id}`)} className="text-left">
                <MediaInfoCard
                  label="First memory"
                  title={summary.first.title}
                  sub={`${fmt(summary.first.date)} · ${ago(summary.first.date)}`}
                  media={firstMedia}
                  accent={Star}
                />
              </button>
              <button onClick={() => navigate(`/timeline?focus=${summary.last.id}`)} className="text-left">
                <MediaInfoCard
                  label="Latest memory"
                  title={summary.last.title}
                  sub={`${fmt(summary.last.date)} · ${ago(summary.last.date)}`}
                  media={lastMedia}
                  accent={Heart}
                />
              </button>
            </div>

            {/* Last week */}
            <div className="mt-5 bg-gradient-card border border-border rounded-2xl p-4 shadow-elegant">
              <h2 className="text-sm font-bold flex items-center gap-2 mb-1">
                <CalendarRange className="w-4 h-4 text-primary" /> Last 7 days
              </h2>
              <p className="text-[0.7rem] text-muted-foreground mb-3">
                Memories you added in the past week.
              </p>
              {lastWeek.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No memories logged this week — make one today ✨
                </p>
              ) : (
                <ul className="space-y-2">
                  {lastWeek.map((e) => (
                    <EntryRow key={e.id} e={e} ago={ago} />
                  ))}
                </ul>
              )}
            </div>

            {/* Categories */}
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
                      <div className="h-3 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-gradient-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Emotions */}
            <div className="mt-5 bg-gradient-card border border-border rounded-2xl p-4 shadow-elegant">
              <h2 className="text-sm font-bold flex items-center gap-2 mb-1">
                <Smile className="w-4 h-4 text-primary" /> Emotions
              </h2>
              <p className="text-[0.7rem] text-muted-foreground mb-3">
                How your memories &amp; plans felt overall.
              </p>
              {emotions.total === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Rate your memories with smiles to see your mood mix.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-3xl">{FACES[Math.round(emotions.avg) - 1] ?? "🙂"}</div>
                    <div>
                      <p className="text-2xl font-bold text-gradient leading-none">{emotions.avg.toFixed(1)}<span className="text-sm text-muted-foreground"> / 5</span></p>
                      <p className="text-[0.65rem] text-muted-foreground uppercase tracking-wider">Average · {emotions.total} rated</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {emotions.dist.map((c, i) => {
                      const pct = emotions.total ? Math.round((c / emotions.total) * 100) : 0;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-base w-6 text-center">{FACES[i]}</span>
                          <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-gradient-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[0.7rem] text-muted-foreground w-20 text-right">
                            <span className="font-bold text-foreground">{c}</span> · {FACE_LABELS[i]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Locations */}
            <div className="mt-5 bg-gradient-card border border-border rounded-2xl shadow-elegant overflow-hidden">
              <button
                type="button"
                onClick={() => setLocOpen((v) => !v)}
                className="w-full flex items-center gap-2 p-4 text-left"
              >
                <MapPin className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold flex-1">My locations</h2>
                <span className="text-[0.7rem] text-muted-foreground">{locations.length}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${locOpen ? "rotate-180" : ""}`} />
              </button>
              {locOpen && (
                <div className="px-4 pb-4">
                  {locations.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Add a location to memories or plans to see them here.
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {locations.map(([loc, n]) => (
                        <li key={loc}>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background border border-border text-xs hover:border-primary/50 transition"
                          >
                            <MapPin className="w-3 h-3 text-primary" />
                            <span>{loc}</span>
                            <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[0.6rem] font-bold">{n}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* On THIS exact date (day + month) */}
            <div className="mt-5 bg-gradient-card border border-border rounded-2xl p-4 shadow-elegant">
              <h2 className="text-sm font-bold flex items-center gap-2 mb-1">
                <History className="w-4 h-4 text-primary" /> On this day
              </h2>
              <p className="text-[0.7rem] text-muted-foreground mb-3">
                Memories from {today.toLocaleDateString(undefined, { day: "2-digit", month: "long" })} across the years.
              </p>
              {onThisDayExact.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nothing recorded on this exact date yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {onThisDayExact.map((e) => (
                    <EntryRow key={e.id} e={e} ago={ago} showYear />
                  ))}
                </ul>
              )}
            </div>

            {/* Same DAY-of-month across ALL months */}
            <div className="mt-5 bg-gradient-card border border-border rounded-2xl p-4 shadow-elegant">
              <h2 className="text-sm font-bold flex items-center gap-2 mb-1">
                <CalendarDays className="w-4 h-4 text-primary" /> Same date, other months
              </h2>
              <p className="text-[0.7rem] text-muted-foreground mb-3">
                Other months where you also made memories on the {ordinal(today.getDate())}.
              </p>
              {sameDateMatches.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No matches yet. Keep adding moments ✨
                </p>
              ) : (
                <div className="space-y-3">
                  {sameDateMatches.map((g) => (
                    <div key={g.monthLabel} className="rounded-xl bg-background/40 p-2.5">
                      <p className="text-[0.7rem] uppercase tracking-wider font-bold text-primary mb-1.5">
                        {g.monthLabel}
                      </p>
                      <ul className="space-y-1.5">
                        {g.entries.map((e) => (
                          <EntryRow key={e.id} e={e} ago={ago} compact />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming anniversaries */}
            {upcomingAnniversaries.length > 0 && (
              <div className="mt-5 bg-gradient-card border border-border rounded-2xl p-4 shadow-elegant">
                <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <Heart className="w-4 h-4 text-primary" /> Coming up (next 60 days)
                </h2>
                <ul className="space-y-2">
                  {upcomingAnniversaries.map(({ entry, inDays, years }) => (
                    <li key={entry.id}>
                      <button
                        onClick={() => navigate(`/timeline?focus=${entry.id}`)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-xl bg-background/40 hover:bg-background/60 transition"
                      >
                        <div className="w-12 h-12 rounded-lg bg-gradient-primary flex flex-col items-center justify-center text-primary-foreground shrink-0">
                          <span className="text-xs font-bold leading-none">{inDays}</span>
                          <span className="text-[0.55rem] uppercase leading-none mt-0.5">days</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{entry.title}</p>
                          <p className="text-[0.7rem] text-muted-foreground">
                            {years > 0 ? `${years}-year mark` : "anniversary"} · originally {fmt(entry.date)}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Time Traveler insights */}
        {(upcomingPlans.length > 0 || overduePlans.length > 0) && (
          <div className="mt-5 bg-gradient-card border border-border rounded-2xl p-4 shadow-elegant">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-1">
              <Compass className="w-4 h-4 text-primary" /> Time Traveler
            </h2>
            <p className="text-[0.7rem] text-muted-foreground mb-3">
              Future plans you've set, and any whose date has passed.
            </p>

            {upcomingPlans.length > 0 && (
              <>
                <p className="text-[0.65rem] uppercase tracking-wider font-bold text-primary mb-1.5">Upcoming</p>
                <ul className="space-y-2 mb-3">
                  {upcomingPlans.slice(0, 6).map((p) => {
                    const days = Math.max(0, Math.round((p.startDate - todayMid) / 86400000));
                    return (
                      <li key={p.id}>
                        <button
                          onClick={() => navigate("/traveler")}
                          className="w-full text-left flex items-center gap-3 p-2 rounded-xl bg-background/40 hover:bg-background/60 transition"
                        >
                          <div className="w-12 h-12 rounded-lg bg-gradient-primary flex flex-col items-center justify-center text-primary-foreground shrink-0">
                            <span className="text-xs font-bold leading-none">{days}</span>
                            <span className="text-[0.55rem] uppercase leading-none mt-0.5">days</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{p.title}</p>
                            <p className="text-[0.7rem] text-muted-foreground truncate">
                              {fmt(p.startDate)}{p.location ? ` · ${p.location}` : ""}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {overduePlans.length > 0 && (
              <>
                <p className="text-[0.65rem] uppercase tracking-wider font-bold text-amber-500 mb-1.5">
                  Date passed — add to Memory Map?
                </p>
                <ul className="space-y-2">
                  {overduePlans.slice(0, 6).map((p) => (
                    <li key={p.id} className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-300 shrink-0">
                        <Compass className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{p.title}</p>
                        <p className="text-[0.7rem] text-muted-foreground">{fmt(p.startDate)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-lg text-primary hover:bg-primary/10 h-8 px-2"
                        onClick={() => setPromoteTarget(p)}
                      >
                        <ArrowRightCircle className="w-4 h-4" /> Save
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      <Dialog open={!!promoteTarget} onOpenChange={(o) => !o && setPromoteTarget(null)}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Did this happen?
            </DialogTitle>
            <DialogDescription className="sr-only">Confirm whether the plan happened</DialogDescription>
          </DialogHeader>
          {promoteTarget && (
            <div className="space-y-1.5 text-sm">
              <p className="font-semibold">{promoteTarget.title}</p>
              <p className="text-xs text-muted-foreground">
                {fmt(promoteTarget.startDate)}
                {promoteTarget.location ? ` · ${promoteTarget.location}` : ""}
              </p>
              <p className="text-xs text-muted-foreground pt-1">
                If yes, we'll save it to your Memory Map as a real memory.
              </p>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-lg w-full sm:w-auto" onClick={() => answerOutcome(false)}>
              Didn't happen
            </Button>
            <Button className="rounded-lg w-full sm:w-auto bg-gradient-primary text-primary-foreground" onClick={() => answerOutcome(true)}>
              Yes, save it ✨
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[85dvh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                    <detail.icon className="w-4 h-4 text-primary-foreground" />
                  </span>
                  {detail.title}
                </DialogTitle>
                <DialogDescription className="sr-only">{detail.title} details</DialogDescription>
              </DialogHeader>
              <div className="pt-1">{detail.body}</div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
};

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const EntryRow = ({
  e, ago, showYear, compact,
}: { e: TimelineEntry; ago: (ts: number) => string; showYear?: boolean; compact?: boolean }) => {
  const d = new Date(e.date);
  const navigate = useNavigate();
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(`/timeline?focus=${e.id}`)}
        className={`w-full text-left flex items-start gap-3 ${compact ? "" : "p-2"} rounded-xl ${compact ? "hover:bg-background/50" : "bg-background/40 hover:bg-background/60"} transition`}
      >
        <div className={`${compact ? "w-8 h-8" : "w-9 h-9"} rounded-lg bg-gradient-primary flex flex-col items-center justify-center text-primary-foreground shrink-0`}>
          <span className="text-[0.55rem] uppercase leading-none">{d.toLocaleDateString(undefined, { month: "short" })}</span>
          <span className="text-xs font-bold leading-none mt-0.5">
            {showYear ? d.getFullYear() : d.getDate()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{e.title}</p>
          <p className="text-[0.7rem] text-muted-foreground">{ago(e.date)}</p>
        </div>
      </button>
    </li>
  );
};

const StatCard = ({
  icon: Icon, label, value, suffix, sub, emoji, onClick,
}: { icon: typeof Sparkles; label: string; value: number | string; suffix?: string; sub?: string; emoji?: boolean; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="text-left bg-gradient-card border border-border rounded-2xl p-3 shadow-elegant transition hover:border-primary/40 hover:shadow-lg active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
  >
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-[0.65rem] uppercase tracking-wider font-semibold truncate">{label}</span>
    </div>
    <p className={`mt-1 text-2xl font-bold ${emoji ? "text-foreground leading-none" : "text-gradient"}`}>
      {value}
      {suffix && <span className="text-base ml-1 text-muted-foreground">{suffix}</span>}
    </p>
    {sub && <p className="text-[0.65rem] text-muted-foreground truncate">{sub}</p>}
  </button>
);

const MediaInfoCard = ({
  label, title, sub, media, accent: Accent,
}: {
  label: string; title: string; sub: string;
  media: { url: string; kind: string } | null;
  accent: typeof Sparkles;
}) => (
  <div className="bg-gradient-card border border-border rounded-2xl overflow-hidden shadow-elegant">
    {media ? (
      <div className="aspect-video bg-secondary/40 overflow-hidden">
        {media.kind === "video" ? (
          <video src={media.url} className="w-full h-full object-cover" muted playsInline />
        ) : (
          <img src={media.url} alt={title} className="w-full h-full object-cover" loading="lazy" />
        )}
      </div>
    ) : (
      <div className="aspect-video bg-gradient-primary/10 flex items-center justify-center">
        <Accent className="w-10 h-10 text-primary/60" />
      </div>
    )}
    <div className="p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Accent className="w-3.5 h-3.5 text-primary" />
        <p className="text-[0.65rem] uppercase tracking-wider font-semibold">{label}</p>
      </div>
      <p className="mt-1 font-semibold truncate">{title}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  </div>
);

export default Stats;
