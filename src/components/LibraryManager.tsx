// Admin tool: manage global custom emotions (emoji + label, used to
// capture how a Memory Map moment felt) and uploaded icons (PNG/SVG
// data url) used as the node visual.

import { useRef, useState } from "react";
import { Plus, Trash2, Smile, Image as ImageIcon, Pencil, Check, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  addEmotion, addIcon, removeEmotion, removeIcon,
  updateEmotion, updateIcon, useLibrary,
} from "@/lib/library-store";

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export const LibraryManager = () => {
  const lib = useLibrary();
  const [emoji, setEmoji] = useState("");
  const [emoLabel, setEmoLabel] = useState("");
  const [iconLabel, setIconLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [editEmoId, setEditEmoId] = useState<string | null>(null);
  const [editEmoLabel, setEditEmoLabel] = useState("");
  const [editEmoEmoji, setEditEmoEmoji] = useState("");
  const [editIconId, setEditIconId] = useState<string | null>(null);
  const [editIconLabel, setEditIconLabel] = useState("");

  const startEditEmo = (id: string, emoji: string, label: string) => {
    setEditEmoId(id);
    setEditEmoEmoji(emoji);
    setEditEmoLabel(label);
  };
  const saveEditEmo = () => {
    if (!editEmoId) return;
    updateEmotion(editEmoId, {
      emoji: editEmoEmoji.trim() || undefined,
      label: editEmoLabel.trim() || undefined,
    } as { emoji?: string; label?: string });
    setEditEmoId(null);
    toast({ title: "Emotion updated" });
  };
  const startEditIcon = (id: string, label: string) => {
    setEditIconId(id);
    setEditIconLabel(label);
  };
  const saveEditIcon = () => {
    if (!editIconId) return;
    updateIcon(editIconId, { label: editIconLabel.trim() || "Untitled" });
    setEditIconId(null);
    toast({ title: "Icon renamed" });
  };

  const addEmo = () => {
    const e = emoji.trim();
    if (!e) { toast({ title: "Pick an emoji", variant: "destructive" }); return; }
    if (!emoLabel.trim()) { toast({ title: "Name your emotion", variant: "destructive" }); return; }
    addEmotion(e, emoLabel.trim());
    setEmoji(""); setEmoLabel("");
    toast({ title: "Emotion added" });
  };

  const onPickIcon = async (file: File | null) => {
    if (!file) return;
    if (!iconLabel.trim()) { toast({ title: "Add an icon name first", variant: "destructive" }); return; }
    if (file.size > 256 * 1024) { toast({ title: "Use an icon under 256KB", variant: "destructive" }); return; }
    const url = await fileToDataUrl(file);
    addIcon(iconLabel.trim(), url);
    setIconLabel("");
    if (fileRef.current) fileRef.current.value = "";
    toast({ title: "Icon added" });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-secondary/30 p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Smile className="w-3.5 h-3.5 text-primary" /> Emotions
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[2rem]">
          {lib.emotions.length === 0 && (
            <span className="text-[0.7rem] text-muted-foreground italic">No custom emotions yet.</span>
          )}
          {lib.emotions.map((e) => (
            <span key={e.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background border border-border text-xs">
              <span className="text-base leading-none">{e.emoji}</span>
              <span>{e.label}</span>
              <button type="button" onClick={() => removeEmotion(e.id)} className="text-destructive/70 hover:text-destructive ml-1" aria-label="Remove">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="😍"
            className="w-16 rounded-lg text-center"
            maxLength={4}
          />
          <Input
            value={emoLabel}
            onChange={(e) => setEmoLabel(e.target.value)}
            placeholder="Name (e.g. In love)"
            className="flex-1 rounded-lg"
          />
          <Button size="sm" className="rounded-lg bg-gradient-primary text-primary-foreground" onClick={addEmo}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[0.65rem] text-muted-foreground mt-1.5">Tip: open your emoji keyboard to insert.</p>
      </div>

      <div className="rounded-xl border border-border bg-secondary/30 p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-primary" /> Custom icons
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[2rem]">
          {lib.icons.length === 0 && (
            <span className="text-[0.7rem] text-muted-foreground italic">No custom icons yet.</span>
          )}
          {lib.icons.map((i) => (
            <span key={i.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background border border-border text-xs">
              <img src={i.dataUrl} alt={i.label} className="w-4 h-4 object-contain" />
              <span>{i.label}</span>
              <button type="button" onClick={() => removeIcon(i.id)} className="text-destructive/70 hover:text-destructive ml-1" aria-label="Remove">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={iconLabel}
            onChange={(e) => setIconLabel(e.target.value)}
            placeholder="Icon name"
            className="flex-1 rounded-lg"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => onPickIcon(e.target.files?.[0] ?? null)}
          />
          <Button size="sm" variant="outline" className="rounded-lg" onClick={() => fileRef.current?.click()}>
            <Plus className="w-4 h-4" /> Upload
          </Button>
        </div>
        <p className="text-[0.65rem] text-muted-foreground mt-1.5">PNG/SVG/WebP, ≤ 256KB. Shown across the app.</p>
      </div>
    </div>
  );
};
