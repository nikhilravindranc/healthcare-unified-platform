"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLink, AuthShell, AuthTitle, PasswordInput, PasswordRules } from "@/components/auth/shell";
import { Alert, Button, Checkbox, Field, Input } from "@/components/ui";
import { signUpSchema } from "@/lib/schemas";
import { auth } from "@/lib/auth";
import type { z } from "zod";

type V = z.input<typeof signUpSchema>;

export default function SignUpPage() {
  const router = useRouter();
  const [err, setErr] = useState<"duplicate" | "network" | null>(null);
  const f = useForm<V>({ resolver: zodResolver(signUpSchema), defaultValues: { first: "", last: "", email: "", password: "", confirm: "", terms: false as unknown as true } });
  const { errors, isSubmitting } = f.formState;
  const pw = f.watch("password");

  const submit = f.handleSubmit(async (v) => {
    setErr(null);
    try { await auth.signUp(v); router.push("/verify-email"); }
    catch (e) { setErr((e as Error).message === "duplicate" ? "duplicate" : "network"); }
  });

  return (
    <AuthShell>
      <AuthTitle title="Start managing your practice" text="Create your EVOQ Practice Management account." />
      <form onSubmit={submit} noValidate className="space-y-4">
        {err === "duplicate" && <Alert tone="error" title="An account already exists for this email">Try <AuthLink href="/sign-in">signing in</AuthLink> or reset your password.</Alert>}
        {err === "network" && <Alert tone="error" title="Couldn't create your account">Check your connection and try again.</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.first?.message}><Input autoComplete="given-name" {...f.register("first")} /></Field>
          <Field label="Last name" error={errors.last?.message}><Input autoComplete="family-name" {...f.register("last")} /></Field>
        </div>
        <Field label="Work email" error={errors.email?.message}><Input type="email" autoComplete="email" {...f.register("email")} /></Field>
        <Field label="Password" error={errors.password?.message && pw.length === 0 ? errors.password.message : undefined}><PasswordInput autoComplete="new-password" {...f.register("password")} /></Field>
        <PasswordRules value={pw} />
        <Field label="Confirm password" error={errors.confirm?.message}><PasswordInput autoComplete="new-password" {...f.register("confirm")} /></Field>
        <div>
          <Controller control={f.control} name="terms" render={({ field }) => (
            <Checkbox checked={!!field.value} onChange={field.onChange} label={<>I agree to the <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Privacy Policy</a>.</>} />
          )} />
          {errors.terms && <p role="alert" className="mt-1.5 text-xs text-danger">{errors.terms.message}</p>}
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>{isSubmitting ? "Creating account" : "Create account"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Already have an account? <AuthLink href="/sign-in">Sign in</AuthLink></p>
    </AuthShell>
  );
}
