// app/(app)/profile/password/page.tsx — change your password.
"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { changePassword, errorText } from "@/lib/driver";
import { BackBar, BottomBar, Button, Card, INPUT, InlineError, Page, useToast } from "@/components/ui";

export default function PasswordPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  async function save() {
    setErr(null);
    if (!current) return setErr("Enter your current password");
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
      return setErr("The new password must be at least 8 characters, with letters and numbers");
    }
    if (next !== again) return setErr("The two new passwords are not the same");
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setAgain("");
      toast.show("Password changed");
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const type = show ? "text" : "password";
  return (
    <>
      {toast.node}
      <BackBar title="Change password" href="/profile" />
      <Page bottom="bar">
        <div className="flex items-start gap-3 rounded-[22px] bg-brand-mint p-4">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand" />
          <p className="text-[12.5px] leading-snug text-brand">Use at least 8 characters, with letters and numbers. Changing it signs you out on any other phone. Don&apos;t share your password — not even with other drivers.</p>
        </div>
        <Card>
          <Field label="Current password" value={current} onChange={setCurrent} type={type} auto="current-password" />
          <Field label="New password" value={next} onChange={setNext} type={type} auto="new-password" />
          <Field label="New password again" value={again} onChange={setAgain} type={type} auto="new-password" />
          <button onClick={() => setShow((s) => !s)} className="mt-3 flex items-center gap-1.5 text-[12.5px] font-extrabold text-brand">
            {show ? <EyeOff size={15} /> : <Eye size={15} />} {show ? "Hide passwords" : "Show passwords"}
          </button>
        </Card>
        <InlineError message={err} />
      </Page>
      <BottomBar>
        <Button onClick={save} loading={busy} disabled={!current || !next || !again} icon={KeyRound} className="mb-1 w-full">
          Change password
        </Button>
      </BottomBar>
    </>
  );
}

function Field({ label, value, onChange, type, auto }: { label: string; value: string; onChange: (v: string) => void; type: string; auto: string }) {
  return (
    <div className="mt-3 first:mt-0">
      <label className="text-[12.5px] font-extrabold text-ink">{label}</label>
      <input className={`${INPUT} mt-2`} type={type} autoComplete={auto} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}