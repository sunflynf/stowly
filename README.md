# Stowly

Personal household inventory. Find things fast, track expiry dates, warranties and condition with alerts, and keep stock levels under control with low-stock warnings and a shopping list. Vietnamese is the default language and English is also available. The app works on phone (camera-first quick add, installable PWA) and desktop.

**Stack:** Next.js 16 (App Router, TypeScript strict), Tailwind CSS v4, Radix primitives in shadcn/ui style, Supabase (Postgres, Auth, Storage, RLS, pg_cron), next-intl, TanStack Query, React Hook Form + Zod, Resend, Web Push, Vitest, Playwright.

---

## 1. Local development

Requirements: Node 22+, pnpm 10, Docker.

```bash
pnpm install
pnpm db:start                 # local Supabase in Docker; prints the URL and keys
cp .env.example .env.local    # fill NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from the output above
pnpm dev                      # http://localhost:3000
```

Create an account on `/login` → **Tạo tài khoản mới**. Email confirmation is off locally. Every new account gets:
- a profile,
- its own household (you are the owner),
- seven bilingual built-in categories,
- a starter location tree: Phòng khách, Phòng ngủ › Tủ quần áo, Nhà bếp › Tủ lạnh / Kệ bếp, and so on.

Demo data:

```bash
pnpm seed:demo                    # ~150 realistic items for demo@stowly.local / demo-password
pnpm seed:demo --count 5000       # performance data set
pnpm seed:demo --email you@example.com --password secret123 --count 300
pnpm seed:demo --count 5000 --members 3   # + demo-member-1..3@stowly.local (editor, viewer, editor) in the same household
```

Useful local URLs:

| URL | What |
| --- | --- |
| http://127.0.0.1:54323 | Supabase Studio |
| http://127.0.0.1:54324 | Mailpit: magic-link and confirmation emails sent by local Auth |

> If Docker Hub/ECR rate-limits image pulls, run `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io pnpm db:start` and retry later.

### Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm lint` | ESLint. `no-explicit-any` is an error. |
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` |
| `pnpm lint:i18n` | Fails if a message key exists in one locale but not the other |
| `pnpm test` | Vitest unit tests. Covers i18n parity (keys and ICU arguments), validation, status/alert logic and digest rendering. |
| `pnpm test:db` | Integration tests against local Supabase: RLS isolation between two users, storage policies, signup seeding, quantity RPC, search, and households: every shared table × every role (owner, editor, viewer, outsider, removed member), invites, roles, leaving, per-person logs and settings |
| `pnpm test:e2e` | Playwright tests:<br>• sign-up + language switch<br>• quick add with photo + stepper + history<br>• search and filters<br>• dashboard → shopping list → restock + snooze<br>• QR labels and the `/l/<id>` link<br>• barcode duplicate check + manual entry<br>• **real camera scan** (Chromium's fake camera plays a QR video into the ZXing decoder)<br>• item groups (created from the item form)<br>• CSV import (Vietnamese file) + export round-trip<br>• household invite → join as viewer (read-only) → removed by the owner |
| `pnpm bench:search` | Search latency against the seeded account, and as each `demo-member-N` of the same household when present (target p95 < 200 ms) |
| `pnpm db:reset` / `pnpm db:types` | Re-apply migrations / regenerate `src/lib/database.types.ts` |
| `pnpm vapid` | Generate VAPID keys for web push |

---

## 2. Deploying (Vercel + Supabase)

1. **Supabase project.** Create one, then:
   ```bash
   pnpm supabase link --project-ref <ref>
   pnpm supabase db push          # applies supabase/migrations/*
   ```
2. **Auth settings** (Dashboard → Authentication → URL Configuration):
   - Site URL: `https://<your-app>`
   - Redirect URLs: `https://<your-app>/**`
   - Optional: turn on "Confirm email".
3. **Sign-up lock.** Set `ALLOWED_EMAIL` in Vercel, which the sign-up form checks. Also enforce it in the database, so that sign-ups through the API are rejected too:
   ```sql
   insert into private.signup_allowlist (email) values ('you@example.com');
   ```
   People you invite to your household can still sign up with the invited email while the invite is open (7 days); no allowlist change is needed. If you disable sign-ups in Supabase entirely, invitees need an existing account.
4. **Vercel.** Import the repo and set the variables from `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`, `ALLOWED_EMAIL`, `CRON_SECRET`
   - `RESEND_API_KEY`, `ALERT_EMAIL_FROM`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
