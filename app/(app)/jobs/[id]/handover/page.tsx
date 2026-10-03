// app/(app)/jobs/[id]/handover/page.tsx — at the customer's door.
//
//   1. Items    what did the customer take? (Taking / Refused for each shop)
//   2. Payment  take the cash — or "already paid, take no money" — and an
//               optional photo (required only if the office says so)
//   →  Delivered!  what you took, what you earned, what to take back
//
// No delivery code: the customer is never asked for a number.
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, Ban, Banknote, Camera, Check, CheckCircle2, Home, Loader2, MapPin, ShieldCheck, Truck, Wallet, X,
} from "lucide-react";
import { errorText, useAsync } from "@/lib/driver";
import { completeJob, getJob, getLiveJobs, JOB_CANCEL_REASONS, uploadProofPhoto, type JobDetail, type JobStop } from "@/lib/jobs";
import { getEarnings } from "@/lib/pickups";
import { money, timeOf } from "@/lib/format";
import { BottomBar, Button, Card, CheckRow, ErrorState, FullLoader, InlineError, Label, Page, Pill } from "@/components/ui";
import { MoneyLine, itemsLine, stopCash } from "@/components/trip";

type Decision = { take: boolean; reason: string };

export default function HandoverPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: job, loading, error, reload } = useAsync(() => getJob(id), [id]);
  const [step, setStep] = useState<1 | 2>(1);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [done, setDone] = useState<null | { collected: number; driverPay: number; refused: JobStop[]; delivered: JobStop[]; at: string }>(null);

  const stops = useMemo(() => (job?.stops ?? []).filter((s) => s.status === "COLLECTED"), [job]);
  useEffect(() => {
    if (stops.length && Object.keys(decisions).length === 0) {
      setDecisions(Object.fromEntries(stops.map((s) => [s.id, { take: true, reason: "" }])));
    }
  }, [stops, decisions]);

  if (loading && !job) return <FullLoader label="Opening the hand over…" />;
  if (error && !job)
    return (
      <Page bottom="none" className="pt-6">
        <ErrorState message={error} onRetry={reload} />
      </Page>
    );
  if (!job) return null;
  if (done) return <Delivered job={job} result={done} />;
  if (job.status !== "ON_THE_WAY") {
    return (
      <Page bottom="none" className="pt-6">
        <ErrorState message={`This trip is ${job.statusLabel.toLowerCase()} — there is nothing to hand over.`} onRetry={() => router.replace(`/jobs/${job.id}`)} />
      </Page>
    );
  }

  const taking = stops.filter((s) => decisions[s.id]?.take !== false);
  const refused = stops.filter((s) => decisions[s.id]?.take === false);

  return (
    <>
      <header className="sticky top-0 z-30 bg-surface-page/95 px-3 pb-2 pt-3.5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => (step === 2 ? setStep(1) : router.push(`/jobs/${job.id}`))}
            aria-label={step === 2 ? "Back to items" : "Close"}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink active:bg-white"
          >
            <X size={21} />
          </button>
          <h1 className="flex-1 truncate text-[17px] font-extrabold text-ink">Hand over · {job.jobNumber}</h1>
        </div>
        <div className="mt-2 flex items-center gap-2 px-1">
          <StepChip n={1} label="Items" state={step === 1 ? "on" : "done"} />
          <div className="h-0.5 flex-1 rounded bg-line" />
          <StepChip n={2} label="Payment" state={step === 2 ? "on" : "todo"} />
        </div>
      </header>
      {step === 1 ? (
        <ItemsStep job={job} stops={stops} decisions={decisions} setDecisions={setDecisions} taking={taking} refused={refused} onNext={() => setStep(2)} />
      ) : (
        <PaymentStep job={job} taking={taking} refused={refused} decisions={decisions} onBack={() => setStep(1)} onDone={setDone} />
      )}
    </>
  );
}

