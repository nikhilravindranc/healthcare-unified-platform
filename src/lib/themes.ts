import { mix, readableOnWhite } from "./palette";

/** Colour themes. Each one only changes colour variables, never layout, wording or behaviour. */
export interface Theme {
  id: string;
  name: string;
  audience: string;
  description: string;
  /** CSS variables set on the document root. Anything not listed keeps the default. */
  vars: Record<string, string>;
}

/** Builds the variable set from a handful of choices so every theme stays consistent. */
function make(c: { primary: string; hover: string; active: string; cyan: string; mint: string; lavender: string; peach: string; t: [string, string, string, string]; canvas: [string, string, string] }): Record<string, string> {
  return {
    "--primary": c.primary, "--primary-hover": c.hover, "--active": c.active, "--selected": c.active,
    "--cyan": c.cyan, "--mint": c.mint, "--lavender": c.lavender, "--peach": c.peach,
    "--t1": c.t[0], "--t2": c.t[1], "--t3": c.t[2], "--t4": c.t[3],
    "--canvas-1": c.canvas[0], "--canvas-2": c.canvas[1], "--canvas-3": c.canvas[2],
  };
}

export const THEMES: Theme[] = [
  { id: "evoq", name: "EVOQ Classic", audience: "Default", description: "The original EVOQ blue, cyan and mint.", vars: {} },
  { id: "clinic", name: "Clinic Blue", audience: "Medical clinics", description: "Calm clinical blues for everyday practice.",
    vars: make({ primary: "#2563A8", hover: "#1D4F88", active: "#E8F1FB", cyan: "#2BA6C9", mint: "#7CCFC4", lavender: "#D9E2F7", peach: "#FFE2B8", t: ["#E4EEFB", "#D5E7FA", "#D9F0F4", "#EAF6F2"], canvas: ["#F3F7FC", "#EEF4FA", "#F1F8F7"] }) },
  { id: "dental", name: "Fresh Mint", audience: "Dental practices", description: "Clean teal and mint, bright and reassuring.",
    vars: make({ primary: "#0E7C80", hover: "#0A6366", active: "#E2F5F4", cyan: "#2EB5BC", mint: "#79D6CB", lavender: "#D8EAF2", peach: "#FFE6C2", t: ["#DDF3F1", "#CDEEEA", "#E3F4F8", "#F0F9F4"], canvas: ["#F1F9F8", "#ECF6F6", "#F3FAF7"] }) },
  { id: "aesthetics", name: "Rose Quartz", audience: "Medical aesthetics", description: "Soft rose and blush with a refined feel.",
    vars: make({ primary: "#A23B64", hover: "#832F50", active: "#FBEAF1", cyan: "#C46C94", mint: "#9ED6C7", lavender: "#EBDDF5", peach: "#FFD9CC", t: ["#FBE6EE", "#F6DCEB", "#EFE3F7", "#FFEFE6"], canvas: ["#FCF5F8", "#F9F1F6", "#FBF4F1"] }) },
  { id: "dermatology", name: "Soft Sage", audience: "Dermatology", description: "Natural sage greens, gentle on the eyes.",
    vars: make({ primary: "#3B7A58", hover: "#2E6146", active: "#E8F3EC", cyan: "#4BA58C", mint: "#9BD3B4", lavender: "#E2E8DA", peach: "#F7E1BF", t: ["#E4F1E8", "#D8EBDD", "#E9F2E0", "#F3F4E4"], canvas: ["#F4F8F5", "#EFF5F0", "#F5F7EE"] }) },
  { id: "physio", name: "Active Coral", audience: "Physiotherapy", description: "Warm, energetic coral with a steady blue accent.",
    vars: make({ primary: "#B24A1A", hover: "#913B14", active: "#FDEDE3", cyan: "#2A93B0", mint: "#8DD0BB", lavender: "#E3E4F5", peach: "#FFD8B5", t: ["#FFE9DA", "#FBDDC9", "#E3EEF6", "#FFF1DD"], canvas: ["#FEF7F2", "#FBF2EB", "#F4F7FA"] }) },
  { id: "wellness", name: "Calm Lavender", audience: "Wellness", description: "Restful lavender and mist for a calm, welcoming space.",
    vars: make({ primary: "#6A4DAE", hover: "#563D8F", active: "#F0EBFA", cyan: "#7E8FD6", mint: "#A5DCCB", lavender: "#E4DBF6", peach: "#FFE3C8", t: ["#EDE6FA", "#E1D8F6", "#E2E8FA", "#EEF6F2"], canvas: ["#F8F5FD", "#F3F0FB", "#F4F7FB"] }) },
  { id: "specialty", name: "Slate Indigo", audience: "Specialty practices", description: "Composed indigo and slate that suits any specialty.",
    vars: make({ primary: "#3B4CB0", hover: "#2F3C8F", active: "#ECEEFB", cyan: "#4F8DD0", mint: "#8FCFC4", lavender: "#DADDF3", peach: "#F8E2C4", t: ["#E7EAFA", "#DADFF6", "#E0EAF6", "#EFF1F8"], canvas: ["#F5F6FC", "#F0F2FA", "#F3F6FA"] }) },
];

