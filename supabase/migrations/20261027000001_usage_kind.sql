-- Alert kind for usage-based "running out soon" (own migration: a new enum value
-- cannot be used in the transaction that adds it).
alter type public.alert_kind add value if not exists 'running_out';
