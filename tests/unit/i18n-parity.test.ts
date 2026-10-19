import { describe, expect, it } from "vitest";
import vi from "../../messages/vi.json";
import en from "../../messages/en.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** Top-level ICU argument names, e.g. "{count, plural, ...}" -> count. */
function icuArgs(message: string): string[] {
  const args = new Set<string>();
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    const ch = message[i];
    if (ch === "{") {
      if (depth === 0) {
        const match = /^\{\s*([a-zA-Z_][\w]*)/.exec(message.slice(i));
        if (match) args.add(match[1]);
      }
      depth++;
    } else if (ch === "}") depth--;
  }
  return [...args].sort();
}

const viFlat = flatten(vi as Tree);
const enFlat = flatten(en as Tree);

describe("i18n message files", () => {
  it("have exactly the same keys in vi and en", () => {
    const missingInEn = [...viFlat.keys()].filter((k) => !enFlat.has(k));
    const missingInVi = [...enFlat.keys()].filter((k) => !viFlat.has(k));
    expect({ missingInEn, missingInVi }).toEqual({ missingInEn: [], missingInVi: [] });
  });

  it("use the same ICU arguments in both locales", () => {
    const mismatched = [...viFlat.entries()]
      .filter(([key, value]) => enFlat.has(key) && icuArgs(value).join() !== icuArgs(enFlat.get(key)!).join())
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });

  it("have no empty messages", () => {
    const empty = [...viFlat.entries(), ...enFlat.entries()].filter(([, v]) => v.trim() === "").map(([k]) => k);
    expect(empty).toEqual([]);
  });
});
