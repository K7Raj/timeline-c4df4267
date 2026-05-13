import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Filter,
  Plus,
  Pencil,
  Trash2,
  Calendar as CalendarIcon,
  ImagePlus,
  X,
  Sparkles,
  Info,
  Heart,
  Star,
  Gift,
  Cake,
  Music,
  Camera,
  MapPin,
  Plane,
  Train,
  Utensils,
  ShoppingBag,
  Sun,
  Coffee,
  Film,
  Briefcase,
  Stethoscope,
  PartyPopper,
  Car,
  Bike,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import {
  createEntry,
  deleteEntries,
  deleteEntry,
  getEntries,
  getEntryBlobUrl,
  type TimelineEntry,
  updateEntry,
} from "@/lib/timeline-store";
import { getCurrentUser, getUser } from "@/lib/auth-store";
import { getMemoryMapPerms } from "@/lib/settings-store";
import { pushNotice } from "@/lib/notifications-store";
import { SmileRating, SmileBadge } from "@/components/SmileRating";
import { IconPicker, ResolvedIcon } from "@/components/IconPicker";

type RangeKey = "all" | "30d" | "6m" | "year" | "custom";

const rangeChips: { key: RangeKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "30d", label: "30 days" },
  { key: "6m", label: "6 months" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom" },
];

