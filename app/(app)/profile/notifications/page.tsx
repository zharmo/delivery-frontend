// app/(app)/profile/notifications/page.tsx — notification settings.
// Saved on this phone. They decide what the bell counts and how this phone alerts you.
"use client";

import { useEffect, useState } from "react";
import { Bell, Bike, Building2, RotateCcw, Volume2, Vibrate, Wallet } from "lucide-react";
import { DEFAULT_PREFS, readPrefs, savePrefs, type NotifPrefs } from "@/lib/driver";
import { BackBar, Button, Card, Label, Page, useToast } from "@/components/ui";

const GROUPS: { title: string; rows: { key: keyof NotifPrefs; icon: React.ElementType; title: string; sub: string }[] }[] = [
  {
    title: "What the bell tells you",
    rows: [
      { key: "newTrip", icon: Bike, title: "New trips", sub: "The office gives you a trip, or takes one back" },
      { key: "pickups", icon: RotateCcw, title: "Return pickups", sub: "A new item to collect from a customer" },
      { key: "office", icon: Building2, title: "Office updates", sub: "New delivery times and changes to your trips" },
      { key: "money", icon: Wallet, title: "Money", sub: "You were paid, or the office received your cash" },
    ],
  },
  {
    title: "Sound and vibration",
    rows: [
      { key: "sound", icon: Volume2, title: "Sound", sub: "Play a sound for new trips" },
      { key: "vibrate", icon: Vibrate, title: "Vibrate", sub: "Vibrate the phone for new trips" },
    ],
  },
];

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const toast = useToast();
  useEffect(() => setPrefs(readPrefs()), []);

  function toggle(k: keyof NotifPrefs) {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    savePrefs(next);
  }

  function test() {
    if (prefs.vibrate && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([120, 60, 120]);
    if (prefs.sound) {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.value = 0.15;
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.25);
      } catch {
        /* no sound on this phone */
      }
    }
    toast.show(prefs.sound || prefs.vibrate ? "Test sent to this phone" : "Sound and vibration are off");
  }

  return (
    <>
      {toast.node}
      <BackBar title="Notifications" kicker="Settings" href="/profile" />
      <Page bottom="none">
        <div className="flex items-start gap-3 rounded-[22px] bg-brand-mint p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
            <Bell size={18} />
          </span>
          <div>
            <p className="text-[15px] font-extrabold text-brand">Stay alert on the road</p>
            <p className="text-[12px] leading-snug text-brand-tint">Keep new trips on so you never miss one. These settings are saved on this phone.</p>
          </div>
        </div>
        {GROUPS.map((g) => (
          <Card key={g.title}>
            <Label className="mb-1">{g.title}</Label>
            {g.rows.map((r, i) => (
              <div key={r.key} className={`flex items-center gap-3 py-3 ${i ? "border-t border-line" : ""}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-ink-soft">
                  <r.icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-extrabold text-ink">{r.title}</p>
                  <p className="text-[11.5px] leading-snug text-ink-muted">{r.sub}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={prefs[r.key]}
                  aria-label={r.title}
                  onClick={() => toggle(r.key)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${prefs[r.key] ? "bg-brand" : "bg-line"}`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${prefs[r.key] ? "left-6" : "left-1"}`} />
                </button>
              </div>
            ))}
          </Card>
        ))}
        <Button onClick={test} variant="outline" icon={Volume2} className="w-full">
          Test sound and vibration
        </Button>
      </Page>
    </>
  );
}
