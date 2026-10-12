"use client";
import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff, Check, Circle } from "lucide-react";
import { Input, Logo } from "@/components/ui";
import { passwordRules } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export function AuthShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(420px,5fr)_7fr]">
      <aside className="relative hidden overflow-hidden bg-cloud lg:block">
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
          <Logo height={34} />
          <div className="max-w-md">
            <h2 className="text-[30px] font-semibold leading-[1.2] tracking-tight">See the whole practice day at a glance.</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Appointments, patient flow, visit documentation and follow-ups in one calm workspace for your front desk and providers.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-slate-600">
              {["Schedule and check in patients faster", "Keep clinical notes next to the appointment", "Never lose track of a follow-up"].map((t) => (
                <li key={t} className="flex items-center gap-2.5"><span className="grid size-5 place-items-center rounded-full bg-white text-primary shadow-sm"><Check className="size-3" strokeWidth={3} /></span>{t}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted">© 2026 EVOQ. Healthcare Practice Management.</p>
        </div>
        <svg className="pointer-events-none absolute -bottom-24 -right-32 size-[560px] opacity-70" viewBox="0 0 400 400" aria-hidden>
          <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#DCDDF5" /><stop offset=".55" stopColor="#BFEAF0" /><stop offset="1" stopColor="#7ACFC5" /></linearGradient></defs>
          <circle cx="220" cy="220" r="180" fill="url(#g)" /><circle cx="140" cy="260" r="110" fill="#fff" opacity=".35" />
        </svg>
      </aside>
      <main className="flex min-h-screen flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden"><Logo height={28} /></div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className={cn("w-full", wide ? "max-w-xl" : "max-w-[400px]")}>{children}</div>
        </div>
      </main>
    </div>
  );
}

export const AuthTitle = ({ title, text }: { title: string; text?: React.ReactNode }) => (
  <div className="mb-6"><h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>{text && <p className="mt-1.5 text-sm text-muted">{text}</p>}</div>
);
export const AuthLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="font-medium text-primary hover:underline">{children}</Link>
);

export const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(function PasswordInput(props, ref) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? "text" : "password"} className="pr-10" {...props} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:bg-cloud">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});

export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="grid gap-1 text-xs" aria-label="Password requirements">
      {passwordRules.map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.label} className={cn("flex items-center gap-1.5", ok ? "text-[#2A8577]" : "text-muted")}>
            {ok ? <Check className="size-3.5" /> : <Circle className="size-3" />}{r.label}<span className="sr-only">{ok ? " (met)" : " (not met)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
