/** Colour helpers for custom themes. Everything runs in the browser; nothing is uploaded anywhere. */
export type RGB = [number, number, number];

export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  return [parseInt(v.slice(0, 2), 16) || 0, parseInt(v.slice(2, 4), 16) || 0, parseInt(v.slice(4, 6), 16) || 0];
};
export const rgbToHex = ([r, g, b]: RGB) => "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
/** Blends `a` toward `b`. t = 0 is all `a`, t = 1 is all `b`. */
export const mix = (a: string, b: string, t: number) => { const x = hexToRgb(a), y = hexToRgb(b); return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); };

const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
export const luminance = (hex: string) => { const [r, g, b] = hexToRgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
/** WCAG contrast ratio between two colours (1 to 21). */
export const contrast = (a: string, b: string) => { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
/** Darkens a colour until white text on it reads clearly (at least 4.5 to 1). */
export const readableOnWhite = (hex: string) => { let c = hex, i = 0; while (contrast(c, "#ffffff") < 4.5 && i++ < 30) c = mix(c, "#000000", 0.06); return c; };

const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Finds up to three brand colours in an image: the most common colours that are not white, black or grey. */
export function dominantColors(data: Uint8ClampedArray): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const add = (strict: boolean) => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 128) continue;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (strict && (mn > 232 || mx < 28 || mx - mn < 26)) continue;
      if (!strict && (mn > 240 || a < 128)) continue;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b; buckets.set(key, e);
    }
  };
  add(true);
  if (buckets.size === 0) add(false);
  const ranked = [...buckets.values()].sort((x, y) => y.n - x.n).map((e): RGB => [e.r / e.n, e.g / e.n, e.b / e.n]);
  const out: RGB[] = [];
  for (const c of ranked) { if (out.every((o) => dist(o, c) > 70)) out.push(c); if (out.length === 3) break; }
  return out.map(rgbToHex);
}

/** Reads an image file, shrinks it for storage, and returns the logo plus its colours. */
export async function readLogo(file: File): Promise<{ dataUrl: string; colors: string[] }> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file (PNG, JPG, SVG or WebP).");
  if (file.size > 3 * 1024 * 1024) throw new Error("That image is larger than 3 MB. Please choose a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That image could not be read.")); i.src = url; });
    const scale = Math.min(1, 480 / img.width, 160 / img.height);
    const w = Math.max(1, Math.round((img.width || 160) * scale)), h = Math.max(1, Math.round((img.height || 160) * scale));
    const logo = document.createElement("canvas"); logo.width = w; logo.height = h;
    logo.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const small = document.createElement("canvas"); const k = Math.min(1, 80 / Math.max(w, h)); small.width = Math.max(1, Math.round(w * k)); small.height = Math.max(1, Math.round(h * k));
    const sctx = small.getContext("2d")!; sctx.drawImage(img, 0, 0, small.width, small.height);
    return { dataUrl: logo.toDataURL("image/png"), colors: dominantColors(sctx.getImageData(0, 0, small.width, small.height).data) };
  } finally { URL.revokeObjectURL(url); }
}
