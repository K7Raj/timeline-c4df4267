import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lock, Clock3, Eye, EyeOff, ArrowRight, ArrowLeft,
  User as UserIcon, ShieldCheck, Upload, Sparkles, KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  createUser, getUserByUsername, listUsers, loginWithUsername,
} from "@/lib/auth-store";
import { importEncryptedVault, importLegacyJson } from "@/lib/share-store";

const Login = () => {
  const navigate = useNavigate();
  const [bootstrap, setBootstrap] = useState(() => listUsers().length === 0);
  const [step, setStep] = useState<"username" | "passcode">("username");
  const [username, setUsername] = useState("");
  const [profileName, setProfileName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (!u) return;
    const found = getUserByUsername(u);
    if (!found) {
      toast.error("Unknown user");
      return;
    }
    setProfileName(found.profileName);
    setStep("passcode");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(async () => {
      try {
        const user = await loginWithUsername(username.trim(), passcode);
        if (user) {
          toast.success(`Welcome ${user.profileName}`);
          navigate(user.role === "admin" ? "/admin" : "/home");
        } else {
          toast.error("Invalid passkey");
        }
      } catch (err) {
        toast.error(String((err as Error).message));
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const back = () => {
    setStep("username");
    setPasscode("");
  };

  if (bootstrap) {
    return <BootstrapPanel onDone={() => setBootstrap(false)} />;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-primary shadow-glow flex items-center justify-center mb-5 animate-pulse">
            <Clock3 className="w-10 h-10 text-primary-foreground" />
          </div>
          {step === "username" ? (
            <>
              <h1 className="text-3xl font-bold text-gradient">Timeline</h1>
              <p className="text-sm text-muted-foreground mt-2 text-center italic">
                Who's unlocking the magic today? ✨
              </p>
            </>
          ) : (
            <>
              <h1 className="font-bold text-gradient text-center leading-tight tracking-tight text-balance break-words text-[clamp(1.4rem,7vw,2rem)] max-w-full px-2">
                Welcome {profileName} 🎉
              </h1>
              <p className="text-sm text-muted-foreground mt-2 text-center italic">
                "Every moment with you is a gift wrapped in love." 🎁✨
              </p>
            </>
          )}
        </div>

        {step === "username" ? (
          <form onSubmit={handleNext} className="bg-gradient-card rounded-3xl p-6 shadow-elegant border border-border space-y-5">
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-11 h-12 bg-input border-border text-base"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <Button
              type="submit"
              disabled={!username.trim()}
              className="w-full h-12 bg-gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition shadow-glow"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="bg-gradient-card rounded-3xl p-6 shadow-elegant border border-border space-y-5">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={show ? "text" : "password"}
                placeholder="Passkey"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="pl-11 pr-11 h-12 bg-input border-border text-base"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label="Toggle visibility"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={back} className="h-12 px-4">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Button
                type="submit"
                disabled={loading || !passcode}
                className="flex-1 h-12 bg-gradient-primary text-primary-foreground font-semibold hover:opacity-90 transition shadow-glow"
              >
                {loading ? "Verifying…" : "Unlock"}
              </Button>
            </div>
          </form>
        )}

        <p className="text-xs text-center text-muted-foreground mt-6">
          🔒 Encrypted locally • Single device session
        </p>
      </div>
    </main>
  );
};

// ---------------------------------------------------------------------------
// First-launch panel: only shown when there are no users on this device.
// ---------------------------------------------------------------------------
const BootstrapPanel = ({ onDone }: { onDone: () => void }) => {
  const [mode, setMode] = useState<"choose" | "create" | "import">("choose");
  const [u, setU] = useState("");
  const [n, setN] = useState("");
  const [p, setP] = useState("");
  const [p2, setP2] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const createFirstAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!u.trim() || p.length < 4) {
      toast.error("Username and a 4+ character passcode are required");
      return;
    }
    if (p !== p2) {
      toast.error("Passcodes do not match");
      return;
    }
    try {
      await createUser({
        username: u.trim(),
        profileName: n.trim() || u.trim(),
        passcode: p,
        role: "admin",
      });
      toast.success("Admin created — sign in to begin ✨");
      onDone();
    } catch (err) {
      toast.error(String((err as Error).message));
    }
  };

  const handleFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        await importLegacyJson(file);
      } else {
        if (pass.length < 4) throw new Error("Enter the sender's passphrase first");
        await importEncryptedVault(file, pass, "replace");
      }
      toast.success("Vault imported successfully");
      onDone();
    } catch (err) {
      toast.error(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-primary shadow-glow flex items-center justify-center mb-4">
            <Sparkles className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-gradient">Welcome to Timeline</h1>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Nothing is stored yet on this device. Get started below.
          </p>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("create")}
              className="w-full text-left bg-gradient-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-primary/50 transition"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">Create the first admin</p>
                <p className="text-xs text-muted-foreground">Start fresh on this device.</p>
              </div>
            </button>
            <button
              onClick={() => setMode("import")}
              className="w-full text-left bg-gradient-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-primary/50 transition"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">Import a vault</p>
                <p className="text-xs text-muted-foreground">Restore from another device.</p>
              </div>
            </button>
          </div>
        )}

        {mode === "create" && (
          <form
            onSubmit={createFirstAdmin}
            className="bg-gradient-card rounded-3xl p-5 border border-border shadow-elegant space-y-3"
          >
            <Input value={u} onChange={(e) => setU(e.target.value)} placeholder="Admin username" autoFocus />
            <Input value={n} onChange={(e) => setN(e.target.value)} placeholder="Display name (optional)" />
            <Input type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="Passcode (min 4)" autoComplete="new-password" />
            <Input type="password" value={p2} onChange={(e) => setP2(e.target.value)} placeholder="Re-enter passcode" autoComplete="new-password" />
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setMode("choose")}>
                Back
              </Button>
              <Button type="submit" className="flex-1 bg-gradient-primary text-primary-foreground">
                Create
              </Button>
            </div>
          </form>
        )}

        {mode === "import" && (
          <div className="bg-gradient-card rounded-3xl p-5 border border-border shadow-elegant space-y-3">
            <label className="text-xs flex items-center gap-1 text-muted-foreground">
              <KeyRound className="w-3 h-3" /> Passphrase
            </label>
            <Input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Same passphrase used on sender"
              disabled={busy}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="w-full h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Upload className="w-4 h-4" /> {busy ? "Importing…" : "Choose .vault file"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".vault,application/octet-stream,application/json,.json"
              className="hidden"
              onChange={handleFile}
            />
            <Button variant="ghost" className="w-full" onClick={() => setMode("choose")} disabled={busy}>
              Back
            </Button>
          </div>
        )}
      </div>
    </main>
  );
};

export default Login;
