# Changelog

## v1.1.0 — 2026-10-21

Everything added since v1.0.0. Upgrade: deploy, then run `supabase db push` (the new migrations run in order; no manual steps).

### Households
- Share one inventory with your family: owner, editor and viewer roles, invite links, leaving and removing members. Every shared table is protected by Row Level Security per role.

### Upkeep and paperwork
- **Maintenance schedules** ("clean the AC filter every 3 months"): due and overdue reminders on the dashboard, in Alerts and in the daily digest; mark done with a note; snooze.
- **Documents:** attach warranty cards, receipts and manuals (PDF or image, up to 10 MB) to any item; view or download them.
- **Claim warranty** page with all purchase facts on one printable sheet.
- **Insurance report:** filter by value, category and room; print or save as PDF with the total.

### Lending and stock
- **Lend and borrow** any item, with due dates, overdue / give-back reminders, a Lent & borrowed page and history.
- **Usage prediction:** learns how fast you use consumables and warns about 7 days before something runs out.
- **Trash with Undo:** deleted items are kept for 30 days and can be restored; they're then removed with their files automatically.

### Finding things
- **Faster text search:** worst p95 on 5,000 items went from about 200 ms to about 120 ms, with identical results.
- **Voice search:** tap the microphone and say "cái khoan ở đâu" / "where's the drill?".

### Look and feel
- **Colour themes:** Stowly teal, Fresh green, Calm blue, Dark and Auto (follows the device), all checked for WCAG AA contrast.
- **UI refresh:** full-width pages, a collapsible sidebar, create/edit in a drawer, list or card views, a font setting, folder-style location tree, and Expiring / Low stock views on All items.

## v1.0.0

First release: items, locations and photos, quick add, barcode and QR labels, search, stock stepper and history, alerts and the daily digest (email and push), shopping list, item groups, CSV import/export, spending and clean-up ideas, PWA with offline page, Vietnamese and English.
