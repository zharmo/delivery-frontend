// app/paused/page.tsx
//
// The office paused this driver. Nothing works until they switch it back on,
// so the screen says that plainly and gives one way out: call the office.
"use client";

import { useEffect, useState } from "react";
import { HelpCircle, Lock, MapPin, Pause, Phone, ShieldCheck, X } from "lucide-react";
import { clearPaused, clearToken } from "@/lib/api";
import { storedUser } from "@/lib/driver";
import { OFFICE_PHONE, OFFICE_WHATSAPP } from "@/lib/office";
import { initials, telHref } from "@/lib/format";
import { Button } from "@/components/ui";

export default function PausedPage() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  useEffect(() => setUser(storedUser()), []);

  function leave() {
    clearToken();
    clearPaused();
    try {
      window.localStorage.removeItem("bakhaar_delivery_user");
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen flex-col px-4 pb-36 pt-4">
      <div className="flex items-center justify-between">
        <button onClick={leave} aria-label="Back to sign in" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-card">
          <X size={19} />
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10.5px] font-extrabold tracking-[0.1em] text-ink-soft shadow-card">
          <span className="h-2 w-2 rounded-full bg-accent" /> DRIVER APP
        </span>
        {OFFICE_WHATSAPP ? (
          <a href={`https://wa.me/${OFFICE_WHATSAPP}`} aria-label="Help" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-card">
            <HelpCircle size={19} />
          </a>
        ) : (
          <span className="h-11 w-11" />
        )}
      </div>

      <div className="mt-8 flex flex-col items-center text-center">
        <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-accent-light">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-card">
            <Lock size={40} className="text-accent-deep" />
          </div>
          <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border-4 border-surface-page bg-accent text-white">
            <Pause size={14} fill="currentColor" />
          </span>
        </div>
        <h1 className="mt-6 text-[25px] font-extrabold text-ink">Your account is paused</h1>
        <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-ink-soft">
          The office has paused your account. Call them to continue.
        </p>
      </div>

      <div className="mt-7 rounded-[24px] bg-white p-4 shadow-card">
        {user && (
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[15px] font-extrabold text-ink-soft">
              {initials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-extrabold text-ink">{user.name}</p>
              <p className="truncate text-[11.5px] text-ink-muted">{user.email}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-light px-2.5 py-1 text-[10.5px] font-extrabold text-accent-deep">
              <Pause size={10} fill="currentColor" /> Paused
            </span>
          </div>
        )}
        <div className={`flex items-start gap-3 ${user ? "pt-4" : ""}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-ink-soft">
            <MapPin size={18} />
          </div>
          <div>
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Who can switch it back on</p>
            <p className="mt-0.5 text-[15px] font-extrabold text-ink">The Bakhaar office</p>
            <p className="text-[12px] text-ink-muted">Only the office can un-pause a driver account.</p>
          </div>
        </div>
        {OFFICE_PHONE && (
          <a href={telHref(OFFICE_PHONE)} className="mt-4 flex items-center gap-3 rounded-2xl bg-surface-sunken px-4 py-3.5">
            <Phone size={18} className="text-accent-tint" />
            <span className="flex-1 text-[16px] font-extrabold text-ink">{OFFICE_PHONE}</span>
          </a>
        )}
      </div>

      <div className="mt-3 flex items-start gap-3 rounded-[22px] bg-brand-mint p-4">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-[12.5px] font-semibold leading-snug text-brand">
          Your earnings are safe. Money the office owes you is still owed, and any cash you hold still has to be handed in.
        </p>
      </div>

      <div className="pb-safe fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-line bg-white px-4 pt-3">
        {OFFICE_PHONE ? (
          <Button href={telHref(OFFICE_PHONE)} icon={Phone} className="w-full">
            Call the office
          </Button>
        ) : (
          <Button onClick={leave} className="w-full">
            Back to sign in
          </Button>
        )}
        <p className="mt-2 text-center text-[11px] font-semibold text-ink-muted">
          {OFFICE_PHONE ? "Ask them to switch your account back on" : "Ask the office to switch your account back on, then sign in again"}
        </p>
      </div>
    </div>
  );
}
