import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Cake, Eye, EyeOff, ArrowRight, ArrowLeft, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getUserByUsername, loginWithUsername } from "@/lib/auth-store";

const Login = () => {
  const navigate = useNavigate();
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
    setTimeout(() => {
      const user = loginWithUsername(username.trim(), passcode);
      if (user) {
        toast.success(`Welcome ${user.profileName}`);
        navigate(user.role === "admin" ? "/admin" : "/home");
      } else {
        toast.error("Invalid passkey");
      }
      setLoading(false);
    }, 250);
  };

  const back = () => {
    setStep("username");
    setPasscode("");
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-primary shadow-glow flex items-center justify-center mb-5 animate-pulse">
            <Cake className="w-10 h-10 text-primary-foreground" />
          </div>
          {step === "username" ? (
            <>
              <h1 className="text-3xl font-bold text-gradient">My Vault</h1>
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
                placeholder="Username (e.g. gayu, admin)"
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
              <Button
                type="button"
                variant="ghost"
                onClick={back}
                className="h-12 px-4"
              >
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

export default Login;
