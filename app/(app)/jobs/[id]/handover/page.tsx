// app/(app)/jobs/[id]/handover/page.tsx — at the customer's door.
//
// The customer checks every item. For each item (and each piece of it):
//   ✓ Taken            the customer keeps it
//   ↩ Refused          the item is right, the customer doesn't want it
//                      → the customer pays the delivery fee
//   ✕ Shop's mistake   wrong / damaged / not as described / missing
//                      → the customer pays nothing for it (take a photo)
//
//   1. Items    mark every item
//   2. Money    the backend says what to collect — count it, take a photo if asked
//   →  Done     what to take to the Bakhaar store
//
// No delivery code: the customer gets the record by email at once.
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, Banknote, Camera, Check, CheckCircle2, Home, Loader2, MapPin, Minus, PackageCheck, Plus,
  RotateCcw, ShieldCheck, Store, Truck, X,
} from "lucide-react";
import { errorText, useAsync } from "@/lib/driver";
import { getJob, uploadProofPhoto, type JobDetail, type JobItem, type JobStop } from "@/lib/jobs";
import { FAULT_REASONS, REFUSED_REASONS, previewDoor, submitDoor, type DoorBody, type DoorDone, type DoorPreview } from "@/lib/door";
import { money } from "@/lib/format";
import { BottomBar, Button, Card, CheckRow, ErrorState, FullLoader, InlineError, Page, Pill } from "@/components/ui";
import { ItemThumb } from "@/components/trip";

type Mark = { refused: number; fault: number; refusedReason: string; faultReason: string; photos: { url: string; preview: string }[] };
const EMPTY: Mark = { refused: 0, fault: 0, refusedReason: "", faultReason: "", photos: [] };

export default function DoorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: job, loading, error, reload } = useAsync(() => getJob(id), [id]);
  const [step, setStep] = useState<1 | 2>(1);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [remedies, setRemedies] = useState<Record<string, "replacement" | "refund">>({});
  const [rules, setRules] = useState<DoorPreview["rules"] | null>(null);
  const [done, setDone] = useState<DoorDone | null>(null);

  const stops = useMemo(() => (job?.stops ?? []).filter((s) => s.status === "COLLECTED"), [job]);

  // The rules (photo needed? single items allowed?) come from the backend.
  useEffect(() => {
    if (!job || job.status !== "ON_THE_WAY" || rules) return;
    previewDoor(job.id, { lines: [] }).then((p) => setRules(p.rules ?? null)).catch(() => undefined);
  }, [job, rules]);

  if (loading && !job) return <FullLoader label="Opening the door screen…" />;
  if (error && !job)
    return (
      <Page bottom="none" className="pt-6">
        <ErrorState message={error} onRetry={reload} />
      </Page>
    );
  if (!job) return null;
  if (done) return <Done job={job} result={done} />;
  if (job.status !== "ON_THE_WAY") {
    return (
      <Page bottom="none" className="pt-6">
        <ErrorState message={`This trip is ${job.statusLabel.toLowerCase()} — there is nothing to hand over.`} onRetry={() => router.replace(`/jobs/${job.id}`)} />
      </Page>
    );
  }

  const body = (): DoorBody => ({
    lines: stops.flatMap((s) =>
      s.items.map((it) => {
        const m = marks[it.id] ?? EMPTY;
        return {
          orderItemId: it.id,
          taken: it.quantity - m.refused - m.fault,
          refused: m.refused,
          fault: m.fault,
          refusedReason: m.refused > 0 ? m.refusedReason : undefined,
          faultReason: m.fault > 0 ? m.faultReason : undefined,
          photos: m.fault > 0 ? m.photos.map((p) => p.url) : undefined,
        };
      })
    ),
    remedies,
  });

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
          <h1 className="flex-1 truncate text-[17px] font-extrabold text-ink">At the door · {job.jobNumber}</h1>
        </div>
        <div className="mt-2 flex items-center gap-2 px-1">
          <StepChip n={1} label="Items" state={step === 1 ? "on" : "done"} />
          <div className="h-0.5 flex-1 rounded bg-line" />
          <StepChip n={2} label="Money" state={step === 2 ? "on" : "todo"} />
        </div>
      </header>
      {step === 1 ? (
        <ItemsStep
          job={job}
          stops={stops}
          marks={marks}
          setMarks={setMarks}
          remedies={remedies}
          setRemedies={setRemedies}
          photoRequired={rules?.faultPhotoRequired ?? true}
          partialEnabled={rules?.partialEnabled ?? true}
          replacementEnabled={rules?.replacementEnabled ?? true}
          onNext={() => setStep(2)}
        />
      ) : (
        <MoneyStep job={job} body={body} onBack={() => setStep(1)} onDone={setDone} />
      )}
    </>
  );
}

