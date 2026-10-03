// app/(app)/jobs/[id]/refused/page.tsx — the customer refused everything.
//
// Who pays the delivery fee depends on WHY:
//   customer's choice + cash order → the customer pays the delivery fee in
//     cash; you say whether they did (Yes / No).
//   customer's choice + paid online → take no money (Bakhaar refunds the
//     products and keeps the fee).
//   shop's fault (wrong, damaged, not as described) → take no money; the
//     shop pays the delivery fee.
// You are paid for the trip in every case. All bags go back to the shops.
"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle, Ban, Banknote, CheckCircle2, CircleSlash, Coins, Info, MessageSquareText, PackageX, Shirt, Store, Undo2, Wallet, X,
} from "lucide-react";
import { errorText, useAsync } from "@/lib/driver";
import { cancelJob, getJob, JOB_CANCEL_REASONS, type JobDetail } from "@/lib/jobs";
import { money } from "@/lib/format";
import { BottomBar, Button, Card, CheckRow, ChoiceRow, ErrorState, FullLoader, INPUT, InlineError, Label, Page, Pill } from "@/components/ui";
import { itemsLine, stopFeeDue } from "@/components/trip";

const ICONS: Record<string, React.ElementType> = {
  customer_would_not_pay: Coins,
  customer_changed_mind: Undo2,
  wrong_item: Shirt,
  item_damaged: PackageX,
  not_as_described: CircleSlash,
  other: MessageSquareText,
};

type Result = { fault: "customer" | "shop"; feeCollected: number; feeRefused: boolean; refundsQueued: number; message: string };

export default function RefusedPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: job, loading, error, reload } = useAsync(() => getJob(id), [id]);
  const [reason, setReason] = useState("");
  const [feePaid, setFeePaid] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [allBack, setAllBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  if (loading && !job) return <FullLoader />;
  if (error && !job)
    return (
      <Page bottom="none" className="pt-6">
        <ErrorState message={error} onRetry={reload} />
      </Page>
    );
  if (!job) return null;
  if (result) return <Recorded job={job} result={result} />;
  if (job.status !== "ON_THE_WAY" && job.status !== "FAILED") {
    return (
      <Page bottom="none" className="pt-6">
        <ErrorState message={`This trip is ${job.statusLabel.toLowerCase()} — a refusal can't be recorded now.`} onRetry={() => router.replace(`/jobs/${job.id}`)} />
      </Page>
    );
  }

  const stops = job.stops.filter((s) => s.status === "COLLECTED");
  const fee = stops.reduce((t, s) => t + stopFeeDue(s), 0);
  const chosen = JOB_CANCEL_REASONS.find((r) => r.value === reason);
  const fault = chosen?.fault ?? null;
  const askFee = fault === "customer" && fee > 0;
  const paidOnline = stops.every((s) => s.money.isPaid || !s.money.isCod);

  const ready = Boolean(reason) && allBack && (!askFee || feePaid !== null) && (reason !== "other" || notes.trim().length > 0);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await cancelJob(job!.id, { reason, notes: notes.trim() || undefined, feePaid: askFee ? feePaid === true : undefined });
      setResult({ fault: r.fault, feeCollected: r.feeCollected, feeRefused: r.feeRefused, refundsQueued: r.refundsQueued, message: r.message });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-2.5 bg-surface-page/95 px-3 pb-2 pt-3.5 backdrop-blur">
        <button onClick={() => router.back()} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-ink active:bg-white">
          <X size={21} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">Trip {job.jobNumber}</div>
          <h1 className="truncate text-[17px] font-extrabold text-ink">Customer refused everything</h1>
        </div>
      </header>
      <Page bottom="bar">
        <Card className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-danger text-white">
            <Ban size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[17px] font-extrabold text-ink">The customer won&apos;t take anything</p>
            <p className="text-[12px] text-ink-muted">
              {job.jobNumber} · {job.customer.name}
            </p>
          </div>
        </Card>

        <Label right={<span className="text-[10.5px] font-extrabold text-danger">NEEDED</span>}>Why did they refuse?</Label>
        <div className="flex flex-col gap-2">
          {JOB_CANCEL_REASONS.map((r) => (
            <ChoiceRow
              key={r.value}
              selected={reason === r.value}
              onClick={() => {
                setReason(r.value);
                setFeePaid(null);
              }}
              icon={ICONS[r.value]}
              title={r.label}
              sub={r.hint}
              tone="danger"
              tag={<Pill tone={r.fault === "shop" ? "accent" : "muted"}>{r.fault === "shop" ? "Shop's fault" : "Customer's choice"}</Pill>}
            />
          ))}
        </div>

        {/* what happens with money */}
        {fault === "shop" && (
          <div className="flex items-start gap-3 rounded-[22px] bg-danger-light p-4">
            <Ban size={19} className="mt-0.5 shrink-0 text-danger" />
            <div>
              <p className="text-[13px] font-extrabold uppercase tracking-wide text-danger-deep">Take no money</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-danger">
                It&apos;s the shop&apos;s fault — the customer pays nothing{paidOnline ? " and gets a full refund" : ""}. The shop pays the delivery fee. You are still paid for this trip.
              </p>
            </div>
          </div>
        )}
        {fault === "customer" && !askFee && (
          <div className="flex items-start gap-3 rounded-[22px] bg-surface-sunken p-4">
            <Info size={19} className="mt-0.5 shrink-0 text-ink-muted" />
            <p className="text-[12.5px] leading-snug text-ink-soft">
              Paid online — <b>take no money</b>. Bakhaar refunds the products and keeps the delivery fee. You are still paid for this trip.
            </p>
          </div>
        )}
        {askFee && (
          <Card className="ring-2 ring-accent/30">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-tint">
                <Banknote size={19} />
              </div>
              <div>
                <p className="text-[15px] font-extrabold text-ink">Did the customer pay the {money(fee)} delivery fee?</p>
                <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">It&apos;s their choice, so they pay for the trip. Ask for {money(fee)} — not the product price.</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setFeePaid(true)}
                className={`min-h-[54px] rounded-2xl border-2 px-2 text-[13px] font-extrabold ${feePaid === true ? "border-brand bg-brand-light text-brand" : "border-line bg-white text-ink"}`}
              >
                Yes — I have {money(fee)}
              </button>
              <button
                onClick={() => setFeePaid(false)}
                className={`min-h-[54px] rounded-2xl border-2 px-2 text-[13px] font-extrabold ${feePaid === false ? "border-danger bg-danger-light text-danger" : "border-line bg-white text-ink"}`}
              >
                No — they refused
              </button>
            </div>
            {feePaid === false && (
              <p className="mt-2.5 text-[11.5px] leading-snug text-danger">
                That&apos;s fine — don&apos;t argue. It is recorded. If this phone number refuses again, cash on delivery may be blocked for it.
              </p>
            )}
            {feePaid === true && <p className="mt-2.5 text-[11.5px] leading-snug text-brand-tint">The {money(fee)} is added to the cash you hand in.</p>}
          </Card>
        )}

        <div>
          <label className="block px-1 text-[12.5px] font-extrabold text-ink">
            Note for the office <span className="font-semibold text-ink-faint">{reason === "other" ? "(needed)" : "(optional)"}</span>
          </label>
          <textarea
            className={`${INPUT} mt-2 min-h-[76px] resize-none bg-white`}
            placeholder="What did the customer say?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <CheckRow
          checked={allBack}
          onChange={setAllBack}
          title="I have all the bags back in my bag"
          sub="Every package is closed and with you — nothing left with the customer."
        />

        <Card>
          <p className="flex items-center gap-2 text-[13.5px] font-extrabold text-ink">
            <Store size={16} /> Take back to {stops.length} shop{stops.length === 1 ? "" : "s"}
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {stops.map((s) => (
              <p key={s.id} className="flex items-center gap-2 text-[12px] text-ink-soft">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span className="min-w-0 truncate">
                  <b className="text-ink">{s.shop.name}</b> · {itemsLine(s)}
                </span>
              </p>
            ))}
          </div>
        </Card>
        <InlineError message={err} />
      </Page>
      <BottomBar>
        <Button onClick={submit} loading={busy} disabled={!ready} variant="danger" icon={Ban} className="w-full">
          Cancel delivery & record refusal
        </Button>
        <button onClick={() => router.back()} className="mt-1 min-h-[44px] w-full text-[13px] font-bold text-ink-muted">
          Back to hand over
        </button>
      </BottomBar>
    </>
  );
}

