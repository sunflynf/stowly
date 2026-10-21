Stowly runs on **Vercel** (the app) and **Supabase** (database, sign-in, photo storage, the hourly alert job). Email goes through **Resend**. Nothing else needs an account.

## Platforms

| Platform | What it does | Account? | Free tier enough? |
| --- | --- | --- | --- |
| Vercel | Hosts the Next.js app, server actions and API routes | Yes | Yes. Hobby is free for personal, non-commercial use. |
| Supabase | Postgres, Auth, Storage, Row Level Security, pg_cron + pg_net, Vault | Yes | Probably; see the limits below |
| Resend | Daily digest and household invite emails (and, optionally, sign-in emails over SMTP) | Yes | Yes (3,000 emails a month) |
| Web Push | Phone and browser notifications | No; generate VAPID keys with `pnpm vapid` | Free |
| Open Food Facts / Open Products Facts | Product name lookup for scanned barcodes | No | Free |
| Domain (optional) | Lets Resend send from your own address | Any registrar | About $10 a year |

### Limits to know
- **Resend's onboarding sender** (`onboarding@resend.dev`) only delivers to the email of the Resend account owner. That's fine for one person; verify a domain to send anywhere else.
- **Supabase's built-in sign-in email** is heavily rate-limited (a few per hour). Point Supabase at Resend instead: Authentication → SMTP Settings.
- **Free Supabase projects pause after about 7 days without activity.** Use the app regularly, resume it from the dashboard, or upgrade to Pro.
- **Storage:** free Supabase gives 1 GB of files and a 500 MB database. Photos are about 150–300 KB each after resizing, so several thousand photos can pass 1 GB. Documents (up to 10 MB each) count toward the same limit. Items alone fit easily.

## Steps

1. **Create a Supabase project** and apply the migrations:
   ```bash
   pnpm supabase link --project-ref <ref>
   pnpm supabase db push
   ```
2. **Auth URLs** (Authentication → URL Configuration):
   - Site URL: `https://<your-app>`
   - Redirect URLs: `https://<your-app>/**`
   - Optional: turn on "Confirm email".
3. **Lock sign-up to your email.** Set `ALLOWED_EMAIL` in Vercel and also run, in the SQL editor:
   ```sql
   insert into private.signup_allowlist (email) values ('you@example.com');
   ```
   After creating your account you can disable sign-ups in Supabase entirely. People you invite to your household can still sign up with the invited email while the invite is open (7 days); if you disable sign-ups entirely, invitees need an existing account.
4. **Import the repo in Vercel** and set the environment variables:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page |
   | `SUPABASE_SERVICE_ROLE_KEY` | Same page. Server-only; never expose it. |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-app>` |
   | `ALLOWED_EMAIL` | Your email |
   | `CRON_SECRET` | A long random string |
   | `RESEND_API_KEY` | From Resend |
   | `ALERT_EMAIL_FROM` | `Stowly <onboarding@resend.dev>` until you verify a domain |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | From `pnpm vapid` |
   | `VAPID_SUBJECT` | `mailto:you@example.com` |

5. **Connect the alert job to your deployment.** The migration already schedules `stowly-alert-digest` at minute 5 of every hour. Tell it where to call, in the SQL editor:
   ```sql
   select vault.create_secret('https://<your-app>/api/cron/alerts', 'stowly_cron_url');
   select vault.create_secret('<CRON_SECRET>', 'stowly_cron_secret');
   ```
6. **Check it.** Preview the digest without sending anything:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-app>/api/cron/alerts?force=1&dry=1"
   ```
   `force=1` ignores the digest hour; `dry=1` sends and logs nothing.

## After the first deploy, test by hand
- A real digest email arrives (Settings → set the digest hour to the next hour, or call the endpoint without `dry=1`).
- Push notifications: turn on push in Settings on your phone and send a test notification.
- A barcode lookup fills in a product name.
- Invite a second email from Settings → Members. Without `RESEND_API_KEY` the link is shown to copy; open it in another browser to join.
- Upload a warranty PDF to an item and open it.
