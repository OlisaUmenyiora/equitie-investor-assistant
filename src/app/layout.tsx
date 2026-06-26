import type { Metadata } from "next";
import { Space_Grotesk, Inter_Tight } from "next/font/google";
import "./globals.css";

// Matching the equit.ai brand typography: Space Grotesk for display/headings,
// Inter Tight for body and figures.
const display = Space_Grotesk({
  variable: "--font-display-brand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Inter_Tight({
  variable: "--font-body-brand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "EquiTie · Investor Assistant",
  description:
    "A personalised, grounded AI assistant for EquiTie investors. Ask about your portfolio, positions, fees and statements.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
