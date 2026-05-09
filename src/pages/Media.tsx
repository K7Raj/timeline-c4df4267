import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FolderPlus,
  Folder as FolderIcon,
  Plus,
  Trash2,
  Move,
  Play,
  X,
  Check,
  Pencil,
  Upload,
  ImageIcon,
  Music,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import {
  Folder,
  MediaItem,
  addMediaFiles,
  createFolder,
  deleteFolder,
  deleteItems,
  getBlobUrl,
  getFolders,
  getItems,
  moveItems,
  renameFolder,
} from "@/lib/media-store";
import { getCurrentUser } from "@/lib/auth-store";

const Media = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const userId = user?.id ?? "";
  const [folders, setFolders] = useState<Folder[]>([]);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [activeFolder, setActiveFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);

  // Selection inside a folder
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<MediaItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [fs, its] = await Promise.all([getFolders(userId), getItems(userId)]);
    setFolders(fs);
    setItems(its);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!user) navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const folderItems = useMemo(
    () => (activeFolder ? items.filter((i) => i.folderId === activeFolder.id) : []),
    [items, activeFolder],
  );

  const folderCount = useCallback(
    (id: string) => items.filter((i) => i.folderId === id).length,
    [items],
  );

  // Actions
  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    await createFolder(userId, name);
    setNewFolderName("");
    setNewFolderOpen(false);
    await refresh();
    toast({ title: "Folder created", description: `"${name}" is ready.` });
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) return;
    await renameFolder(renameTarget.id, name);
    setRenameTarget(null);
    await refresh();
    if (activeFolder?.id === renameTarget.id)
      setActiveFolder({ ...activeFolder, name });
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    await deleteFolder(deleteFolderTarget.id);
    if (activeFolder?.id === deleteFolderTarget.id) setActiveFolder(null);
    setDeleteFolderTarget(null);
    await refresh();
    toast({ title: "Folder deleted" });
  };

  const handleUpload: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    if (!activeFolder || !e.target.files?.length) return;
    const files = e.target.files;
    await addMediaFiles(userId, activeFolder.id, files);
    e.target.value = "";
    await refresh();
    toast({ title: "Uploaded", description: `${files.length} file(s) added.` });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleDeleteSelected = async () => {
    if (!selected.size) return;
    await deleteItems([...selected]);
    clearSelection();
    await refresh();
    toast({ title: "Deleted" });
  };

  const handleMove = async (toId: string) => {
    if (!selected.size) return;
    await moveItems([...selected], toId);
    clearSelection();
    setMoveOpen(false);
    await refresh();
    toast({ title: "Moved" });
  };

  // ---- UI ----
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="flex items-center gap-2 px-3 sm:px-4 h-14 max-w-5xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => (activeFolder ? setActiveFolder(null) : navigate("/home"))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-base sm:text-lg font-bold text-gradient flex-1 truncate">
            {activeFolder ? `${activeFolder.name}` : "Multimedia"}
          </h1>
          {!activeFolder ? (
            <Button
              size="sm"
              className="rounded-xl bg-gradient-primary text-primary-foreground"
              onClick={() => setNewFolderOpen(true)}
            >
              <FolderPlus className="w-4 h-4" />
              <span className="hidden xs:inline sm:inline">New</span>
            </Button>
          ) : (
            <Button
              size="sm"
              className="rounded-xl bg-gradient-primary text-primary-foreground"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden xs:inline sm:inline">Upload</span>
            </Button>
          )}
        </div>
      </header>

      <section className="px-3 sm:px-5 pt-5 pb-24 max-w-5xl mx-auto">
        {loading ? (
          <p className="text-center text-muted-foreground text-sm mt-10">Loading…</p>
        ) : activeFolder ? (
          <FolderView
            folder={activeFolder}
            items={folderItems}
            selected={selected}
            onToggle={toggleSelect}
            onOpen={setPreview}
          />
        ) : (
          <FoldersGrid
            folders={folders}
            count={folderCount}
            onOpen={setActiveFolder}
            onRename={(f) => {
              setRenameTarget(f);
              setRenameValue(f.name);
            }}
            onDelete={(f) => setDeleteFolderTarget(f)}
            onCreate={() => setNewFolderOpen(true)}
          />
        )}
      </section>

      {/* hidden input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      {/* Selection action bar */}
      {activeFolder && selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-3 pointer-events-none">
          <div className="mx-auto max-w-md pointer-events-auto bg-gradient-card border border-border rounded-2xl shadow-elegant p-2 flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={clearSelection}>
              <X className="w-5 h-5" />
            </Button>
            <span className="text-sm font-medium flex-1">{selected.size} selected</span>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-xl"
              onClick={() => setMoveOpen(true)}
            >
              <Move className="w-4 h-4" />
              Move
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="rounded-xl"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="bg-gradient-card border-border rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Folder name (e.g. Birthdays)"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-primary text-primary-foreground"
              onClick={handleCreateFolder}
            >
              <Check className="w-4 h-4" /> Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="bg-gradient-card border-border rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-primary text-primary-foreground"
              onClick={handleRename}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete folder confirm */}
      <AlertDialog
        open={!!deleteFolderTarget}
        onOpenChange={(o) => !o && setDeleteFolderTarget(null)}
      >
        <AlertDialogContent className="bg-gradient-card border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteFolderTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the folder and all media inside it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteFolder}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move to folder */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="bg-gradient-card border-border rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Move to folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {folders
              .filter((f) => f.id !== activeFolder?.id)
              .map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleMove(f.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-secondary/50 text-left transition"
                >
                  <FolderIcon className="w-5 h-5 text-primary" />
                  <span className="flex-1 text-sm font-medium truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {folderCount(f.id)}
                  </span>
                </button>
              ))}
            {folders.filter((f) => f.id !== activeFolder?.id).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No other folders. Create one first.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Media preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="bg-background/95 border-border rounded-2xl max-w-3xl p-2 sm:p-4">
          {preview && <MediaPreview item={preview} />}
        </DialogContent>
      </Dialog>
    </main>
  );
};

