// app/(app)/profile/page.tsx
//
// The driver's own details. Only three fields are theirs to change — phone
// and the two vehicle fields. Name, email and account status belong to the
// office, and are shown read-only with a "contact admin" note rather than
// as inputs that would be rejected on save.
"use client";

import { useEffect, useState } from "react";
import {
  Bell, Bike, CircleUser, LogOut, Mail, MapPin, Phone, ShieldCheck, Truck, User,
} from "lucide-react";
import {
  getProfile, logout, setAvailability, updateProfile, useAsync,
} from "@/lib/deliveries";
import {
  Button, Card, ConfirmSheet, ErrorState, LoadingState, PageHeader, Row, Toast,
} from "@/components/ui";

const STATUS_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  ACTIVE: { bg: "#EAF7EE", fg: "#2C6B44", label: "Active — taking deliveries" },
  OFFLINE: { bg: "#F0F1F6", fg: "#6B7280", label: "Offline — not taking deliveries" },
  BUSY: { bg: "#FFF1E0", fg: "#D9540F", label: "Busy" },
  SUSPENDED: { bg: "#FDEAEA", fg: "#C4362A", label: "Suspended — contact the office" },
};

const VEHICLES = ["motorbike", "car", "bicycle", "on foot"];

export default function ProfilePage() {
  const { data, loading, error, reload } = useAsync(getProfile);

  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    setPhone(data.phone ?? "");
    setVehicleType(data.vehicleType ?? "");
    setVehicleNumber(data.vehicleNumber ?? "");
  }, [data]);

  if (loading) return <LoadingState label="Loading your profile…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const tone = STATUS_TONE[data.status] ?? STATUS_TONE.OFFLINE;
  const suspended = data.status === "SUSPENDED";
  const changed =
    phone !== (data.phone ?? "") ||
    vehicleType !== (data.vehicleType ?? "") ||
    vehicleNumber !== (data.vehicleNumber ?? "");

  async function save() {
    setSaving(true);
    try {
      await updateProfile({ phone, vehicleType, vehicleNumber });
      setToast({ tone: "success", message: "Profile updated" });
      reload();
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "Could not save" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability() {
    setTogglingStatus(true);
    try {
      const next = data!.status === "ACTIVE" ? "OFFLINE" : "ACTIVE";
      await setAvailability(next);
      setToast({
        tone: "success",
        message: next === "ACTIVE" ? "You're active — the office can assign you work" : "You're offline",
      });
      reload();
    } catch (err) {
      setToast({ tone: "error", message: err instanceof Error ? err.message : "Could not change status" });
    } finally {
      setTogglingStatus(false);
    }
  }

  return (
    <>
      <PageHeader title="Profile" subtitle="Your delivery account" />

      {/* ── Identity ── */}
      <Card className="mb-3">
        <div className="flex items-center gap-3.5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand text-[20px] font-extrabold text-white">
            {data.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[17px] font-extrabold text-ink">{data.name}</div>
            <div className="truncate text-[12.5px] text-ink-muted">{data.email}</div>
            <span
              className="mt-1 inline-block rounded-full px-2.5 py-1 text-[10.5px] font-extrabold"
              style={{ background: tone.bg, color: tone.fg }}
            >
              {tone.label}
            </span>
          </div>
        </div>

        {/* The area the office registered this driver for. Read-only here. */}
        <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-brand-light px-3.5 py-3">
          <MapPin className="h-4 w-4 shrink-0 text-brand" />
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-brand-tint">
              Your Area
            </div>
            <div className="truncate text-[13.5px] font-bold text-brand">
              {data.assignedLocation || "Not set by the office yet"}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Availability ── */}
      {!suspended && (
        <Card className="mb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13.5px] font-extrabold text-ink">Availability</div>
              <p className="mt-0.5 text-[11.5px] leading-[1.5] text-ink-muted">
                Go offline when your shift ends so the office doesn&apos;t assign you new work.
              </p>
            </div>
            <button
              onClick={toggleAvailability}
              disabled={togglingStatus}
              aria-label="Toggle availability"
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                data.status === "ACTIVE" ? "bg-brand" : "bg-line"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${
                  data.status === "ACTIVE" ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </Card>
      )}

      {suspended && (
        <div className="mb-3 rounded-2xl bg-[#FDEAEA] p-4">
          <p className="text-[12.5px] leading-[1.6] text-[#C4362A]">
            <strong>Your account is suspended.</strong> You can&apos;t take deliveries until the
            Bakhaar office reactivates it.
          </p>
        </div>
      )}

      {/* ── Editable ── */}
      <Card title="Your Details" icon={<User className="h-4 w-4 text-brand" />} className="mb-3">
        <label className="mb-1.5 block text-[12px] font-bold text-ink">Phone</label>
        <div className="mb-3.5 flex items-center gap-2 rounded-xl border border-line bg-surface-sunken px-3.5">
          <Phone className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="+252 63 000 0000"
            className="w-full bg-transparent py-3.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>

        <label className="mb-1.5 block text-[12px] font-bold text-ink">Vehicle</label>
        <div className="mb-3.5 flex flex-wrap gap-2">
          {VEHICLES.map((v) => (
            <button
              key={v}
              onClick={() => setVehicleType(v)}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 px-3.5 text-[12.5px] font-bold capitalize ${
                vehicleType === v ? "border-brand bg-brand-light text-brand" : "border-line bg-white text-ink-soft"
              }`}
            >
              <Bike className="h-3.5 w-3.5" />
              {v}
            </button>
          ))}
        </div>

        <label className="mb-1.5 block text-[12px] font-bold text-ink">Vehicle Number</label>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-sunken px-3.5">
          <Truck className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
            placeholder="HGA-1234"
            className="w-full bg-transparent py-3.5 text-[14px] uppercase text-ink placeholder:normal-case placeholder:text-ink-faint focus:outline-none"
          />
        </div>

        {changed && (
          <div className="mt-4">
            <Button onClick={save} loading={saving}>
              Save Changes
            </Button>
          </div>
        )}
      </Card>

      {/* ── Read-only ── */}
      <Card title="Account" icon={<ShieldCheck className="h-4 w-4 text-brand" />} className="mb-3">
        <Row label="Full name" value={data.name} />
        <Row label="Email" value={data.email} />
        <Row label="Account status" value={data.status} />
        <Row label="Assigned area" value={data.assignedLocation || "—"} />
        <Row label="Joined" value={new Date(data.joinedAt).toLocaleDateString()} />
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-surface-sunken p-3">
          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <p className="text-[11.5px] leading-[1.55] text-ink-muted">
            To change your name, email, password, assigned area or account status, contact the
            Bakhaar office — those are set by an administrator.
          </p>
        </div>
      </Card>

      {/* ── Notifications: honest about what exists ── */}
      <Card title="Notifications" icon={<Bell className="h-4 w-4 text-brand" />} className="mb-3">
        <p className="text-[12px] leading-[1.6] text-ink-muted">
          New deliveries appear on your dashboard when you open or refresh the app. Push
          notifications aren&apos;t set up yet — keep an eye on the dashboard during your shift.
        </p>
      </Card>

      <Button tone="danger" onClick={() => setConfirmLogout(true)}>
        <LogOut className="h-4 w-4" />
        Log Out
      </Button>

      <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-ink-faint">
        <CircleUser className="h-3.5 w-3.5" />
        Bakhaar Delivery · Hargeisa
      </div>

      <ConfirmSheet
        open={confirmLogout}
        title="Log out?"
        body="You'll need your email and password to sign back in."
        confirmLabel="Yes, log out"
        tone="danger"
        onConfirm={logout}
        onCancel={() => setConfirmLogout(false)}
      />

      {toast && <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
