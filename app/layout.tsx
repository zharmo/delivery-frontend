// app/layout.tsx — the root layout for the delivery app.
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bakhaar Delivery",
  description: "Delivery staff app for the Bakhaar marketplace, Hargeisa.",
};

// Phone-first: fill the screen, sit under the notch, don't let a double-tap
// zoom the page while a rider is working.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0E3B2A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
