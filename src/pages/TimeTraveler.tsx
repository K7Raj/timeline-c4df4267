import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Plane, MapPin, Calendar as CalendarIcon, Trash2, Pencil,
  Compass, Image as ImageIcon, X, Activity, PartyPopper, Briefcase, Sparkles,
  CalendarDays, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/auth-store";
import { getTravelerPerms } from "@/lib/settings-store";
import {
  createPlan, deletePlan, getPlanImageUrl, listPlans, updatePlan,
  type PlanKind, type TravelerPlan,
} from "@/lib/traveler-store";
import { createEntry } from "@/lib/timeline-store";
import localforage from "localforage";
import { SmileRating, SmileBadge } from "@/components/SmileRating";
import { IconPicker, ResolvedIcon } from "@/components/IconPicker";

const KIND_META: Record<PlanKind, { label: string; Icon: typeof Plane; color: string }> = {
  trip:     { label: "Trip",     Icon: Plane,        color: "from-sky-500 to-indigo-500" },
  activity: { label: "Activity", Icon: Activity,     color: "from-emerald-500 to-teal-500" },
  visit:    { label: "Visit",    Icon: MapPin,       color: "from-pink-500 to-rose-500" },
  event:    { label: "Event",    Icon: PartyPopper,  color: "from-amber-500 to-orange-500" },
  other:    { label: "Other",    Icon: Briefcase,    color: "from-violet-500 to-fuchsia-500" },
};

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
const fmtDay = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
const monthKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
};
const daysFromNow = (ts: number) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((ts - today.getTime()) / 86400000);
};

