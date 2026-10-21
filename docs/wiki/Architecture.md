## Overview

| Layer | Technology |
| --- | --- |
| App | Next.js 16 App Router, strict TypeScript, Tailwind CSS v4, shadcn-style components on Radix |
| Data in the browser | TanStack Query through the Supabase client; RLS restricts every query to the owner's rows |
| Changes | Server Actions with Zod validation |
| Database | Supabase Postgres with `unaccent`, `pg_trgm`, `pg_cron`, `pg_net` |
| Files | Supabase Storage, private buckets `item-photos` and `item-documents`, both under `<household_id>/<item_id>/` |
| i18n | next-intl, no locale in URLs; `NEXT_LOCALE` cookie mirrors `profiles.locale` |
| Notifications | Resend (email) and Web Push (VAPID) with a service worker |
| Themes | Per-person colour theme (`profiles.theme`), mirrored in the `STOWLY_THEME` cookie so pages render without a flash |

## Data model

Main tables: `households`, `household_members`, `household_invites`, `profiles`, `items`, `locations` (a tree), `categories`, `tags` / `item_tags`, `item_photos`, `item_documents`, `item_events` (quantity, move and condition history), `item_groups`, `maintenance_tasks`, `maintenance_log`, `shopping_list`, `alert_snoozes`, `suggestion_dismissals`, `notifications_log`, `group_notifications_log`, `maintenance_notifications_log`, `push_subscriptions`.

- Shared data belongs to a **household**; people join a household with a role. Per-person data stays on the person: `profiles` (language, timezone, currency, theme, lead days, digest), push subscriptions and the notification logs.
- Every table has Row Level Security (see below).
- Composite foreign keys `(id, household_id)` mean a row can never point at another household's category, location, item, tag or group.
- Triggers keep derived data in sync: location paths, search documents, history events, maintenance due dates and per-item limits (5 photos, 20 documents).

## Households and roles

