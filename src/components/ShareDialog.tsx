import { useRef, useState } from "react";
import { Download, Upload, ShieldCheck, Loader2, Share2, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  exportEncryptedVault,
  importEncryptedVault,
  importLegacyJson,
  shareOrDownload,
  suggestedFileName,
} from "@/lib/share-store";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const ShareDialog = ({ open, onOpenChange }: ShareDialogProps) => {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [pass, setPass] = useState("");
  const [importPass, setImportPass] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (pass.length < 4) {
      toast({ title: "Passphrase too short", description: "Use at least 4 characters.", variant: "destructive" });
      return;
    }
    setBusy("export");
    try {
      const blob = await exportEncryptedVault(pass);
      const result = await shareOrDownload(blob, suggestedFileName());
      toast({
        title: "Vault ready 🔐",
        description:
          result.method === "native"
            ? "Pick Bluetooth, AirDrop or Nearby Share from the share sheet."
            : "File downloaded. Send it via Bluetooth, AirDrop, or any file-share app.",
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
      toast({ title: "Vault imported", description: "Reloading…" });
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      toast({ title: "Import failed", description: String(err), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-gradient-card border-border rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Encrypted vault share
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Pack the entire app — users, settings, timeline, media, wishes —
            into a single encrypted <code>.vault</code> file. Share it over
            Bluetooth, AirDrop, or Nearby Share. The other device unlocks it
            with the same passphrase.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 mt-2">
          {/* EXPORT */}
          <div className="rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">Send to another device</p>
            </div>
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
              {busy === "export" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Encrypt & share
            </button>
            <p className="mt-2 text-[0.7rem] text-muted-foreground leading-relaxed">
              On the share sheet pick <b>Bluetooth</b>, <b>AirDrop</b>, or
              <b> Nearby&nbsp;Share</b>. The receiver also needs this app
              installed and the same passphrase.
            </p>
          </div>

          {/* IMPORT */}
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
              {busy === "import" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Choose .vault file
            </button>
            <p className="mt-2 text-[0.7rem] text-muted-foreground leading-relaxed">
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
