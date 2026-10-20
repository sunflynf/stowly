// Colour themes. This module is the single source of truth: the root layout
// renders `themeCss()` into the page, and the unit tests check every
// foreground/background pair below for WCAG AA contrast.
//
// Status colours keep the same meaning in every theme (red = danger,
// amber = warning); only their shades change so they stay readable.

export const THEMES = ["teal", "green", "blue", "dark"] as const;
export type Theme = (typeof THEMES)[number];
/** What a person picks: a theme, or "auto" (Stowly teal, or Dark when the device is in dark mode). */
export const THEME_PREFERENCES = ["auto", ...THEMES] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export const DEFAULT_THEME: ThemePreference = "teal";
export const THEME_COOKIE = "STOWLY_THEME";

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export interface ThemeTokens {
  scheme: "light" | "dark";
  background: string;
  foreground: string;
  card: string;
  "card-foreground": string;
  popover: string;
  "popover-foreground": string;
  primary: string;
  "primary-hover": string;
  "primary-foreground": string;
  accent: string;
  "accent-foreground": string;
  muted: string;
  "muted-foreground": string;
  border: string;
  input: string;
  ring: string;
  danger: string;
  "danger-foreground": string;
  "danger-solid": string;
  warning: string;
  "warning-foreground": string;
  "warning-solid": string;
  neutral: string;
  "neutral-foreground": string;
  success: string;
  "success-foreground": string;
}

// Light themes share their status shades.
const LIGHT_STATUS = {
  danger: "#fde8e6",
  "danger-foreground": "#9f1d14",
  "danger-solid": "#b3261e",
  warning: "#fdefd6",
  "warning-foreground": "#8a4b00",
  "warning-solid": "#b85c00",
} as const;

export const THEME_TOKENS: Record<Theme, ThemeTokens> = {
  // Stowly teal: the original look.
  teal: {
    scheme: "light",
    background: "#f3f5f4",
    foreground: "#14201c",
    card: "#ffffff",
    "card-foreground": "#14201c",
    popover: "#ffffff",
    "popover-foreground": "#14201c",
    primary: "#0b6e63",
    "primary-hover": "#095c53",
    "primary-foreground": "#ffffff",
    accent: "#e3f1ee",
    "accent-foreground": "#0a5a51",
    muted: "#eef1ef",
    "muted-foreground": "#4b5c55",
    border: "#e2e8e5",
    input: "#cfd8d4",
    ring: "#0b6e63",
    ...LIGHT_STATUS,
    neutral: "#eef1ef",
    "neutral-foreground": "#3b4a44",
    success: "#e3f1ee",
    "success-foreground": "#0a5a51",
  },
  // Fresh green: off-white, deep forest primary, moss (#7FB069) highlights.
  green: {
    scheme: "light",
    background: "#f7f7f2",
    foreground: "#1a2b21",
    card: "#ffffff",
    "card-foreground": "#1a2b21",
    popover: "#ffffff",
    "popover-foreground": "#1a2b21",
    primary: "#1f3d2b",
    "primary-hover": "#172f21",
    "primary-foreground": "#ffffff",
    accent: "#e7f0e0",
    "accent-foreground": "#2e5220",
    muted: "#eff1ea",
    "muted-foreground": "#4d5a4f",
    border: "#e3e6dc",
    input: "#cdd3c6",
    ring: "#1f3d2b",
    ...LIGHT_STATUS,
    neutral: "#eff1ea",
    "neutral-foreground": "#3e4a40",
    success: "#e7f0e0",
    "success-foreground": "#2e5220",
  },
  // Calm blue: misty background, deep sea primary, sea-glass (#7FB7BE) highlights.
  blue: {
    scheme: "light",
    background: "#f2f6f8",
    foreground: "#13232d",
    card: "#ffffff",
    "card-foreground": "#13232d",
    popover: "#ffffff",
    "popover-foreground": "#13232d",
    primary: "#1b3a4b",
    "primary-hover": "#152e3c",
    "primary-foreground": "#ffffff",
    accent: "#ddeef0",
    "accent-foreground": "#1d5059",
    muted: "#eaf0f3",
    "muted-foreground": "#4a5b65",
    border: "#dee6ea",
    input: "#c9d4da",
    ring: "#1b3a4b",
    ...LIGHT_STATUS,
    neutral: "#eaf0f3",
    "neutral-foreground": "#3a4a53",
    success: "#ddeef0",
    "success-foreground": "#1d5059",
  },
  // Dark: deep navy, soft light text, a toned-down green accent.
  dark: {
    scheme: "dark",
    background: "#0b0f19",
    foreground: "#e6e9f2",
    card: "#141a27",
    "card-foreground": "#e6e9f2",
    popover: "#18202f",
    "popover-foreground": "#e6e9f2",
    primary: "#5cd6a0",
    "primary-hover": "#7be0b3",
    "primary-foreground": "#0b0f19",
    accent: "#16302a",
    "accent-foreground": "#8fe6c0",
    muted: "#1c2433",
    "muted-foreground": "#a3abbd",
    border: "#263044",
    input: "#3a4660",
    ring: "#5cd6a0",
    danger: "#3a1517",
    "danger-foreground": "#ffb4ab",
    "danger-solid": "#d63d3d",
    warning: "#33250d",
    "warning-foreground": "#f5c26b",
    "warning-solid": "#d68a1c",
    neutral: "#1c2433",
    "neutral-foreground": "#c3c9d6",
    success: "#16302a",
    "success-foreground": "#8fe6c0",
  },
};