function StepChip({ n, label, state }: { n: number; label: string; state: "on" | "done" | "todo" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold ${state === "on" ? "bg-brand text-white" : state === "done" ? "bg-brand-light text-brand" : "bg-white text-ink-faint"}`}>
      {state === "done" ? <Check size={12} strokeWidth={3} /> : <span>{n}</span>}
      {label}
    </span>
  );
}

/* ── 1. every item ──────────────────────────────────────────────────── */

function ItemsStep({
  job, stops, marks, setMarks, remedies, setRemedies, photoRequired, partialEnabled, replacementEnabled, onNext,
}: {
  job: JobDetail;
  stops: JobStop[];
  marks: Record<string, Mark>;
  setMarks: (f: (m: Record<string, Mark>) => Record<string, Mark>) => void;
  remedies: Record<string, "replacement" | "refund">;
  setRemedies: (f: (r: Record<string, "replacement" | "refund">) => Record<string, "replacement" | "refund">) => void;
  photoRequired: boolean;
  partialEnabled: boolean;
  replacementEnabled: boolean;
  onNext: () => void;
}) {
  const all = stops.flatMap((s) => s.items);
  const count = (k: "taken" | "refused" | "fault") =>
    all.reduce((t, it) => {
      const m = marks[it.id] ?? EMPTY;
      return t + (k === "taken" ? it.quantity - m.refused - m.fault : m[k]);
    }, 0);
  const problems: string[] = [];
  for (const it of all) {
    const m = marks[it.id] ?? EMPTY;
    if (m.refused > 0 && !m.refusedReason) problems.push(`Why was ${it.productName} refused?`);
    if (m.fault > 0 && !m.faultReason) problems.push(`What did the shop get wrong with ${it.productName}?`);
    if (m.fault > 0 && m.faultReason && m.faultReason !== "missing" && photoRequired && m.photos.length === 0) problems.push(`Take a photo of ${it.productName}`);
  }
  if (!partialEnabled) {
    for (const s of stops) {
      const takenSome = s.items.some((it) => (marks[it.id]?.refused ?? 0) + (marks[it.id]?.fault ?? 0) < it.quantity);
      const notAll = s.items.some((it) => (marks[it.id]?.refused ?? 0) + (marks[it.id]?.fault ?? 0) > 0);
      if (takenSome && notAll) problems.push(`${s.shop.name}: mark the whole shop the same way`);
    }
  }

  const setMark = (itemId: string, patch: Partial<Mark>) => setMarks((cur) => ({ ...cur, [itemId]: { ...(cur[itemId] ?? EMPTY), ...patch } }));
  const wholeShop = (s: JobStop, as: "taken" | "refused" | "fault") =>
    setMarks((cur) => {
      const next = { ...cur };
      for (const it of s.items) {
        const prev = cur[it.id] ?? EMPTY;
        next[it.id] = { ...prev, refused: as === "refused" ? it.quantity : 0, fault: as === "fault" ? it.quantity : 0 };
      }
      return next;
    });

  return (
    <>
      <Page bottom="bar">
        <Card className="flex items-center gap-3 py-3.5">
          <Truck size={18} className="text-ink-soft" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-extrabold text-ink">Trip {job.jobNumber}</p>
            <p className="truncate text-[11.5px] text-ink-muted">{job.customer.name}{job.customer.area ? ` · ${job.customer.area}` : ""}</p>
          </div>
          <Pill tone="brand"><MapPin size={11} /> At the door</Pill>
        </Card>

        <div className="px-1">
          <h2 className="text-[21px] font-extrabold text-ink">Let the customer check every item</h2>
          <p className="mt-1 text-[12.5px] text-ink-muted">Everything starts as taken. Change only what the customer gives back.</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Count tone="brand" label="Taken" n={count("taken")} />
          <Count tone="muted" label="Refused" n={count("refused")} />
          <Count tone="danger" label="Shop's mistake" n={count("fault")} />
        </div>

        {stops.map((s) => {
          const shopFault = s.items.some((it) => (marks[it.id]?.fault ?? 0) > 0);
          const canReplace = replacementEnabled;
          return (
            <Card key={s.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words text-[16px] font-extrabold text-ink">{s.shop.name}</span>
                <span className="text-[11px] font-bold text-ink-faint">{s.orderNumber}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Whole ${s.shop.name}`}>
                <QuickBtn onClick={() => wholeShop(s, "taken")}>All taken</QuickBtn>
                <QuickBtn onClick={() => wholeShop(s, "refused")}>All refused</QuickBtn>
                <QuickBtn onClick={() => wholeShop(s, "fault")}>All shop&apos;s mistake</QuickBtn>
              </div>

              <div className="mt-3 flex flex-col gap-3">
                {s.items.map((it) => (
                  <ItemMarker key={it.id} it={it} m={marks[it.id] ?? EMPTY} set={(p) => setMark(it.id, p)} photoRequired={photoRequired} />
                ))}
              </div>

              {shopFault && canReplace && (
                <div className="mt-3 rounded-2xl bg-surface-sunken p-3">
                  <p className="text-[12px] font-extrabold text-ink">For the shop&apos;s mistake, the customer wants:</p>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {(["replacement", "refund"] as const).map((r) => {
                      const on = (remedies[s.orderId] ?? "replacement") === r;
                      return (
                        <button key={r} onClick={() => setRemedies((cur) => ({ ...cur, [s.orderId]: r }))} aria-pressed={on} className={`min-h-[44px] rounded-xl px-2 text-[12.5px] font-extrabold ${on ? "bg-white text-brand shadow-card ring-2 ring-brand/30" : "text-ink-muted"}`}>
                          {r === "replacement" ? "The correct item" : "Money back"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </Page>
      <BottomBar>
        <Button onClick={onNext} disabled={problems.length > 0} iconRight={ArrowRight} className="w-full">
          Next: money
        </Button>
        <p className="mt-1.5 pb-1 text-center text-[11.5px] font-semibold text-ink-muted">{problems[0] ?? "The office sees exactly what you mark"}</p>
      </BottomBar>
    </>
  );
}

function Count({ tone, label, n }: { tone: "brand" | "muted" | "danger"; label: string; n: number }) {
  const cls = tone === "brand" ? "bg-brand-light text-brand" : tone === "danger" ? "bg-danger-light text-danger" : "bg-white text-ink-soft";
  return (
    <div className={`rounded-2xl px-3 py-2.5 text-center ${cls}`}>
      <p className="text-[20px] font-extrabold leading-none">{n}</p>
      <p className="mt-1 text-[10.5px] font-extrabold uppercase tracking-wide">{label}</p>
    </div>
  );
}

function QuickBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="min-h-[34px] rounded-full border border-line bg-white px-3 text-[11.5px] font-bold text-ink-soft active:bg-surface-sunken">
      {children}
    </button>
  );
}

function ItemMarker({ it, m, set, photoRequired }: { it: JobItem; m: Mark; set: (p: Partial<Mark>) => void; photoRequired: boolean }) {
  const taken = it.quantity - m.refused - m.fault;
  const single = it.quantity === 1;
  const state: "taken" | "refused" | "fault" = m.fault > 0 ? "fault" : m.refused > 0 ? "refused" : "taken";
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function addPhoto(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    setErr(null);
    try {
      const url = await uploadProofPhoto(f);
      set({ photos: [...m.photos, { url, preview: URL.createObjectURL(f) }].slice(0, 3) });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setUploading(false);
    }
  }

  const step = (k: "refused" | "fault", d: number) => {
    const next = Math.max(0, m[k] + d);
    const other = k === "refused" ? m.fault : m.refused;
    if (next + other > it.quantity) return;
    set({ [k]: next } as Partial<Mark>);
  };

  return (
    <div className={`rounded-2xl border-2 p-3 ${state === "fault" ? "border-danger/30 bg-danger-light/30" : state === "refused" ? "border-line bg-surface-sunken/60" : "border-transparent bg-surface-sunken"}`}>
      <div className="flex items-start gap-3">
        <ItemThumb item={it} size={52} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-[13.5px] font-extrabold text-ink">{it.productName}</p>
          <p className="break-words text-[11.5px] text-ink-muted">{it.variantLabel ? `${it.variantLabel} · ` : ""}{it.quantity} × {money(it.unitPrice)}</p>
        </div>
      </div>

      {single ? (
        <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-2xl bg-white p-1" role="group" aria-label={`${it.productName}: what happened`}>
          {(["taken", "refused", "fault"] as const).map((k) => {
            const on = state === k;
            const label = k === "taken" ? "✓ Taken" : k === "refused" ? "↩ Refused" : "✕ Shop's mistake";
            const color = k === "taken" ? "text-brand ring-brand/30" : k === "refused" ? "text-ink ring-ink/20" : "text-danger ring-danger/30";
            return (
              <button
                key={k}
                onClick={() => set({ refused: k === "refused" ? 1 : 0, fault: k === "fault" ? 1 : 0 })}
                aria-pressed={on}
                className={`min-h-[44px] rounded-xl px-1 text-[11.5px] font-extrabold leading-tight ${on ? `bg-surface-sunken ring-2 ${color}` : "text-ink-muted"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-2.5 flex flex-col gap-1.5 rounded-2xl bg-white p-2.5">
          <div className="flex items-center justify-between text-[12.5px] font-extrabold text-brand">
            <span>✓ Taken</span>
            <span className="tabular-nums">{taken}</span>
          </div>
          <Stepper label="↩ Refused" value={m.refused} onMinus={() => step("refused", -1)} onPlus={() => step("refused", 1)} />
          <Stepper label="✕ Shop's mistake" value={m.fault} onMinus={() => step("fault", -1)} onPlus={() => step("fault", 1)} danger />
        </div>
      )}

      {m.refused > 0 && (
        <div className="mt-2.5">
          <p className="text-[11.5px] font-extrabold text-ink">The item is right — why doesn&apos;t the customer want it?</p>
          <Chips options={REFUSED_REASONS} value={m.refusedReason} onPick={(v) => set({ refusedReason: v })} />
        </div>
      )}

      {m.fault > 0 && (
        <div className="mt-2.5">
          <p className="text-[11.5px] font-extrabold text-danger">What did the shop get wrong?</p>
          <Chips options={FAULT_REASONS} value={m.faultReason} onPick={(v) => set({ faultReason: v })} danger />
          {m.faultReason && m.faultReason !== "missing" && (
            <div className="mt-2.5">
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
              <div className="flex flex-wrap gap-2">
                {m.photos.map((p, i) => (
                  <div key={p.url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.preview} alt={`Photo ${i + 1} of the problem`} className="h-20 w-20 rounded-xl object-cover" />
                    <button onClick={() => set({ photos: m.photos.filter((x) => x.url !== p.url) })} aria-label="Remove photo" className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {m.photos.length < 3 && (
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-danger/40 bg-white text-danger">
                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                    <span className="text-[10px] font-extrabold">{photoRequired && m.photos.length === 0 ? "Photo needed" : "Add photo"}</span>
                  </button>
                )}
              </div>
              {err && <p className="mt-1 text-[11px] font-bold text-danger">{err}</p>}
            </div>
          )}
          {m.faultReason === "missing" && (
            <p className="mt-2 rounded-xl bg-white px-3 py-2 text-[11.5px] text-ink-muted">Missing items go straight to the office. You ticked every item at the shop, so be sure.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Stepper({ label, value, onMinus, onPlus, danger }: { label: string; value: number; onMinus: () => void; onPlus: () => void; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-[12.5px] font-extrabold ${danger ? "text-danger" : "text-ink"}`}>{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={onMinus} aria-label={`Fewer ${label}`} className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-sunken text-ink"><Minus size={15} /></button>
        <span className="w-6 text-center text-[15px] font-extrabold tabular-nums text-ink">{value}</span>
        <button onClick={onPlus} aria-label={`More ${label}`} className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-sunken text-ink"><Plus size={15} /></button>
      </div>
    </div>
  );
}

function Chips({ options, value, onPick, danger }: { options: readonly { value: string; label: string }[]; value: string; onPick: (v: string) => void; danger?: boolean }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onPick(o.value)}
            aria-pressed={on}
            className={`rounded-full border px-3 py-1.5 text-[11.5px] font-bold ${on ? (danger ? "border-danger bg-danger-light text-danger" : "border-ink bg-white text-ink") : "border-line bg-white text-ink-soft"}`}
          >
            {on ? "✓ " : ""}{o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── 2. money (numbers from the backend) ────────────────────────────── */

function MoneyStep({ job, body, onBack, onDone }: { job: JobDetail; body: () => DoorBody; onBack: () => void; onDone: (r: DoorDone) => void }) {
  const [preview, setPreview] = useState<DoorPreview | null>(null);
  const [perr, setPerr] = useState<string | null>(null);
  const [inHand, setInHand] = useState(false);
  const [feePaid, setFeePaid] = useState<boolean | null>(null);
  const [photo, setPhoto] = useState<{ url: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    previewDoor(job.id, body()).then(setPreview).catch((e) => setPerr(errorText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  // The fee answer changes what to collect: ask the backend again.
  useEffect(() => {
    if (feePaid === null) return;
    previewDoor(job.id, { ...body(), feePaid }).then(setPreview).catch((e) => setPerr(errorText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feePaid]);

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
    if (!preview) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await submitDoor(job.id, {
        ...body(),
        cashCollected: preview.cashToCollect > 0 ? inHand : undefined,
        feePaid: preview.feeQuestion ? feePaid ?? undefined : undefined,
        photoUrl: photo?.url,
      });
      onDone(r);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (perr) {
    return (
      <Page bottom="bar">
        <InlineError message={perr} />
        <BottomBar>
          <Button onClick={onBack} variant="secondary" className="w-full">Back to items</Button>
        </BottomBar>
      </Page>
    );
  }
  if (!preview) return <FullLoader label="Working out the money…" />;

  const cash = preview.cashToCollect;
  const ready =
    (cash <= 0 || inHand) && (!preview.feeQuestion || feePaid !== null) && (!preview.needsProofPhoto || !!photo) && !uploading;

  return (
    <>
      <Page bottom="bar">
        <div className="px-1">
          <h2 className="text-[21px] font-extrabold text-ink">{cash > 0 ? "Take the cash" : "No cash to take"}</h2>
          <p className="mt-1 text-[12.5px] text-ink-muted">These numbers come from the office system. Don&apos;t accept a different amount.</p>
        </div>

        {preview.feeQuestion && (
          <Card>
            <p className="text-[14px] font-extrabold text-ink">Did the customer pay the {money(preview.feeQuestion.amount)} delivery fee?</p>
            <p className="mt-0.5 text-[12px] text-ink-muted">The customer refused correct items, so the delivery fee is theirs to pay.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant={feePaid === true ? "primary" : "outline"} size="md" onClick={() => setFeePaid(true)}>Yes, paid</Button>
              <Button variant={feePaid === false ? "danger" : "outline"} size="md" onClick={() => setFeePaid(false)}>No, refused</Button>
            </div>
          </Card>
        )}

        {cash > 0 ? (
          <div className="rounded-[24px] bg-gradient-to-b from-accent-light to-[#FFE9D2] p-4">
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-deep px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white">
                <Banknote size={13} /> Collect from {job.customer.name.split(" ")[0]}
              </span>
            </div>
            <p className="mt-2 text-center text-[44px] font-extrabold leading-tight text-accent-deep">{money(cash)}</p>
            <div className="mt-2 flex flex-col gap-1.5 rounded-2xl bg-white/80 p-3 text-[12.5px]">
              {preview.shops.filter((s) => s.cash > 0).map((s) => (
                <div key={s.orderId} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 break-words text-ink-soft">{s.shopName}{s.deliveryFee > 0 ? " (with delivery)" : ""}</span>
                  <span className="shrink-0 font-extrabold text-ink">{money(s.cash)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-[22px] bg-brand-mint p-4">
            <CheckCircle2 size={24} className="shrink-0 text-brand" />
            <div>
              <p className="text-[16px] font-extrabold text-brand">Take no money</p>
              <p className="mt-0.5 text-[12.5px] text-brand-tint">
                {preview.allShopFault ? "Everything was the shop's mistake — the customer pays nothing." : "Paid online already. Don't accept any cash."}
              </p>
            </div>
          </div>
        )}

        {(preview.refundToCustomer > 0 || preview.heldForCorrectItem > 0) && (
          <Card className="flex flex-col gap-1.5 text-[12.5px]">
            {preview.refundToCustomer > 0 && (
              <p className="flex items-start gap-2 text-ink-soft"><RotateCcw size={15} className="mt-0.5 shrink-0" /> Tell the customer: {money(preview.refundToCustomer)} comes back to their Zaad / eDahab from Bakhaar.</p>
            )}
            {preview.heldForCorrectItem > 0 && (
              <p className="flex items-start gap-2 text-ink-soft"><ShieldCheck size={15} className="mt-0.5 shrink-0" /> {money(preview.heldForCorrectItem)} is kept safe for the correct item (or refunded).</p>
            )}
          </Card>
        )}

        {cash > 0 && <CheckRow checked={inHand} onChange={setInHand} title={`I have ${money(cash)} in my hand`} sub="Counted. The cash goes to the office later." />}

        <Card>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[14.5px] font-extrabold text-ink"><Camera size={17} /> Photo at the door</span>
            <Pill tone={preview.needsProofPhoto ? "danger" : "muted"}>{preview.needsProofPhoto ? "Needed" : "Optional"}</Pill>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          {photo ? (
            <div className="relative mt-3 overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.preview} alt="Parcel at the door" className="h-44 w-full object-cover" />
              <button onClick={() => fileRef.current?.click()} className="absolute bottom-2 right-2 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-extrabold text-ink shadow">Retake</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-3 flex min-h-[88px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line bg-surface-sunken text-ink-muted">
              {uploading ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
              <span className="text-[12.5px] font-bold">{uploading ? "Uploading…" : "Take a photo"}</span>
            </button>
          )}
        </Card>

        {preview.goodsToStore > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-accent-light p-3.5">
            <Store size={16} className="mt-0.5 shrink-0 text-accent-tint" />
            <p className="text-[12px] leading-snug text-accent-deep">Keep the refused items closed in your bag. You take them to the <b>Bakhaar store</b> after your trips.</p>
          </div>
        )}
        <div className="flex items-start gap-2.5 rounded-2xl bg-white/70 p-3.5">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-ink-muted" />
          <p className="text-[11.5px] leading-snug text-ink-muted">The customer gets this record by email right away.</p>
        </div>
        <InlineError message={err} />
      </Page>
      <BottomBar>
        <Button onClick={finish} loading={busy} disabled={!ready} icon={CheckCircle2} className="w-full">Finish</Button>
        <button onClick={onBack} className="mt-1 min-h-[44px] w-full text-[13px] font-bold text-ink-muted">Back to items</button>
      </BottomBar>
    </>
  );
}

/* ── done ───────────────────────────────────────────────────────────── */

function Done({ job, result }: { job: JobDetail; result: DoorDone }) {
  const nothing = result.status === "CANCELLED";
  return (
    <Page bottom="none" className="pt-8">
      <div className="flex flex-col items-center text-center">
        <div className={`animate-pop flex h-24 w-24 items-center justify-center rounded-full text-white shadow-card ${nothing ? "bg-ink-soft" : "bg-brand"}`}>
          {nothing ? <AlertTriangle size={42} /> : <Check size={46} strokeWidth={3} />}
        </div>
        <h1 className="mt-4 text-[28px] font-extrabold text-ink">{nothing ? "Recorded" : "Delivered!"}</h1>
        <p className="text-[13.5px] font-semibold text-ink-soft">Trip {job.jobNumber} · {job.customer.name}</p>
      </div>

      <Card className="mt-2">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-extrabold text-ink">Summary</span>
          <Pill tone="brand">DONE</Pill>
        </div>
        <div className="mt-3 flex flex-col gap-2.5 text-[13px]">
          <Row label="Cash taken" value={result.collected > 0 ? money(result.collected) : "None"} />
          <Row label="You earn" value={`+${money(result.driverPay)}${result.payHeld ? " (after the store)" : ""}`} />
          {result.shops.map((s) => (
            <Row key={s.orderId} label={s.shopName} value={[s.taken ? `${s.taken} taken` : "", s.refused ? `${s.refused} refused` : "", s.fault ? `${s.fault} shop's mistake` : ""].filter(Boolean).join(" · ")} />
          ))}
        </div>
      </Card>

      {result.goodsToStore > 0 && (
        <div className="flex items-start gap-3 rounded-[22px] bg-accent-light p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white"><Store size={18} /></div>
          <div className="min-w-0">
            <p className="text-[14px] font-extrabold text-accent-deep">Take the refused items to the Bakhaar store</p>
            <p className="text-[12.5px] leading-snug text-accent-deep/85">{result.payHeld ? "Your pay for this trip is added when the store receives them." : "The store records them."}</p>
          </div>
        </div>
      )}

      {result.goodsToStore > 0 && <Button href="/store" icon={PackageCheck} className="w-full">My items for the store</Button>}
      <Button href="/jobs" iconRight={ArrowRight} variant={result.goodsToStore > 0 ? "secondary" : "primary"} className="w-full">My trips</Button>
      <Button href="/dashboard" variant="secondary" icon={Home} className="w-full">Back to Home</Button>
      <Link href={`/jobs/${job.id}`} className="py-1 text-center text-[12.5px] font-bold text-ink-muted">See this trip</Link>
    </Page>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="min-w-0 break-words text-ink-muted">{label}</span>
      <span className="shrink-0 text-right font-extrabold text-ink">{value}</span>
    </div>
  );
}