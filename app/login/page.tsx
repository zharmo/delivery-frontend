// app/login/page.tsx
//
// Sign in with the email and password the office gave you.
// A paused account goes to the "Your account is paused" screen.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, Headphones, Lock, Mail, ShieldCheck, Truck, X } from "lucide-react";
import { ApiError, getToken, markPaused } from "@/lib/api";
import { login } from "@/lib/driver";
import { OFFICE_PHONE } from "@/lib/office";
import { telHref } from "@/lib/format";
import { Button, INPUT } from "@/components/ui";
import LogoIcon from "@/components/LogoIcon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; text: string } | null>(null);

  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError({ title: "Enter your email and password.", text: "Both are on the paper the office gave you." });
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && /suspend/i.test(err.message)) {
        markPaused();
        router.replace("/paused");
        return;
      }
      if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
        setError({ title: "Wrong email or password. Try again.", text: "Check them carefully, or call the office if you are locked out." });
      } else {
        setError({ title: "Couldn't sign in.", text: err instanceof Error ? err.message : "Something went wrong — try again." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex min-h-screen flex-col px-4 pb-32 pt-10">
      <div className="flex flex-col items-center text-center">
        <LogoIcon size={64} className="drop-shadow-[0_10px_22px_rgba(6,178,99,0.28)]" />
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10.5px] font-extrabold tracking-[0.1em] text-ink-soft shadow-card">
          <Truck size={13} /> DRIVER APP
        </span>
        <h1 className="mt-3 text-[26px] font-extrabold leading-tight text-ink">Bakhaar Delivery</h1>
        <p className="mt-1 text-[12.5px] font-medium text-ink-muted">Deliveries and return pickups · Hargeisa</p>
      </div>

      <div className="mt-7 rounded-[24px] bg-white p-5 shadow-card">
        <h2 className="text-[19px] font-extrabold text-ink">Sign in to start your shift</h2>
        <p className="mt-1 text-[12.5px] text-ink-muted">Use the email and password the office gave you.</p>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-danger-light p-3.5">
            <AlertCircle size={20} className="mt-0.5 shrink-0 fill-danger text-white" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-extrabold leading-snug text-danger-deep">{error.title}</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-danger">{error.text}</p>
            </div>
            <button type="button" onClick={() => setError(null)} aria-label="Close" className="text-danger">
              <X size={17} />
            </button>
          </div>
        )}

        <label className="mt-5 flex items-center justify-between text-[12.5px] font-extrabold text-ink">
          Email <span className="text-[11px] font-semibold text-ink-faint">Office account</span>
        </label>
        <div className="relative mt-2">
          <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            className={`${INPUT} pl-11`}
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="you@bakhaar.so"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <label className="mt-4 block text-[12.5px] font-extrabold text-ink">Password</label>
        <div className="relative mt-2">
          <Lock size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            className={`${INPUT} pl-11 pr-12`}
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-ink-muted">
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {OFFICE_PHONE ? (
          <a href={telHref(OFFICE_PHONE)} className="mt-5 flex items-center justify-center gap-1.5 text-[12.5px] font-extrabold text-brand">
            <Headphones size={15} /> Forgot password? Call the office
          </a>
        ) : (
          <p className="mt-5 flex items-center justify-center gap-1.5 text-[12.5px] font-extrabold text-brand">
            <Headphones size={15} /> Forgot password? Ask the office
          </p>
        )}
      </div>

      <div className="mt-3 flex items-start gap-3 rounded-[22px] bg-white p-4 shadow-card">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand">
          <ShieldCheck size={19} />
        </div>
        <div>
          <p className="text-[13px] font-extrabold text-ink">Before you leave</p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">Charge your phone and hand in yesterday&apos;s cash at the office.</p>
        </div>
      </div>

      <div className="pb-safe fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 bg-gradient-to-t from-surface-page via-surface-page to-transparent px-4 pt-6">
        <Button type="submit" loading={busy} iconRight={ArrowRight} className="w-full">
          Sign in
        </Button>
      </div>
    </form>
  );
}