// app/(app)/support/page.tsx — help for a driver who is stuck.
// The office numbers come from .env.local (NEXT_PUBLIC_SUPPORT_PHONE /
// NEXT_PUBLIC_SUPPORT_WHATSAPP). Until they are set, no fake number is shown.
"use client";

import { useState } from "react";
import { AlertTriangle, Ban, Banknote, ChevronDown, LifeBuoy, MessageCircle, Phone, RotateCcw, Truck, XCircle } from "lucide-react";
import { OFFICE_PHONE, OFFICE_WHATSAPP } from "@/lib/office";
import { telHref } from "@/lib/format";
import { BackBar, Button, Card, Page } from "@/components/ui";

const FAQS: { q: string; a: string; icon: React.ElementType }[] = [
  {
    icon: Truck,
    q: "When do I press \"start delivery\"?",
    a: "Only when every shop's bag is in your bag. The app won't let you set off before that. Pressing it tells the customer you are coming.",
  },
  {
    icon: Banknote,
    q: "The customer wants to pay a different amount.",
    a: "Don't accept it. The amount in the app is what they owe. If a shop's items are refused, mark that shop Refused and the app takes it off the cash. Call the office if you are not sure.",
  },
  {
    icon: Ban,
    q: "The customer refuses everything. Who pays?",
    a: "If it's their choice and it's a cash order, they pay the delivery fee — ask for it and say in the app if they paid. If the shop made a mistake (wrong, damaged, not as described), take no money. Either way you are paid for the trip and you take the bags back to the shops.",
  },
  {
    icon: XCircle,
    q: "Nobody is at the address.",
    a: "Call the customer first — most problems are a missed call. Then press \"Couldn't deliver\" and choose why. Everything stays with you; you can try again, or the office will give a new time.",
  },
  {
    icon: RotateCcw,
    q: "A return pickup item doesn't look right.",
    a: "Don't take it. Only press \"I have the item\" when it matches the return. If it doesn't, call the office before you leave the customer.",
  },
  {
    icon: AlertTriangle,
    q: "I pressed the wrong button.",
    a: "While collecting you can press Undo on a shop. After that, call the office — they can fix it from their side.",
  },
  {
    icon: LifeBuoy,
    q: "My account says paused.",
    a: "Only the office can switch it back on. Call them — you can't take trips until they do.",
  },
];

export default function SupportPage() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <>
      <BackBar title="Help & support" href="/profile" />
      <Page>
        <Card>
          <p className="text-[16px] font-extrabold text-ink">Call the office</p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">For anything the app can&apos;t fix — a wrong address, a problem with cash, a mistake.</p>
          {OFFICE_PHONE || OFFICE_WHATSAPP ? (
            <div className="mt-3 flex flex-col gap-2.5">
              {OFFICE_PHONE && (
                <Button href={telHref(OFFICE_PHONE)} icon={Phone} className="w-full">
                  Call {OFFICE_PHONE}
                </Button>
              )}
              {OFFICE_WHATSAPP && (
                <Button href={`https://wa.me/${OFFICE_WHATSAPP}`} variant="secondary" icon={MessageCircle} className="w-full">
                  WhatsApp the office
                </Button>
              )}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl bg-surface-sunken p-3.5 text-[12.5px] text-ink-soft">
              The office number isn&apos;t set in this app yet. Use the number the office gave you.
            </p>
          )}
        </Card>
        <p className="px-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">Common questions</p>
        <div className="overflow-hidden rounded-[22px] bg-white shadow-card">
          {FAQS.map((f, i) => (
            <div key={f.q} className={i ? "border-t border-line" : ""}>
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-ink-soft">
                  <f.icon size={17} />
                </span>
                <span className="flex-1 text-[13.5px] font-extrabold text-ink">{f.q}</span>
                <ChevronDown size={17} className={`shrink-0 text-ink-faint transition-transform ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && <p className="px-4 pb-4 pl-16 text-[12.5px] leading-relaxed text-ink-soft">{f.a}</p>}
            </div>
          ))}
        </div>
      </Page>
    </>
  );
}
