// app/login/page.tsx
//
// Delivery staff sign-in. Hits /delivery/auth/login, which only accepts
// accounts with the delivery role — a seller or customer signing in here is
// refused by the backend, not by a check in this page.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Truck } from "lucide-react";
import { getToken } from "@/lib/api";
import { login } from "@/lib/deliveries";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Don't make them do it again.
  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  // The email is remembered between shifts; the password never is.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("bakhaar_delivery_email");
      if (saved) setEmail(saved);
    } catch {
      /* ignore */
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      try {
        if (remember) window.localStorage.setItem("bakhaar_delivery_email", email.trim());
        else window.localStorage.removeItem("bakhaar_delivery_email");
      } catch {
        /* ignore */
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-surface-page px-5 py-10">
      <div className="mx-auto w-full max-w-[400px]">
        {/* Brand */}
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand">
            <Truck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-[24px] font-extrabold leading-tight text-ink">Bakhaar Delivery</h1>
          <p className="mt-1 text-[13px] text-ink-muted">Sign in to see today&apos;s deliveries.</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-5 shadow-[0_4px_14px_rgba(16,24,32,0.05)]">
          <label className="mb-1.5 block text-[12.5px] font-bold text-ink">Email</label>
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            placeholder="driver@bakhaar.so"
            className="mb-4 w-full rounded-xl border border-line bg-surface-sunken px-4 py-3.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />

          <label className="mb-1.5 block text-[12.5px] font-bold text-ink">Password</label>
          <div className="relative mb-4">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Your password"
              className="w-full rounded-xl border border-line bg-surface-sunken px-4 py-3.5 pr-12 text-[15px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-ink-faint" />
              ) : (
                <Eye className="h-4 w-4 text-ink-faint" />
              )}
            </button>
          </div>

          <label className="mb-4 flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 accent-[#0E3B2A]"
            />
            <span className="text-[12.5px] text-ink-soft">Remember my email on this phone</span>
          </label>

          {error && (
            <div className="mb-4 rounded-xl bg-[#FDEAEA] p-3">
              <p className="text-[12.5px] font-semibold leading-[1.5] text-[#C4362A]">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[15px] font-bold text-white disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign In"}
          </button>

          {/* Honest about what exists: there is no password-reset email
              service in this project, so the office resets it by hand. */}
          <p className="mt-4 text-center text-[11.5px] leading-[1.6] text-ink-faint">
            Forgot your password? Contact the Bakhaar office — they&apos;ll set a new one for you.
          </p>
        </form>

        <p className="mt-5 text-center text-[11px] text-ink-faint">
          For Bakhaar delivery staff only.
        </p>
      </div>
    </div>
  );
}
