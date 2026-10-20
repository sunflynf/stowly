export const fonts = ["be-vietnam-pro", "inter", "noto-sans", "roboto", "lexend", "nunito-sans", "system"] as const;
export type AppFont = (typeof fonts)[number];
export const defaultFont: AppFont = "be-vietnam-pro";
export const FONT_COOKIE = "STOWLY_FONT";

/** CSS variable holding each font's family (next/font), used for the picker previews. */
export const fontFamilyVar: Record<AppFont, string> = {
  "be-vietnam-pro": "var(--font-be-vietnam-pro)",
  inter: "var(--font-inter)",
  "noto-sans": "var(--font-noto-sans)",
  roboto: "var(--font-roboto)",
  lexend: "var(--font-lexend)",
  "nunito-sans": "var(--font-nunito-sans)",
  system: "ui-sans-serif, system-ui",
};

export function isFont(value: unknown): value is AppFont {
  return typeof value === "string" && (fonts as readonly string[]).includes(value);
}
