import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Music2, Plus, Trash2, Pencil, Play, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { toast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/auth-store";
import { useSettings } from "@/lib/settings-store";
import {
  addVideos,
  deleteVideos,
  getVideoUrl,
  listVideos,
  renameVideo,
  type RhythmVideo,
} from "@/lib/rhythm-store";

const Rhythm = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const settings = useSettings(user?.id);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [videos, setVideos] = useState<RhythmVideo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renameOf, setRenameOf] = useState<RhythmVideo | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [playing, setPlaying] = useState<{ v: RhythmVideo; url: string } | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    refresh();
  }, [user, navigate]);

  const refresh = async () => {
    if (!user) return;
    setVideos(await listVideos(user.id));
  };

  const onPick = async (files: FileList | null) => {
    if (!user || !files || files.length === 0) return;
    const added = await addVideos(user.id, files);
    if (added.length === 0) {
      toast({ title: "Only video files are supported", variant: "destructive" });
    } else {
      toast({ title: `Added ${added.length} video${added.length === 1 ? "" : "s"} ✨` });
    }
    refresh();
  };

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const allSelected = selected.size > 0 && selected.size === videos.length;

  const handleDelete = async () => {
    await deleteVideos(Array.from(selected));
    toast({ title: `Deleted ${selected.size} video${selected.size === 1 ? "" : "s"}` });
    setSelected(new Set());
    setConfirmDel(false);
    refresh();
  };

  const startRename = (v: RhythmVideo) => {
    setRenameOf(v);
    setRenameVal(v.name);
  };

  const saveRename = async () => {
    if (!renameOf || !renameVal.trim()) return;
    await renameVideo(renameOf.id, renameVal.trim());
    setRenameOf(null);
    refresh();
  };

  const play = async (v: RhythmVideo) => {
    const url = await getVideoUrl(v.id);
    if (!url) return;
    setPlaying({ v, url });
  };

  const closePlay = () => {
    if (playing) URL.revokeObjectURL(playing.url);
    setPlaying(null);
  };

  return (
    <main className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="flex items-center gap-2 px-3 sm:px-4 h-14 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/home")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
            <Music2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-bold text-gradient flex-1 truncate">{settings.rhythmName || "Rhythm of Us"}</h1>
          {selected.size > 0 ? (
            <>
              <span className="text-xs text-muted-foreground">{selected.size}</span>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl"
                onClick={() => setSelected(allSelected ? new Set() : new Set(videos.map((v) => v.id)))}
                aria-label="Select all"
              >
                <Check className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl text-destructive"
                onClick={() => setConfirmDel(true)}
                aria-label="Delete selected"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </>
          ) : (
            <Button
              size="icon"
              className="rounded-xl bg-gradient-primary text-primary-foreground"
              onClick={() => fileRef.current?.click()}
              aria-label="Add video"
            >
              <Plus className="w-5 h-5" />
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />
        </div>
        {settings.enabledTabs.media && (
          <div className="px-3 sm:px-4 pb-3 max-w-2xl mx-auto flex items-center gap-2">
            <button
              onClick={() => navigate("/media")}
              className="flex-1 px-3 py-1.5 rounded-full text-xs font-medium border bg-secondary/50 border-border text-muted-foreground hover:text-foreground transition"
            >
              Photos & files
            </button>
            <button
              className="flex-1 px-3 py-1.5 rounded-full text-xs font-medium border bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
            >
              Videos
            </button>
          </div>
        )}
      </header>

      <section className="px-4 pt-5 pb-12 max-w-2xl mx-auto">
        {videos.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-primary/10 flex items-center justify-center mb-3">
              <Music2 className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Tap + to add videos from your device.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              They stay on this device only.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {videos.map((v) => {
              const isSel = selected.has(v.id);
              return (
                <div
                  key={v.id}
                  className={`relative group bg-gradient-card border rounded-2xl p-3 shadow-elegant transition ${
                    isSel ? "border-primary ring-2 ring-primary/40" : "border-border"
                  }`}
                  onClick={() => (selected.size > 0 ? toggle(v.id) : play(v))}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gradient-primary flex items-center justify-center shrink-0 relative">
                      {v.thumb ? (
                        <>
                          <img src={v.thumb} alt="" className="w-full h-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Play className="w-5 h-5 text-white drop-shadow" />
                          </span>
                        </>
                      ) : (
                        <Play className="w-5 h-5 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{v.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(v.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1 justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(v.id);
                      }}
                      aria-label="Select"
                    >
                      <Check className={`w-4 h-4 ${isSel ? "text-primary" : "text-muted-foreground"}`} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(v);
                      }}
                      aria-label="Rename"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-lg text-destructive"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await deleteVideos([v.id]);
                        refresh();
                      }}
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Rename */}
      <Dialog open={!!renameOf} onOpenChange={(o) => !o && setRenameOf(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename video</DialogTitle>
          </DialogHeader>
          <Input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} className="rounded-xl" autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenameOf(null)}>Cancel</Button>
            <Button className="bg-gradient-primary text-primary-foreground" onClick={saveRename}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} video{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected videos from this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Player */}
      <Dialog open={!!playing} onOpenChange={(o) => !o && closePlay()}>
        <DialogContent className="max-w-2xl p-3">
          <DialogHeader>
            <DialogTitle className="text-sm pr-8 flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" />
              <span className="truncate">{playing?.v.name}</span>
            </DialogTitle>
          </DialogHeader>
          {playing && (
            <video
              src={playing.url}
              controls
              autoPlay
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
              className="w-full rounded-xl bg-black max-h-[70dvh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Rhythm;
