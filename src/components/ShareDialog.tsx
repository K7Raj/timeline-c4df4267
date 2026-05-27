import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Upload, ShieldCheck, Loader2, Share2, KeyRound, Users } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import {
  exportEncryptedVault, importEncryptedVault, importLegacyJson,
  shareOrDownload, suggestedFileName,
} from "@/lib/share-store";
import { getCurrentUser, listUsers } from "@/lib/auth-store";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const ShareDialog = ({ open, onOpenChange }: ShareDialogProps) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [pass, setPass] = useState("");
  const [importPass, setImportPass] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const me = getCurrentUser();
  const isAdmin = me?.role === "admin";
  const allUsers = isAdmin ? listUsers() : [];
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && isAdmin) setPicked(new Set(allUsers.map((u) => u.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAdmin]);

  const togglePick = (id: string) => {
    setPicked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const allChecked = isAdmin && picked.size === allUsers.length && allUsers.length > 0;
  const toggleAll = () => {
    if (allChecked) setPicked(new Set());
    else setPicked(new Set(allUsers.map((u) => u.id)));
  };

  const handleExport = async () => {
    if (pass.length < 4) {
      toast({ title: "Passphrase too short", description: "Use at least 4 characters.", variant: "destructive" });
      return;
    }
    const userIds = isAdmin ? [...picked] : me ? [me.id] : [];
    if (userIds.length === 0) {
      toast({ title: "Select at least one user", variant: "destructive" });
      return;
    }
    setBusy("export");
    try {
      const blob = await exportEncryptedVault(pass, { userIds });
      const result = await shareOrDownload(blob, suggestedFileName());
      toast({
        title: "Vault ready 🔐",
        description:
          result.method === "native"
            ? "Pick Bluetooth, AirDrop or Nearby Share."
            : "File downloaded. Send via Bluetooth, AirDrop, or any file-share app.",
      });
    } catch (e) {
      toast({ title: "Export failed", description: String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handlePick = () => fileRef.current?.click();

  const handleImport: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("import");
    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        await importLegacyJson(file);
      } else {
        if (importPass.length < 4) {
          throw new Error("Enter the passphrase used on the sender device first.");
        }
        await importEncryptedVault(file, importPass, "replace");
      }
      toast({ title: "Vault imported", description: "Vault updated successfully." });
      onOpenChange(false);
      navigate("/", { replace: true });
    } catch (err) {
      toast({ title: "Import failed", description: String(err), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto bg-gradient-card border-border rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Encrypted vault share
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {isAdmin
              ? "Pick which users to include, then encrypt and share."
              : "You'll share only your own data. The receiver unlocks it with the same passphrase."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 mt-2">
          <div className="rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">Send to another device</p>
            </div>

            {isAdmin && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <Label className="text-xs">Include data for</Label>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="ml-auto text-[0.65rem] uppercase font-bold text-primary"
                  >
                    {allChecked ? "Clear" : "All"}
                  </button>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto rounded-xl border border-border p-2 bg-background/40">
                  {allUsers.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-secondary/50 cursor-pointer"
                    >
                      <Checkbox checked={picked.has(u.id)} onCheckedChange={() => togglePick(u.id)} />
                      <span className="text-xs flex-1 truncate">
                        <span className="font-semibold">{u.profileName}</span>
                        <span className="text-muted-foreground"> · @{u.username}</span>
                      </span>
                      <span className="text-[0.6rem] uppercase text-muted-foreground">{u.role}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Label htmlFor="vault-pass" className="text-xs flex items-center gap-1">
              <KeyRound className="w-3 h-3" /> Passphrase
            </Label>
            <Input
              id="vault-pass"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 4 characters"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="mt-1 h-9"
              disabled={!!busy}
            />
            <button
              disabled={!!busy}
              onClick={handleExport}
              className="mt-3 w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold text-sm disabled:opacity-60"
            >
              {busy === "export" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Encrypt & share
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Upload className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">Receive on this device</p>
            </div>
            <Label htmlFor="vault-import-pass" className="text-xs flex items-center gap-1">
              <KeyRound className="w-3 h-3" /> Passphrase from sender
            </Label>
            <Input
              id="vault-import-pass"
              type="password"
              autoComplete="off"
              placeholder="Same passphrase used on sender"
              value={importPass}
              onChange={(e) => setImportPass(e.target.value)}
              className="mt-1 h-9"
              disabled={!!busy}
            />
            <button
              disabled={!!busy}
              onClick={handlePick}
              className="mt-3 w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-border bg-background/40 hover:bg-background/70 font-semibold text-sm disabled:opacity-60"
            >
              {busy === "import" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Choose .vault file
            </button>
            <p className="mt-2 text-[0.7rem] text-muted-foreground">
              Existing data on this device will be replaced.
            </p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".vault,application/octet-stream,application/json,.json"
          className="hidden"
          onChange={handleImport}
        />
      </DialogContent>
    </Dialog>
  );
};