/** Browser/PWA chrome colour (status bar on phones). */
export function themeColor(theme: Theme) {
  return theme === "dark" ? THEME_TOKENS.dark.background : THEME_TOKENS[theme].primary;
}

function block(selector: string, t: ThemeTokens) {
  const vars = Object.entries(t)
    .filter(([k]) => k !== "scheme")
    .map(([k, v]) => `--${k}:${v};`)
    .join("");
  return `${selector}{color-scheme:${t.scheme};${vars}}`;
}

/** CSS custom properties for every theme, keyed by <html data-theme>. */
export function themeCss() {
  return [
    block(':root,[data-theme="teal"],[data-theme="auto"]', THEME_TOKENS.teal),
    block('[data-theme="green"]', THEME_TOKENS.green),
    block('[data-theme="blue"]', THEME_TOKENS.blue),
    block('[data-theme="dark"]', THEME_TOKENS.dark),
    `@media (prefers-color-scheme: dark){${block('[data-theme="auto"]', THEME_TOKENS.dark)}}`,
  ].join("\n");
}

// --- Contrast (WCAG 2.x) ---------------------------------------------------

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text/background pairs the UI actually uses, with the minimum ratio each needs. */
export function contrastPairs(t: ThemeTokens): { name: string; fg: string; bg: string; min: number }[] {
  const text = 4.5;
  const ui = 3;
  return [
    { name: "foreground/background", fg: t.foreground, bg: t.background, min: text },
    { name: "foreground/card", fg: t["card-foreground"], bg: t.card, min: text },
    { name: "popover", fg: t["popover-foreground"], bg: t.popover, min: text },
    { name: "muted-foreground/card", fg: t["muted-foreground"], bg: t.card, min: text },
    { name: "muted-foreground/background", fg: t["muted-foreground"], bg: t.background, min: text },
    { name: "muted-foreground/muted", fg: t["muted-foreground"], bg: t.muted, min: text },
    { name: "primary button", fg: t["primary-foreground"], bg: t.primary, min: text },
    { name: "primary button hover", fg: t["primary-foreground"], bg: t["primary-hover"], min: text },
    { name: "primary text/card", fg: t.primary, bg: t.card, min: text },
    { name: "primary text/background", fg: t.primary, bg: t.background, min: text },
    { name: "accent", fg: t["accent-foreground"], bg: t.accent, min: text },
    { name: "danger badge", fg: t["danger-foreground"], bg: t.danger, min: text },
    { name: "warning badge", fg: t["warning-foreground"], bg: t.warning, min: text },
    { name: "neutral badge", fg: t["neutral-foreground"], bg: t.neutral, min: text },
    { name: "success badge", fg: t["success-foreground"], bg: t.success, min: text },
    { name: "danger text/card", fg: t["danger-foreground"], bg: t.card, min: text },
    { name: "warning text/card", fg: t["warning-foreground"], bg: t.card, min: text },
    { name: "danger button (white text)", fg: "#ffffff", bg: t["danger-solid"], min: text },
    { name: "focus ring/background", fg: t.ring, bg: t.background, min: ui },
    { name: "danger meter/muted", fg: t["danger-solid"], bg: t.muted, min: ui },
    { name: "warning meter/muted", fg: t["warning-solid"], bg: t.muted, min: ui },
    { name: "primary meter/muted", fg: t.primary, bg: t.muted, min: ui },
  ];
}