function Recorded({ job, result }: { job: JobDetail; result: Result }) {
  return (
    <Page bottom="none" className="pt-8">
      <div className="flex flex-col items-center text-center">
        <div className="animate-pop flex h-20 w-20 items-center justify-center rounded-full bg-danger text-white shadow-card">
          <Ban size={36} />
        </div>
        <h1 className="mt-4 text-[24px] font-extrabold text-ink">Refusal recorded</h1>
        <p className="text-[13px] font-semibold text-ink-soft">
          Trip {job.jobNumber} · {job.customer.name}
        </p>
      </div>
      <Card>
        <div className="flex flex-col gap-2.5 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Whose fault</span>
            <Pill tone={result.fault === "shop" ? "accent" : "muted"}>{result.fault === "shop" ? "Shop's fault" : "Customer's choice"}</Pill>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Delivery fee you took</span>
            <span className="font-extrabold text-ink">{result.feeCollected > 0 ? money(result.feeCollected) : result.feeRefused ? "Refused to pay" : "None"}</span>
          </div>
          {result.refundsQueued > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Refund</span>
              <span className="font-bold text-ink">Bakhaar sends it</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Your pay for this trip</span>
            <span className="flex items-center gap-1 font-extrabold text-brand-tint">
              <CheckCircle2 size={14} /> Still paid
            </span>
          </div>
        </div>
      </Card>
      {result.feeCollected > 0 && (
        <div className="flex items-start gap-3 rounded-[22px] bg-accent-light p-4">
          <Wallet size={18} className="mt-0.5 shrink-0 text-accent-tint" />
          <p className="text-[12.5px] leading-snug text-accent-deep">Hand in the {money(result.feeCollected)} with the rest of your cash at the office.</p>
        </div>
      )}
      <div className="flex items-start gap-3 rounded-[22px] bg-danger-light p-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
        <p className="text-[12.5px] leading-snug text-danger">Now take every bag back to its shop and tick them off.</p>
      </div>
      <Button href={`/jobs/${job.id}`} icon={Undo2} className="w-full">
        Return to the shops
      </Button>
      <Button href="/dashboard" variant="secondary" className="w-full">
        Back to Home
      </Button>
    </Page>
  );
}
