// components/AppShell.tsx
//
// The signed-in frame: checks there is a session, and shows the five-tab
// bottom bar (Home · Trips · Pickups · Money · Profile) on the main tabs.
// Detail screens (a trip, a pickup, a receipt…) hide the bar so their own
// big action button sits at the bottom instead.
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClipboardList, Home, RotateCcw, User, Wallet } from "lucide-react";
import { getToken } from "@/lib/api";
import { FullLoader } from "./ui";

const TABS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/jobs", label: "Trips", icon: ClipboardList },
  { href: "/pickups", label: "Pickups", icon: RotateCcw },
  { href: "/earnings", label: "Money", icon: Wallet },
  { href: "/profile", label: "Profile", icon: User },
];

/** The main tabs — the only screens with the bottom bar. */
const TAB_ROOTS = ["/dashboard", "/jobs", "/pickups", "/earnings", "/profile", "/history", "/support"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/dashboard";
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // No token, no app. Checked here because the token lives in localStorage.
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return <FullLoader />;

  const showNav = TAB_ROOTS.includes(pathname);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`) || (href === "/profile" && (pathname === "/history" || pathname === "/support"));

  return (
    <>
      {children}
      {showNav && (
        <nav className="pb-safe fixed bottom-0 left-1/2 z-40 grid w-full max-w-[480px] -translate-x-1/2 grid-cols-5 gap-1 border-t border-line bg-white/95 px-2 pt-2 backdrop-blur">
          {TABS.map((t) => {
            const on = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10.5px] font-bold transition-colors ${
                  on ? "bg-brand-light text-brand" : "text-ink-muted"
                }`}
              >
                <t.icon size={20} strokeWidth={on ? 2.4 : 2} />
                {t.label}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
