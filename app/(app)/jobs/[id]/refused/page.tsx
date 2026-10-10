// app/(app)/jobs/[id]/refused/page.tsx
//
// Refusals are now recorded item by item on the door screen (taken /
// refused / shop's mistake), so this older page only sends the driver there.
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullLoader } from "@/components/ui";

export default function RefusedRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/jobs/${id}/handover`);
  }, [id, router]);
  return <FullLoader label="Opening the door screen…" />;
}