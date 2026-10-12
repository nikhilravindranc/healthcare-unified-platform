"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthLink, AuthShell, AuthTitle } from "@/components/auth/shell";
import { Button } from "@/components/ui";
import { auth } from "@/lib/auth";

export default function VerifyPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const email = typeof window !== "undefined" ? sessionStorage.getItem("pms.pending") : null;
  return (
    <AuthShell>
      <div className="mb-4 grid size-11 place-items-center rounded-full bg-active text-primary"><MailCheck className="size-5" /></div>
      <AuthTitle title="Verify your email" text={<>We sent a verification link to <span className="font-medium text-ink">{email ?? "your email address"}</span>. Open it to finish creating your account.</>} />
      <Button className="w-full" loading={busy} onClick={async () => { setBusy(true); await new Promise((r) => setTimeout(r, 700)); auth.activatePending(); router.push("/setup"); }}>
        Verify email (demo)
      </Button>
      <Button variant="ghost" className="mt-2 w-full" onClick={() => toast.success("Verification email sent again")}>Resend email</Button>
      <p className="mt-6 text-center text-sm text-muted">Wrong address? <AuthLink href="/sign-up">Start over</AuthLink></p>
    </AuthShell>
  );
}
