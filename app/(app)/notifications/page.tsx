// app/(app)/notifications/page.tsx — what happened to you, newest first.
// Built from real events (trips given or taken back, office changes,
// return pickups, pay, cash received). Opening this page marks them read.
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Banknote, Bell, Bike, Building2, ChevronRight, RotateCcw, Send, Settings, Undo2 } from "lucide-react";
import { getNotifications, lastSeen, markSeen, readPrefs, PREF_KINDS, useAsync, type DriverNotification } from "@/lib/driver";
import { ago, dayHeading, dayKey, toDate } from "@/lib/format";
import { BackBar, EmptyState, ErrorState, Page, Skeleton } from "@/components/ui";

const KIND: Record<string, { icon: React.ElementType; cls: string }> = {
  trip: { icon: Bike, cls: "bg-brand-light text-brand" },
  taken: { icon: Undo2, cls: "bg-surface-sunken text-ink-soft" },
  office: { icon: Building2, cls: "bg-accent-light text-accent-tint" },
  pickup: { icon: RotateCcw, cls: "bg-violet-light text-violet" },
  paid: { icon: Send, cls: "bg-violet-light text-violet" },
  cash: { icon: Banknote, cls: "bg-accent-light text-accent-tint" },
};

export default function NotificationsPage() {
  const { data, loading, error, reload } = useAsync(getNotifications, []);
  const [seenBefore, setSeenBefore] = useState<number>(0);

  useEffect(() => {
    setSeenBefore(lastSeen());
  }, []);
  useEffect(() => {
    if (data) markSeen();
  }, [data]);

  const groups = useMemo(() => {
    const prefs = readPrefs();
    const list = (data ?? []).filter((n) => {
      const k = PREF_KINDS[n.kind];
      return !k || prefs[k];
    });
    const map = new Map<string, DriverNotification[]>();
    for (const n of list) {
      const d = toDate(n.at);
      const k = d ? dayKey(d) : "earlier";
      map.set(k, [...(map.get(k) ?? []), n]);
    }
    return Array.from(map.entries());
  }, [data]);

  return (
    <>
      <BackBar
        title="Notifications"
        right={
          <Link href="/profile/notifications" aria-label="Notification settings" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft active:bg-white">
            <Settings size={19} />
          </Link>
        }
      />
      <Page bottom="none">
        {loading && !data ? (
          <Skeleton rows={4} height={76} />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : groups.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" text="New trips, office changes, return pickups and payments show here." />
        ) : (
          groups.map(([key, list]) => (
            <div key={key} className="flex flex-col gap-2">
              <p className="px-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">{key === "earlier" ? "Earlier" : dayHeading(key)}</p>
              <div className="overflow-hidden rounded-[22px] bg-white shadow-card">
                {list.map((n, i) => {
                  const k = KIND[n.kind] ?? KIND.office;
                  const unread = (toDate(n.at)?.getTime() ?? 0) > seenBefore;
                  const inner = (
                    <div className={`flex items-start gap-3 px-4 py-3.5 ${i ? "border-t border-line" : ""} ${unread ? "bg-brand-light/30" : ""}`}>
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${k.cls}`}>
                        <k.icon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-extrabold leading-snug text-ink">{n.title}</p>
                        {n.body && <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-muted">{n.body}</p>}
                        <p className="mt-1 text-[11px] font-semibold text-ink-faint">{ago(n.at)}</p>
                      </div>
                      {unread && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />}
                      {n.link && !unread && <ChevronRight size={16} className="mt-2 shrink-0 text-ink-faint" />}
                    </div>
                  );
                  return n.link ? (
                    <Link key={n.id} href={n.link}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={n.id}>{inner}</div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </Page>
    </>
  );
}
