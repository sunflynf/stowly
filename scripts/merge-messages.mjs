// Dev helper: deep-merge a JSON fragment into messages/<locale>.json.
// Usage: node scripts/merge-messages.mjs <locale> <fragment.json>
import { readFileSync, writeFileSync } from "node:fs";

const [locale, fragmentPath] = process.argv.slice(2);
const target = `messages/${locale}.json`;
let base = {};
try {
  base = JSON.parse(readFileSync(target, "utf8"));
} catch {}
const fragment = JSON.parse(readFileSync(fragmentPath, "utf8"));

function merge(a, b) {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object") merge(a[k], v);
    else a[k] = v;
  }
  return a;
}

writeFileSync(target, JSON.stringify(merge(base, fragment), null, 2) + "\n");
