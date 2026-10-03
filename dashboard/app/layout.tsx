import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Incident risk",
  description: "Risk of each CER pipeline incident, as of 2026-09-25. Risk is likelihood times consequence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
