"use client";
import Link from "next/link";
import { Button, Logo } from "@/components/ui";
import { useEffect } from "react";
import { auth, useSession } from "@/lib/auth";

export default function WelcomePage() {
  const s = useSession();
  useEffect(() => { if (s) auth.markWelcomed(s.email); }, [s]);
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-white px-5">
      <div className="soft-gradient pointer-events-none absolute inset-x-0 top-0 h-56 opacity-60 [mask-image:linear-gradient(#000,transparent)]" aria-hidden />
      <div className="relative w-full max-w-lg text-center">
        <div className="mb-8 flex justify-center"><Logo height={34} /></div>
        <h1 className="text-[30px] font-semibold tracking-tight">Welcome to your practice{s?.first ? `, ${s.first}` : ""}</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-muted">Your practice workspace is ready. Start with today&apos;s schedule or add your first patient.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/calendar"><Button className="w-full sm:w-auto">View today&apos;s schedule</Button></Link>
          <Link href="/patients?new=1"><Button variant="secondary" className="w-full sm:w-auto">Add your first patient</Button></Link>
        </div>
        <div className="mt-6 flex justify-center gap-5 text-sm font-medium text-primary"><Link href="/overview?guide=1" className="hover:underline">Take a 2-minute tour</Link><Link href="/overview" className="hover:underline">Explore the practice</Link></div>
      </div>
    </main>
  );
}
