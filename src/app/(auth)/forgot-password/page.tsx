"use client";
import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLink, AuthShell, AuthTitle } from "@/components/auth/shell";
import { Button, Field, Input } from "@/components/ui";
import { forgotSchema } from "@/lib/schemas";
import type { z } from "zod";

export default function ForgotPage() {
  const [sent, setSent] = useState<string | null>(null);
  const f = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  const { errors, isSubmitting } = f.formState;

  if (sent)
    return (
      <AuthShell>
        <div className="mb-4 grid size-11 place-items-center rounded-full bg-active text-primary"><MailCheck className="size-5" /></div>
        <AuthTitle title="Check your email" text="If an account exists for this email, password reset instructions have been sent." />
        <Link href="/sign-in"><Button className="w-full">Back to sign in</Button></Link>
        <p className="mt-5 text-center text-sm text-muted">Didn&apos;t get it? Check spam, or <Link href="/reset-password" className="font-medium text-primary hover:underline">open the demo reset link</Link>.</p>
      </AuthShell>
    );
  return (
    <AuthShell>
      <AuthTitle title="Reset your password" text="Enter your email address and we'll send instructions to reset your password." />
      <form noValidate className="space-y-4" onSubmit={f.handleSubmit(async (v) => { await new Promise((r) => setTimeout(r, 700)); setSent(v.email); })}>
        <Field label="Email address" error={errors.email?.message}><Input type="email" autoComplete="email" {...f.register("email")} /></Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Send reset link</Button>
      </form>
      <p className="mt-6 text-center text-sm"><AuthLink href="/sign-in">Return to sign in</AuthLink></p>
    </AuthShell>
  );
}
