-- New enum values for maintenance schedules. Kept in their own migration: a
-- value added by ALTER TYPE cannot be used in the same transaction.
alter type public.alert_kind add value if not exists 'maintenance_due';
alter type public.alert_kind add value if not exists 'maintenance_overdue';
alter type public.item_event_type add value if not exists 'maintenance';
