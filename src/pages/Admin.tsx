import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  Clock3,
  Search,
  Sun,
  Moon,
  Share2,
  
  Settings as SettingsIcon,
  Sparkles,
  Lamp,
  Compass,
  X,
  Eye,
  Smartphone,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  createUser,
  deleteUser,
  getCurrentUser,
  listUsers,
  logout,
  updateUser,
  type Role,
  type User,
} from "@/lib/auth-store";
import { deleteAllForUser } from "@/lib/timeline-store";
import { clearWishes } from "@/lib/wish-store";
import { useTheme } from "@/hooks/use-theme";
import { ShareDialog } from "@/components/ShareDialog";
import {
  getSettings,
  getUserSettings,
  saveSettings,
  saveUserSettings,
  type AppSettings,
  type TabKey,
} from "@/lib/settings-store";
import { pushNotice } from "@/lib/notifications-store";
import { setSoundEnabled } from "@/lib/sound";
import { LibraryManager } from "@/components/LibraryManager";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Type, Quote, Wand2, Volume2, LayoutGrid, Library } from "lucide-react";
import { FolderLock, Save } from "lucide-react";
import {
  clearBackupFolder,
  getBackupFolderName,
  isPickerSupported,
  pickBackupFolder,
  saveEncryptedSnapshot,
} from "@/lib/backup-folder";

