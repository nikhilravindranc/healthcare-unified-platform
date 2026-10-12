"use client";
import Link from "next/link";
import { Logo, Alert } from "@/components/ui";
import { useSettings } from "@/lib/settings";
import { moduleEnabled } from "@/platform/modules";

/** The public (patient-facing) frame for online booking. It has no staff navigation and shows no internal data. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const st = useSettings();
  return (
    <div className="min-h-screen bg-cloud/40">
      <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3"><Logo height={26} /><span className="text-sm font-medium text-slate-600">{st.clinicName}</span></div></header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Alert tone="info" title="Demo booking page">Times shown are sample availability, not real-time. No confirmation email or text is sent. Bookings made here appear in the practice&apos;s appointments for this demo session.</Alert>
        <div className="mt-5">{children}</div>
        <p className="mt-8 text-center text-xs text-muted"><Link href="/book/manage" className="font-medium text-primary hover:underline">Manage an existing booking</Link></p>
      </main>
    </div>
  );
}

/** Whether public booking is switched on, from the module switch and the booking settings. */
export function useBookingAvailable() {
  const st = useSettings();
  return moduleEnabled("booking", st.modules) && st.booking.enabled;
}
