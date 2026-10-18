# Stowly

Personal household inventory: find things fast, track expiry/warranty/condition, and keep stock levels with low-stock warnings and a shopping list. Vietnamese (default) and English.

> Full setup and usage docs are completed in milestone M6. Quick start for development:

```bash
pnpm install
pnpm db:start            # local Supabase via Docker (prints keys)
cp .env.example .env.local   # fill in the keys printed above
pnpm dev                 # http://localhost:3000
```

Tests: `pnpm test` (unit + i18n parity), `pnpm test:db` (RLS/integration, needs local Supabase).
