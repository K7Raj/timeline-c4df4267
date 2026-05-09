import { useRef, useState } from "react";
import { Download, Upload, Wifi, FileJson, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { downloadBundle, importBundle } from "@/lib/share-store";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const ShareDialog = ({ open, onOpenChange }: ShareDialogProps) => {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setBusy("export");
    try {
      await downloadBundle();
      toast({
        title: "Vault exported ✨",
        description: "Send the file to the other phone via your hotspot share.",
      });
    } catch (e) {
      toast({ title: "Export failed", description: String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleImport: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("import");
    try {
      await importBundle(file, "replace");
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
            <Wifi className="w-5 h-5 text-primary" /> Share vault
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Export everything (timeline, multimedia, folders) to a single file,
            then send it to the other phone over your WiFi hotspot, AirDrop, or
            Quick Share. On the other device, open this dialog and tap Import.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 mt-2">
          <button
            disabled={!!busy}
            onClick={handleExport}
            className="group flex items-center gap-3 p-4 rounded-2xl border border-border bg-secondary/40 hover:border-primary/50 hover:bg-secondary/70 transition text-left disabled:opacity-60"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
              {busy === "export" ? (
                <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
              ) : (
                <Download className="w-5 h-5 text-primary-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">Export vault</p>
              <p className="text-xs text-muted-foreground">
                Save a portable .json bundle (includes media)
              </p>
            </div>
          </button>

          <button
            disabled={!!busy}
            onClick={() => fileRef.current?.click()}
            className="group flex items-center gap-3 p-4 rounded-2xl border border-border bg-secondary/40 hover:border-primary/50 hover:bg-secondary/70 transition text-left disabled:opacity-60"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
              {busy === "import" ? (
                <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-primary-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">Import vault</p>
              <p className="text-xs text-muted-foreground">
                Replace local data with a received bundle
              </p>
            </div>
          </button>

          <p className="text-[0.7rem] text-muted-foreground flex items-start gap-2 mt-1 leading-relaxed">
            <FileJson className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Tip: connect both phones to the same WiFi hotspot, then use any
            file-sharing app (e.g. ShareIt, Quick Share) to transfer the
            exported .json file.
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImport}
        />
      </DialogContent>
    </Dialog>
  );
};
