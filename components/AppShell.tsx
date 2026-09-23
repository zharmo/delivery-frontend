// components/AppShell.tsx
//
// The signed-in shell: sidebar on desktop (for dispatch staff at a desk),
// bottom navigation on mobile (for drivers on a phone, thumb at the bottom
// of the screen).
//
// The app is organised around TRIPS, not parcels. A trip is one customer's
// whole basket — every shop it came from, collected on one journey — so
// "My Trips" is the driver's main screen and the active tab points at the
// trip they are in the middle of.
//
// "Active" is hidden when there is nothing in progress, rather than shown
// as a dead tab — a driver should never tap something that does nothing.
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ClipboardList, History, Home, LifeBuoy, LogOut, Navigation, Truck, User,
} from "lucide-react";
import { getToken } from "@/lib/api";
import { logout, storedUser } from "@/lib/deliveries";
import { getJobDashboard, type Job } from "@/lib/jobs";
import { LoadingState } from "./ui";

// desktopOnly keeps the bottom bar on a phone down to five thumb-sized
// targets. "Active Trip" is the one left out, because the dashboard
// already puts the active trip in a full-width card at the top.
const NAV: {
  href: string;
  label: string;
  mobileLabel: string;
  icon: React.ElementType;
  desktopOnly?: boolean;
}[] = [
  { href: "/dashboard", label: "Dashboard", mobileLabel: "Home", icon: Home },
  { href: "/jobs", label: "My Trips", mobileLabel: "Trips", icon: ClipboardList },
  { href: "__active__", label: "Active Trip", mobileLabel: "Active", icon: Navigation, desktopOnly: true },
  { href: "/history", label: "History", mobileLabel: "History", icon: History },
  { href: "/profile", label: "Profile", mobileLabel: "Profile", icon: User },
  { href: "/support", label: "Support", mobileLabel: "Support", icon: LifeBuoy },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<Job | null>(null);
  const user = storedUser();

  // Guard: no token, no app. Checked on the client because the token lives
  // in localStorage (same approach as the seller dashboard).
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  // Which trip the "Active" tab points at. Refreshed on navigation so the
  // tab appears as soon as the office gives the driver a basket.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getJobDashboard()
      .then((d) => {
        if (!cancelled) setActive(d.activeJob);
      })
      .catch(() => {
        /* the page itself will surface any real problem */
      });
    return () => {
      cancelled = true;
    };
  }, [ready, pathname]);

  if (!ready) return <LoadingState label="Checking your session…" />;

  const items = NAV.map((item) => ({
    ...item,
    resolvedHref: item.href === "__active__" ? (active ? `/jobs/${active.id}` : null) : item.href,
  })).filter((item) => item.resolvedHref !== null) as (typeof NAV[number] & { resolvedHref: string })[];

  const mobileItems = items.filter((item) => !item.desktopOnly);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-surface-page md:flex">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex md:h-screen md:w-[240px] md:shrink-0 md:flex-col md:border-r md:border-line md:bg-white md:sticky md:top-0">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand">
            <Truck className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-[14px] font-extrabold leading-tight text-ink">Bakhaar</div>
            <div className="text-[11px] font-bold leading-tight text-accent">DELIVERY</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.resolvedHref}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold ${
                isCurrent(item.resolvedHref) ? "bg-brand-light text-brand" : "text-ink-soft"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          {user && (
            <div className="mb-2 px-2">
              <div className="truncate text-[12.5px] font-bold text-ink">{user.name}</div>
              <div className="truncate text-[11px] text-ink-faint">{user.email}</div>
            </div>
          )}
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-[#D9540F]"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="flex items-center gap-2 border-b border-line bg-white px-4 py-3 md:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
            <Truck className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-extrabold leading-tight text-ink">Bakhaar Delivery</div>
            {user && <div className="text-[10.5px] leading-tight text-ink-faint">{user.name}</div>}
          </div>
          <button onClick={logout} aria-label="Log out" className="p-1.5">
            <LogOut className="h-4 w-4 text-[#D9540F]" />
          </button>
        </header>

        {/* pb-24 on mobile keeps content clear of the bottom nav */}
        <main className="mx-auto max-w-[760px] px-4 pb-24 pt-4 md:px-6 md:pb-10">{children}</main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white md:hidden">
        {mobileItems.map((item) => {
          const current = isCurrent(item.resolvedHref);
          return (
            <Link
              key={item.href}
              href={item.resolvedHref}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5"
            >
              <item.icon className={`h-[18px] w-[18px] ${current ? "text-brand" : "text-ink-faint"}`} />
              <span className={`text-[9.5px] font-bold ${current ? "text-brand" : "text-ink-faint"}`}>
                {item.mobileLabel}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}