const fmtShort = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
const fmtYear = (ts: number) => new Date(ts).getFullYear().toString();
const fmtLong = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const fmtRange = (start: number, end?: number) => {
  if (!end || end === start) return fmtShort(start);
  const s = new Date(start);
  const e = new Date(end);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}–${e.getDate()} ${s.toLocaleDateString(undefined, { month: "short" })}`;
  }
  return `${fmtShort(start)} – ${fmtShort(end)}`;
};

// Fallback icon (used only when entry has no explicit iconKey).
const pickIcon = (title: string) => {
  const t = title.toLowerCase();
  if (/(wedding|reception|engagement|mehendi|anniversary)/.test(t)) return Heart;
  if (/(temple|spiritual|tirupati)/.test(t)) return Sparkles;
  if (/(movie|film|coolie)/.test(t)) return Film;
  if (/(honeymoon|trip|travel|pondi|yercaud|manali)/.test(t)) return Plane;
  if (/(train)/.test(t)) return Train;
  if (/(car|drive|driving)/.test(t)) return Car;
  if (/(bike|accident)/.test(t)) return Bike;
  if (/(work|office)/.test(t)) return Briefcase;
  if (/(food|dominos|cafe|coffee|cooking|pongal|dessert|resto)/.test(t))
    return /coffee|cafe/.test(t) ? Coffee : Utensils;
  if (/(shopping|mall|purchase|gold|broadway)/.test(t)) return ShoppingBag;
  if (/(health|injection|sick|care)/.test(t)) return Stethoscope;
  if (/(diwali|christmas|festival|new year|valentine)/.test(t)) return PartyPopper;
  if (/(beach|sunrise|date|polar)/.test(t)) return Sun;
  if (/(birthday|cake)/.test(t)) return Cake;
  if (/(music|song)/.test(t)) return Music;
  if (/(photo|shoot|camera)/.test(t)) return Camera;
  if (/(map|place|visit)/.test(t)) return MapPin;
  if (/(gift|surprise)/.test(t)) return Gift;
  return Star;
};

const Timeline = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const current = getCurrentUser();

  // Admin can pass ?user=USER_ID to view another user's timeline
  const targetUserId = params.get("user") ?? current?.id ?? "";
  const focusId = params.get("focus");
  const targetUser = useMemo(() => getUser(targetUserId), [targetUserId]);
  const isAdmin = current?.role === "admin";
  const perms = getMemoryMapPerms(current, targetUserId);
  const canCreate = perms.create;
  const canEdit = perms.update || perms.delete;
  const canDelete = perms.delete;

  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [range, setRange] = useState<RangeKey>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [editing, setEditing] = useState<TimelineEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<TimelineEntry | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  useEffect(() => {
    if (!current) navigate("/", { replace: true });
  }, [current, navigate]);

  // Apply ?focus=ID after entries load: expand it and scroll into view.
  useEffect(() => {
    if (!focusId || entries.length === 0) return;
    if (!entries.some((e) => e.id === focusId)) return;
    setExpandedId(focusId);
    setPulseId(focusId);
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-entry-id="${focusId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    const t = setTimeout(() => setPulseId(null), 1800);
    // strip the param so re-renders don't re-trigger
    const next = new URLSearchParams(params);
    next.delete("focus");
    setParams(next, { replace: true });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, entries]);

  // Click anywhere outside the expanded card closes it.
  useEffect(() => {
    if (!expandedId) return;
    const handler = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("[data-expanded-card='true']")) return;
      if (t.closest("[data-entry-id]")) return; // tapping any node toggles via its own handler
      setExpandedId(null);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [expandedId]);

  const load = async () => {
    if (!targetUserId) return;
    setLoading(true);
    const list = await getEntries(targetUserId);
    setEntries(list);
    // Load media URLs in parallel for snappier rendering
    const mediaItems = list.filter((e) => e.mediaKind);
    const results = await Promise.all(
      mediaItems.map(async (e) => [e.id, await getEntryBlobUrl(e.id)] as const),
    );
    const map: Record<string, string> = {};
    for (const [id, url] of results) if (url) map[id] = url;
    setUrls((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return map;
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
    return () => {
      setUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  // After initial load (and only when no ?focus is set), scroll to the first
  // entry so the user lands directly on real data instead of the empty state.
  const didAutoScroll = useRef(false);
  useEffect(() => {
    if (loading || focusId || didAutoScroll.current) return;
    if (entries.length === 0) return;
    didAutoScroll.current = true;
    setTimeout(() => {
      const sorted = [...entries].sort((a, b) => a.date - b.date);
      const first = sorted[0];
      const el = document.querySelector<HTMLElement>(`[data-entry-id="${first.id}"]`);
      el?.scrollIntoView({ behavior: "auto", block: "center" });
    }, 60);
  }, [loading, entries, focusId]);

  const filtered = useMemo(() => {
    const now = Date.now();
    let from = 0;
    let to = Infinity;
    if (range === "30d") from = now - 30 * 86400000;
    else if (range === "6m") from = now - 182 * 86400000;
    else if (range === "year") from = new Date(new Date().getFullYear(), 0, 1).getTime();
    else if (range === "custom") {
      if (customFrom) from = new Date(customFrom).getTime();
      if (customTo) to = new Date(customTo).getTime() + 86400000 - 1;
    }
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => {
        if (e.date < from || e.date > to) return false;
        if (!q) return true;
        return (
          e.title.toLowerCase().includes(q) ||
          e.content.toLowerCase().includes(q) ||
          fmtLong(e.date).toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => a.date - b.date);
  }, [entries, range, customFrom, customTo, search]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (e: TimelineEntry) => {
    setEditing(e);
    setDialogOpen(true);
  };

  const notifyOwner = (msg: string) => {
    if (isAdmin && targetUserId && targetUserId !== current?.id) {
      pushNotice(targetUserId, msg);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    await deleteEntry(toDelete.id);
    notifyOwner(`Admin removed a memory: "${toDelete.title}"`);
    setToDelete(null);
    toast({ title: "Moment deleted" });
    load();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((e) => e.id)));
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    await deleteEntries(ids);
    notifyOwner(`Admin removed ${ids.length} memory item${ids.length === 1 ? "" : "s"}`);
    setBulkConfirm(false);
    exitSelect();
    toast({ title: `${ids.length} moment${ids.length === 1 ? "" : "s"} deleted` });
    load();
  };

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="shrink-0 sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="flex items-center gap-1 px-3 sm:px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() =>
              selectMode
                ? exitSelect()
                : navigate(isAdmin ? "/admin" : "/home")
            }
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-base sm:text-lg font-bold text-gradient flex-1 truncate flex items-center gap-1.5">
            {selectMode
              ? `${selected.size} selected`
              : isAdmin && targetUser
                ? `${targetUser.profileName}'s Memory Map`
                : "Memory Map"}
            {!selectMode && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="text-muted-foreground hover:text-primary transition"
                    aria-label="About Memory Map"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 text-xs" align="start">
                  <p className="font-semibold mb-1 text-foreground">Memory Map ✨</p>
                  <p className="text-muted-foreground leading-relaxed">
                    A winding journey of moments connected by a dotted trail.
                    Tap a node to expand it.
                  </p>
                </PopoverContent>
              </Popover>
            )}
          </h1>

          {selectMode && canDelete ? (
            <>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={selectAll} aria-label="Select all">
                <CheckSquare className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl text-destructive hover:text-destructive"
                onClick={() => selected.size && setBulkConfirm(true)}
                disabled={!selected.size}
                aria-label="Delete selected"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setShowSearch((v) => !v)} aria-label="Search">
                <Search className="w-5 h-5" />
              </Button>
              {canDelete && (
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSelectMode(true)} aria-label="Select">
                  <Square className="w-5 h-5" />
                </Button>
              )}
              {canCreate && (
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={openCreate} aria-label="Add moment">
                  <Plus className="w-5 h-5" />
                </Button>
              )}
            </>
          )}
        </div>

        {showSearch && !selectMode && (
          <div className="px-3 sm:px-4 pb-3 animate-fade-in">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, story, or date…"
                className="pl-9 rounded-xl bg-secondary/50"
              />
              {search && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setSearch("")} aria-label="Clear search">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {!selectMode && (
          <div className="px-3 sm:px-4 pb-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            {rangeChips.map((c) => (
              <button
                key={c.key}
                onClick={() => setRange(c.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  range === c.key
                    ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                    : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
            <span className="ml-auto shrink-0 text-[0.7rem] text-muted-foreground">
              {filtered.length}/{entries.length}
            </span>
          </div>
        )}

        {range === "custom" && !selectMode && (
          <div className="px-3 sm:px-4 pb-3 flex items-center gap-2 animate-fade-in">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-xl bg-secondary/50 text-xs" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-xl bg-secondary/50 text-xs" />
          </div>
        )}
      </header>

      <section className="flex-1 px-3 sm:px-5 pt-4 pb-10 max-w-2xl w-full mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-xs text-muted-foreground">
            <span className="inline-block w-4 h-4 mr-2 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Loading your memories…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onAdd={openCreate} hasEntries={entries.length > 0} canEdit={canCreate} />
        ) : (
          <CandyMap
            entries={filtered}
            urls={urls}
            expandedId={expandedId}
            pulseId={pulseId}
            onToggleExpand={(id) => {
              if (selectMode) toggleSelect(id);
              else setExpandedId((cur) => (cur === id ? null : id));
            }}
            selectMode={selectMode}
            selected={selected}
            onEdit={openEdit}
            onDelete={(e) => setToDelete(e)}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        )}
      </section>

      <EntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editing}
        userId={targetUserId}
        onSaved={() => {
          notifyOwner(editing ? "Admin updated a memory" : "Admin added a new memory");
          setDialogOpen(false);
          load();
        }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this moment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{toDelete?.title}" from the timeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} moment{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the selected moments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

// ---------- Memory Map: alternating cards along a curvy dotted trail ----------
// Cards alternate left/right of the central rail; all cards share the same
// width for a clean rhythm. The connector horizontal line is removed.

const ROW_H = 110;
const NODE = 44;

const CandyMap = ({
  entries,
  urls,
  expandedId,
  pulseId,
  onToggleExpand,
  selectMode,
  selected,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  entries: TimelineEntry[];
  urls: Record<string, string>;
  expandedId: string | null;
  pulseId: string | null;
  onToggleExpand: (id: string) => void;
  selectMode: boolean;
  selected: Set<string>;
  onEdit: (e: TimelineEntry) => void;
  onDelete: (e: TimelineEntry) => void;
  canEdit: boolean;
  canDelete: boolean;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Central rail with gentle horizontal sway for candy-map feel.
  const railX = (i: number) => width / 2 + Math.sin(i * 0.9) * 14;

  const positions = entries.map((_, i) => ({
    x: railX(i),
    y: ROW_H / 2 + i * ROW_H,
  }));

  const path = (() => {
    if (positions.length === 0) return "";
    let d = `M ${positions[0].x} ${positions[0].y}`;
    for (let i = 1; i < positions.length; i++) {
      const a = positions[i - 1];
      const b = positions[i];
      const midY = (a.y + b.y) / 2;
      d += ` C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
    }
    return d;
  })();

  const totalH = entries.length * ROW_H + 40;

  return (
    <div ref={containerRef} className="relative w-full" style={{ minHeight: totalH }}>
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height={totalH}
        aria-hidden="true"
      >
        <path
          d={path}
          fill="none"
          stroke="hsl(var(--primary) / 0.55)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="2 8"
        />
      </svg>

      {entries.map((e, i) => {
        const FallbackIcon = pickIcon(e.title);
        const isExpanded = expandedId === e.id;
        const isSelected = selected.has(e.id);
        const showYear = i === 0 || fmtYear(entries[i - 1].date) !== fmtYear(e.date);
        const url = urls[e.id];
        const pos = positions[i];

        // Alternating sides: even -> left, odd -> right. Same fixed slot width.
        const isLeft = i % 2 === 0;
        const gap = NODE / 2 + 14;
        const slot = Math.max(120, (width - gap * 2) / 2 - 4);
        const cardLeft = isLeft ? Math.max(4, pos.x - gap - slot) : pos.x + gap;

        // Card emoji shown inline (only when explicitly chosen as an emoji).
        const cardEmoji = e.iconKey?.startsWith("emoji:") ? e.iconKey.slice(6) : null;

        return (
          <div key={e.id} data-entry-id={e.id}>
            {showYear && (
              <div
                className="absolute z-10"
                style={{ left: pos.x, top: pos.y - ROW_H / 2 + 4, transform: "translateX(-50%)" }}
              >
                <span className="px-2.5 py-0.5 rounded-full bg-gradient-primary text-primary-foreground text-[0.6rem] font-bold shadow-glow">
                  {fmtYear(e.date)}
                </span>
              </div>
            )}

            {/* Card — alternating side, fixed width */}
            <button
              onClick={() => onToggleExpand(e.id)}
              className={`absolute text-left px-3 py-2 rounded-2xl bg-gradient-card border shadow-elegant transition active:scale-[0.98] hover:border-primary/60 ${
                isSelected ? "border-primary/60 ring-2 ring-primary/30" : "border-border"
              } ${isExpanded ? "border-primary/60" : ""}`}
              style={{
                left: cardLeft,
                width: slot,
                top: pos.y - 30,
              }}
            >
              <div className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-wider text-primary">
                <CalendarIcon className="w-2.5 h-2.5 shrink-0" />
                <span className="whitespace-nowrap">{fmtRange(e.date, e.endDate)}</span>
              </div>
              <p className="mt-0.5 text-[0.78rem] sm:text-xs font-semibold text-foreground leading-snug break-words line-clamp-2 flex items-start gap-1">
                {cardEmoji && <span className="text-sm leading-none shrink-0">{cardEmoji}</span>}
                <span className="min-w-0">{e.title}</span>
              </p>
              {e.location && (
                <div className="mt-0.5 flex items-center gap-1 text-[0.65rem] text-muted-foreground truncate">
                  <MapPin className="w-2.5 h-2.5 shrink-0 text-primary" />
                  <span className="truncate">{e.location}</span>
                </div>
              )}
              {selectMode && (
                <span
                  className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] font-bold ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border"
                  }`}
                >
                  {isSelected ? "✓" : ""}
                </span>
              )}
            </button>

            {/* Candy node */}
            <button
              onClick={() => onToggleExpand(e.id)}
              className={`absolute rounded-full flex items-center justify-center border-[3px] border-background shadow-elegant transition active:scale-90 bg-gradient-primary ${
                isSelected ? "ring-4 ring-primary/40" : ""
              } ${isExpanded ? "scale-110" : ""}`}
              style={{
                width: NODE,
                height: NODE,
                left: pos.x - NODE / 2,
                top: pos.y - NODE / 2,
              }}
              aria-label={`${e.title} on ${fmtLong(e.date)}`}
            >
              <span className="absolute inset-0 -m-1 rounded-full bg-gradient-primary opacity-40 blur-md" />
              {e.iconKey ? (
                <span className="relative text-primary-foreground drop-shadow flex items-center justify-center">
                  <ResolvedIcon iconKey={e.iconKey} className="w-5 h-5" />
                </span>
              ) : (
                <FallbackIcon className="relative w-4 h-4 text-primary-foreground drop-shadow" />
              )}
            </button>

            {isExpanded && (
              <div
                className="absolute left-2 right-2 z-20 animate-fade-in"
                data-expanded-card="true"
                style={{ top: pos.y + NODE / 2 + 8 }}
              >
                <div className={`bg-gradient-card border rounded-2xl p-3 shadow-glow space-y-2 ${pulseId === e.id ? "border-primary ring-4 ring-primary/40" : "border-primary/40"}`}>
                  <div className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-primary">
                    <CalendarIcon className="w-3 h-3" />
                    <span>
                      {fmtRange(e.date, e.endDate)} · {fmtYear(e.date)}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold leading-snug">{e.title}</h3>
                  {e.location && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-sound="open"
                      className="inline-flex items-center gap-1 text-[0.7rem] text-primary hover:underline"
                    >
                      <MapPin className="w-3 h-3" /> {e.location}
                    </a>
                  )}
                  {e.enjoyment ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Felt:</span>
                      <SmileRating value={e.enjoyment} readOnly size="sm" />
                    </div>
                  ) : null}
                  {e.content && (
                    <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {e.content}
                    </p>
                  )}
                  {e.mediaKind && url && (
                    <div className="rounded-lg overflow-hidden border border-border">
                      {e.mediaKind === "video" ? (
                        <video
                          src={url}
                          className="w-full max-h-48 object-cover"
                          controls
                          controlsList="nodownload noremoteplayback"
                          disablePictureInPicture
                        />
                      ) : (
                        <img src={url} alt={e.title} className="w-full max-h-48 object-cover" loading="lazy" />
                      )}
                    </div>
                  )}
                  {!selectMode && (canEdit || canDelete) && (
                    <div className="flex items-center justify-end gap-1 pt-0.5">
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-lg h-7 text-xs"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onEdit(e);
                          }}
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-lg h-7 text-xs text-destructive hover:text-destructive"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onDelete(e);
                          }}
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ height: expandedId ? 240 : 24 }} />
    </div>
  );
};

