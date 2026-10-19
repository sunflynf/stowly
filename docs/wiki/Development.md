## Requirements

Node 22+, pnpm 10 and Docker.

## Run locally

```bash
pnpm install
pnpm db:start                 # local Supabase in Docker; prints the URL and keys
cp .env.example .env.local    # fill NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY
pnpm dev                      # http://localhost:3000
```

Email confirmation is off locally. Magic-link emails land in Mailpit.

| URL | What |
| --- | --- |
| http://localhost:3000 | The app |
| http://127.0.0.1:54323 | Supabase Studio |
| http://127.0.0.1:54324 | Mailpit (local emails) |

If Docker image pulls are rate-limited, run `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io pnpm db:start` and retry.

### Demo data

```bash
pnpm seed:demo                    # ~150 items for demo@stowly.local / demo-password
pnpm seed:demo --count 5000       # performance data set
pnpm seed:demo --email you@example.com --password secret123 --count 300
```

The seed backdates history, so spending stats and clean-up suggestions have something to show.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm lint` | ESLint (`no-explicit-any` is an error) |
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` |
| `pnpm lint:i18n` | Fails if a message key exists in one language but not the other |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:db` | Integration tests against local Supabase: RLS, storage, search, groups, digest, insights |
| `pnpm test:e2e` | Playwright, desktop and mobile, including a real camera scan through Chromium's fake camera |
| `pnpm bench:search` | Search latency on the seeded account (target p95 < 200 ms) |
| `pnpm db:reset` / `pnpm db:types` | Re-apply migrations / regenerate `src/lib/database.types.ts` |
| `pnpm vapid` | Generate VAPID keys for web push |

`pnpm install` also copies the barcode decoder (`zxing_reader.wasm`) into `public/vendor/`, which is git-ignored.

## Before opening a pull request

Run all of these:

```bash
pnpm lint && pnpm typecheck && pnpm lint:i18n
pnpm test && pnpm test:db && pnpm test:e2e
pnpm build
pnpm bench:search
```

## Rules the code follows

- Strict TypeScript, no `any`.
- Every mutation is a Server Action that validates its input with Zod; forms share the same schemas.
- Every table has Row Level Security, covered by integration tests.
- All text exists in both `messages/vi.json` and `messages/en.json`.
- New dependencies are explained in the README's dependency table, and new defaults in its "Decisions" section.
- This is Next.js 16: read `node_modules/next/dist/docs/` before relying on older Next.js habits (`proxy.ts` replaces middleware, for example).

## Project layout

| Path | Contents |
| --- | --- |
| `src/app` | Routes: `(auth)/login`, `(app)/…` pages, `api/` routes, `l/[id]` label links |
| `src/components` | UI by feature (`items`, `alerts`, `shopping`, …) and `ui/` primitives |
| `src/lib/actions` | Server Actions |
| `src/lib/queries` | TanStack Query hooks |
| `src/lib/alerts` | Digest selection, rendering, email and push |
| `supabase/migrations` | Schema, RLS, triggers, search, alerts, cron |
| `messages` | Vietnamese and English text |
| `tests/unit`, `tests/integration`, `e2e` | Tests |
| `scripts` | Seed, benchmark, i18n check, VAPID |
