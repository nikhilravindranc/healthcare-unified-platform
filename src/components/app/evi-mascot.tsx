import { cn } from "@/lib/utils";

/** Crop rectangles (px) of each character in public/evi-agents.webp (2000x667). */
const SHEET = { src: "/evi-agents.webp", w: 2000 };
const SPRITES = [
  { x: 180, y: 0, w: 520, h: 350 },   // 0 checklist: Follow-up
  { x: 720, y: 0, w: 560, h: 350 },   // 1 calendar: Appointment
  { x: 1320, y: 0, w: 520, h: 350 },  // 2 refresh: Recall
  { x: 240, y: 350, w: 420, h: 317 }, // 3 notes: Visit preparation
  { x: 760, y: 350, w: 520, h: 317 }, // 4 alert: No-show
  { x: 1340, y: 350, w: 480, h: 317 },// 5 chart: Insights
];
export const AGENT_SPRITE: Record<string, number> = { followup: 0, appointment: 1, recall: 2, prep: 3, noshow: 4, insights: 5 };

function Crop({ src, imgW, r, width, className, label }: { src: string; imgW: number; r: { x: number; y: number; w: number; h: number }; width: number; className?: string; label?: string }) {
  const s = width / r.w;
  return (
    <span className={cn("block shrink-0 overflow-hidden", className)} style={{ width, height: r.h * s }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} style={{ width: imgW * s, maxWidth: "none", marginLeft: -r.x * s, marginTop: -r.y * s }} />
    </span>
  );
}

/** Small EVI with a cue for one of the six agents. Decorative. */
export function EviSprite({ index, width = 56, className }: { index: number; width?: number; className?: string }) {
  return <Crop src={SHEET.src} imgW={SHEET.w} r={SPRITES[index]} width={width} className={className} />;
}

/** EVI peeking and waving. Used sparingly: guide and the empty EVI panel. */
export function EviPeek({ width = 120, className }: { width?: number; className?: string }) {
  return <Crop src="/evi.webp" imgW={1536} r={{ x: 150, y: 0, w: 1330, h: 940 }} width={width} className={className} />;
}

/** Round face crop for chat headers. */
export function EviAvatar({ size = 26 }: { size?: number }) {
  const s = size / 640;
  return (
    <span aria-hidden className="block shrink-0 overflow-hidden rounded-full bg-[#EAF3FB] ring-1 ring-line" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/evi.webp" alt="" draggable={false} style={{ width: 1536 * s, maxWidth: "none", marginLeft: -300 * s, marginTop: -330 * s }} />
    </span>
  );
}
