// components/useUnread.ts — how many notifications arrived since the driver last looked.
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getNotifications, lastSeen, readPrefs, PREF_KINDS } from "@/lib/driver";
import { toDate } from "@/lib/format";

export function useUnread() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getNotifications()
        .then((list) => {
          if (cancelled) return;
          const seen = lastSeen();
          const prefs = readPrefs();
          setCount(
            list.filter((n) => {
              const key = PREF_KINDS[n.kind];
              return (!key || prefs[key]) && (toDate(n.at)?.getTime() ?? 0) > seen;
            }).length
          );
        })
        .catch(() => {
          /* the bell just shows no number */
        });
    load();
    const onSeen = () => setCount(0);
    window.addEventListener("bakhaar-notif-seen", onSeen);
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener("bakhaar-notif-seen", onSeen);
    };
  }, [pathname]);
  return count;
}