export const DEFAULT_THEME = "evoq";

/** A practice's own theme: three brand colours plus type, shape and icon choices. */
export interface CustomTheme {
  name: string;
  /** The practice logo, shrunk and stored as a data address. */
  logo?: string;
  primary: string; accent: string; secondary: string;
  font: "inter" | "system" | "humanist" | "serif";
  size: "compact" | "default" | "comfortable";
  corners: "sharp" | "soft" | "round";
  buttons: "square" | "rounded" | "pill";
  icons: "light" | "regular" | "bold";
}
export const DEFAULT_CUSTOM: CustomTheme = { name: "My brand", primary: "#2867b2", accent: "#26b9cf", secondary: "#7acfc5", font: "inter", size: "default", corners: "soft", buttons: "rounded", icons: "regular" };

/** Builds every colour variable from the three brand colours. Primary is darkened if white text on it would be hard to read. */
export function customColors(c: CustomTheme): Record<string, string> {
  const p = readableOnWhite(c.primary), W = "#ffffff";
  return make({
    primary: p, hover: mix(p, "#000000", 0.18), active: mix(p, W, 0.9), cyan: c.accent, mint: mix(c.secondary, W, 0.3), lavender: mix(c.secondary, W, 0.78), peach: "#FFDFAE",
    t: [mix(p, W, 0.88), mix(c.accent, W, 0.86), mix(c.secondary, W, 0.84), mix(mix(c.accent, "#FFF3DC", 0.5), W, 0.6)],
    canvas: [mix(p, W, 0.965), mix(c.accent, W, 0.95), mix(c.secondary, W, 0.95)],
  });
}

export const getTheme = (id?: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];
const KEYS = Array.from(new Set([...THEMES.flatMap((t) => Object.keys(t.vars)), ...Object.keys(customColors(DEFAULT_CUSTOM))]));
const ATTRS = ["font", "size", "corners", "buttons", "icons"] as const;

/** Applies a theme to the page by setting its colour variables. The default clears them. A custom theme also sets type, shape and icon choices. */
export function applyTheme(id?: string, custom?: CustomTheme | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  KEYS.forEach((k) => root.style.removeProperty(k));
  ATTRS.forEach((a) => root.removeAttribute(`data-${a}`));
  if (id === "custom" && custom) {
    Object.entries(customColors(custom)).forEach(([k, v]) => root.style.setProperty(k, v));
    ATTRS.forEach((a) => root.setAttribute(`data-${a}`, custom[a]));
    root.dataset.theme = "custom";
    return;
  }
  const t = getTheme(id);
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.theme = t.id;
}
