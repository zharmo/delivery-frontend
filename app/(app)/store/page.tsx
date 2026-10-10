// app/(app)/store/page.tsx — refused items to take to the Bakhaar store.
//
// Items a customer refused at the door (or the shop's mistakes) stay closed
// in your bag and go to the Bakhaar store — not back to the shop. The store
// staff check each item and record it. Your pay for those trips is added
// then (if the office holds it).
"use client";

import { AlertTriangle, Clock, PackageCheck, Phone, Store, Wallet } from "lucide-react";
import { useAsync } from "@/lib/driver";
import { getMyStoreItems, type StoreItem } from "@/lib/door";
import { fileUrl } from "@/lib/jobs";
import { ago, money, telHref } from "@/lib/format";
import { OFFICE_PHONE } from "@/lib/office";
import { BackBar, BottomBar, Button, Card, EmptyState, ErrorState, Page, Pill, Skeleton } from "@/components/ui";

export default function StorePage() {
  const { data, loading, error, reload } = useAsync(getMyStoreItems, []);

  const trips = new Map<string, { jobNumber: string; items: StoreItem[] }>();
  for (const it of data?.items ?? []) {
    if (!trips.has(it.jobId)) trips.set(it.jobId, { jobNumber: it.jobNumber, items: [] });
    trips.get(it.jobId)!.items.push(it);
  }

  return (
    <>
      <BackBar title="Bakhaar store" kicker="Refused items" href="/dashboard" />
      <Page bottom={OFFICE_PHONE ? "bar" : "none"}>
        {loading && !data ? (
          <Skeleton rows={3} height={140} />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data && data.items.length === 0 ? (
          <EmptyState icon={PackageCheck} title="Nothing to bring" text="The store has every refused item from your trips." />
        ) : data ? (
          <>
            <div className="rounded-[22px] bg-accent-light p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
                  <Store size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[16px] font-extrabold text-accent-deep">Bring these to the Bakhaar store</p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-accent-deep/85">
                    Keep each bag closed. The store staff check every item and record it — then it&apos;s off your list.
                    {data.alertHours ? ` Please bring them within ${data.alertHours} hours.` : ""}
                  </p>
                </div>
              </div>
              {data.payWaiting > 0 && (
                <p className="mt-3 flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 text-[12.5px] font-bold text-ink">
                  <Wallet size={15} className="shrink-0 text-accent-tint" /> {money(data.payWaiting)} of your pay is added when the store has them.
                </p>
              )}
            </div>

            {Array.from(trips.entries()).map(([jobId, t]) => (
              <Card key={jobId}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-extrabold text-ink">Trip {t.jobNumber}</span>
                  {t.items.some((i) => i.overdue) ? <Pill tone="danger"><AlertTriangle size={11} /> Late</Pill> : <Pill tone="muted"><Clock size={11} /> {ago(t.items[0].createdAt)}</Pill>}
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {t.items.map((it) => {
                    const img = fileUrl(it.product.imageUrl);
                    return (
                      <div key={it.id} className="flex items-center gap-3 rounded-2xl bg-surface-sunken p-2.5">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={it.product.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-ink-faint"><PackageCheck size={18} /></span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-[13px] font-extrabold text-ink">{it.quantity} × {it.product.name}</p>
                          <p className="break-words text-[11.5px] text-ink-muted">{it.product.variant ? `${it.product.variant} · ` : ""}{it.shop.name}</p>
                        </div>
                        <Pill tone={it.kind === "shop_fault" ? "danger" : "muted"}>{it.kind === "shop_fault" ? "Shop's mistake" : "Refused"}</Pill>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </>
        ) : null}
      </Page>
      {OFFICE_PHONE && (
        <BottomBar>
          <Button href={telHref(OFFICE_PHONE)} variant="secondary" icon={Phone} className="w-full">Call the office</Button>
        </BottomBar>
      )}
    </>
  );
}