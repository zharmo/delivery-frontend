// app/(app)/profile/details/page.tsx — My details.
// You can change your phone and vehicle. Name, email and city are the office's.
"use client";

import { useEffect, useState } from "react";
import { Bike, Car, Check, Footprints, Lock, Mail, MapPin, Phone, Save, User } from "lucide-react";
import { getProfile, updateProfile, useAsync, errorText, VEHICLES } from "@/lib/driver";
import { BackBar, BottomBar, Button, Card, ErrorState, FullLoader, INPUT, InlineError, Label, Page, Avatar, useToast } from "@/components/ui";

/** A simple motorbike (lucide has only a bicycle). */
function Motorbike({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="5" cy="17" r="3" />
      <circle cx="19" cy="17" r="3" />
      <path d="M8 17h6l3-6h-4l-2-3H8" />
      <path d="M16 6h2l1 5" />
    </svg>
  );
}

const ICON: Record<string, React.ElementType> = { motorbike: Motorbike, car: Car, bicycle: Bike, "on foot": Footprints };

export default function DetailsPage() {
  const { data, loading, error, reload, setData } = useAsync(getProfile, []);
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!data) return;
    setPhone(data.phone ?? "");
    setVehicleType(data.vehicleType ?? "");
    setVehicleNumber(data.vehicleNumber ?? "");
  }, [data]);

  if (loading && !data) return <FullLoader />;
  if (error && !data)
    return (
      <>
        <BackBar title="My details" href="/profile" />
        <Page bottom="none">
          <ErrorState message={error} onRetry={reload} />
        </Page>
      </>
    );
  if (!data) return null;

  const changed = phone !== (data.phone ?? "") || vehicleType !== (data.vehicleType ?? "") || vehicleNumber !== (data.vehicleNumber ?? "");

  async function save() {
    setErr(null);
    if (phone.trim() && phone.replace(/\D/g, "").length < 6) return setErr("Enter a full phone number");
    setBusy(true);
    try {
      const p = await updateProfile({ phone: phone.trim(), vehicleType, vehicleNumber: vehicleNumber.trim().toUpperCase() });
      setData(p);
      toast.show("Saved");
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {toast.node}
      <BackBar title="My details" href="/profile" />
      <Page bottom="bar">
        <Card className="flex items-center gap-3">
          <Avatar name={data.name} size={54} dark />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-extrabold text-ink">{data.name}</p>
            <p className="truncate text-[12px] text-ink-muted">{data.email}</p>
          </div>
        </Card>

        <Card>
          <Label>Personal information</Label>
          <ReadOnly icon={User} label="Full name" value={data.name} />
          <ReadOnly icon={Mail} label="Email" value={data.email} />
          <ReadOnly icon={MapPin} label="City" value={data.assignedLocation ?? "—"} />
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-faint">
            <Lock size={11} /> Only the office can change these.
          </p>
          <label className="mt-4 block text-[12.5px] font-extrabold text-ink">Phone number</label>
          <div className="relative mt-2">
            <Phone size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input className={`${INPUT} pl-11`} inputMode="tel" placeholder="063 412 3456" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">Customers and shops call you on this number.</p>
        </Card>

        <Card>
          <Label>Vehicle</Label>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {VEHICLES.map((v) => {
              const on = vehicleType === v.value;
              const Icon = ICON[v.value] ?? Bike;
              return (
                <button
                  key={v.value}
                  onClick={() => setVehicleType(v.value)}
                  className={`relative flex flex-col items-start rounded-2xl border-2 p-3 text-left ${on ? "border-brand bg-brand-light/70" : "border-line bg-white"}`}
                >
                  {on && (
                    <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${on ? "bg-brand text-white" : "bg-surface-sunken text-ink-soft"}`}>
                    <Icon size={19} />
                  </span>
                  <span className="mt-2 text-[14px] font-extrabold text-ink">{v.label}</span>
                  <span className="text-[11px] text-ink-muted">{v.hint}</span>
                </button>
              );
            })}
          </div>
          <label className="mt-4 block text-[12.5px] font-extrabold text-ink">Plate number</label>
          <input className={`${INPUT} mt-2 uppercase`} placeholder="e.g. HGA 4521" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
        </Card>
        <InlineError message={err} />
      </Page>
      <BottomBar>
        <Button onClick={save} loading={busy} disabled={!changed} icon={Save} className="w-full">
          Save changes
        </Button>
        <button
          onClick={() => {
            setPhone(data.phone ?? "");
            setVehicleType(data.vehicleType ?? "");
            setVehicleNumber(data.vehicleNumber ?? "");
          }}
          disabled={!changed}
          className="mt-1 min-h-[44px] w-full text-[13px] font-bold text-ink-muted disabled:opacity-40"
        >
          Discard changes
        </button>
      </BottomBar>
    </>
  );
}

function ReadOnly({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="mt-3">
      <p className="text-[11.5px] font-bold text-ink-muted">{label}</p>
      <div className="mt-1 flex items-center gap-2.5 rounded-2xl bg-surface-sunken px-4 py-3 text-[14px] font-semibold text-ink-soft">
        <Icon size={15} className="text-ink-faint" />
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
