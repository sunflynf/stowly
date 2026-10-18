// Fails (exit 1) if a message key exists in one locale but not the other.
// Also run as part of `pnpm test` (tests/unit/i18n-parity.test.ts).
import { readFileSync } from "node:fs";

const load = (l) => JSON.parse(readFileSync(`messages/${l}.json`, "utf8"));
const flatten = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [p + k] : flatten(v, `${p}${k}.`)));

const vi = new Set(flatten(load("vi")));
const en = new Set(flatten(load("en")));
const onlyVi = [...vi].filter((k) => !en.has(k));
const onlyEn = [...en].filter((k) => !vi.has(k));
if (onlyVi.length || onlyEn.length) {
  console.error("Missing in en:", onlyVi);
  console.error("Missing in vi:", onlyEn);
  process.exit(1);
}
console.log(`i18n OK: ${vi.size} keys in each locale`);