const EmptyState = ({
  onAdd,
  hasEntries,
  canEdit,
}: {
  onAdd: () => void;
  hasEntries: boolean;
  canEdit: boolean;
}) => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-16">
    <div className="w-20 h-20 rounded-3xl bg-gradient-primary flex items-center justify-center shadow-glow mb-5">
      <Sparkles className="w-10 h-10 text-primary-foreground" />
    </div>
    <h2 className="text-xl font-bold mb-2">
      {hasEntries ? "No moments match your filter" : "No memories yet"}
    </h2>
    <p className="text-sm text-muted-foreground max-w-xs mb-5">
      {hasEntries
        ? "Try a different search term or change the date range."
        : canEdit
          ? "Add the first memory to begin a beautiful winding map."
          : "An admin will add memories to your timeline soon. ✨"}
    </p>
    {!hasEntries && canEdit && (
      <Button onClick={onAdd} className="rounded-xl bg-gradient-primary text-primary-foreground">
        <Plus className="w-4 h-4" /> Add the first moment
      </Button>
    )}
  </div>
);

const EntryDialog = ({
  open,
  onOpenChange,
  entry,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry: TimelineEntry | null;
  userId: string;
  onSaved: () => void;
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [enjoyment, setEnjoyment] = useState<number | undefined>(undefined);
  const [iconKey, setIconKey] = useState<string | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeMedia, setRemoveMedia] = useState(false);
  const [existingPreview, setExistingPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setTitle(entry.title);
      setContent(entry.content);
      setDate(new Date(entry.date).toISOString().slice(0, 10));
      setEndDate(entry.endDate ? new Date(entry.endDate).toISOString().slice(0, 10) : "");
      setLocation(entry.location ?? "");
      setEnjoyment(entry.enjoyment);
      setIconKey(entry.iconKey);
      (async () => {
        if (entry.mediaKind) {
          const url = await getEntryBlobUrl(entry.id);
          setExistingPreview(url);
        } else {
          setExistingPreview(null);
        }
      })();
    } else {
      setTitle("");
      setContent("");
      setDate(new Date().toISOString().slice(0, 10));
      setEndDate("");
      setLocation("");
      setEnjoyment(undefined);
      setIconKey(undefined);
      setExistingPreview(null);
    }
    setFile(null);
    setPreview(null);
    setRemoveMedia(false);
  }, [open, entry]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => {
      if (existingPreview) URL.revokeObjectURL(existingPreview);
    };
  }, [existingPreview]);

  const handleSave = async () => {
    if (!title.trim() || !date) {
      toast({ title: "Title and date are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const ts = new Date(date).getTime();
      const ets = endDate ? new Date(endDate).getTime() : undefined;
      if (entry) {
        await updateEntry(entry.id, {
          title: title.trim(),
          content: content.trim(),
          date: ts,
          endDate: ets,
          location: location.trim() || undefined,
          enjoyment,
          iconKey,
          file,
          removeMedia,
        });
        toast({ title: "Moment updated" });
      } else {
        await createEntry(userId, {
          title: title.trim(),
          content: content.trim(),
          date: ts,
          endDate: ets,
          location: location.trim() || undefined,
          enjoyment,
          iconKey,
          file,
        });
        toast({ title: "Moment added ✨" });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const showPreview = preview || (!removeMedia && existingPreview);
  const previewKind = file
    ? file.type.startsWith("video")
      ? "video"
      : "image"
    : entry?.mediaKind;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit moment" : "New moment"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">End (optional)</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 rounded-xl" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A memorable moment" className="mt-1 rounded-xl" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Icon</label>
              {iconKey && (
                <button type="button" data-no-sound onClick={() => setIconKey(undefined)} className="text-[0.65rem] text-muted-foreground hover:text-destructive">
                  clear
                </button>
              )}
            </div>
            <div className="mt-1 rounded-xl border border-border bg-secondary/30 p-2 max-h-48 overflow-y-auto">
              <IconPicker value={iconKey} onChange={setIconKey} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Location (optional)
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Yercaud, Tamil Nadu"
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">How did it feel?</label>
            <div className="mt-1 flex items-center justify-between p-2 rounded-xl border border-border bg-secondary/30">
              <SmileRating value={enjoyment} onChange={setEnjoyment} />
              {enjoyment ? (
                <button
                  type="button"
                  data-no-sound
                  onClick={() => setEnjoyment(undefined)}
                  className="text-[0.65rem] text-muted-foreground hover:text-destructive"
                >
                  clear
                </button>
              ) : null}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Short detail</label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="A short note about this day…" rows={3} className="mt-1 rounded-xl resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Media (optional)</label>
            {showPreview ? (
              <div className="mt-1 relative rounded-xl overflow-hidden border border-border">
                {previewKind === "video" ? (
                  <video src={showPreview} className="w-full aspect-video object-cover" controls />
                ) : (
                  <img src={showPreview} alt="preview" className="w-full aspect-video object-cover" />
                )}
                <button
                  onClick={() => {
                    setFile(null);
                    setRemoveMedia(true);
                    setExistingPreview(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur hover:bg-destructive hover:text-destructive-foreground transition"
                  aria-label="Remove media"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="mt-1 flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition">
                <ImagePlus className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Tap to add photo or video</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      setRemoveMedia(false);
                    }
                  }}
                />
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary text-primary-foreground">
            {saving ? "Saving…" : entry ? "Save changes" : "Add moment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Timeline;
