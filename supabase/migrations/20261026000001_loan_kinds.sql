-- Enum values for lending and borrowing (own migration: a new enum value
-- cannot be used in the transaction that adds it).
alter type public.alert_kind add value if not exists 'borrow_due';
alter type public.item_event_type add value if not exists 'lent';
alter type public.item_event_type add value if not exists 'borrowed';
alter type public.item_event_type add value if not exists 'returned';
