// app/(app)/support/page.tsx
//
// Help for a driver who is stuck. Deliberately plain: a phone number, a
// WhatsApp link, and short answers to the questions the office actually
// gets asked. Nothing here invents an office phone number — the numbers
// come from this app's own environment file, and until they're filled in
// the page says so honestly rather than showing a fake line.
"use client";

import Link from "next/link";
import {
  AlertTriangle, Banknote, HelpCircle, LifeBuoy, MessageCircle, Phone, Truck, XCircle,
} from "lucide-react";
import { Card, PageHeader } from "@/components/ui";

/**
 * Set these in delivery-frontend/.env.local:
 *   NEXT_PUBLIC_SUPPORT_PHONE=+252630000000
 *   NEXT_PUBLIC_SUPPORT_WHATSAPP=252630000000
 */
const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || "";
const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.trim() || "";

const FAQS: { q: string; a: string; icon: React.ElementType }[] = [
  {
    icon: Truck,
    q: "When do I press \"I'm on the way\"?",
    a: "Only after the shop has physically handed you the parcel. Pressing it tells the customer you are moving, so pressing it early means they start waiting for nothing.",
  },
  {
    icon: HelpCircle,
    q: "The customer is asking me for a code. What do I give them?",
    a: "Nothing — there is no delivery code any more. Hand over the parcel, collect the cash if it is a cash order, then press \"Mark as Delivered\" in the app.",
  },
  {
    icon: Banknote,
    q: "The customer wants to pay a different amount.",
    a: "Don't accept it. The amount on the delivery page is the order total and cannot be changed in the app. Call the office before handing the parcel over.",
  },
  {
    icon: XCircle,
    q: "Nobody is at the address.",
    a: "Call the customer from the delivery page first — most failures are a missed call. If there is still no answer, open the delivery, press \"Report a Problem\" and choose a reason. You can then go out again later or take the parcel back to the shop.",
  },
  {
    icon: AlertTriangle,
    q: "I pressed the wrong button.",
    a: "You can't undo a step yourself — that's on purpose, so the record stays honest. Call the office and they will fix it from the admin side.",
  },
  {
    icon: LifeBuoy,
    q: "My account says suspended.",
    a: "Only the office can lift that. Call them — you won't be able to take deliveries until they do.",
  },
];

export default function SupportPage() {
  const hasContact = Boolean(SUPPORT_PHONE || SUPPORT_WHATSAPP);

  return (
    <>
      <PageHeader title="Support" subtitle="Help while you're on the road" />

      {/* ── Reach the office ── */}
      <Card title="Contact the Office" icon={<LifeBuoy className="h-4 w-4 text-brand" />} className="mb-3">
        {hasContact ? (
          <div className="flex flex-col gap-2.5">
            {SUPPORT_PHONE && (
              <a
                href={`tel:${SUPPORT_PHONE}`}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-brand text-[14px] font-bold text-white"
              >
                <Phone className="h-4 w-4" />
                Call {SUPPORT_PHONE}
              </a>
            )}
            {SUPPORT_WHATSAPP && (
              <a
                href={`https://wa.me/${SUPPORT_WHATSAPP}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-line text-[14px] font-bold text-brand"
              >
                <MessageCircle className="h-4 w-4" />
                Message on WhatsApp
              </a>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-surface-sunken p-3.5">
            <p className="text-[12.5px] leading-[1.6] text-ink-muted">
              No support number has been set for this app yet. Ask the Bakhaar office for the number
              to call during your shift — they can add it so it appears here for every driver.
            </p>
          </div>
        )}
      </Card>

      {/* ── FAQ ── */}
      <Card title="Common Questions" icon={<HelpCircle className="h-4 w-4 text-brand" />} className="mb-3">
        <div className="flex flex-col divide-y divide-line-soft">
          {FAQS.map((f) => (
            <div key={f.q} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-light">
                <f.icon className="h-4 w-4 text-brand" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold leading-[1.4] text-ink">{f.q}</div>
                <p className="mt-1 text-[12px] leading-[1.6] text-ink-soft">{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── The road, in one card ── */}
      <Card title="How a Delivery Works" icon={<Truck className="h-4 w-4 text-brand" />} className="mb-3">
        <ol className="flex flex-col gap-2.5">
          {[
            ["Assigned", "The office gives you the delivery. It appears on your dashboard."],
            ["On the Way", "You collect the parcel from the shop and press the button. The customer is told you're moving."],
            ["Delivered", "You hand it over, collect the cash if it's a cash order, and mark it delivered."],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-extrabold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-bold text-ink">{title}</div>
                <p className="text-[11.5px] leading-[1.55] text-ink-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 rounded-xl bg-surface-sunken p-3 text-[11.5px] leading-[1.55] text-ink-muted">
          If something goes wrong on the way, report it and the delivery is marked{" "}
          <strong>Failed</strong> — it stays on your list so you can try again or return the parcel
          to the shop.
        </p>
      </Card>

      <div className="mt-4 text-center text-[11px] text-ink-faint">
        <Link href="/dashboard" className="font-bold text-brand underline">
          Back to Dashboard
        </Link>
      </div>
    </>
  );
}
