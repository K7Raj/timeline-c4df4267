import { useEffect, useMemo, useState } from "react";
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
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

const Admin = () => {
  const navigate = useNavigate();
  const me = getCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pwTarget, setPwTarget] = useState<User | null>(null);
  const [delTarget, setDelTarget] = useState<User | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  
  const [permsTarget, setPermsTarget] = useState<User | null>(null);
  const [resetWishTarget, setResetWishTarget] = useState<User | null>(null);
  const [userSettingsTarget, setUserSettingsTarget] = useState<User | null>(null);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (!me) navigate("/", { replace: true });
    else if (me.role !== "admin") navigate("/home", { replace: true });
  }, [me, navigate]);

  const refresh = () => setUsers(listUsers());
  useEffect(() => {
    refresh();
  }, []);

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
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setShareOpen(true)} aria-label="Share">
            <Share2 className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-xl text-destructive" onClick={handleLogout} aria-label="Logout">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} />
      <PermsDialog target={permsTarget} onClose={() => setPermsTarget(null)} />
      <UserSettingsAdminDialog target={userSettingsTarget} onClose={() => setUserSettingsTarget(null)} />

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
            className="rounded-xl bg-gradient-primary text-primary-foreground"
          >
            <Plus className="w-4 h-4" /> New user
          </Button>
        </div>

        <div className="grid gap-3">
          {filtered.map((u) => (
            <div
              key={u.id}
              className="bg-gradient-card border border-border rounded-2xl p-4 shadow-elegant"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
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
                  </div>
                  <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1 -mx-1">
                {u.role === "user" && (
                  <>
                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={() => navigate(`/timeline?user=${u.id}`)} aria-label="Memory Map" title="Memory Map">
                      <Clock3 className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={() => setPermsTarget(u)} aria-label="Permissions" title="Permissions">
                      <Shield className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={() => setUserSettingsTarget(u)} aria-label="User settings" title="User settings">
                      <SettingsIcon className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={() => setResetWishTarget(u)} aria-label="Reset wishes" title="Reset wishes">
                      <Lamp className="w-4 h-4" />
                    </Button>
                  </>
                )}
                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={() => setPwTarget(u)} aria-label="Change passcode" title="Passcode">
                  <KeyRound className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={() => setEditing(u)} aria-label="Edit" title="Edit">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl text-destructive hover:text-destructive ml-auto" onClick={() => setDelTarget(u)} aria-label="Delete" title="Delete" disabled={u.id === me?.id}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
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
      <DialogContent className="max-w-sm">
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
      <DialogContent className="max-w-sm">
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
      <DialogContent className="max-w-sm">
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
    surprise: "Surprise",
    media: "Multimedia",
    wish: "Make a Wish",
    rhythm: s.rhythmName || "Rhythm of Us",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Global defaults
          </DialogTitle>
          <DialogDescription className="text-xs">
            Default welcome heading, quotes, tabs and surprise wishes for new users.
            Per-user overrides take precedence.
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
            <label className="text-xs font-medium text-muted-foreground">Enabled tabs</label>
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-gradient-primary text-primary-foreground" onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    surprise: "Surprise",
    media: "Multimedia",
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
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
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