function StepChip({ n, label, state }: { n: number; label: string; state: "on" | "done" | "todo" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold ${
        state === "on" ? "bg-brand text-white" : state === "done" ? "bg-brand-light text-brand" : "bg-white text-ink-faint"
      }`}
    >
      {state === "done" ? <Check size={12} strokeWidth={3} /> : <span>{n}</span>}
      {label}
    </span>
  );
}

/* ── 1. what did the customer take? ─────────────────────────────────── */

function ItemsStep({
  job, stops, decisions, setDecisions, taking, refused, onNext,
}: {
  job: JobDetail;
  stops: JobStop[];
  decisions: Record<string, Decision>;
  setDecisions: (d: Record<string, Decision>) => void;
  taking: JobStop[];
  refused: JobStop[];
  onNext: () => void;
}) {
  const cashBefore = stops.reduce((t, s) => t + stopCash(s), 0);
  const cashNow = taking.reduce((t, s) => t + stopCash(s), 0);
  const missingReason = refused.some((s) => !decisions[s.id]?.reason);
  const set = (id: string, d: Partial<Decision>) => setDecisions({ ...decisions, [id]: { ...decisions[id], ...d } });

  return (
    <>
      <Page bottom="bar">
        <Card className="flex items-center gap-3 py-3.5">
          <Truck size={18} className="text-ink-soft" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-extrabold text-ink">Trip {job.jobNumber}</p>
            <p className="truncate text-[11.5px] text-ink-muted">
              {job.customer.name}
              {job.customer.area ? ` · ${job.customer.area}` : ""}
            </p>
          </div>
          <Pill tone="brand">
            <MapPin size={11} /> At the door
          </Pill>
        </Card>

        <div className="px-1">
          <h2 className="text-[21px] font-extrabold text-ink">What did the customer take?</h2>
          <p className="mt-1 text-[12.5px] text-ink-muted">Mark each shop. If the customer doesn&apos;t want a shop&apos;s items, mark it refused — you take it back.</p>
        </div>

        {stops.map((s) => {
          const d = decisions[s.id] ?? { take: true, reason: "" };
          return (
            <Card key={s.id} className={d.take ? "" : "ring-2 ring-danger/25"}>
              <div className="flex items-start gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${d.take ? "bg-[#22A06B] text-white" : "bg-danger text-white"}`}>
                  {d.take ? <Check size={18} strokeWidth={3} /> : <X size={18} strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-extrabold text-ink">{s.shop.name}</span>
                    {d.take ? <Pill tone="brand">Taking</Pill> : <Pill tone="danger">Refused</Pill>}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-muted">{itemsLine(s)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-[16px] font-extrabold ${d.take ? "text-ink" : "text-ink-faint line-through"}`}>{money(s.money.total)}</p>
                  <p className="text-[10px] font-bold text-ink-faint">{stopCash(s) ? "CASH" : "PAID"}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl bg-surface-sunken p-1.5">
                <button
                  onClick={() => set(s.id, { take: true, reason: "" })}
                  className={`min-h-[42px] rounded-xl text-[13px] font-extrabold ${d.take ? "bg-white text-brand shadow-card" : "text-ink-muted"}`}
                >
                  ✓ Taking
                </button>
                <button
                  onClick={() => set(s.id, { take: false })}
                  className={`min-h-[42px] rounded-xl text-[13px] font-extrabold ${!d.take ? "bg-white text-danger shadow-card" : "text-ink-muted"}`}
                >
                  ✕ Refused
                </button>
              </div>
              {!d.take && (
                <div className="mt-3 flex flex-col gap-2.5">
                  <label className="text-[12px] font-extrabold text-ink">
                    Why was this refused? <span className="font-semibold text-danger">needed</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {JOB_CANCEL_REASONS.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => set(s.id, { reason: r.value })}
                        className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${
                          d.reason === r.value ? "border-danger bg-danger-light text-danger" : "border-line bg-white text-ink-soft"
                        }`}
                      >
                        {d.reason === r.value ? "✓ " : ""}
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-start gap-2.5 rounded-2xl bg-accent-light p-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-accent-tint" />
                    <p className="text-[12px] leading-snug text-accent-deep">
                      Keep this bag closed in your bag. Take it back to <b>{s.shop.name}</b> after your trips.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          );
        })}

        <div className="rounded-[22px] bg-white p-4 shadow-card">
          <div className="flex items-center justify-between">
            <Label>Hand over check</Label>
            <div className="flex gap-1.5">
              <Pill tone="brand">{taking.length} taking</Pill>
              {refused.length > 0 && <Pill tone="danger">{refused.length} refused</Pill>}
            </div>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-[13px] font-bold text-ink-soft">{cashNow > 0 ? "Cash to collect now" : "Cash to collect"}</span>
            <span className="text-right">
              {cashNow !== cashBefore && <span className="mr-2 text-[13px] font-bold text-ink-faint line-through">{money(cashBefore)}</span>}
              <span className="text-[22px] font-extrabold text-ink">{cashNow > 0 ? money(cashNow) : "None — paid"}</span>
            </span>
          </div>
        </div>
      </Page>
      <BottomBar>
        {taking.length === 0 ? (
          <>
            <Button href={`/jobs/${job.id}/refused`} variant="danger" icon={Ban} className="w-full">
              The customer refused everything
            </Button>
            <p className="mt-1.5 pb-1 text-center text-[11.5px] font-semibold text-ink-muted">Nothing taken? Record the refusal instead.</p>
          </>
        ) : (
          <>
            <Button onClick={onNext} disabled={missingReason} iconRight={ArrowRight} className="w-full">
              {cashNow > 0 ? `Next: take cash (${money(cashNow)})` : "Next: finish"}
            </Button>
            <p className="mt-1.5 pb-1 text-center text-[11.5px] font-semibold text-ink-muted">
              {missingReason ? "Choose why each refused shop was refused" : "You can still change this on the next step"}
            </p>
          </>
        )}
      </BottomBar>
    </>
  );
}

/* ── 2. payment and photo ───────────────────────────────────────────── */

function PaymentStep({
  job, taking, refused, decisions, onBack, onDone,
}: {
  job: JobDetail;
  taking: JobStop[];
  refused: JobStop[];
  decisions: Record<string, Decision>;
  onBack: () => void;
  onDone: (r: { collected: number; driverPay: number; refused: JobStop[]; delivered: JobStop[]; at: string }) => void;
}) {
  const cash = taking.reduce((t, s) => t + stopCash(s), 0);
  const photoRequired = Boolean(job.proofRules?.photoRequired);
  const [inHand, setInHand] = useState(false);
  const [photo, setPhoto] = useState<{ url: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickPhoto(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    setErr(null);
    try {
      const url = await uploadProofPhoto(f);
      setPhoto({ url, preview: URL.createObjectURL(f) });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setUploading(false);
    }
  }

  async function finish() {
    setBusy(true);
    setErr(null);
    try {
      const reasons = refused.map((s) => `${s.shop.name}: ${JOB_CANCEL_REASONS.find((r) => r.value === decisions[s.id]?.reason)?.label ?? "refused"}`);
      const r = await completeJob(job.id, {
        acceptedStopIds: taking.map((s) => s.id),
        cashCollected: cash > 0 ? inHand : undefined,
        refusedReason: reasons.length ? reasons.join("; ") : undefined,
        photoUrl: photo?.url,
      });
      onDone({ collected: r.collected, driverPay: Number(r.driverPay ?? 0), refused, delivered: taking, at: new Date().toISOString() });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const ready = (cash <= 0 || inHand) && (!photoRequired || photo) && !uploading;

  return (
    <>
      <Page bottom="bar">
        <div className="px-1">
          <h2 className="text-[21px] font-extrabold text-ink">{cash > 0 ? "Take the cash" : "Hand over the bags"}</h2>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            {cash > 0 ? "Count the money before you give the bags." : "This order is paid. Give the bags and finish."}
          </p>
        </div>

        {cash > 0 ? (
          <div className="rounded-[24px] bg-gradient-to-b from-accent-light to-[#FFE9D2] p-4">
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-deep px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white">
                <Banknote size={13} /> Collect from {job.customer.name.split(" ")[0]}
              </span>
            </div>
            <p className="mt-2 text-center text-[44px] font-extrabold leading-tight text-accent-deep">{money(cash)}</p>
            <div className="mt-2 flex flex-col gap-1.5 rounded-2xl bg-white/80 p-3">
              {taking.map((s) => (
                <MoneyLine key={s.id} label={s.shop.name} value={stopCash(s)} />
              ))}
              {refused.map((s) => (
                <MoneyLine key={s.id} label={`${s.shop.name} (refused)`} value={s.money.total} strike />
              ))}
              {taking.some((s) => !stopCash(s)) && <p className="text-[11px] font-semibold text-ink-muted">Shops marked paid online are not in the cash.</p>}
            </div>
            <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-white/80 p-3">
              <Wallet size={17} className="shrink-0 text-accent-tint" />
              <p className="text-[12px] font-semibold text-ink-soft">Take US dollars in cash. Check the notes are good.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-[22px] bg-brand-mint p-4">
            <CheckCircle2 size={24} className="shrink-0 text-brand" />
            <div>
              <p className="text-[16px] font-extrabold text-brand">Already paid — take no money</p>
              <p className="mt-0.5 text-[12.5px] text-brand-tint">The customer paid online. Don&apos;t accept any cash for this trip.</p>
            </div>
          </div>
        )}

        {cash > 0 && (
          <CheckRow
            checked={inHand}
            onChange={setInHand}
            title={`I have ${money(cash)} in my hand`}
            sub="Counted. The cash goes to the office later."
          />
        )}

        <Card>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[14.5px] font-extrabold text-ink">
              <Camera size={17} /> Photo at the door
            </span>
            <Pill tone={photoRequired ? "danger" : "muted"}>{photoRequired ? "Needed" : "Optional"}</Pill>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          {photo ? (
            <div className="relative mt-3 overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.preview} alt="Parcel at the door" className="h-48 w-full object-cover" />
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[10.5px] font-extrabold text-white">
                <Check size={11} strokeWidth={3} /> Photo added
              </span>
              <button onClick={() => fileRef.current?.click()} className="absolute bottom-2 right-2 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-extrabold text-ink shadow">
                Retake
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-3 flex min-h-[96px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line bg-surface-sunken text-ink-muted"
            >
              {uploading ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
              <span className="text-[12.5px] font-bold">{uploading ? "Uploading…" : "Take a photo of the parcel"}</span>
            </button>
          )}
        </Card>

        <div className="flex items-start gap-2.5 rounded-2xl bg-white/70 p-3.5">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-ink-muted" />
          <p className="text-[11.5px] leading-snug text-ink-muted">Never give the bags before you have the money in your hand.</p>
        </div>
        <InlineError message={err} />
      </Page>
      <BottomBar>
        <Button onClick={finish} loading={busy} disabled={!ready} icon={CheckCircle2} className="w-full">
          Finish delivery
        </Button>
        <button onClick={onBack} className="mt-1 min-h-[44px] w-full text-[13px] font-bold text-ink-muted">
          Back to items
        </button>
      </BottomBar>
    </>
  );
}

/* ── delivered! ─────────────────────────────────────────────────────── */

function Delivered({ job, result }: { job: JobDetail; result: { collected: number; driverPay: number; refused: JobStop[]; delivered: JobStop[]; at: string } }) {
  const { data } = useAsync(async () => {
    const [earnings, live] = await Promise.all([getEarnings(), getLiveJobs()]);
    return { earnings, next: live.find((j) => j.id !== job.id && j.status !== "CANCELLED") ?? null };
  }, [job.id]);
  const items = result.delivered.reduce((t, s) => t + s.itemCount, 0);

  return (
    <Page bottom="none" className="pt-8">
      <div className="flex flex-col items-center text-center">
        <div className="animate-pop flex h-24 w-24 items-center justify-center rounded-full bg-brand text-white shadow-card">
          <Check size={46} strokeWidth={3} />
        </div>
        <h1 className="mt-4 text-[28px] font-extrabold text-ink">Delivered!</h1>
        <p className="text-[13.5px] font-semibold text-ink-soft">
          Trip {job.jobNumber} · {job.customer.name}
        </p>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-bold text-ink-muted shadow-card">
          <MapPin size={12} /> {job.customer.area ?? job.dropLocation ?? "Delivered"} · {timeOf(result.at)}
        </span>
      </div>

      <Card className="mt-2">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-extrabold text-ink">Trip summary</span>
          <Pill tone="brand">DONE</Pill>
        </div>
        <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Cash taken</span>
            <span className="font-extrabold text-ink">{result.collected > 0 ? money(result.collected) : "None — paid online"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">You earned</span>
            <span className="rounded-full bg-brand-light px-2.5 py-0.5 font-extrabold text-brand-tint">+{money(result.driverPay)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Items delivered</span>
            <span className="text-right font-bold text-ink">
              {items} from {result.delivered.length} shop{result.delivered.length === 1 ? "" : "s"}
            </span>
          </div>
          {result.refused.length > 0 && (
            <div className="rounded-2xl bg-danger-light/70 p-3">
              <p className="flex items-center justify-between text-[12.5px] font-extrabold text-danger">
                Refused <span className="rounded-full bg-white px-2 py-0.5 text-[10.5px]">Take it back</span>
              </p>
              <p className="mt-1 text-[12px] text-danger">
                {result.refused.map((s) => s.shop.name).join(", ")} — take {result.refused.length === 1 ? "it" : "them"} back to the shop.
              </p>
            </div>
          )}
        </div>
      </Card>

      {data && data.earnings.cash.toHandOver > 0 && (
        <div className="flex items-start gap-3 rounded-[22px] bg-accent-light p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
            <Wallet size={18} />
          </div>
          <div>
            <p className="text-[14px] font-extrabold text-accent-deep">Cash reminder</p>
            <p className="text-[12.5px] leading-snug text-accent-deep/85">
              You hold <b>{money(data.earnings.cash.toHandOver)}</b> in cash. Hand it in at the office today.
            </p>
          </div>
        </div>
      )}

      {data?.next ? (
        <Button href={`/jobs/${data.next.id}`} iconRight={ArrowRight} className="w-full">
          Next trip ({data.next.jobNumber})
        </Button>
      ) : (
        <Button href="/jobs" iconRight={ArrowRight} className="w-full">
          My trips
        </Button>
      )}
      <Button href="/dashboard" variant="secondary" icon={Home} className="w-full">
        Back to Home
      </Button>
      <Link href={`/jobs/${job.id}`} className="py-1 text-center text-[12.5px] font-bold text-ink-muted">
        See this trip
      </Link>
    </Page>
  );
}
