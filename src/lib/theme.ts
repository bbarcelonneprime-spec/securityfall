// Custom theme engine.
// The app's brand colors are built from Tailwind's indigo → violet → fuchsia
// scale (plus a few blue shades). In Tailwind v4 every color utility resolves
// to a CSS variable (e.g. `bg-indigo-500` → `var(--color-indigo-500)`), so we
// can recolor the ENTIRE site at runtime simply by overriding those variables
// on the document root.
//
// We keep each shade's original lightness (L) and chroma (C) and only rotate
// the hue (H) by an offset, which preserves the rich multi-tone gradients while
// shifting the overall palette to whatever the user picks.

type Shade = { name: string; l: number; c: number; h: number };

// Original oklch values from Tailwind's default theme for the shades the app uses.
const SHADES: Shade[] = [
  // blue
  { name: "blue-200", l: 88.2, c: 0.059, h: 254.128 },
  { name: "blue-300", l: 80.9, c: 0.105, h: 251.813 },
  { name: "blue-400", l: 70.7, c: 0.165, h: 254.624 },
  { name: "blue-500", l: 62.3, c: 0.214, h: 259.815 },
  { name: "blue-600", l: 54.6, c: 0.245, h: 262.881 },
  { name: "blue-700", l: 48.8, c: 0.243, h: 264.376 },
  { name: "blue-900", l: 37.9, c: 0.146, h: 265.522 },
  // indigo
  { name: "indigo-200", l: 87, c: 0.065, h: 274.039 },
  { name: "indigo-300", l: 78.5, c: 0.115, h: 274.713 },
  { name: "indigo-400", l: 67.3, c: 0.182, h: 276.935 },
  { name: "indigo-500", l: 58.5, c: 0.233, h: 277.117 },
  { name: "indigo-600", l: 51.1, c: 0.262, h: 276.966 },
  { name: "indigo-700", l: 45.7, c: 0.24, h: 277.023 },
  { name: "indigo-900", l: 35.9, c: 0.144, h: 278.697 },
  // violet (293 is our reference hue)
  { name: "violet-200", l: 89.4, c: 0.057, h: 293.283 },
  { name: "violet-300", l: 81.1, c: 0.111, h: 293.571 },
  { name: "violet-400", l: 70.2, c: 0.183, h: 293.541 },
  { name: "violet-500", l: 60.6, c: 0.25, h: 292.717 },
  { name: "violet-600", l: 54.1, c: 0.281, h: 293.009 },
  { name: "violet-700", l: 49.1, c: 0.27, h: 292.581 },
  { name: "violet-900", l: 38, c: 0.189, h: 293.745 },
  // fuchsia
  { name: "fuchsia-200", l: 90.3, c: 0.076, h: 319.62 },
  { name: "fuchsia-300", l: 83.3, c: 0.145, h: 321.434 },
  { name: "fuchsia-400", l: 74, c: 0.238, h: 322.16 },
  { name: "fuchsia-500", l: 66.7, c: 0.295, h: 322.15 },
  { name: "fuchsia-600", l: 59.1, c: 0.293, h: 322.896 },
  { name: "fuchsia-700", l: 51.8, c: 0.253, h: 323.949 },
  { name: "fuchsia-900", l: 40.1, c: 0.17, h: 325.612 },
];

// Reference hue = violet-600 (the dominant brand color).
const REFERENCE_HUE = 293;

const STORAGE_KEY = "alex-custom-theme-hue";

export type ThemePreset = { id: string; label: string; hue: number; swatch: string };

// Built-in palettes. `hue` is the oklch hue of the dominant (violet) tone.
export const THEME_PRESETS: ThemePreset[] = [
  { id: "default", label: "Indigo / Violet", hue: 293, swatch: "oklch(54.1% 0.281 293)" },
  { id: "ocean", label: "Océan", hue: 245, swatch: "oklch(54.1% 0.22 245)" },
  { id: "emerald", label: "Émeraude", hue: 165, swatch: "oklch(54.1% 0.18 165)" },
  { id: "sunset", label: "Coucher de soleil", hue: 40, swatch: "oklch(60% 0.2 40)" },
  { id: "rose", label: "Rose", hue: 350, swatch: "oklch(56% 0.25 350)" },
  { id: "magenta", label: "Magenta", hue: 320, swatch: "oklch(56% 0.28 320)" },
  { id: "gold", label: "Or", hue: 85, swatch: "oklch(60% 0.16 85)" },
  { id: "teal", label: "Turquoise", hue: 195, swatch: "oklch(54% 0.13 195)" },
];

function normalizeHue(h: number): number {
  let v = h % 360;
  if (v < 0) v += 360;
  return v;
}

/** Apply a theme by rotating every brand hue to match the chosen base hue. */
export function applyThemeHue(baseHue: number) {
  if (typeof document === "undefined") return;
  const offset = baseHue - REFERENCE_HUE;
  const root = document.documentElement;
  for (const s of SHADES) {
    const h = normalizeHue(s.h + offset);
    root.style.setProperty(`--color-${s.name}`, `oklch(${s.l}% ${s.c} ${h})`);
  }
}

/** Remove all overrides, reverting to Tailwind's default palette. */
export function resetTheme() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const s of SHADES) {
    root.style.removeProperty(`--color-${s.name}`);
  }
}

export function saveThemeHue(hue: number | null) {
  try {
    if (hue == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(hue));
  } catch {
    /* ignore */
  }
}

export function loadThemeHue(): number | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Convert an sRGB hex color to its oklch hue (degrees). */
export function hexToOklchHue(hex: string): number {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const rl = lin(r), gl = lin(g), bl = lin(b);
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const mm = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(mm), s_ = Math.cbrt(s);
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  let hue = (Math.atan2(bb, a) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  return hue;
}
