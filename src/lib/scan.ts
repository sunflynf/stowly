/** What a scanned QR code or barcode should open. */
export type ScanTarget =
  | { type: "location"; id: string }
  | { type: "item"; id: string }
  | { type: "path"; path: string }
  | { type: "code"; code: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const LOCATION_PATH = new RegExp(`^/(?:l|locations)/(${UUID})/?$`, "i");
const ITEM_PATH = new RegExp(`^/items/(${UUID})/?$`, "i");

/**
 * Stowly labels encode https://<app>/l/<location-id>. Those (and item links)
 * are recognised on any host, so labels printed from another deployment or
 * domain still open here. Other same-origin links open as-is; anything else
 * is treated as a product barcode.
 */
export function resolveScan(raw: string, origin: string): ScanTarget {
  const value = raw.trim();
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      const location = LOCATION_PATH.exec(url.pathname);
      if (location) return { type: "location", id: location[1].toLowerCase() };
      const item = ITEM_PATH.exec(url.pathname);
      if (item) return { type: "item", id: item[1].toLowerCase() };
      if (url.origin === origin) return { type: "path", path: url.pathname + url.search };
    }
  } catch {
    // Not a URL.
  }
  return { type: "code", code: value.slice(0, 64) };
}

/** Keeps only characters valid in a stored barcode (digits, letters, dashes). */
export function normalizeBarcode(code: string): string | null {
  const clean = code.trim().replace(/\s+/g, "");
  return /^[0-9A-Za-z-]{4,64}$/.test(clean) ? clean : null;
}
