"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthShell, AuthTitle, PasswordInput, PasswordRules } from "@/components/auth/shell";
import { Button, Field } from "@/components/ui";
import { resetSchema } from "@/lib/schemas";
import type { z } from "zod";

export default function ResetPage() {
  const [done, setDone] = useState(false);
  const f = useForm<z.input<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } });
  const { errors, isSubmitting } = f.formState;
  const pw = f.watch("password");

  if (done)
    return (
      <AuthShell>
        <div className="mb-4 grid size-11 place-items-center rounded-full bg-[#EAF7F4] text-[#2A8577]"><CheckCircle2 className="size-5" /></div>
        <AuthTitle title="Password updated" text="Your password has been changed successfully." />
        <Link href="/sign-in"><Button className="w-full">Sign in</Button></Link>
      </AuthShell>
    );
  return (
    <AuthShell>
      <AuthTitle title="Choose a new password" text="Create a password you haven't used before." />
      <form noValidate className="space-y-4" onSubmit={f.handleSubmit(async () => { await new Promise((r) => setTimeout(r, 700)); setDone(true); })}>
        <Field label="New password" error={pw.length === 0 ? errors.password?.message : undefined}><PasswordInput autoComplete="new-password" {...f.register("password")} /></Field>
        <PasswordRules value={pw} />
        <Field label="Confirm password" error={errors.confirm?.message}><PasswordInput autoComplete="new-password" {...f.register("confirm")} /></Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Reset password</Button>
      </form>
    </AuthShell>
  );
}
