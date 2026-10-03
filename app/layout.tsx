// app/layout.tsx — the root layout for the delivery app.
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bakhaar Delivery",
  description: "The driver app for the Bakhaar marketplace, Hargeisa.",
};

// Phone-first: fill the screen, sit under the notch, no double-tap zoom.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0E3B2A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* The whole app is a phone-width column, also on a computer. */}
        <div className="relative mx-auto min-h-screen w-full max-w-[480px] bg-surface-page shadow-[0_0_40px_rgba(16,24,32,0.08)]">
          {children}
        </div>
      </body>
    </html>
  );
}