5. **Email (Resend).** Create an API key. Until you verify a domain, keep `ALERT_EMAIL_FROM="Stowly <onboarding@resend.dev>"`. With that sender, Resend only delivers to the address of the Resend account owner.
6. **Web push.** Run `pnpm vapid` and put the keys in the env vars above.
7. **Scheduled alerts.** pg_cron is already scheduled by the migration (`stowly-alert-digest`, minute 5 of every hour). Point it at your deployment in the SQL editor:
   ```sql
   select vault.create_secret('https://<your-app>/api/cron/alerts', 'stowly_cron_url');
   select vault.create_secret('<CRON_SECRET>', 'stowly_cron_secret');
   ```
   Check it by hand:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-app>/api/cron/alerts?force=1&dry=1"
   ```
   - `force=1` ignores the digest hour.
   - `dry=1` previews what would be sent without sending or logging anything.

---

## 3. How to verify each milestone

| Milestone | Verify |
| --- | --- |
| **M1** Scaffold, auth, i18n, schema, RLS | `pnpm test:db`: RLS isolation, storage, seeding. Then sign up on `/login` and switch Tiếng Việt/English (sidebar or Settings); the choice persists after signing in again. |
| **M2** Locations, items CRUD, photos, quick add, tags | `/items/new`: take or pick a photo, choose a category chip, set quantity and threshold, pick a location (or create one inline), then "Lưu & thêm tiếp". `/locations`: add, rename, move, delete. `/categories`: custom fields and tags. |
| **M3** Search, All items, stepper, history | `/items`: type `ao khoac`, `sac`, `lightnig` (typo) or `tu quan ao` (a location). Combine filters and sorts; the state is kept in the URL. The inline stepper writes to the item's quantity history (item detail page). `pnpm bench:search` |
| **M4** Alert states, dashboard, shopping list | `/` shows stat cards, "Cần xử lý" and the low-stock bars. "Tạo danh sách cần mua" fills `/shopping`; checking an item adds the bought amount to stock. |
| **M5** Scheduled alerts, Alerts page, settings | `/alerts`: Mark replaced, Used up, Add to shopping list, Snooze 7 days (with undo). `/settings`: lead days, digest hour, channels, push on this device, test notification, CSV/JSON export. Cron dry run: `curl -H "Authorization: Bearer local-cron-secret" "localhost:3000/api/cron/alerts?force=1&dry=1"` |
| **QR labels** | `/locations` → **In nhãn QR**: pick locations and a label size, then print (A4, 100% scale). Scanning a label, or opening `/l/<id>`, shows that location's contents, signing in first if needed. |
| **Barcode scan** | Quick add → the scan button next to the name. If the camera is unavailable, type a code into the same dialog. A known code offers **+1 to stock**; an unknown code fills the name from Open Food Facts when it is reachable, and the barcode is saved and searchable. The dashboard scan button opens labels and items you already own. |
| **Item groups** | **Nhóm đồ** → create "Dây sạc" with threshold 5, then add items (or pick the group in the item form). The group page shows the combined total vs threshold; when the total is low, the group appears on the dashboard low-stock panel, the Alerts page (snooze / add to shopping) and the daily digest. Buying a group shopping entry restocks the member updated most recently. |
| **CSV import** | **Settings → Nhập từ CSV**, or `/import`: drop a CSV (Excel with semicolons, Vietnamese headers and dd/mm/yyyy dates all work), check the column matching and the preview, choose what happens to duplicates, then import. Re-importing an export (`/api/export/items`) updates items by `id`. "Tải tệp mẫu" downloads a template. |
| **Spending** | Sidebar → **Chi tiêu**: pick a period. You get totals vs the previous period, the monthly chart (hover/focus a bar, or switch to the table), spending by category and by room, and the most expensive items. Purchases without a price or date are counted in a note. |
| **Clean-up ideas** | Sidebar → **Gợi ý dọn dẹp**, also linked from the dashboard. Four tabs: unused for a long time, worn, broken, duplicates. Actions: give away, archive, keep, snooze 30 days, and merge duplicates into the older item; undo is available where safe. The "unused" threshold is in Settings. `pnpm seed:demo` backdates history so there is something to see. |
| **Households** | Settings → **Thành viên**: name the household, set your display name, invite an email as Biên tập/Chỉ xem (without `RESEND_API_KEY` the link is shown to copy). Open the link in another browser: sign up or sign in with that email, then **Tham gia**. A viewer sees a "Chỉ xem" banner and no add/edit controls; an editor can change items. The owner changes roles and removes members; anyone can **Rời nhà này** except the last owner. Item history shows who made each change; switch households from the same section. `pnpm test:db` (role matrix), `pnpm seed:demo --count 5000 --members 3 && pnpm bench:search`. |
| **M6** PWA, performance, E2E | `pnpm build && pnpm start`, then install from the browser; the offline page is served without a network. `pnpm seed:demo --count 5000 && pnpm bench:search`, then `pnpm test:e2e`. |

> `pnpm install` runs `scripts/copy-zxing-wasm.mjs`, which places the barcode decoder in `public/vendor/` (git-ignored).

Measured on the local stack with 5,000 items (end-to-end via PostgREST):
- Search: p95 ≤ ~110 ms across text, typo, location, state-filtered and paginated queries. With households (owner + 3 members of the same household, each benchmarked): worst p95 151 ms.
- `item_alerts` view: ~20 ms.
- `dashboard_stats()`: ~40 ms.

---

## 4. Architecture notes

- **Households.** All data belongs to a household; profiles (language, timezone, lead days, digest, push), push subscriptions and the notification logs stay per person.
  - RLS on every shared table: read rows where `household_id = current_household_id()` (the person's active household, re-checked against membership); insert/update/delete additionally need `can_edit_household()` (owner or editor). Both helpers are `security definer`, wrapped in `(select …)` so they run once per query, not per row.
  - Composite foreign keys `(id, household_id)` stop a row from referencing another household's category, location, item, tag or group.
  - Members, invites and the household name: the owner of the active household. New members only arrive through `accept_household_invite()`, which checks the token hash, expiry and that the invite is addressed to the caller's email.
  - Triggers keep a household with at least one owner, delete a household when its last member leaves, and move someone who leaves or is removed to another household (or a new one of their own).
  - Alerts are computed per person by `user_item_alerts(user)` (their settings, their active household's items). The `item_alerts` view calls it for the signed-in user and the digest calls it per person, so there is still one source of truth.
- **Data access.**
  - Reads run in the browser with TanStack Query through the Supabase client; RLS restricts every query to the active household's rows.
  - Every mutation is a Server Action that validates its input with Zod. The same schemas drive the forms.
  - Database triggers keep derived data in sync: location paths, search documents and item history events.
- **Single source of truth for alerts.** `public.compute_item_alerts()` (SQL) decides which alerts are raised. The `item_alerts` view, `dashboard_stats()`, the search badges and the scheduled digest all read from it. The TypeScript side only formats labels such as "Còn 2 ngày".
- **Search.** Implemented in `public.search_items()`:
  - Text is normalised with `lower(unaccent())`, so "ao khoac" matches "Áo khoác" and "đ" matches "d".
  - A weighted `tsvector` holds the name (A), tags (B), category and location path in both languages (C), and notes, attributes and place of purchase (D).
  - Prefix matching applies to names and tags; whole words match anywhere.
  - A substring match runs on the normalised name.
  - Typo tolerance is per word (4+ letters), using `pg_trgm` strict word similarity.
  - GIN indexes back the full-text and trigram matching.
- **No resends.** `notifications_log(user, item, kind, threshold_key, channel)` is unique, so each member gets each reminder once.
  - The threshold key includes the date and the bucket (e.g. `2026-11-01:7`), so the 30-, 7- and 1-day reminders each send once.
  - When an alert resolves, its log rows are cleared so it can fire again (e.g. restocked, then running low again).
- **Photos.**
  - Stored in a private `item-photos` bucket under `<household_id>/<item_id>/`. Members read, owners and editors upload and delete.
  - Resized in the browser to 1600 px plus a 320 px thumbnail (WebP, with JPEG fallback).
  - Shown via signed URLs; at most 5 per item, enforced by a trigger.

---

## 5. Decisions

Defaults chosen where the brief was open, or where the environment forced a choice:

1. **No locale in URLs.** The locale lives in the `NEXT_LOCALE` cookie and mirrors `profiles.locale`; it is synced on login and when changed in the header/sidebar or Settings. Vietnamese is the default and the source of truth for messages.
2. **Bilingual built-ins.**
   - `categories` and `locations` have `name` (Vietnamese, or as typed by the user) plus an optional `name_en`.
   - Built-ins are seeded with both. The UI shows `name_en` in English when present.
   - Search covers both languages.
   - User content is never translated.
3. **Alerts run as pg_cron → pg_net → Next.js route** (`/api/cron/alerts`) rather than a Supabase Edge Function.
   - This reuses the app's TypeScript rendering, i18n messages and status labels instead of duplicating them in Deno.
   - The job runs hourly; each user is processed when their local time equals their digest hour (default 07:00).
   - Vercel Cron can call the same endpoint instead, but the Hobby plan only allows daily jobs.
4. **Low stock** means `quantity <= min_quantity`, and "out of stock" means quantity 0. Both require a threshold to be set. The quick-add field reads "Báo khi còn ≤" to match.
5. **Severity colours.** Status is always shown as text; colour only reinforces it.
   - Red: expired, out of stock, or expiring within 7 days.
   - Amber: low stock, warranty ending, replacement due, lent book overdue.
   - Teal: expiring further out (e.g. "Còn 26 ngày"), as in the mockup.
6. **Snoozes.** Snoozes are stored in a separate `alert_snoozes` table, which the brief's data model did not include. "Used up / remove" archives the item (it can be restored), and "Mark replaced" for expiring items asks for an optional new expiry date.
7. **Sign-up lock** works at two levels (an open household invite also allows its email to sign up):
   - `ALLOWED_EMAIL` in the UI.
   - The `private.signup_allowlist` table, enforced by a trigger on `auth.users`. An empty table allows any sign-up, which is convenient for local development.

   Magic links only sign in existing accounts.
8. **Next.js 16 specifics.**
   - `proxy.ts` replaces middleware.
   - Cache Components are not enabled, because all data is per-user and fetched on the client.
   - The signed-in shell renders after mount to avoid hydration mismatches when streamed boundaries hydrate after data has arrived. A private app gets nothing from server-rendering its data.
9. **UI kit.** The shadcn registry was not reachable from the build environment, so the components in `src/components/ui` are hand-written in shadcn style on Radix primitives (`radix-ui`), with the same API conventions.
10. **Currency.** Prices are stored as plain numbers in the profile currency (VND by default; USD and EUR are selectable). There is no conversion.
11. **Lists.** All items uses infinite scroll with 50 rows per page, plus a "Load more" button. Totals come from `count(*) over()`.
12. **Scanning.** The scanner uses the browser's native `BarcodeDetector` when it supports the needed formats, and otherwise the ZXing WebAssembly ponyfill (`barcode-detector`). That covers iPhone Safari, Firefox and desktop browsers. The `.wasm` file is copied to `public/vendor/` on install and served by the app itself, never from a CDN. Every scan dialog also accepts a typed code.
    - A scanned **QR label** (`…/l/<location-id>`) opens that location. Labels are recognised on any host, so labels printed from another domain still work here.
    - A scanned **product barcode** opens the item you already own with that barcode. If you don't own one, quick add opens with the code filled in.
13. **Dark mode.** All colours are CSS variables in `globals.css`, so dark mode only needs a second set of values. It is not implemented yet (light theme first, per the brief).
14. **Performance tweak.** `compute_item_alerts()` and `user_today()` deliberately omit `SET search_path` so Postgres can inline them; every name is schema-qualified. Inlining made the alerts view about 10× faster.
15. **QR labels.**
    - Labels encode a short link, `/l/<id>`, which keeps the QR code coarse and easy to scan. It redirects to `/locations/<id>`, a page showing sub-locations and every item inside, including items in sub-locations.
    - Labels are generated locally with `qrcode`, as SVG. The link uses `NEXT_PUBLIC_SITE_URL`, so labels printed from a preview build open production.
    - The print sheet matches common A4 sticker paper: 63.5×38.1 mm (3 per row) or 99.1×67.7 mm (2 per row).
16. **Barcode lookup.**
    - `/api/products/<code>` asks Open Food Facts, then Open Products Facts. Both are free, keyless and identified by a User-Agent.
    - Results are cached for 7 days, each request times out after 4 s, and the endpoint requires sign-in.
    - Lookup fills in the name ("Brand Name 75 g") and the category, but only fields you have left empty.
    - Items keep their `barcode`, which is also searchable, so the next scan finds the item instantly.
    - From quick add, a known barcode shows "Bạn đã có món này" with **Open item** and **+1 to stock** instead of creating a duplicate.

17. **Item groups.**
    - A group has a shared threshold, evaluated on the **sum** of its active members' quantities.
    - Members keep their own optional thresholds.
    - Group alerts live in a `group_alerts` view with the same alert kinds as items (`low_stock`/`out_of_stock`).
    - Group alerts have their own notification log and a simple `snoozed_until` on the group.
    - A bought group entry adds its quantity to the member updated most recently: usually the one you are re-buying, and easy to adjust afterwards.
18. **CSV import.**
    - **File handling:** Parsing and validation run in the browser, so you get an instant preview. Rows are sent in chunks of 200 to a server action, which validates everything again with the same Zod item schema.
    - **Matching:**
      - Category and group names are matched accent-insensitively, in Vietnamese or English.
      - Location paths use `›`, `>` or `/` as separators and are walked from the top, creating missing levels.
      - Missing categories, groups and tags are created.
      - A row with an `id` you own always updates that item. Otherwise a duplicate is the same barcode, or the same name in the same location; it is updated, skipped or created again, as you choose.
      - Each existing item is matched by at most one row, so identical lines stay separate items.
    - **Updates:** only the columns present in the file are written, and tag links change only where they differ.
    - **Speed** (local stack, 5,000 rows): about 13 s to create, about 40 s to update.

19. **Spending** comes from `spending_stats()`.
    - `purchase_price` is treated as the amount paid for the item record, not per unit.
    - Purchases are counted by `purchase_date`, in your timezone.
    - Purchases missing a price or a date are excluded but reported, so the totals never quietly mislead.
    - "Previous period" means the same number of days right before the selected range.
    - The charts are single-series in the brand teal (no categorical palette). Bars are focusable and have tooltips; only the peak bar is labelled; a table view is available.
20. **Clean-up ideas** come from `unused_suggestions()` and `unused_suggestion_counts()`.
    - **What "used" means:** a quantity change, a move or a condition change (rows in `item_events`). Editing a name or a note does not count. Items tracked by an expiry date are left to expiry alerts.
    - **Duplicates:** same name, accent- and case-insensitive, in the same location. "Merge" adds the quantities to the oldest entry (recorded in its history) and archives the others.
    - **Give away:** sets the condition to "given away" and archives the item, so it stays in history and spending.
    - **Keep:** hides the suggestion. For worn, broken and duplicate items that is permanent; for an unused item it lasts one more idle period.
    - **Paging:** results come per reason, 30 at a time, because PostgREST caps a response at 1,000 rows. The same cap was found and fixed for the alerts list and the digest, which now page through all rows.

21. **Households.**
    - **Migration:** each existing user gets a household whose id equals their user id, with them as owner. `user_id` columns are renamed to `household_id`, so every row, composite key and photo path stays valid and no data is rewritten. Existing history is attributed to that user.
    - **Several households per person.** Accepting an invite switches you to that household; your own household stays available in Settings → Members. Everything on screen (and RLS) is scoped to the active household.
    - **Roles:** editors can also manage locations, categories, tags and groups, because the item form creates them inline. Only owners manage members, invites and the household name. Invites can be for editor or viewer; an owner can promote anyone afterwards, and there can be several owners.
    - **Invites:** 32 random bytes in the link, only the SHA-256 hash is stored; valid 7 days, once, and only for the invited email. Re-inviting an email replaces its open invite. Without Resend the owner gets the link to share. The email is written in the inviter's language.
    - **Invited sign-ups** still get their own (empty) household; the invite then switches them to the shared one.
    - **Leaving:** the last owner cannot leave or step down. Someone who leaves their only household gets a fresh one. If the last owner's account is deleted, the longest-standing member becomes owner; an empty household is deleted with its data.
    - **Shared vs personal:** snoozes, shopping list and clean-up dismissals are shared by the household. Alert lead days, timezone, currency, language, digest hour and channels are per person, so two members may see different "expiring soon" sets. The digest covers each person's active household.
    - **Display names:** optional; otherwise the part of the email before "@". Former members still appear by name in history, marked as having left.
    - **Viewers** see a read-only banner. Add/edit controls are hidden on the main screens; every write is also rejected by the server (`forbidden`) and by RLS.

### Dependencies added (and why)

| Package | Why |
| --- | --- |
| `@supabase/supabase-js`, `@supabase/ssr` | Database, auth, storage; cookie sessions in Next.js |
| `next-intl` | i18n with ICU plurals and locale-aware formatting |
| `@tanstack/react-query` | Client data cache, optimistic stepper, infinite lists |
| `react-hook-form`, `zod`, `@hookform/resolvers` | Forms and shared validation |
| `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner` | Accessible primitives, shadcn-style variants, icons, toasts |
| `browser-image-compression` | Client-side photo resize/compression before upload |
| `qrcode` | QR labels, generated locally as SVG |
| `barcode-detector` | Barcode/QR scanning on browsers without a native `BarcodeDetector` (ZXing WebAssembly, self-hosted) |
| `resend` | Digest email |
| `web-push` | Push notifications (VAPID) |
| `server-only` | Guards server modules (service-role client) from client bundles |
| dev: `supabase`, `vitest`, `@playwright/test`, `tsx`, `@types/web-push` | CLI, tests, scripts |
