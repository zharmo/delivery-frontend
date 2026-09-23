// app/(app)/layout.tsx
// Wraps every signed-in page in the nav shell + auth guard.
import AppShell from "@/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
