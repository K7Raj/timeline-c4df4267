import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  Clock3,
  Gift,
  ChevronRight,
  LogOut,
  Settings,
  Share2,
  Sun,
  Moon,
  Bell,
  Lamp,
  Sparkles,
  Trash2,
  BarChart3,
  Music2,
  Compass,
  User as UserIcon,
  CalendarDays,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "@/hooks/use-theme";
import { ShareDialog } from "@/components/ShareDialog";
import { getCurrentUser, logout } from "@/lib/auth-store";
import { getUser as getAuthUser, updateUser as updateAuthUser } from "@/lib/auth-store";
import {
  useSettings,
  saveUserSettings,
  getUserSettings,
  type TabKey,
} from "@/lib/settings-store";
import { setSoundEnabled } from "@/lib/sound";
import {
  clearNotices,
  markAllRead,
  useNotices,
} from "@/lib/notifications-store";
import { toast } from "@/hooks/use-toast";

interface Tab {
  key: TabKey;
  title: string;
  description: string;
  icon: typeof Clock3;
  path: string;
}

const baseTabs = (rhythmName: string): Tab[] => [
  { key: "timeline", title: "Memory Map", description: "Your moments, in order", icon: Clock3, path: "/timeline" },
  { key: "stats", title: "Statistics", description: "Insights from your memories", icon: BarChart3, path: "/stats" },
  { key: "traveler", title: "Time Traveler", description: "Plan future trips, visits & events", icon: Compass, path: "/traveler" },
  { key: "wish", title: "Make a Wish", description: "Summon the genie ✨", icon: Lamp, path: "/wish" },
  { key: "surprise", title: "Surprise", description: "Something special awaits", icon: Gift, path: "/surprise" },
  { key: "rhythm", title: rhythmName || "Rhythm of Us", description: "Photos, videos, audio & films", icon: Music2, path: "/rhythm" },
];

