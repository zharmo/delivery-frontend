// app/page.tsx — the entry point just decides where to send you.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";
import { FullLoader } from "@/components/ui";

export default function IndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getToken() ? "/dashboard" : "/login");
  }, [router]);
  return <FullLoader label="Opening Bakhaar Delivery…" />;
}
