"use client";
import { useSyncExternalStore } from "react";

export const DEMO = { email: "dr.patel@brightwellclinic.com", password: "Practice#2026", name: "Dr. Aarav Patel", first: "Aarav" };
export interface Session { email: string; name: string; first: string; practice: string }
interface Account { email: string; password: string; name: string; first: string; practice?: string }

const SKEY = "pms.session", AKEY = "pms.accounts";
const listeners = new Set<() => void>();
const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} listeners.forEach((l) => l()); };

let cache: { raw: string | null; val: Session | null } = { raw: "__init__", val: null };
function snapshot(): Session | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(SKEY); } catch {}
  if (raw !== cache.raw) cache = { raw, val: raw ? JSON.parse(raw) : null };
  return cache.val;
}
export function useSession() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, snapshot, () => undefined as unknown as Session | null);
}

const accounts = () => read<Account[]>(AKEY, []);
export const auth = {
  emailExists: (email: string) => email.toLowerCase() === DEMO.email || accounts().some((a) => a.email === email.toLowerCase()),
  async signIn(email: string, password: string) {
    await new Promise((r) => setTimeout(r, 700));
    if (email.toLowerCase().includes("offline")) throw new Error("network");
    const e = email.toLowerCase();
    let acct: Account | undefined = e === DEMO.email && password === DEMO.password ? { ...DEMO, practice: "Brightwell Clinic" } : undefined;
    acct ??= accounts().find((a) => a.email === e && a.password === password);
    if (!acct) throw new Error("invalid");
    write(SKEY, { email: acct.email, name: acct.name, first: acct.first, practice: acct.practice ?? "Your practice" });
  },
  async signUp(v: { first: string; last: string; email: string; password: string }) {
    await new Promise((r) => setTimeout(r, 800));
    if (auth.emailExists(v.email)) throw new Error("duplicate");
    write(AKEY, [...accounts(), { email: v.email.toLowerCase(), password: v.password, name: `${v.first} ${v.last}`, first: v.first }]);
    sessionStorage.setItem("pms.pending", v.email.toLowerCase());
  },
  /** Called after email verification: signs the new account in. */
  activatePending() {
    const e = sessionStorage.getItem("pms.pending");
    const a = accounts().find((x) => x.email === e);
    if (a) write(SKEY, { email: a.email, name: a.name, first: a.first, practice: a.practice ?? "Your practice" });
  },
  /** True the first time this account signs in; the welcome page marks it seen. */
  needsWelcome(email: string) { try { return localStorage.getItem("pms.welcomed." + email.toLowerCase()) !== "1"; } catch { return false; } },
  markWelcomed(email: string) { try { localStorage.setItem("pms.welcomed." + email.toLowerCase(), "1"); } catch {} },
  setPractice(name: string) {
    const s = snapshot(); if (!s) return;
    write(AKEY, accounts().map((a) => (a.email === s.email ? { ...a, practice: name } : a)));
    write(SKEY, { ...s, practice: name });
  },
  signOut() { try { localStorage.removeItem(SKEY); } catch {} cache = { raw: "__init__", val: null }; listeners.forEach((l) => l()); },
};