const Home = () => {
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const user = getCurrentUser();
  const settings = useSettings(user?.id);
  const notices = useNotices(user?.id);
  const unread = notices.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user) navigate("/", { replace: true });
    else if (user.role === "admin") navigate("/admin", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, navigate]);

  // Apply this user's sound preference to the engine on login.
  useEffect(() => {
    if (user?.id) setSoundEnabled(getUserSettings(user.id).soundEnabled);
  }, [user?.id]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const enabled = baseTabs(settings.rhythmName).filter((t) => settings.enabledTabs[t.key]);

  const handleNotifToggle = (o: boolean) => {
    setNotifOpen(o);
    if (o && user && unread) {
      setTimeout(() => markAllRead(user.id), 400);
    }
  };

  const handleClearNotices = () => {
    if (!user) return;
    clearNotices(user.id);
    toast({ title: "Notifications cleared" });
  };

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="flex items-center gap-1 px-3 sm:px-4 h-14">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-gradient-card border-border">
              <Drawer
                onClose={() => setOpen(false)}
                onLogout={handleLogout}
                onOpenSettings={() => {
                  setOpen(false);
                  setSettingsOpen(true);
                }}
                onOpenProfile={() => {
                  setOpen(false);
                  setProfileOpen(true);
                }}
                onOpenShare={() => {
                  setOpen(false);
                  setShareOpen(true);
                }}
                tabs={enabled}
              />
            </SheetContent>
          </Sheet>

          <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center mr-1">
            <Clock3 className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-bold text-gradient flex-1">Timeline</h1>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => setShareOpen(true)}
            aria-label="Share vault"
          >
            <Share2 className="w-5 h-5" />
          </Button>

          <Popover open={notifOpen} onOpenChange={handleNotifToggle}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl relative" aria-label="Notifications">
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive ring-2 ring-background" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-96 overflow-y-auto p-0" align="end">
              <div className="px-3 py-2 border-b border-border flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Notifications</span>
                {unread > 0 && (
                  <span className="ml-2 text-[0.65rem] uppercase font-bold text-primary">
                    {unread} new
                  </span>
                )}
                {notices.length > 0 && (
                  <button
                    className="ml-auto text-[0.7rem] text-muted-foreground hover:text-destructive flex items-center gap-1"
                    onClick={handleClearNotices}
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              {notices.length === 0 ? (
                <p className="text-xs text-muted-foreground p-6 text-center">
                  Nothing new. The admin hasn't changed anything yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {notices.map((n) => (
                    <li key={n.id} className="p-3 text-xs">
                      <p className={n.read ? "text-muted-foreground" : "text-foreground font-medium"}>
                        {n.message}
                      </p>
                      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} />
      {user && (
        <UserSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          userId={user.id}
        />
      )}
      {user && (
        <ProfileDialog
          open={profileOpen}
          onOpenChange={setProfileOpen}
          userId={user.id}
        />
      )}

      {/* Body */}
      <section className="px-4 sm:px-5 pt-5 pb-10 max-w-2xl mx-auto">
        <div className="mb-6 text-center">
          <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
            Welcome {user?.profileName ?? user?.username ?? ""} ✨
          </p>
          <h2 className="mt-1 font-bold leading-tight tracking-tight text-balance text-[clamp(1.25rem,6vw,1.875rem)]">
            {settings.welcomeHeading}
          </h2>
        </div>

        {/* Quotes */}
        {settings.quotes.length > 0 && (
          <div className="mb-6 bg-gradient-card border border-border rounded-2xl p-4 shadow-elegant">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1.5">
                {settings.quotes.filter(Boolean).map((q, i) => (
                  <p key={i} className="text-sm italic text-foreground/90 leading-relaxed">
                    {q}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {enabled.map((opt) => (
            <button
              key={opt.key}
              onClick={() => navigate(opt.path)}
              className="w-full text-left bg-gradient-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:shadow-glow hover:border-primary/40 transition-all active:scale-[0.98]"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
                <opt.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{opt.title}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {opt.description}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>
    </main>
  );
};

const Drawer = ({
  onClose,
  onLogout,
  onOpenSettings,
  onOpenProfile,
  onOpenShare,
  tabs,
}: {
  onClose: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenShare: () => void;
  tabs: Tab[];
}) => {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const initial = (user?.profileName || user?.username || "U").charAt(0).toUpperCase();
  const joined = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-5 h-14 border-b border-border">
        <span className="font-bold text-gradient">Timeline</span>
      </div>

      <button
        type="button"
        onClick={onOpenProfile}
        className="px-5 py-4 border-b border-border flex items-center gap-3 hover:bg-secondary/40 transition text-left"
      >
        <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
          {user?.avatarEmoji ? <span className="text-2xl leading-none">{user.avatarEmoji}</span> : initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{user?.profileName ?? "User"}</p>
          <p className="text-xs text-muted-foreground truncate">@{user?.username ?? ""}</p>
          {user?.bio ? (
            <p className="text-[0.7rem] text-muted-foreground/90 truncate mt-0.5">{user.bio}</p>
          ) : joined ? (
            <p className="text-[0.65rem] text-muted-foreground/80 truncate mt-0.5 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> Joined {joined}
            </p>
          ) : null}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {tabs.map((opt) => (
          <button
            key={opt.key}
            onClick={() => {
              onClose();
              navigate(opt.path);
            }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary transition text-left"
          >
            <opt.icon className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">{opt.title}</span>
          </button>
        ))}

        <div className="my-2 h-px bg-border" />

        <div className="flex items-center justify-between px-3 py-3 rounded-xl">
          <div className="flex items-center gap-3">
            {theme === "dark" ? (
              <Moon className="w-5 h-5 text-primary" />
            ) : (
              <Sun className="w-5 h-5 text-primary" />
            )}
            <span className="text-sm font-medium">
              {theme === "dark" ? "Dark mode" : "Light mode"}
            </span>
          </div>
          <Switch checked={theme === "light"} onCheckedChange={toggle} />
        </div>

        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary transition text-left"
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium">Settings</span>
        </button>

        <button
          onClick={onOpenProfile}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary transition text-left"
        >
          <UserIcon className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium">Edit profile</span>
        </button>

        <button
          onClick={onOpenShare}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary transition text-left"
        >
          <Share2 className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium">Share vault</span>
        </button>
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-destructive/10 text-destructive transition"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Lock & Sign out</span>
        </button>
      </div>
    </div>
  );
};

// Per-user settings dialog: only allows changing own passcode.
const UserSettingsDialog = ({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
}) => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sound, setSound] = useState(true);

  useEffect(() => {
    if (open) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setSound(getUserSettings(userId).soundEnabled);
    }
  }, [open, userId]);

  const toggleSound = (v: boolean) => {
    setSound(v);
    saveUserSettings(userId, { soundEnabled: v });
    setSoundEnabled(v);
  };

  const save = async () => {
    const { getUser, updateUser } = await import("@/lib/auth-store");
    const u = getUser(userId);
    if (!u) return;
    if (u.passcode !== current) {
      toast({ title: "Current passcode is incorrect", variant: "destructive" });
      return;
    }
    if (!next || next.length < 4) {
      toast({ title: "New passcode must be at least 4 characters", variant: "destructive" });
      return;
    }
    if (next !== confirm) {
      toast({ title: "Passcodes do not match", variant: "destructive" });
      return;
    }
    try {
      updateUser(userId, { passcode: next });
      toast({ title: "Passcode updated ✨" });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Update failed", description: String((e as Error).message), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" /> Settings
          </DialogTitle>
          <DialogDescription className="text-xs">
            Update your sign-in passcode and personal preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2">
            <div>
              <div className="text-sm font-medium">App sounds</div>
              <div className="text-xs text-muted-foreground">Taps, chimes & sparkles</div>
            </div>
            <Switch checked={sound} onCheckedChange={toggleSound} />
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Change passcode</div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Current passcode</label>
              <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">New passcode</label>
              <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Confirm new passcode</label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 rounded-xl" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-gradient-primary text-primary-foreground" onClick={save}>
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Home;
