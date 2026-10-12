"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, Field, Input, Modal, Segmented, Sheet } from "@/components/ui";
import { PhotoThumb } from "./photos";
import { apiC, PATIENT_FACE } from "@/lib/clinical";
import { useAction, useClinic, usePhotos } from "@/lib/hooks";
import type { PhotoAsset, PhotoView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getSettings } from "@/lib/settings";

const AREA: Record<PhotoView, string> = { Front: "Full face", "Left profile": "Full face", "Right profile": "Full face", "Close-up (eyes)": "Periorbital", "Close-up (lips)": "Perioral" };

/** Guided photo capture: checklist of required views, camera capture with upload fallback, validation and retry. */
export function CaptureSheet({ open, onClose, patientId, visitId, stage = "Before" }: { open: boolean; onClose: () => void; patientId: string; visitId?: string; stage?: PhotoAsset["stage"] }) {
  const { config } = useClinic();
  const { data: photos } = usePhotos();
  const add = useAction(apiC.addPhoto);
  const checklist = (config.photoChecklist.length ? config.photoChecklist : ["Front"]) as PhotoView[];
  const [st, setSt] = useState(stage);
  const [view, setView] = useState<PhotoView>(checklist[0]);
  const [mode, setMode] = useState<"choose" | "camera" | "review">("choose");
  const [preview, setPreview] = useState<{ uri?: string; sample?: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(true);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => { if (open) { setSt(stage); setView(checklist[0]); setMode("choose"); setPreview(null); setErr(null); setProgress(null); setNotes(""); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  const stop = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); }, []);
  const done = (v: PhotoView) => !!photos?.some((p) => p.patientId === patientId && p.visitId === visitId && p.stage === st && p.view === v);

  const startCamera = async () => {
    setErr(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not support camera capture.");
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setMode("camera");
      setTimeout(() => { if (video.current && stream.current) { video.current.srcObject = stream.current; void video.current.play(); } }, 50);
    } catch (e) {
      const n = (e as Error).name;
      setErr(n === "NotAllowedError" ? "Camera permission was denied. Allow camera access in your browser settings, or upload a file instead." : n === "NotFoundError" ? "No camera was found on this device. Upload a file instead." : (e as Error).message || "The camera could not be started. Upload a file instead.");
    }
  };
  const snap = () => {
    const v = video.current; if (!v) return;
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d")!.drawImage(v, 0, 0);
    setPreview({ uri: c.toDataURL("image/jpeg", 0.9) }); stop(); setMode("review");
  };
  const onFile = (f?: File) => {
    setErr(null); if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setErr("Unsupported file type. Use a JPG, PNG or WebP image.");
    const mb = getSettings().maxPhotoMB; if (f.size > mb * 1024 * 1024) return setErr(`This file is larger than ${mb} MB. Choose a smaller image.`);
    const r = new FileReader();
    r.onerror = () => setErr("The file could not be read. Try again.");
    r.onload = () => { setPreview({ uri: String(r.result) }); setMode("review"); };
    r.readAsDataURL(f);
  };
  const save = async () => {
    setProgress(0);
    for (let p = 10; p <= 100; p += 30) { await new Promise((r) => setTimeout(r, 150)); setProgress(p); }
    await add.run({ patientId, visitId, date: "2026-10-07", view, stage: st, area: AREA[view], source: preview?.sample ? "demo" : preview?.uri ? "captured" : "uploaded", consent: consent ? "Granted" : "Pending", notes, uri: preview?.uri, key: preview?.sample ? PATIENT_FACE[patientId] : undefined });
    toast.success(`${view} photo saved`);
    setProgress(null); setPreview(null); setMode("choose");
    const next = checklist.find((v) => v !== view && !done(v));
    if (next) setView(next);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { stop(); onClose(); } }} title="Guided photo capture" description="Capture or upload each required view. Originals are stored unchanged." width={480}>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Segmented label="Stage" value={st} onChange={(v) => setSt(v as PhotoAsset["stage"])} options={[{ value: "Before", label: "Before" }, { value: "During", label: "During" }, { value: "After", label: "After" }]} />
          <Badge tone="lavender">{checklist.filter(done).length} of {checklist.length} views</Badge>
        </div>
        <ul className="space-y-1.5" aria-label="Photo checklist">
          {checklist.map((v) => (
            <li key={v}><button onClick={() => { setView(v); setMode("choose"); setPreview(null); stop(); }} aria-current={v === view} className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-[13px]", v === view ? "border-primary bg-active" : "border-line hover:bg-cloud/60")}>
              <span className={cn("grid size-5 place-items-center rounded-full", done(v) ? "bg-[#2A8577] text-white" : "border border-slate-300")}>{done(v) && <Check className="size-3" strokeWidth={3} />}</span>
              <span className="flex-1 font-medium">{v}</span><span className="text-xs text-muted">{done(v) ? "Captured" : "Required"}</span>
            </button></li>
          ))}
        </ul>

        {err && <Alert tone="error" title="Couldn't add photo" action={<Button size="sm" variant="secondary" onClick={() => { setErr(null); setMode("choose"); }}><RotateCcw className="size-3.5" />Retry</Button>}>{err}</Alert>}

        {mode === "choose" && (
          <div className="rounded-xl border border-dashed border-line p-4 text-center">
            <p className="text-sm font-medium">{view}</p><p className="mb-3 text-xs text-muted">Frame the patient, keep lighting and distance consistent with earlier photos.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={startCamera}><Camera className="size-4" />Use camera</Button>
              <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-cloud focus-within:ring-2 focus-within:ring-primary">
                <ImagePlus className="size-4" />Upload file<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {PATIENT_FACE[patientId] && <Button variant="ghost" onClick={() => { setPreview({ sample: true }); setMode("review"); }}>Use sample image</Button>}
            </div>
          </div>
        )}
        {mode === "camera" && (
          <div className="space-y-2">
            <video ref={video} playsInline muted className="aspect-[4/3] w-full rounded-xl bg-black object-cover" aria-label="Camera preview" />
            <div className="flex justify-between"><Button variant="secondary" onClick={() => { stop(); setMode("choose"); }}><X className="size-4" />Cancel</Button><Button onClick={snap}><Camera className="size-4" />Capture</Button></div>
          </div>
        )}
        {mode === "review" && preview && (
          <div className="space-y-3">
            <div className="mx-auto w-48 overflow-hidden rounded-xl border border-line">
              {preview.uri ? <PhotoThumb photo={{ id: "p", patientId, date: "", author: "", view, area: "", stage: st, source: "captured", consent: "Granted", notes: "", uri: preview.uri }} /> : <PhotoThumb photo={{ id: "p", patientId, date: "", author: "", view, area: "", stage: st, source: "demo", consent: "Granted", notes: "", key: PATIENT_FACE[patientId] }} />}
            </div>
            {preview.sample && <p className="text-center text-xs text-muted">Illustrative demo image. It is not a real clinical capture.</p>}
            <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></Field>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />Photography consent is on file for this patient</label>
            {progress !== null && <div className="h-1.5 rounded-full bg-cloud" role="progressbar" aria-valuenow={progress} aria-label="Upload progress"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>}
            <div className="flex justify-between"><Button variant="secondary" disabled={progress !== null} onClick={() => { setPreview(null); setMode("choose"); }}>Retake</Button><Button loading={progress !== null} onClick={save}>Save {view.toLowerCase()}</Button></div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Before/after comparison: slider or side by side. Never alters the source images. */
export function CompareDialog({ open, onClose, a, b }: { open: boolean; onClose: () => void; a?: PhotoAsset; b?: PhotoAsset }) {
  const [mode, setMode] = useState<"slider" | "side">("slider");
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const move = (x: number) => { const r = box.current!.getBoundingClientRect(); setPos(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100))); };
  if (!a || !b) return null;
  const [before, after] = a.date <= b.date ? [a, b] : [b, a];
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Compare photos" width={640}
      description={<span>Before {before.date} · After {after.date}. Illustrative demo images are labelled; no retouching is applied.</span>}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="mb-3"><Segmented label="Comparison mode" value={mode} onChange={setMode} options={[{ value: "slider", label: "Slider" }, { value: "side", label: "Side by side" }]} /></div>
      {mode === "side" ? (
        <div className="grid grid-cols-2 gap-3">{[before, after].map((p, i) => <figure key={p.id}><PhotoThumb photo={p} ar={4 / 5} className="rounded-lg" /><figcaption className="mt-1 text-xs text-muted">{i ? "After" : "Before"} · {p.date} · {p.view}</figcaption></figure>)}</div>
      ) : (
        <div>
          <div ref={box} className="relative mx-auto aspect-[4/5] max-w-sm touch-none select-none overflow-hidden rounded-lg" onPointerDown={(e) => { drag.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); move(e.clientX); }} onPointerMove={(e) => drag.current && move(e.clientX)} onPointerUp={() => (drag.current = false)}>
            <PhotoThumb photo={after} ar={4 / 5} className="absolute inset-0 size-full" />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}><PhotoThumb photo={before} ar={4 / 5} className="size-full" /></div>
            <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px] text-white">Before</span><span className="absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px] text-white">After</span>
            <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}><span className="absolute left-1/2 top-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-xs shadow">⇆</span></div>
          </div>
          <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Comparison position" className="mx-auto mt-3 block w-full max-w-sm" />
        </div>
      )}
      {(before.source === "demo" || after.source === "demo") && <p className="mt-3 text-xs text-muted">Demo set. These are illustrative stock images and do not show a verified treatment outcome.</p>}
    </Modal>
  );
}
