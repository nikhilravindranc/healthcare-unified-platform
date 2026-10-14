"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { EviAvatar } from "./evi-mascot";

/** Small floating EVI launcher. Greets once, then stays out of the way as a small avatar. Opens the EVI panel. */
export function EviLauncher({ onOpen }: { onOpen: () => void }) {
  const [greet, setGreet] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem("pms.eviGreeted") === "1"; } catch {}
    if (seen) return;
    const t = setTimeout(() => setGreet(true), 1200);
    return () => clearTimeout(t);
  }, []);
  const close = () => { setGreet(false); try { localStorage.setItem("pms.eviGreeted", "1"); } catch {} };
  return (
    <div className="fixed bottom-20 right-4 z-30 flex items-end gap-2 md:bottom-5 md:right-5">
      {greet && (
        <div role="status" className="anim-pop relative max-w-[220px] rounded-2xl rounded-br-sm border border-line bg-white py-2.5 pl-3.5 pr-8 text-[13px] shadow-lg">
          <button onClick={() => { close(); onOpen(); }} className="text-left"><span className="font-semibold">Hi, this is EVI,</span> your AI assistant. <span className="text-primary">Ask me anything.</span></button>
          <button onClick={close} aria-label="Dismiss greeting" className="absolute right-1.5 top-1.5 rounded p-1 text-muted hover:bg-cloud"><X className="size-3.5" /></button>
        </div>
      )}
      <button onClick={() => { close(); onOpen(); }} aria-label="Chat with EVI, your AI assistant" className="grid size-11 place-items-center rounded-full border border-line bg-white shadow-md ring-primary/0 transition hover:ring-4 hover:ring-primary/15">
        <EviAvatar size={34} />
      </button>
    </div>
  );
}