const Admin = () => {
  const navigate = useNavigate();
  const me = getCurrentUser();
  const [users, setUsers] = useState<User[]>(() => listUsers());
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pwTarget, setPwTarget] = useState<User | null>(null);
  const [delTarget, setDelTarget] = useState<User | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);

  const [permsTarget, setPermsTarget] = useState<User | null>(null);
  const [travelerPermsTarget, setTravelerPermsTarget] = useState<User | null>(null);
  const [resetWishTarget, setResetWishTarget] = useState<User | null>(null);
  const [userSettingsTarget, setUserSettingsTarget] = useState<User | null>(null);
  const [viewTarget, setViewTarget] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (!me) navigate("/", { replace: true });
    else if (me.role !== "admin") navigate("/home", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, me?.role, navigate]);

  const refresh = () => setUsers(listUsers());
  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.profileName.toLowerCase().includes(q),
    );
  }, [users, search]);

  const handleDelete = async () => {
    if (!delTarget) return;
    try {
      deleteUser(delTarget.id);
      await deleteAllForUser(delTarget.id);
      toast({ title: `Deleted ${delTarget.username}` });
      refresh();
    } catch (e) {
      toast({ title: "Could not delete", description: String((e as Error).message), variant: "destructive" });
    }
    setDelTarget(null);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleResetWishes = async () => {
    if (!resetWishTarget) return;
    await clearWishes(resetWishTarget.id);
    pushNotice(resetWishTarget.id, "Admin reset your genie wishes — make new ones ✨");
    toast({ title: `Reset wishes for ${resetWishTarget.profileName}` });
    setResetWishTarget(null);
  };

  return (
    <main className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="flex items-center gap-1 px-3 sm:px-4 h-14 max-w-4xl mx-auto w-full">
          <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center mr-1">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-base sm:text-lg font-bold text-gradient flex-1 truncate">
            Admin · {me?.profileName}
          </h1>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={toggle} aria-label="Theme">
            {theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Admin menu">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl border-border bg-popover">
              <DropdownMenuItem onClick={() => setGlobalSettingsOpen(true)} className="gap-2 rounded-lg">
                <SettingsIcon className="w-4 h-4" /> Global settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShareOpen(true)} className="gap-2 rounded-lg">
                <Share2 className="w-4 h-4" /> Share vault
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="gap-2 rounded-lg text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4" /> Lock & sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} />
      <SettingsDialog open={globalSettingsOpen} onOpenChange={setGlobalSettingsOpen} users={users} />
      <PermsDialog target={permsTarget} onClose={() => setPermsTarget(null)} />
      <TravelerPermsDialog target={travelerPermsTarget} onClose={() => setTravelerPermsTarget(null)} />
      <UserSettingsAdminDialog target={userSettingsTarget} onClose={() => setUserSettingsTarget(null)} />
      <UserDetailsDialog target={viewTarget} onClose={() => setViewTarget(null)} />

      <section className="flex-1 px-3 sm:px-5 pt-5 pb-12 max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              className="pl-9 rounded-xl bg-secondary/50"
            />
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="rounded-xl bg-gradient-primary text-primary-foreground px-3 shrink-0"
            aria-label="New user"
          >
            <Plus className="w-4 h-4" /> <span className="hidden min-[380px]:inline">New user</span>
          </Button>
        </div>

        <div className="grid gap-3">
          {loading && (
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-gradient-card border border-border rounded-2xl p-4 shadow-elegant">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-11 h-11 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-1">
                    {[0, 1, 2, 3, 4].map((j) => (
                      <Skeleton key={j} className="h-9 w-9 rounded-xl" />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
          {!loading && filtered.map((u) => (
            <div
              key={u.id}
              className="bg-gradient-card border border-border rounded-2xl p-3 shadow-elegant"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
                  {(u.profileName || u.username).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{u.profileName}</p>
                    <span
                      className={`text-[0.6rem] uppercase font-bold px-2 py-0.5 rounded-full ${
                        u.role === "admin"
                          ? "bg-primary/20 text-primary"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {u.role}
                    </span>
                    {u.boundDeviceId && (
                      <span title="Bound to a device" className="text-[0.6rem] text-muted-foreground flex items-center gap-0.5">
                        <Smartphone className="w-3 h-3" /> bound
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => setViewTarget(u)} aria-label="View details" title="View details">
                    <Eye className="w-4 h-4" />
                  </Button>
                  {u.role === "user" && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => navigate(`/timeline?user=${u.id}`)} aria-label="Memory Map" title="Memory Map">
                      <Clock3 className="w-4 h-4" />
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" aria-label="More user actions" title="More actions">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl border-border bg-popover">
                    {u.role === "user" && (
                      <>
                        <DropdownMenuItem onClick={() => setUserSettingsTarget(u)} className="gap-2 rounded-lg">
                          <SettingsIcon className="w-4 h-4" /> User settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPermsTarget(u)} className="gap-2 rounded-lg">
                          <Shield className="w-4 h-4" /> Memory Map access
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTravelerPermsTarget(u)} className="gap-2 rounded-lg">
                          <Compass className="w-4 h-4" /> Time Traveler access
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setResetWishTarget(u)} className="gap-2 rounded-lg">
                          <Lamp className="w-4 h-4" /> Reset wishes
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={() => setPwTarget(u)} className="gap-2 rounded-lg">
                      <KeyRound className="w-4 h-4" /> Change passcode
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditing(u)} className="gap-2 rounded-lg">
                      <Pencil className="w-4 h-4" /> Edit account
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={u.id === me?.id} onClick={() => setDelTarget(u)} className="gap-2 rounded-lg text-destructive focus:text-destructive">
                      <Trash2 className="w-4 h-4" /> Delete user
                    </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">
              No users match your search.
            </p>
          )}
        </div>
      </section>

      <UserDialog
        open={createOpen || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setEditing(null);
          }
        }}
        user={editing}
        onSaved={(saved) => {
          if (saved && editing) {
            pushNotice(saved.id, "Admin updated your account details");
          }
          setCreateOpen(false);
          setEditing(null);
          refresh();
        }}
      />

      <PasswordDialog
        user={pwTarget}
        onClose={() => setPwTarget(null)}
        onSaved={(u) => {
          if (u) pushNotice(u.id, "Admin reset your passkey");
          setPwTarget(null);
          refresh();
        }}
      />

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {delTarget?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the account and the user's memory map.
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

      <AlertDialog open={!!resetWishTarget} onOpenChange={(o) => !o && setResetWishTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset wishes for {resetWishTarget?.profileName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears all 3 genie wishes so the user can make new ones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetWishes} className="bg-gradient-primary text-primary-foreground">
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

const UserDialog = ({
  open,
  onOpenChange,
  user,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: User | null;
  onSaved: (saved: User | null) => void;
}) => {
  const [username, setUsername] = useState("");
  const [profileName, setProfileName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [role, setRole] = useState<Role>("user");

  useEffect(() => {
    if (!open) return;
    if (user) {
      setUsername(user.username);
      setProfileName(user.profileName);
      setPasscode("");
      setRole(user.role);
    } else {
      setUsername("");
      setProfileName("");
      setPasscode("");
      setRole("user");
    }
  }, [open, user]);

  const save = () => {
    try {
      if (user) {
        updateUser(user.id, {
          username: username.trim(),
          profileName: profileName.trim(),
          role,
          ...(passcode ? { passcode } : {}),
        });
        toast({ title: "User updated" });
        onSaved(user);
      } else {
        if (!username.trim() || !passcode) {
          toast({ title: "Username and passcode are required", variant: "destructive" });
          return;
        }
        const created = createUser({
          username: username.trim(),
          profileName: profileName.trim() || username.trim(),
          passcode,
          role,
        });
        // Default-grant CRUD on the user's own memory map (read-only otherwise)
        const s = getSettings();
        s.memoryMapCrud[created.id] = { create: false, update: false, delete: false };
        s.travelerCrud[created.id] = { create: false, update: false, delete: false };
        saveSettings(s);
        toast({ title: "User created" });
        onSaved(created);
      }
    } catch (e) {
      toast({ title: "Save failed", description: String((e as Error).message), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user ? "Edit user" : "New user"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Username</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. gayu" className="mt-1 rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Profile name</label>
            <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="e.g. Gayu Kitty" className="mt-1 rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Passcode {user && <span className="opacity-60">(leave blank to keep)</span>}
            </label>
            <Input type="text" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="passcode" className="mt-1 rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Role</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["user", "admin"] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border transition ${
                    role === r
                      ? "bg-gradient-primary text-primary-foreground border-transparent"
                      : "bg-secondary/50 border-border text-muted-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-gradient-primary text-primary-foreground" onClick={save}>
            {user ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PasswordDialog = ({
  user,
  onClose,
  onSaved,
}: {
  user: User | null;
  onClose: () => void;
  onSaved: (u: User | null) => void;
}) => {
  const [pw, setPw] = useState("");
  useEffect(() => {
    setPw("");
  }, [user]);

  if (!user) return null;

  const save = () => {
    if (!pw) {
      toast({ title: "Enter a new passcode", variant: "destructive" });
      return;
    }
    try {
      updateUser(user.id, { passcode: pw });
      toast({ title: "Passcode updated" });
      onSaved(user);
    } catch (e) {
      toast({ title: "Failed", description: String((e as Error).message), variant: "destructive" });
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reset passcode</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Set a new passcode for <span className="font-semibold text-foreground">{user.profileName}</span>.
        </p>
        <Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New passcode" className="rounded-xl" autoFocus />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-gradient-primary text-primary-foreground" onClick={save}>
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PermsDialog = ({
  target,
  onClose,
}: {
  target: User | null;
  onClose: () => void;
}) => {
  const [perms, setPerms] = useState({ create: false, update: false, delete: false });

  useEffect(() => {
    if (!target) return;
    const s = getSettings();
    setPerms(s.memoryMapCrud[target.id] ?? { create: false, update: false, delete: false });
  }, [target]);

  if (!target) return null;

  const save = () => {
    const s = getSettings();
    s.memoryMapCrud[target.id] = perms;
    saveSettings(s);
    pushNotice(target.id, "Admin updated your Memory Map permissions");
    toast({ title: `Permissions saved for ${target.profileName}` });
    onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Memory Map access</DialogTitle>
          <DialogDescription className="text-xs">
            Choose what {target.profileName} can do with their Memory Map.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {(["create", "update", "delete"] as const).map((k) => (
            <label
              key={k}
              className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30"
            >
              <span className="text-sm capitalize">{k}</span>
              <Switch
                checked={perms[k]}
                onCheckedChange={(v) => setPerms((p) => ({ ...p, [k]: v }))}
              />
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="bg-gradient-primary text-primary-foreground" onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SettingsDialog = ({
  open,
  onOpenChange,
  users,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: User[];
}) => {
  const [s, setS] = useState<AppSettings>(() => getSettings());

  useEffect(() => {
    if (open) setS(getSettings());
  }, [open]);

  const save = () => {
    saveSettings(s);
    setSoundEnabled(s.soundEnabled);
    // Notify all non-admin users about the update
    users.filter((u) => u.role === "user").forEach((u) =>
      pushNotice(u.id, "Admin updated app settings (welcome, quotes or tabs)"),
    );
    toast({ title: "App settings saved ✨" });
    onOpenChange(false);
  };

  const tabLabels: Record<TabKey, string> = {
    timeline: "Memory Map",
    stats: "Statistics",
    traveler: "Time Traveler",
    surprise: "Surprise",
    media: "Multimedia (legacy)",
    wish: "Make a Wish",
    rhythm: s.rhythmName || "Rhythm of Us",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Global defaults
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tap a card to edit. Per-user overrides take precedence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <SettingCard icon={Type} title="Welcome heading" sub="Greeting shown on the user's home screen.">
            <Input
              value={s.welcomeHeading}
              onChange={(e) => setS({ ...s, welcomeHeading: e.target.value })}
              className="rounded-xl"
            />
          </SettingCard>

          <SettingCard icon={Volume2} title="App sounds" sub="Soft taps, chimes & sparkles across the app." defaultOpen>
            <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30">
              <span className="text-sm">Enable sounds globally</span>
              <Switch checked={s.soundEnabled} onCheckedChange={(v) => setS({ ...s, soundEnabled: v })} />
            </label>
          </SettingCard>

          <SettingCard icon={Shield} title="Security access" sub="Single-device lock and encrypted vault sharing.">
            <div className="grid gap-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
                <span className="flex items-center gap-2 text-foreground"><Smartphone className="w-4 h-4 text-primary" /> Device lock</span>
                <span className="font-semibold text-primary">Active</span>
              </div>
              <p className="leading-relaxed">
                Accounts stay bound to one device. Use Share vault for encrypted transfers instead of copying app data.
              </p>
            </div>
          </SettingCard>

          <SettingCard icon={FolderLock} title="Encrypted backup folder" sub="Pick a device folder where snapshots are written encrypted.">
            <BackupFolderEditor />
          </SettingCard>

          <SettingCard icon={Quote} title="Home quotes" sub="One per line.">
            <Textarea
              rows={5}
              value={s.quotes.join("\n")}
              onChange={(e) =>
                setS({ ...s, quotes: e.target.value.split("\n").map((l) => l.trimEnd()) })
              }
              className="rounded-xl resize-none font-mono text-xs"
            />
          </SettingCard>

          <SettingCard icon={Wand2} title="Surprise wishes" sub={`One per line, use {name}.`}>
            <Textarea
              rows={4}
              value={s.surpriseWishes.join("\n")}
              onChange={(e) =>
                setS({ ...s, surpriseWishes: e.target.value.split("\n").map((l) => l.trimEnd()) })
              }
              className="rounded-xl resize-none font-mono text-xs"
            />
          </SettingCard>

          <SettingCard icon={Library} title="Custom library" sub="Emotions & icons used across the app.">
            <LibraryManager />
          </SettingCard>

          <SettingCard icon={LayoutGrid} title="Enabled tabs" sub="Default tabs shown to new users.">
            <div className="space-y-2">
              {(Object.keys(tabLabels) as TabKey[]).map((k) => (
                <label
                  key={k}
                  className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30"
                >
                  <span className="text-sm">{tabLabels[k]}</span>
                  <Switch
                    checked={s.enabledTabs[k]}
                    onCheckedChange={(v) =>
                      setS({ ...s, enabledTabs: { ...s.enabledTabs, [k]: v } })
                    }
                  />
                </label>
              ))}
            </div>
          </SettingCard>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-gradient-primary text-primary-foreground" onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SettingCard = ({
  icon: Icon, title, sub, children, defaultOpen,
}: {
  icon: typeof Sparkles;
  title: string;
  sub?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border border-border bg-secondary/20 overflow-hidden">
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/40 transition">
            <div className="w-9 h-9 rounded-lg bg-gradient-primary/15 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{title}</p>
              {sub && <p className="text-[0.65rem] text-muted-foreground truncate">{sub}</p>}
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 pt-1 border-t border-border/60">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};


const UserSettingsAdminDialog = ({
  target,
  onClose,
}: {
  target: User | null;
  onClose: () => void;
}) => {
  const [s, setS] = useState<AppSettings>(() => getSettings());

  useEffect(() => {
    if (target) setS(getUserSettings(target.id));
  }, [target]);

  if (!target) return null;

  const tabLabels: Record<TabKey, string> = {
    timeline: "Memory Map",
    stats: "Statistics",
    traveler: "Time Traveler",
    surprise: "Surprise",
    media: "Multimedia (legacy)",
    wish: "Make a Wish",
    rhythm: s.rhythmName || "Rhythm of Us",
  };

  const save = () => {
    saveUserSettings(target.id, {
      welcomeHeading: s.welcomeHeading,
      quotes: s.quotes,
      enabledTabs: s.enabledTabs,
      surpriseWishes: s.surpriseWishes,
      rhythmName: s.rhythmName,
    });
    pushNotice(target.id, "Admin updated your personal settings");
    toast({ title: `Settings saved for ${target.profileName}` });
    onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-primary" /> {target.profileName}'s settings
          </DialogTitle>
          <DialogDescription className="text-xs">
            Personalise this user's home, quotes, surprise wishes and tabs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Welcome heading</label>
            <Input
              value={s.welcomeHeading}
              onChange={(e) => setS({ ...s, welcomeHeading: e.target.value })}
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">"{s.rhythmName || "Rhythm of Us"}" tab name</label>
            <Input
              value={s.rhythmName}
              onChange={(e) => setS({ ...s, rhythmName: e.target.value })}
              placeholder="Rhythm of Us"
              className="mt-1 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Home quotes (one per line)</label>
            <Textarea
              rows={5}
              value={s.quotes.join("\n")}
              onChange={(e) =>
                setS({ ...s, quotes: e.target.value.split("\n").map((l) => l.trimEnd()) })
              }
              className="mt-1 rounded-xl resize-none font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Surprise wishes (one per line, use {"{name}"})</label>
            <Textarea
              rows={4}
              value={s.surpriseWishes.join("\n")}
              onChange={(e) =>
                setS({ ...s, surpriseWishes: e.target.value.split("\n").map((l) => l.trimEnd()) })
              }
              className="mt-1 rounded-xl resize-none font-mono text-xs"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Visible tabs</label>
            <div className="mt-2 space-y-2">
              {(Object.keys(tabLabels) as TabKey[]).map((k) => (
                <label
                  key={k}
                  className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30"
                >
                  <span className="text-sm">{tabLabels[k]}</span>
                  <Switch
                    checked={s.enabledTabs[k]}
                    onCheckedChange={(v) =>
                      setS({ ...s, enabledTabs: { ...s.enabledTabs, [k]: v } })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="bg-gradient-primary text-primary-foreground" onClick={save}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Admin;

const BackupFolderEditor = () => {
  const [folder, setFolder] = useState<string | null>(null);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const supported = isPickerSupported();

  useEffect(() => {
    getBackupFolderName().then(setFolder);
  }, []);

  const pick = async () => {
    try {
      const name = await pickBackupFolder();
      setFolder(name);
      if (name) toast({ title: `Folder linked: ${name}` });
    } catch (e) {
      toast({ title: "Could not pick folder", description: String((e as Error).message), variant: "destructive" });
    }
  };

  const clear = async () => {
    await clearBackupFolder();
    setFolder(null);
  };

  const snapshot = async () => {
    if (!pass || pass.length < 4) {
      toast({ title: "Enter a passphrase (4+ chars)", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await saveEncryptedSnapshot(pass);
      toast({
        title: res.method === "folder" ? `Saved to ${folder}` : "Downloaded snapshot",
        description: res.name,
      });
      setPass("");
    } catch (e) {
      toast({ title: "Snapshot failed", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="rounded-xl border border-border bg-secondary/30 p-3 flex items-center justify-between gap-2">
        <span className="truncate">
          {folder ? <span className="text-foreground font-semibold">{folder}</span> : <span className="text-muted-foreground">No folder linked</span>}
        </span>
        {folder ? (
          <Button size="sm" variant="ghost" className="rounded-lg h-7" onClick={clear}>Clear</Button>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="rounded-lg flex-1" onClick={pick} disabled={!supported}>
          <FolderLock className="w-3.5 h-3.5" /> {folder ? "Change folder" : "Choose folder"}
        </Button>
      </div>
      {!supported && (
        <p className="text-[0.65rem] text-muted-foreground leading-relaxed">
          This device doesn't support folder picking. Snapshots will fall back to a normal encrypted download.
        </p>
      )}
      <div className="pt-1 space-y-1">
        <label className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Snapshot passphrase</label>
        <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="e.g. our-wedding-2025" className="rounded-lg" />
        <Button size="sm" className="w-full rounded-lg bg-gradient-primary text-primary-foreground" onClick={snapshot} disabled={busy}>
          <Save className="w-3.5 h-3.5" /> Save encrypted snapshot
        </Button>
      </div>
    </div>
  );
};

const UserDetailsDialog = ({
  target,
  onClose,
}: {
  target: User | null;
  onClose: () => void;
}) => {
  if (!target) return null;
  const initial = (target.profileName || target.username || "U").charAt(0).toUpperCase();
  const joined = new Date(target.createdAt).toLocaleDateString(undefined, {
    day: "2-digit", month: "long", year: "numeric",
  });
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" /> User details
          </DialogTitle>
          <DialogDescription className="text-xs">
            Read-only snapshot for {target.profileName}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center text-center gap-1 pt-1">
          <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-3xl shadow-glow">
            {target.avatarEmoji ? <span className="leading-none">{target.avatarEmoji}</span> : initial}
          </div>
          <p className="font-semibold mt-1">{target.profileName}</p>
          <p className="text-xs text-muted-foreground">@{target.username} · {target.role}</p>
          {target.bio && (
            <p className="text-xs mt-2 px-2 text-foreground/90 whitespace-pre-wrap">{target.bio}</p>
          )}
        </div>
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex justify-between rounded-lg bg-secondary/30 px-3 py-2">
            <span className="text-muted-foreground">Joined</span>
            <span className="font-medium">{joined}</span>
          </div>
          <div className="flex justify-between rounded-lg bg-secondary/30 px-3 py-2">
            <span className="text-muted-foreground">Device</span>
            <span className="font-medium flex items-center gap-1">
              <Smartphone className="w-3 h-3" />
              {target.boundDeviceId ? "Bound" : "Not bound"}
            </span>
          </div>
          <div className="flex justify-between rounded-lg bg-secondary/30 px-3 py-2">
            <span className="text-muted-foreground">User ID</span>
            <span className="font-mono text-[0.65rem] truncate max-w-[10rem]">{target.id}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TravelerPermsDialog = ({
  target,
  onClose,
}: {
  target: User | null;
  onClose: () => void;
}) => {
  const [perms, setPerms] = useState({ create: false, update: false, delete: false });

  useEffect(() => {
    if (!target) return;
    const s = getSettings();
    setPerms(s.travelerCrud[target.id] ?? { create: false, update: false, delete: false });
  }, [target]);

  if (!target) return null;

  const save = () => {
    const s = getSettings();
    s.travelerCrud[target.id] = perms;
    saveSettings(s);
    pushNotice(target.id, "Admin updated your Time Traveler permissions");
    toast({ title: `Time Traveler perms saved for ${target.profileName}` });
    onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Time Traveler access</DialogTitle>
          <DialogDescription className="text-xs">
            Choose what {target.profileName} can do with their Time Traveler plans.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {(["create", "update", "delete"] as const).map((k) => (
            <label
              key={k}
              className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30"
            >
              <span className="text-sm capitalize">{k}</span>
              <Switch
                checked={perms[k]}
                onCheckedChange={(v) => setPerms((p) => ({ ...p, [k]: v }))}
              />
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="bg-gradient-primary text-primary-foreground" onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

