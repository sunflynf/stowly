import { describe, expect, it } from "vitest";
import { contrastPairs, contrastRatio, isThemePreference, THEME_TOKENS, THEMES, themeCss } from "@/lib/themes";

describe("themes", () => {
  it.each(THEMES)("%s meets WCAG AA for every text/background pair it uses", (theme) => {
    const failures = contrastPairs(THEME_TOKENS[theme])
      .map((p) => ({ ...p, ratio: Number(contrastRatio(p.fg, p.bg).toFixed(2)) }))
      .filter((p) => p.ratio < p.min)
      .map((p) => `${p.name}: ${p.ratio} < ${p.min}`);
    expect(failures).toEqual([]);
  });

  it("every theme defines the same tokens", () => {
    const keys = Object.keys(THEME_TOKENS.teal).sort();
    for (const t of THEMES) expect(Object.keys(THEME_TOKENS[t]).sort()).toEqual(keys);
  });

  it("renders CSS for each theme, and auto follows the device", () => {
    const css = themeCss();
    for (const t of THEMES) expect(css).toContain(`[data-theme="${t}"]`);
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)\{\[data-theme="auto"\]\{color-scheme:dark;/);
  });

  it("computes known contrast ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#0b6e63", "#ffffff")).toBeGreaterThan(5.5);
  });

  it("validates stored preferences", () => {
    expect(isThemePreference("auto")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("pink")).toBe(false);
  });
});
