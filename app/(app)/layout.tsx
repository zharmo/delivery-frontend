// app/(app)/layout.tsx — every signed-in page sits inside the app frame.
import AppShell from "@/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
