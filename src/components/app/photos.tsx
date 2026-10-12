"use client";
import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { FACES, PATIENT_FACE } from "@/lib/clinical";
import { getPatient } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { PhotoAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "face" | "eyes" | "lips";
const FOCUS: Record<Mode, { dy: number; tf: number }> = { face: { dy: 0, tf: 0.66 }, eyes: { dy: -0.12, tf: 1.5 }, lips: { dy: 0.25, tf: 1.7 } };

/** Crops a demo portrait around the face (or eyes / lips) using only CSS. The source file is never altered. */
export function FacePhoto({ faceKey, mode = "face", ar = 1, tf, className, zoom = 1, yBias = 0.45 }: { faceKey: string; mode?: Mode; ar?: number; tf?: number; className?: string; zoom?: number; yBias?: number }) {
  const f = FACES[faceKey];
  if (!f) return <div className={cn("bg-cloud", className)} style={{ aspectRatio: ar }} />;
  const fh = f.fs * f.w * 1.25;
  const { dy, tf: t0 } = FOCUS[mode];
  const cx = f.fx * f.w, cy = f.fy * f.h + dy * fh;
  let u = ((tf ?? t0) * zoom) / (f.fs * f.w);
  u = Math.max(u, 1 / f.w, 1 / (f.h * ar));
  const wPct = f.w * u * 100, hPct = f.h * u * ar * 100;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const left = clamp(50 - cx * u * 100, 100 - wPct, 0);
  const top = clamp(yBias * 100 - cy * u * ar * 100, 100 - hPct, 0);
  return (
    <span className={cn("relative block overflow-hidden bg-cloud", className)} style={{ aspectRatio: ar }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/people/${faceKey}.jpg`} alt="" draggable={false} className="absolute max-w-none select-none" style={{ width: `${wPct}%`, left: `${left}%`, top: `${top}%` }} />
    </span>
  );
}

/** Demo patient portrait. Illustrative stock image, not a real patient. */
export function PatientAvatar({ id, name, size = 36, className }: { id: string; name?: string; size?: number; className?: string }) {
  const key = PATIENT_FACE[id];
  const uploaded = getPatient(id)?.portrait;
  return (
    <span className={cn("block shrink-0 overflow-hidden rounded-full ring-1 ring-line", className)} style={{ width: size, height: size }} role={name ? "img" : undefined} aria-label={name} aria-hidden={name ? undefined : true}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {uploaded ? <img src={uploaded} alt="" className="size-full object-cover" /> : key ? <FacePhoto faceKey={key} ar={1} yBias={0.5} className="size-full" /> : <span className="grid size-full place-items-center bg-lavender/70 text-xs font-medium text-[#40428A]">{(name ?? "?").split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>}
    </span>
  );
}

export function PhotoThumb({ photo, ar = 4 / 5, className }: { photo: PhotoAsset; ar?: number; className?: string }) {
  if (photo.uri)
    // eslint-disable-next-line @next/next/no-img-element
    return <span className={cn("block overflow-hidden bg-cloud", className)} style={{ aspectRatio: ar }}><img src={photo.uri} alt={`${photo.view}, ${photo.stage}`} className="size-full object-cover" /></span>;
  const mode: Mode = photo.view === "Close-up (eyes)" ? "eyes" : photo.view === "Close-up (lips)" ? "lips" : "face";
  return <FacePhoto faceKey={photo.key ?? PATIENT_FACE[photo.patientId]} mode={mode} ar={ar} className={className} />;
}

/** Reads a JPG/PNG/WebP, validates size and returns a downscaled data URL. The original file is not kept or altered. */
export function fileToPortrait(file: File, maxW = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error("Unsupported file type. Use a JPG, PNG or WebP image."));
    const mb = getSettings().maxPhotoMB;
    if (file.size > mb * 1024 * 1024) return reject(new Error(`This file is larger than ${mb} MB. Choose a smaller image.`));
    const r = new FileReader();
    r.onerror = () => reject(new Error("The file could not be read. Try again."));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("This image could not be opened."));
      img.onload = () => { const k = Math.min(1, maxW / img.width); const c = document.createElement("canvas"); c.width = img.width * k; c.height = img.height * k; c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL("image/jpeg", 0.88)); };
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}

/** Optional patient photo used for identity and as the canvas for injection plotting. */
export function PortraitField({ value, onChange, name }: { value?: string; onChange: (v?: string) => void; name?: string }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium">Photo <span className="font-normal text-muted">(optional)</span></p>
      <div className="flex items-center gap-3">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-cloud text-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt={name ? `Photo of ${name}` : "Patient photo"} className="size-full object-cover" /> : <Camera className="size-5" aria-hidden />}
        </span>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-line bg-white px-3 text-[13px] font-medium hover:bg-cloud focus-within:ring-2 focus-within:ring-primary">
            {busy ? "Reading…" : value ? "Replace photo" : "Upload photo"}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setErr(""); setBusy(true); try { onChange(await fileToPortrait(f)); } catch (x) { setErr((x as Error).message); } setBusy(false); }} />
          </label>
          {value && <button type="button" onClick={() => onChange(undefined)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] text-muted hover:text-danger"><Trash2 className="size-3.5" />Remove</button>}
        </div>
      </div>
      {err ? <p role="alert" className="mt-1.5 text-xs text-danger">{err}</p> : <p className="mt-1.5 text-xs text-muted">A clear, front-facing photo works best. It is used on the patient record and as the canvas for injection plotting.</p>}
    </div>
  );
}
