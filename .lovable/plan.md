- Overview

This is a multi-part overhaul. Below is exactly what I'll change, file by file, with the key decisions called out so you can correct anything before I build.

---

### 1. Remove all hardcoded user / admin data

**Today:** `src/lib/auth-store.ts` ships with a seeded admin (`admin / Admin@2026`) and a seeded user (`gayu / Welcome@2026`). The Memory Map also seeds events from `src/data/timeline-seed.json`. These password and other should be maintained still at local device storage area

**After:**

- `auth-store.ts` no longer seeds anyone. On fresh install the user list is empty.
- `timeline-seed.json` is no longer auto-imported.
- The login screen detects "no users yet" and shows a **First-launch panel** with two choices:
  1. **Import a vault** (existing encrypted `.vault` file from another device — reuses the share-store import flow).
  2. **Create the first admin** (username + passcode form) — only available when the user list is empty, so it can never be used to escalate.
- All quotes, welcome text, tab toggles, rhythm name etc. come from `settings-store` which is already per-user; I'll just remove any literal defaults like "Gayu" / "Kitty" and fall back to the user's own profile name.

> **Decision I'm making:** an empty-install must still allow creating the very first admin locally — otherwise a brand new device with no vault file would be unusable. If you want it to *only* accept an imported vault and refuse to create anything locally, tell me and I'll drop step 2.

---

### 2. Share dialog — role-aware with per-user checkboxes

Rewriting `src/components/ShareDialog.tsx` and extending `src/lib/share-store.ts`:

- **Regular user logged in:** share button exports **only their own data** (their timeline, media, rhythm videos, wishes, settings, plus their user record). No checkboxes.
- **Admin logged in:** share dialog shows a checkbox list of every user (including admin) plus an "All users" master checkbox. Export packs only the selected users' data and the global app settings.
- Implementation: the manifest builder filters every IndexedDB store by `userId` for the selected users, plus always includes the selected user records themselves. Tracked-key storage (`vault-users`, settings) is filtered to the selected ids.
- Import logic stays the same — replaces or merges whatever is in the file.

---

### 3. Multimedia — list / icon view + size selector

In `src/pages/Media.tsx`:

- Add a small toolbar with two toggles:
  - **View:** Grid (icon) ↔ List
  - **Size:** S / M / L (only meaningful for grid; in list it switches between dense / comfortable / spacious row heights)
- Persist choice in `localStorage` per user (mirrored through `storage-bridge`).
- Grid sizes map to Tailwind columns (`grid-cols-4 / 3 / 2` at the current breakpoint) and thumbnail size.

---

### 4. Statistics → Timeline deep-linking

- Every clickable entry in `Stats.tsx` (last 7 days, on this day, same date / other months, upcoming anniversaries, first/latest cards) becomes a button that does `navigate(`/timeline?focus=${entry.id}`)`.
- In `Timeline.tsx`, when `?focus=ID` is present:
  1. Auto-set `expandedId = ID`.
  2. Scroll the matching node into view (uses a `ref` map by entry id and `scrollIntoView({ block: "center", behavior: "smooth" })`).
  3. Briefly highlight the node (a 1.5s ring pulse).

---

### 5. Timeline — click-anywhere to close

Currently the only way to close an expanded node is to tap the same node again. I'll:

- Wrap the timeline body in a click handler: when `expandedId` is set, any click that is **not** inside the expanded card or on another expandable node clears `expandedId`.
- The expanded card itself stops propagation so its internal buttons (edit / delete / media) keep working.

---

### 6. New tab: **Time Traveler** (future plans)

- New page `src/pages/TimeTraveler.tsx` and route `/traveler` in `App.tsx`.
- New store `src/lib/traveler-store.ts` — same pattern as `timeline-store` (localforage `gayu-vault / traveler-meta` + `traveler-blobs`, blob-shared via vault export).
- Schema per item:
  ```
  { id, userId, title, notes, kind: "trip"|"activity"|"visit"|"event"|"other",
    startDate, endDate?, location?, mediaKind?, createdAt }
  ```
- UI:
  - Header with Add button.
  - Toggle: **Months view** (calendar-style cards grouped by year-month, only future months shown) ↔ **Day view** (chronological list with countdown badge "in 12 days").
  - Add/edit dialog with title, kind dropdown, location, start/end date, notes, optional cover image.
  - When a plan's date passes, it auto-moves to a "Past plans" section at the bottom.
- Tab is wired into `settings-store.enabledTabs` (new key `traveler`) so it can be enabled/disabled per user from Admin.

---

### 7. Tab order + merge Media into Rhythm

- New visual order on Home cards and side drawer:
`Memory Map → Statistics → Time Traveler → Make a Wish → Surprise → Rhythm of Us`
- **Multimedia option is removed** from the home grid. Instead, `Rhythm.tsx` becomes a tabbed page with two tabs at the top:
  - **Photos & files** — the current Multimedia experience (folders + photos/videos/audio + the new view modes from §3).
  - **Videos** — the current Rhythm-of-Us video collection.
- The `/media` route stays in `App.tsx` for backwards compatibility but redirects to `/rhythm?tab=media`.
- `settings-store.enabledTabs.media` is folded into `rhythm` — admin only sees one toggle now.

---

## Technical notes (for the dev side)

- **Storage bridge:** every new key (`traveler-*`, `media-view-mode-*`) is added to `TRACKED_KEYS` in `storage-bridge.ts` so it ships in vault exports.
- **share-store filtering:** I'll add `exportEncryptedVault(passphrase, opts?: { userIds?: string[] })`. When `userIds` is given, manifest-building iterates each store and skips items whose `userId` isn't in the set; `vault-users` localStorage gets filtered the same way.
- **First-launch flow:** `Login.tsx` checks `listUsers().length === 0` and renders the bootstrap panel instead of the username/passcode prompt.
- **Click-outside:** simplest reliable approach is a `ref` on the cards container plus an `onClick` on the section that clears `expandedId` when `e.target` isn't inside `[data-expanded="true"]`. No global listeners.
- **Timeline focus:** `useSearchParams()` to read `focus`; effect runs after `entries` load.
- No backend, no Lovable Cloud needed — all changes stay client-side per existing architecture.

---

## What I will NOT change (to keep this safe)

- Encryption format and `.vault` file layout — fully backwards compatible.
- Capacitor config and existing native plumbing.
- Admin page CRUD, Wish, Surprise pages.
- Theme tokens / index.css.

If anything above looks wrong (especially the first-launch decision in §1, or whether you want Multimedia to disappear from the home grid completely vs. stay as a sub-tab) tell me and I'll adjust before coding.