// ----- Subcomponents -----

const FoldersGrid = ({
  folders,
  count,
  onOpen,
  onRename,
  onDelete,
  onCreate,
}: {
  folders: Folder[];
  count: (id: string) => number;
  onOpen: (f: Folder) => void;
  onRename: (f: Folder) => void;
  onDelete: (f: Folder) => void;
  onCreate: () => void;
}) => {
  if (folders.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-primary flex items-center justify-center mb-4">
          <FolderPlus className="w-8 h-8 text-primary-foreground" />
        </div>
        <h3 className="font-bold text-lg mb-1">No folders yet</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Create your first folder to organize your memories.
        </p>
        <Button
          onClick={onCreate}
          className="bg-gradient-primary text-primary-foreground rounded-xl"
        >
          <Plus className="w-4 h-4" /> Create folder
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {folders.map((f) => (
        <div
          key={f.id}
          className="group relative bg-gradient-card border border-border rounded-2xl p-4 shadow-elegant hover:border-primary/40 hover:shadow-glow transition-all"
        >
          <button
            onClick={() => onOpen(f)}
            className="w-full text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-3">
              <FolderIcon className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base truncate">{f.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {count(f.id)} item{count(f.id) === 1 ? "" : "s"}
            </p>
          </button>
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRename(f);
              }}
              className="p-1.5 rounded-lg bg-background/70 backdrop-blur hover:bg-secondary"
              aria-label="Rename"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(f);
              }}
              className="p-1.5 rounded-lg bg-background/70 backdrop-blur hover:bg-destructive/20 text-destructive"
              aria-label="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Mobile: always-visible small actions */}
          <div className="sm:hidden absolute top-2 right-2 flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(f);
              }}
              className="p-1.5 rounded-lg bg-background/70 backdrop-blur text-destructive"
              aria-label="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const FolderView = ({
  folder,
  items,
  selected,
  onToggle,
  onOpen,
}: {
  folder: Folder;
  items: MediaItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (item: MediaItem) => void;
}) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-primary flex items-center justify-center mb-4">
          <ImageIcon className="w-8 h-8 text-primary-foreground" />
        </div>
        <h3 className="font-bold text-lg mb-1">Empty folder</h3>
        <p className="text-sm text-muted-foreground">
          Tap Upload to add photos or videos.
        </p>
      </div>
    );
  }
  const hasSelection = selected.size > 0;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
      {items.map((it) => (
        <MediaThumb
          key={it.id}
          item={it}
          selected={selected.has(it.id)}
          selectionMode={hasSelection}
          onToggle={() => onToggle(it.id)}
          onOpen={() => onOpen(it)}
        />
      ))}
    </div>
  );
};

const MediaThumb = ({
  item,
  selected,
  selectionMode,
  onToggle,
  onOpen,
}: {
  item: MediaItem;
  selected: boolean;
  selectionMode: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const pressTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    let objUrl: string | null = null;
    getBlobUrl(item.id).then((u) => {
      if (active) {
        setUrl(u);
        objUrl = u;
      }
    });
    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [item.id]);

  const startPress = () => {
    pressTimer.current = window.setTimeout(() => onToggle(), 400);
  };
  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <button
      onClick={() => (selectionMode ? onToggle() : onOpen())}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchMove={endPress}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
        selected
          ? "border-primary ring-2 ring-primary/40"
          : "border-border hover:border-primary/40"
      } bg-secondary`}
    >
      {url ? (
        item.kind === "image" ? (
          <img src={url} alt={item.name} className="w-full h-full object-cover" />
        ) : item.kind === "video" ? (
          <>
            <video
              src={url}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play className="w-6 h-6 text-white drop-shadow" fill="white" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-primary p-2 text-primary-foreground">
            <Music className="w-7 h-7" />
            <span className="text-[0.6rem] font-medium truncate w-full text-center">
              {item.name}
            </span>
          </div>
        )
      ) : (
        <div className="w-full h-full animate-pulse bg-muted" />
      )}

      {selected && (
        <div className="absolute inset-0 bg-primary/20 flex items-start justify-end p-1.5">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
        </div>
      )}
      {!selected && selectionMode && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 border-white/80 bg-black/20" />
      )}
    </button>
  );
};

const MediaPreview = ({ item }: { item: MediaItem }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objUrl: string | null = null;
    getBlobUrl(item.id).then((u) => {
      setUrl(u);
      objUrl = u;
    });
    return () => {
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [item.id]);

  if (!url)
    return <div className="h-64 flex items-center justify-center">Loading…</div>;

  return (
    <div className="w-full flex items-center justify-center">
      {item.kind === "image" ? (
        <img
          src={url}
          alt={item.name}
          className="max-h-[80vh] w-auto rounded-xl object-contain"
        />
      ) : item.kind === "video" ? (
        <video
          src={url}
          controls
          autoPlay
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          className="max-h-[80vh] w-full rounded-xl"
        />
      ) : (
        <div className="w-full p-6 flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-3xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Music className="w-12 h-12 text-primary-foreground" />
          </div>
          <p className="text-sm font-medium truncate max-w-full">{item.name}</p>
          <audio
            src={url}
            controls
            autoPlay
            controlsList="nodownload noremoteplayback"
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

export default Media;
