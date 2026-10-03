// app/(app)/profile/page.tsx — Profile.
//
// Who you are, your duty status (online / busy / offline), and the way to
// your details, notification settings, password, history and help.
"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, Bell, Bike, ChevronRight, History, KeyRound, LifeBuoy, LogOut, MapPin, Phone, UserCog } from "lucide-react";
import { DUTY, getProfile, logout, setAvailability, useAsync, errorText, VEHICLES, type DutyStatus } from "@/lib/driver";
import { getEarnings } from "@/lib/pickups";
import { money } from "@/lib/format";
import { Avatar, Button, Card, ErrorState, Label, Page, Sheet, Skeleton, TopBar, useToast } from "@/components/ui";

const MENU = [
  { href: "/profile/details", icon: UserCog, title: "My details", sub: "Phone and vehicle" },
  { href: "/profile/notifications", icon: Bell, title: "Notifications", sub: "What the bell tells you" },
  { href: "/profile/password", icon: KeyRound, title: "Change password", sub: "Keep your account safe" },
  { href: "/history", icon: History, title: "Trip history", sub: "Every trip you finished" },
  { href: "/support", icon: LifeBuoy, title: "Help & support", sub: "Call the office, common questions" },
];

export default function ProfilePage() {
  const { data, loading, error, reload, setData } = useAsync(async () => {
    const [profile, earnings] = await Promise.all([getProfile(), getEarnings().catch(() => null)]);
    return { profile, cash: earnings?.cash.toHandOver ?? 0, deliveredToday: earnings?.deliveredToday ?? 0 };
  }, []);
  const [saving, setSaving] = useState<DutyStatus | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);
  const toast = useToast();

  async function duty(s: DutyStatus) {
    if (!data || data.profile.status === s) return;
    setSaving(s);
    try {
      const r = await setAvailability(s);
      setData({ ...data, profile: { ...data.profile, status: r.status } });
      toast.show(`You're ${DUTY[s].label.toLowerCase()}`);
    } catch (e) {
      toast.show(errorText(e), "danger");
    } finally {
      setSaving(null);
    }
  }

  const vehicle = VEHICLES.find((v) => v.value === data?.profile.vehicleType)?.label ?? data?.profile.vehicleType;

  return (
    <>
      {toast.node}
      <TopBar title="Profile" />
      <Page>
        {loading && !data ? (
          <Skeleton rows={3} />
        ) : error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data ? (
          <>
            <Card className="flex flex-col items-center py-6 text-center">
              <div className="relative">
                <Avatar name={data.profile.name} size={78} dark />
                <span
                  className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-[3px] border-white ${
                    data.profile.status === "ACTIVE" ? "bg-[#22A06B]" : data.profile.status === "BUSY" ? "bg-accent" : "bg-ink-faint"
                  }`}
                />
              </div>
              <p className="mt-3 text-[21px] font-extrabold text-ink">{data.profile.name}</p>
              <p className="text-[12px] text-ink-muted">{data.profile.email}</p>
              {data.profile.phone && (
                <p className="mt-0.5 flex items-center gap-1 text-[12.5px] font-bold text-ink-soft">
                  <Phone size={12} /> {data.profile.phone}
                </p>
              )}
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {(vehicle || data.profile.vehicleNumber) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-bold text-ink-soft">
                    <Bike size={12} /> {[vehicle, data.profile.vehicleNumber].filter(Boolean).join(" · ")}
                  </span>
                )}
                {data.profile.assignedLocation && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-bold text-ink-soft">
                    <MapPin size={12} /> {data.profile.assignedLocation}
                  </span>
                )}
              </div>
            </Card>

            <Card>
              <Label>Duty status</Label>
              <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-surface-sunken p-1.5">
                {(["ACTIVE", "BUSY", "OFFLINE"] as DutyStatus[]).map((s) => {
                  const on = data.profile.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => duty(s)}
                      disabled={saving !== null}
                      className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl text-[13px] font-extrabold ${on ? "bg-brand text-white shadow-card" : "text-ink-muted"}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${s === "ACTIVE" ? "bg-[#22A06B]" : s === "BUSY" ? "bg-accent" : "bg-ink-faint"}`} />
                      {DUTY[s].label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11.5px] text-ink-muted">
                {data.profile.status in DUTY ? DUTY[data.profile.status as DutyStatus].help : "The office has set your status."}
              </p>
            </Card>

            <div className="overflow-hidden rounded-[22px] bg-white shadow-card">
              {MENU.map((m, i) => (
                <Link key={m.href} href={m.href} className={`flex items-center gap-3 px-4 py-3.5 ${i ? "border-t border-line" : ""}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-ink-soft">
                    <m.icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-extrabold text-ink">{m.title}</p>
                    <p className="truncate text-[11.5px] text-ink-muted">{m.sub}</p>
                  </div>
                  <ChevronRight size={17} className="text-ink-faint" />
                </Link>
              ))}
            </div>

            <Button onClick={() => setConfirmOut(true)} variant="danger-soft" icon={LogOut} className="w-full">
              Log out
            </Button>
            <p className="text-center text-[11px] font-semibold text-ink-faint">Bakhaar Delivery · driver app</p>

            <Sheet
              open={confirmOut}
              onClose={() => setConfirmOut(false)}
              title="Log out of Bakhaar Delivery?"
              footer={
                <div className="grid grid-cols-2 gap-2.5 pb-1">
                  <Button onClick={() => setConfirmOut(false)} variant="secondary">
                    Cancel
                  </Button>
                  <Button onClick={logout} variant="danger">
                    Yes, log out
                  </Button>
                </div>
              }
            >
              {data.cash > 0 ? (
                <div className="flex items-start gap-3 rounded-2xl bg-danger-light p-3.5">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
                  <p className="text-[13px] leading-snug text-danger-deep">
                    You still hold <b>{money(data.cash)}</b> of customers&apos; cash. Hand it in at the office before you finish your day.
                  </p>
                </div>
              ) : (
                <p className="text-[13px] text-ink-soft">You have no cash to hand in. You can sign in again any time.</p>
              )}
            </Sheet>
          </>
        ) : null}
      </Page>
    </>
  );
}
