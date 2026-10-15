"use client";
import { BrandLogo } from "@/components/ui/brand-logo";
import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarClock, Check, Phone, ShieldCheck } from "lucide-react";
import { BannerSurface } from "@/components/ui/banner";
import { Button, Logo } from "@/components/ui";
import { fmtTime } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { moduleEnabled } from "@/platform/modules";

/** The public (patient-facing) frame for online booking. It has no staff navigation and shows no internal data. */
export function PublicShell({ children, title, subtitle, narrow }: { children: React.ReactNode; title?: string; subtitle?: string; narrow?: boolean }) {
  const st = useSettings();
  const embed = useSearchParams().get("embed") === "1";
  const q = embed ? "?embed=1" : "";
  // Embedded in another site: tell the parent page how tall the content is so it can resize the frame.
  useEffect(() => {
    if (!embed || window.parent === window) return;
    const send = () => window.parent.postMessage({ type: "evoq-booking-height", height: document.documentElement.scrollHeight }, "*");
    send();
    const ro = new ResizeObserver(send);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [embed]);
  if (embed) return (
    <div className="min-h-screen bg-white px-3 pb-6 pt-4 sm:px-5">
      <div className={cn("mx-auto", narrow ? "max-w-xl" : "max-w-6xl")}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>{title && <h1 className="text-xl font-semibold tracking-tight">{title}</h1>}{subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-600">{subtitle}</p>}</div>
          <Link href={`/book/manage${q}`}><Button size="sm" variant="secondary"><CalendarClock className="size-4" aria-hidden />Manage booking</Button></Link>
        </div>
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#cfe3f5] bg-active px-2.5 py-1 text-xs font-medium text-primary"><ShieldCheck className="size-3.5" aria-hidden />Demo booking. Sample availability, no confirmation is sent.</p>
        {children}
      </div>
    </div>
  );
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "linear-gradient(160deg, var(--canvas-1) 0%, var(--canvas-2) 50%, var(--canvas-3) 100%) fixed" }}>
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/book" className="flex min-w-0 items-center gap-3" aria-label={`${st.clinicName}, book an appointment`}>
            <BrandLogo height={26} />
            <span className="hidden h-6 w-px bg-line sm:block" aria-hidden />
            <span className="hidden truncate text-sm font-medium text-slate-600 sm:block">{st.clinicName}</span>
          </Link>
          <div className="flex items-center gap-2">
            {st.phone && <a href={`tel:${st.phone.replace(/[^\d+]/g, "")}`} className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-cloud md:inline-flex"><Phone className="size-3.5" aria-hidden />{st.phone}</a>}
            <Link href="/book/manage"><Button size="sm" variant="secondary"><CalendarClock className="size-4" aria-hidden />Manage booking</Button></Link>
          </div>
        </div>
      </header>

      <div className={cn("mx-auto w-full px-4 pt-6 sm:px-6", narrow ? "max-w-xl" : "max-w-7xl")}>
        <BannerSurface variant="booking" className={cn("px-5 py-6 sm:px-8", narrow ? "" : "lg:py-9")}>
          <div className={cn("max-w-2xl", !narrow && "lg:max-w-[52%]")}>
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/75 px-2.5 py-1 text-xs font-medium text-primary"><ShieldCheck className="size-3.5" aria-hidden />Demo booking page</p>
            {title && <h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">{title}</h1>}
            {subtitle && <p className="mt-1.5 text-[15px] text-slate-700">{subtitle}</p>}
            {!narrow && <ul className="mt-4 flex flex-wrap gap-2 text-[13px] text-slate-700">{["No account needed", "Choose your provider or any available", "Change or cancel online"].map((t) => <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1 shadow-sm"><Check className="size-3.5 text-primary" aria-hidden />{t}</li>)}</ul>}
            <p className="mt-3 max-w-xl text-xs text-slate-600">Times are sample availability, not real-time. No confirmation email or text is sent. Bookings made here appear in the practice&apos;s appointments for this demo session.</p>
          </div>
        </BannerSurface>
      </div>

      <main className={cn("mx-auto w-full flex-1 px-4 pb-16 pt-6 sm:px-6", narrow ? "max-w-xl" : "max-w-7xl")}>{children}</main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted sm:px-6">
          <span>{st.clinicName} · Open {fmtTime(st.openTime)} to {fmtTime(st.closeTime)}</span>
          <Link href="/book/manage" className="font-medium text-primary hover:underline">Change or cancel a booking</Link>
        </div>
      </footer>
    </div>
  );
}

/** Whether public booking is switched on, from the module switch and the booking settings. */
export function useBookingAvailable() {
  const st = useSettings();
  return moduleEnabled("booking", st.modules) && st.booking.enabled;
}
