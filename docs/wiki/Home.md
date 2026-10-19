**Stowly** is a personal household inventory app. Use it to find things fast, keep track of expiry dates, warranties and condition, and get warned before something runs out.

- Vietnamese by default, English available.
- Works on phone (camera-first quick add, installable as an app) and desktop.
- One person per account. Data is private to its owner.

Current version: **v1.0.0**.

## Pages

| Page | For |
| --- | --- |
| [[User Guide]] | Using Stowly day to day: adding items, search, alerts, shopping, labels, import, stats |
| [[Deployment]] | Putting Stowly online with Vercel, Supabase and Resend |
| [[Development]] | Running it locally, scripts and tests |
| [[Architecture]] | How it works inside: data model, search, alerts, security |
| [[Roadmap]] | Ideas and what's planned next |

## Features in v1.0.0

- **Items:** photos, category-specific fields, tags, quantity with a stepper and history, condition, price and purchase date.
- **Locations:** a tree of rooms, cupboards and shelves, with breadcrumbs.
- **Search:** ignores accents ("ao khoac" finds "Áo khoác") and tolerates typos. Covers names, tags, categories, locations, notes and barcodes.
- **Alerts:** expiry, warranty ending, replacement due, low and out of stock, overdue lent books. Shown on the dashboard and Alerts page and sent in a daily email and push digest.
- **Shopping list:** created from low-stock items. Ticking off an item adds it back to stock.
- **Item groups:** a shared low-stock threshold across similar items, e.g. "Charging cables ≥ 5".
- **QR labels and barcode scanning:** print labels for boxes and shelves, then scan to see what's inside; scan product barcodes to add items.
- **CSV import and export**, plus a full JSON backup.
- **Spending stats** and **clean-up suggestions** for unused, worn, broken and duplicate items.