const TimeTraveler = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const perms = user ? getTravelerPerms(user, user.id) : { create: false, update: false, delete: false };
  const canCreate = perms.create;
  const canEdit = perms.update;
  const canDelete = perms.delete;
  const [plans, setPlans] = useState<TravelerPlan[]>([]);
  const [view, setView] = useState<"months" | "days">("months");
  const [editing, setEditing] = useState<TravelerPlan | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<TravelerPlan | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [outcomePrompt, setOutcomePrompt] = useState<TravelerPlan | null>(null);

  useEffect(() => {
    if (!user) navigate("/", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, navigate]);

  const refresh = async () => {
    if (!user) return;
    const list = await listPlans(user.id);
    setPlans(list);
    const withImg = list.filter((p) => p.mediaKind);
    const entries = await Promise.all(
      withImg.map(async (p) => [p.id, await getPlanImageUrl(p.id)] as const),
    );
    const map: Record<string, string> = {};
    for (const [id, url] of entries) if (url) map[id] = url;
    setImages((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return map;
    });
  };

  useEffect(() => {
    refresh();
    return () => {
      setImages((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = plans.filter((p) => (p.endDate ?? p.startDate) >= today.getTime());
  const past = plans.filter((p) => (p.endDate ?? p.startDate) < today.getTime()).reverse();

  const grouped = useMemo(() => {
    const m = new Map<string, TravelerPlan[]>();
    for (const p of upcoming) {
      const k = monthKey(p.startDate);
      const arr = m.get(k) ?? [];
      arr.push(p);
      m.set(k, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [upcoming]);

  const handleSave = async (data: PlanForm) => {
    if (!user) return;
    if (editing) {
      await updatePlan(editing.id, data);
      toast({ title: "Plan updated" });
    } else {
      await createPlan(user.id, {
        title: data.title, notes: data.notes, kind: data.kind,
        startDate: data.startDate, endDate: data.endDate, location: data.location,
        enjoyment: data.enjoyment,
        iconKey: data.iconKey,
        file: data.file,
      } as Parameters<typeof createPlan>[1]);
      toast({ title: "Plan added ✨" });
    }
    setEditing(null);
    setCreateOpen(false);
    refresh();
  };

  return (
    <main className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="flex items-center gap-2 px-3 sm:px-4 h-14 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/home")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
            <Compass className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-bold text-gradient flex-1 truncate">Time Traveler</h1>
          {canCreate && (
            <Button
              size="icon"
              className="rounded-xl bg-gradient-primary text-primary-foreground"
              onClick={() => { setEditing(null); setCreateOpen(true); }}
              aria-label="Add plan"
            >
              <Plus className="w-5 h-5" />
            </Button>
          )}
        </div>

        <div className="px-3 sm:px-4 pb-3 max-w-2xl mx-auto flex items-center gap-2">
          <button
            onClick={() => setView("months")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              view === "months"
                ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                : "bg-secondary/50 border-border text-muted-foreground"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" /> Months
          </button>
          <button
            onClick={() => setView("days")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              view === "days"
                ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                : "bg-secondary/50 border-border text-muted-foreground"
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" /> Days
          </button>
          <span className="ml-auto text-[0.7rem] text-muted-foreground">
            {upcoming.length} upcoming
          </span>
        </div>
      </header>

      <section className="px-3 sm:px-5 pt-4 pb-12 max-w-2xl mx-auto">
        {plans.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-primary flex items-center justify-center mb-4 shadow-glow">
              <Sparkles className="w-9 h-9 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-bold mb-1">Plot your future memories</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-5">
              Trips, activities, visits, events — never miss a thing. Add your first plan.
            </p>
            {canCreate && (
              <Button
                onClick={() => { setEditing(null); setCreateOpen(true); }}
                className="rounded-xl bg-gradient-primary text-primary-foreground"
              >
                <Plus className="w-4 h-4" /> Add a plan
              </Button>
            )}
          </div>
        ) : view === "months" ? (
          <div className="space-y-5">
            {grouped.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                No upcoming plans. Add one ✨
              </p>
            ) : (
              grouped.map(([k, list]) => (
                <div key={k}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-gradient-primary text-primary-foreground text-[0.65rem] font-bold uppercase tracking-wider shadow-glow">
                      {monthLabel(k)}
                    </span>
                    <span className="text-[0.65rem] text-muted-foreground">
                      {list.length} plan{list.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {list.map((p) => (
                      <PlanCard
                        key={p.id}
                        plan={p}
                        image={images[p.id]}
                        onEdit={canEdit ? () => setEditing(p) : undefined}
                        onDelete={canDelete ? () => setToDelete(p) : undefined}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}

            {past.length > 0 && (
              <div className="pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Past plans
                </h3>
                <div className="space-y-2 opacity-70">
                  {past.map((p) => (
                    <PlanRow key={p.id} plan={p} onEdit={canEdit ? () => setEditing(p) : undefined} onDelete={canDelete ? () => setToDelete(p) : undefined} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((p) => (
              <PlanRow key={p.id} plan={p} onEdit={canEdit ? () => setEditing(p) : undefined} onDelete={canDelete ? () => setToDelete(p) : undefined} />
            ))}
            {past.length > 0 && (
              <div className="pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Past plans
                </h3>
                <div className="space-y-2 opacity-70">
                  {past.map((p) => (
                    <PlanRow key={p.id} plan={p} onEdit={canEdit ? () => setEditing(p) : undefined} onDelete={canDelete ? () => setToDelete(p) : undefined} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <PlanDialog
        open={createOpen || !!editing}
        onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditing(null); } }}
        editing={editing}
        onSave={handleSave}
      />

      <OutcomeDialog
        plan={outcomePrompt}
        onClose={() => setOutcomePrompt(null)}
        onAnswered={async (didHappen) => {
          if (!outcomePrompt || !user) return;
          if (didHappen) {
            // Copy any cover image from traveler-blobs → File so it
            // can be re-attached to the timeline entry.
            let file: File | null = null;
            if (outcomePrompt.mediaKind) {
              try {
                const blobs = localforage.createInstance({ name: "gayu-vault", storeName: "traveler-blobs" });
                const b = await blobs.getItem<Blob>(outcomePrompt.id);
                if (b) file = new File([b], `${outcomePrompt.title}.${(b.type.split("/")[1] ?? "jpg")}`, { type: b.type || "image/jpeg" });
              } catch { /* ignore */ }
            }
            const created = await createEntry(user.id, {
              date: outcomePrompt.startDate,
              endDate: outcomePrompt.endDate,
              title: outcomePrompt.title,
              content: outcomePrompt.notes,
              location: outcomePrompt.location,
              enjoyment: outcomePrompt.enjoyment,
              iconKey: outcomePrompt.iconKey,
              file,
            });
            await updatePlan(outcomePrompt.id, {
              outcome: "happened",
              outcomeAt: Date.now(),
              timelineEntryId: created.id,
            });
            toast({ title: "Added to Memory Map ✨", description: outcomePrompt.title });
          } else {
            await updatePlan(outcomePrompt.id, {
              outcome: "missed",
              outcomeAt: Date.now(),
            });
            toast({ title: "Marked as didn't happen" });
          }
          setOutcomePrompt(null);
          refresh();
        }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" will be removed permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { if (toDelete) { await deletePlan(toDelete.id); setToDelete(null); refresh(); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

const PlanCard = ({
  plan, image, onEdit, onDelete,
}: { plan: TravelerPlan; image?: string; onEdit?: () => void; onDelete?: () => void }) => {
  const meta = KIND_META[plan.kind];
  const days = daysFromNow(plan.startDate);
  return (
    <div className="bg-gradient-card border border-border rounded-2xl shadow-elegant overflow-hidden flex flex-col">
      {image ? (
        <div className="aspect-video bg-secondary/40">
          <img src={image} alt={plan.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={`aspect-video bg-gradient-to-br ${meta.color} flex items-center justify-center`}>
          <meta.Icon className="w-10 h-10 text-white/90 drop-shadow" />
        </div>
      )}
      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="px-2 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-wider bg-primary/15 text-primary">
            {meta.label}
          </span>
          {days >= 0 && days <= 60 && (
            <span className="px-2 py-0.5 rounded-full text-[0.6rem] font-bold bg-accent text-accent-foreground">
              in {days}d
            </span>
          )}
        </div>
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 flex items-center gap-1.5">
          {plan.iconKey && <ResolvedIcon iconKey={plan.iconKey} className="w-4 h-4 shrink-0 text-primary" />}
          <span className="truncate">{plan.title}</span>
        </h3>
        <div className="mt-1 text-[0.7rem] text-muted-foreground flex items-center gap-1">
          <CalendarIcon className="w-3 h-3" />
          {fmtDate(plan.startDate)}{plan.endDate ? ` – ${fmtDate(plan.endDate)}` : ""}
        </div>
        {plan.location && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.location)}`}
            target="_blank"
            rel="noopener noreferrer"
            data-sound="open"
            className="mt-0.5 text-[0.7rem] text-primary hover:underline flex items-center gap-1"
          >
            <MapPin className="w-3 h-3" /> {plan.location}
          </a>
        )}
        {plan.enjoyment ? (
          <div className="mt-1"><SmileRating value={plan.enjoyment} readOnly size="sm" /></div>
        ) : null}
        {plan.notes && (
          <p className="mt-1.5 text-xs text-foreground/80 line-clamp-2 whitespace-pre-wrap">{plan.notes}</p>
        )}
        {(onEdit || onDelete) && (
          <div className="mt-2 flex items-center justify-end gap-1">
            {onEdit && (
              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={onEdit}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-destructive" onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const PlanRow = ({
  plan, onEdit, onDelete,
}: { plan: TravelerPlan; onEdit?: () => void; onDelete?: () => void }) => {
  const meta = KIND_META[plan.kind];
  const days = daysFromNow(plan.startDate);
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-gradient-card shadow-elegant">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${meta.color} flex flex-col items-center justify-center text-white shrink-0`}>
        {days >= 0 ? (
          <>
            <span className="text-sm font-bold leading-none">{days}</span>
            <span className="text-[0.55rem] uppercase mt-0.5 leading-none">days</span>
          </>
        ) : (
          <meta.Icon className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {plan.iconKey && <ResolvedIcon iconKey={plan.iconKey} className="w-3.5 h-3.5 text-primary shrink-0" />}
          <p className="font-semibold text-sm truncate">{plan.title}</p>
          <span className="px-1.5 py-0 rounded-full text-[0.55rem] font-bold uppercase bg-primary/15 text-primary">
            {meta.label}
          </span>
        </div>
        <p className="text-[0.7rem] text-muted-foreground truncate">
          {fmtDay(plan.startDate)}
          {plan.endDate ? ` → ${fmtDay(plan.endDate)}` : ""}
          {plan.location ? ` · ${plan.location}` : ""}
        </p>
        {plan.enjoyment ? (
          <div className="mt-0.5"><SmileBadge value={plan.enjoyment} /></div>
        ) : null}
      </div>
      {(onEdit || onDelete) && (
        <div className="flex items-center gap-0.5">
          {onEdit && (
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

interface PlanForm {
  title: string;
  notes: string;
  kind: PlanKind;
  startDate: number;
  endDate?: number;
  location?: string;
  enjoyment?: number;
  iconKey?: string;
  file?: File | null;
  removeMedia?: boolean;
}

const PlanDialog = ({
  open, onOpenChange, editing, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: TravelerPlan | null;
  onSave: (data: PlanForm) => void | Promise<void>;
}) => {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<PlanKind>("trip");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [enjoyment, setEnjoyment] = useState<number | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [existing, setExisting] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const [iconKey, setIconKey] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setNotes(editing.notes);
      setKind(editing.kind);
      setStart(new Date(editing.startDate).toISOString().slice(0, 10));
      setEnd(editing.endDate ? new Date(editing.endDate).toISOString().slice(0, 10) : "");
      setLocation(editing.location ?? "");
      setEnjoyment(editing.enjoyment);
      setIconKey(editing.iconKey);
      setRemove(false);
      (async () => {
        if (editing.mediaKind) setExisting(await getPlanImageUrl(editing.id));
        else setExisting(null);
      })();
    } else {
      setTitle(""); setNotes(""); setKind("trip");
      setStart(new Date().toISOString().slice(0, 10));
      setEnd(""); setLocation(""); setEnjoyment(undefined); setIconKey(undefined); setExisting(null); setRemove(false);
    }
    setFile(null); setPreview(null);
  }, [open, editing]);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => () => { if (existing) URL.revokeObjectURL(existing); }, [existing]);

  const submit = () => {
    if (!title.trim() || !start) {
      toast({ title: "Title and start date are required", variant: "destructive" });
      return;
    }
    onSave({
      title: title.trim(),
      notes: notes.trim(),
      kind,
      startDate: new Date(start).getTime(),
      endDate: end ? new Date(end).getTime() : undefined,
      location: location.trim() || undefined,
      enjoyment,
      iconKey,
      file,
      removeMedia: remove,
    });
  };

  const showImg = preview || (!remove && existing);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit plan" : "New plan"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <div className="mt-1 grid grid-cols-5 gap-1.5">
              {(Object.keys(KIND_META) as PlanKind[]).map((k) => {
                const M = KIND_META[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border text-[0.6rem] transition ${
                      kind === k
                        ? "bg-gradient-primary text-primary-foreground border-transparent"
                        : "bg-secondary/50 border-border text-muted-foreground"
                    }`}
                  >
                    <M.Icon className="w-4 h-4" />
                    {M.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 rounded-xl" placeholder="Weekend in Yercaud" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Start</label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">End (optional)</label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 rounded-xl" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Location
            </label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 rounded-xl" placeholder="e.g. Yercaud, Tamil Nadu" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Excitement level</label>
            <div className="mt-1 flex items-center justify-between p-2 rounded-xl border border-border bg-secondary/30">
              <SmileRating value={enjoyment} onChange={setEnjoyment} />
              {enjoyment ? (
                <button type="button" data-no-sound onClick={() => setEnjoyment(undefined)} className="text-[0.65rem] text-muted-foreground hover:text-destructive">
                  clear
                </button>
              ) : null}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Icon / emotion</label>
            <div className="mt-1 p-2 rounded-xl border border-border bg-secondary/30">
              <IconPicker value={iconKey} onChange={setIconKey} />
              {iconKey && (
                <button type="button" data-no-sound onClick={() => setIconKey(undefined)} className="mt-1 text-[0.65rem] text-muted-foreground hover:text-destructive">
                  clear icon
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 rounded-xl resize-none" placeholder="Things to pack, ideas, reminders…" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cover image (optional)</label>
            {showImg ? (
              <div className="mt-1 relative rounded-xl overflow-hidden border border-border">
                <img src={showImg} alt="" className="w-full aspect-video object-cover" />
                <button
                  onClick={() => { setFile(null); setRemove(true); setExisting(null); }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur hover:bg-destructive hover:text-destructive-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="mt-1 flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition">
                <ImageIcon className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Tap to add a cover image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setFile(f); setRemove(false); }
                  }}
                />
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-gradient-primary text-primary-foreground" onClick={submit}>
            {editing ? "Save" : "Add plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimeTraveler;