- Rows are readable when `household_id = current_household_id()` (the person's active household, re-checked against membership). Writes also need `can_edit_household()`. Both helpers are `security definer` and wrapped in `(select …)` so they run once per query.

| Role | Can do |
| --- | --- |
| Owner | Everything, including members, invites and the household name. There can be several owners. |
| Editor | Add, edit and delete items, locations, categories, tags, groups, shopping list and alerts. |
| Viewer | Read only. |

- **Invites:** the link carries a secret token; only its SHA-256 hash is stored. `accept_household_invite()` checks the hash, the 7-day expiry and that the invite is addressed to the caller's email. Without `RESEND_API_KEY` the app shows the link to copy instead of emailing it.
- **Membership triggers:** a household always keeps at least one owner; the last owner cannot leave or step down. Someone who leaves (or is removed) is moved to another household or a fresh one of their own; an empty household is deleted with its data.
- **Migration from single-user:** each existing user got a household whose id equals their user id. `user_id` columns were renamed to `household_id`, so no row, key or storage path was rewritten.
- **Shared vs personal:** snoozes, shopping list and clean-up dismissals are shared. Lead days, timezone, currency, language, theme, digest hour and channels are per person, so two members can see different "expiring soon" sets.

## Search

`public.search_items()`:
- Normalises text with `lower(unaccent())`, so "ao khoac" matches "Áo khoác" and "đ" matches "d".
- Uses a weighted `tsvector`: name (A), tags (B), category and location path in both languages (C), notes, attributes, shop and barcode (D).
- Prefix-matches names and tags; whole words match anywhere.
- Adds a substring match on the normalised name.
- Tolerates typos per word (4+ letters) with `pg_trgm` strict word similarity.
- GIN indexes back full-text and trigram matching.
- A text query first collects candidate ids through those indexes (`search_candidate_ids()`, security definer so the indexes are usable under RLS; it filters to the caller's active household itself). The exact match and ranking then run only on the candidates. Results are the same, only faster.

Measured on 5,000 items: p95 about 110 ms across text, typo, location, filtered and paged queries (worst p95 151 ms with an owner plus 3 members benchmarked). The candidate lookup roughly halves text queries, e.g. "ao khoac" 142 → ~50 ms and a typo like "lightnig" 154 → ~15 ms. Run `pnpm bench:search` to measure.

## Alerts

- `public.compute_item_alerts()` is the single source of truth. The `item_alerts` view, `dashboard_stats()`, search badges and the digest all read from it; TypeScript only formats labels like "Còn 2 ngày".
- It and `user_today()` omit `SET search_path` so Postgres can inline them (about 10× faster); every name is schema-qualified.
- Alerts are computed per person by `user_item_alerts(user)` (their settings, their active household's items). The `item_alerts` view calls it for the signed-in user and the digest calls it per person.
- Groups have their own `group_alerts` view.

## Maintenance

- `maintenance_tasks` are recurring jobs ("Clean AC filter every 3 months"), standalone or attached to an item. Each has an interval (days, weeks, months or years), an optional first due date, and can be snoozed or archived.
- A trigger maintains `next_due`: last done + interval, else the start date, else created + interval. Marking a task done writes a row to `maintenance_log` and moves the next date on, counting from the day it was done.
- `compute_maintenance_alerts(task, today, lead_days)` decides which tasks are due or overdue, the same pattern as `compute_item_alerts()`. The `maintenance_alerts` view, `dashboard_stats()` and the digest (`user_maintenance_alerts(user)`) all read it. `profiles.maintenance_lead_days` (default 7) is the per-person warning window.

## Daily digest

```
pg_cron (minute 5, hourly) → pg_net → POST /api/cron/alerts (Bearer CRON_SECRET)
  → for each user whose local hour = digest hour
  → collect new item, group and maintenance alerts → send email (Resend) and push (web-push) → log
```

- The URL and secret live in Supabase Vault.
- `notifications_log(item, kind, threshold_key, channel)` is unique. The threshold key includes the date and bucket (e.g. `2026-11-01:7`), so 30-, 7- and 1-day reminders each send once.
- When an alert resolves its log rows are cleared, so it can fire again later.
- Maintenance reminders use `maintenance_notifications_log`, with the due date in the threshold key. Logs are per person, so each member gets each reminder once.

## Photos

- Resized in the browser to 1600 px plus a 320 px thumbnail (WebP, JPEG fallback).
- Shown through signed URLs. At most 5 per item, enforced by a trigger.
- Members read; owners and editors upload and delete.

## Documents

- Warranty cards, invoices and manuals live in the private `item-documents` bucket under `<household_id>/<item_id>/`, with the same access rules as photos. The bucket accepts only PDF, JPEG, PNG and WebP up to 10 MB.
- The browser uploads the file, then `addDocumentAction` registers it using the type and size read back from Storage, not what the client claims. A row check ties `storage_path` to the item's folder. At most 20 per item.
- Viewed and downloaded through 10-minute signed URLs; downloads keep the original file name.
- The **Claim warranty** view gathers an item's warranty status, serial and model, photos and documents on one printable page. The **insurance report** (`insurance_report()`) lists priced items with photos, serial numbers and a total, filterable by minimum value, category and room.

## Scanning

- Native `BarcodeDetector` when available, otherwise the ZXing WebAssembly ponyfill served from `/vendor/`.
- QR labels encode `/l/<location-id>`, which redirects to the location page.
- Product lookups go through `/api/products/<code>` (Open Food Facts, then Open Products Facts; cached 7 days, 4 s timeout, sign-in required).

## Design decisions

The full list, with reasons, is in the README's **Decisions** section.

## Access control for sign-up

`ALLOWED_EMAIL` in the UI plus the `private.signup_allowlist` table, enforced by a trigger on `auth.users`. An empty table allows any sign-up (handy locally). An open household invite also lets its email sign up. Magic links only sign in existing accounts.
