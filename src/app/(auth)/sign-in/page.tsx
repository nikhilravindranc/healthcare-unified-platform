"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { AuthLink, AuthShell, AuthTitle, PasswordInput } from "@/components/auth/shell";
import { Alert, Button, Checkbox, Field, Input } from "@/components/ui";
import { signInSchema } from "@/lib/schemas";
import { auth, DEMO } from "@/lib/auth";
import type { z } from "zod";

type V = z.infer<typeof signInSchema>;

export default function SignInPage() {
  const router = useRouter();
  const [err, setErr] = useState<"invalid" | "network" | null>(null);
  const [remember, setRemember] = useState(true);
  const f = useForm<V>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = f.formState;

  const submit = f.handleSubmit(async (v) => {
    setErr(null);
    try { await auth.signIn(v.email, v.password); router.replace(auth.needsWelcome(v.email) ? "/welcome" : "/overview"); }
    catch (e) { setErr((e as Error).message === "network" ? "network" : "invalid"); }
  });

  return (
    <AuthShell>
      <AuthTitle title="Welcome back" text="Sign in to your practice" />
      <form onSubmit={submit} noValidate className="space-y-4">
        {err === "invalid" && <Alert tone="error" title="Incorrect email or password">Check your details and try again.</Alert>}
        {err === "network" && <Alert tone="error" title="Can't reach the server">Check your connection and try again.</Alert>}
        <Field label="Email address" error={errors.email?.message}><Input type="email" autoComplete="email" placeholder="you@yourpractice.com" {...f.register("email")} /></Field>
        <Field label="Password" error={errors.password?.message}><PasswordInput autoComplete="current-password" {...f.register("password")} /></Field>
        <div className="flex items-center justify-between">
          <Checkbox checked={remember} onChange={setRemember} label="Remember me" />
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>{isSubmitting ? "Signing in" : "Sign in"}</Button>
        <Button type="button" variant="secondary" className="w-full" onClick={() => { f.setValue("email", DEMO.email); f.setValue("password", DEMO.password); f.clearErrors(); }}>Use the demo practice account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Don&apos;t have an account? <AuthLink href="/sign-up">Create an account</AuthLink></p>
    </AuthShell>
  );
}
