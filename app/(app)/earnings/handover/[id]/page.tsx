// app/(app)/earnings/handover/[id]/page.tsx — a cash handover receipt.
"use client";

import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, FileText, Landmark, UserCheck, Wallet } from "lucide-react";
import { useAsync } from "@/lib/driver";
import { getHandover } from "@/lib/pickups";
import { longDateTime, money } from "@/lib/format";
import { BackBar, Button, Card, ErrorState, FullLoader, Page, Pill, Progress } from "@/components/ui";

export default function HandoverReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const { data: h, loading, error, reload } = useAsync(() => getHandover(id), [id]);

  return (
    <>
      <BackBar title="Cash handover" kicker="Receipt" href="/earnings" />
      {loading && !h ? (
        <FullLoader />
      ) : error && !h ? (
        <Page bottom="none">
          <ErrorState message={error} onRetry={reload} />
        </Page>
      ) : h ? (
        <Page bottom="none">
          <Card className="flex items-center gap-3 py-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand">
              <CheckCircle2 size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">The office confirmed</p>
              <p className="text-[14px] font-extrabold text-ink">Cash received</p>
            </div>
            <Pill tone="brand">Received</Pill>
          </Card>

          <div className="overflow-hidden rounded-[24px] bg-white shadow-card">
            <div className="flex items-center gap-2 bg-brand px-4 py-3 text-white">
              <Landmark size={16} />
              <span className="text-[11.5px] font-extrabold uppercase tracking-[0.1em]">Bakhaar office</span>
            </div>
            <div className="flex flex-col items-center px-4 py-5 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-ink-soft">
                <Wallet size={22} />
              </span>
              <p className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">Cash handed in</p>
              <p className="text-[36px] font-extrabold leading-tight text-ink">{money(h.amount)}</p>
              <p className="text-[11.5px] text-ink-muted">US dollars · cash</p>
            </div>
            <div className="mx-4 mb-4 flex flex-col gap-2 rounded-2xl bg-surface-sunken p-3.5 text-[12.5px]">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <Clock size={13} /> Time
                </span>
                <span className="font-bold text-ink">{longDateTime(h.at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <FileText size={13} /> Receipt
                </span>
                <span className="font-mono text-[11.5px] font-bold text-ink">#{h.id.slice(0, 8).toUpperCase()}</span>
              </div>
            </div>
            <div className="border-t border-dashed border-line px-4 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-ink-soft">
                  <UserCheck size={18} />
                </span>
                <div>
                  <p className="text-[11px] font-bold text-ink-muted">Received by</p>
                  <p className="text-[15px] font-extrabold text-ink">{h.receivedBy ?? "The office"}</p>
                </div>
              </div>
              {h.note && (
                <div className="mt-3 rounded-2xl bg-surface-sunken px-3.5 py-3">
                  <p className="text-[10.5px] font-extrabold uppercase tracking-wide text-ink-muted">Note</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-soft">{h.note}</p>
                </div>
              )}
            </div>
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[15px] font-extrabold text-ink">
                <Wallet size={17} /> Your cash
              </span>
              {h.holdingNow !== null && h.holdingNow > 0 && <Pill tone="accent">To hand in</Pill>}
            </div>
            {h.holdingNow !== null && (
              <div className={`mt-3 flex items-center justify-between rounded-2xl p-3.5 ${h.holdingNow > 0 ? "bg-accent-light" : "bg-brand-light"}`}>
                <div>
                  <p className="text-[11.5px] font-bold text-ink-muted">Cash in your hands now</p>
                  <p className={`text-[24px] font-extrabold ${h.holdingNow > 0 ? "text-accent-deep" : "text-brand"}`}>{money(h.holdingNow)}</p>
                </div>
                {h.holdingNow > 0 ? <AlertTriangle size={22} className="text-accent-tint" /> : <CheckCircle2 size={22} className="text-brand" />}
              </div>
            )}
            <div className="mt-3 flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-ink-muted">You held before this</span>
                <span className="font-bold text-ink">{money(h.heldBefore)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Handed in</span>
                <span className="font-bold text-danger">−{money(h.amount)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <span className="font-extrabold text-ink">Left after this</span>
                <span className="font-extrabold text-ink">{money(h.heldAfter)}</span>
              </div>
            </div>
            {h.heldBefore > 0 && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px] font-bold text-ink-muted">
                  <span>This handover</span>
                  <span>{Math.round((h.amount / h.heldBefore) * 100)}% of what you held</span>
                </div>
                <Progress value={h.amount / h.heldBefore} />
              </div>
            )}
          </Card>
          <Button href="/earnings" variant="secondary" className="w-full">
            Back to My Money
          </Button>
        </Page>
      ) : null}
    </>
  );
}
