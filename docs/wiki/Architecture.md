## Overview

| Layer | Technology |
| --- | --- |
| App | Next.js 16 App Router, strict TypeScript, Tailwind CSS v4, shadcn-style components on Radix |
| Data in the browser | TanStack Query through the Supabase client; RLS restricts every query to the owner's rows |
| Changes | Server Actions with Zod validation |
| Database | Supabase Postgres with `unaccent`, `pg_trgm`, `pg_cron`, `pg_net` |
| Files | Supabase Storage, private bucket `item-photos/<user_id>/<item_id>/` |
| i18n | next-intl, no locale in URLs; `NEXT_LOCALE` cookie mirrors `profiles.locale` |
| Notifications | Resend (email) and Web Push (VAPID) with a service worker |

## Data model

Main tables: `profiles`, `items`, `locations` (a tree), `categories`, `tags` / `item_tags`, `item_photos`, `item_events` (quantity, move and condition history), `item_groups`, `shopping_list`, `alert_snoozes`, `suggestion_dismissals`, `notifications_log`, `group_notifications_log`, `push_subscriptions`.

- Every table has an owner policy in Row Level Security.
- Foreign keys include `user_id` (composite `(id, user_id)`), so a row can never point at another user's data.
- Triggers keep derived data in sync: location paths, search documents and history events.

## Search

`public.search_items()`:
- Normalises text with `lower(unaccent())`, so "ao khoac" matches "Áo khoác" and "đ" matches "d".
- Uses a weighted `tsvector`: name (A), tags (B), category and location path in both languages (C), notes, attributes, shop and barcode (D).
- Prefix-matches names and tags; whole words match anywhere.
- Adds a substring match on the normalised name.
- Tolerates typos per word (4+ letters) with `pg_trgm` strict word similarity.
- GIN indexes back full-text and trigram matching.

Measured on 5,000 items: p95 about 110 ms across text, typo, location, filtered and paged queries.

## Alerts

- `public.compute_item_alerts()` is the single source of truth. The `item_alerts` view, `dashboard_stats()`, search badges and the digest all read from it; TypeScript only formats labels like "Còn 2 ngày".
- It and `user_today()` omit `SET search_path` so Postgres can inline them (about 10× faster); every name is schema-qualified.
- Groups have their own `group_alerts` view.

## Daily digest

```
pg_cron (minute 5, hourly) → pg_net → POST /api/cron/alerts (Bearer CRON_SECRET)
  → for each user whose local hour = digest hour
  → collect new alerts → send email (Resend) and push (web-push) → log
```

- The URL and secret live in Supabase Vault.
- `notifications_log(item, kind, threshold_key, channel)` is unique. The threshold key includes the date and bucket (e.g. `2026-11-01:7`), so 30-, 7- and 1-day reminders each send once.
- When an alert resolves its log rows are cleared, so it can fire again later.

## Photos

- Resized in the browser to 1600 px plus a 320 px thumbnail (WebP, JPEG fallback).
- Shown through signed URLs. At most 5 per item, enforced by a trigger.

## Scanning

- Native `BarcodeDetector` when available, otherwise the ZXing WebAssembly ponyfill served from `/vendor/`.
- QR labels encode `/l/<location-id>`, which redirects to the location page.
- Product lookups go through `/api/products/<code>` (Open Food Facts, then Open Products Facts; cached 7 days, 4 s timeout, sign-in required).

## Design decisions

The full list, with reasons, is in the README's **Decisions** section.
