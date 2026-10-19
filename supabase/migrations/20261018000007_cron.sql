-- Hourly trigger for the alert digest (email + web push).
--
-- The job calls the app's /api/cron/alerts endpoint via pg_net. Configure the
-- target once per environment (values are stored encrypted in Supabase Vault):
--
--   select vault.create_secret('https://your-app.vercel.app/api/cron/alerts', 'stowly_cron_url');
--   select vault.create_secret('<same value as CRON_SECRET>', 'stowly_cron_secret');
--
-- Until both secrets exist the job is a no-op. Each user is processed in the
-- hour that matches their digest time in their own timezone.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function private.trigger_alert_digest()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'stowly_cron_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'stowly_cron_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;

revoke all on function private.trigger_alert_digest() from public, anon, authenticated;

-- Minute 5 of every hour.
select cron.schedule('stowly-alert-digest', '5 * * * *', $$select private.trigger_alert_digest()$$);
