import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

// Display serif with warmth and character (opsz axis) — the editorial voice.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

// Clean, humanist grotesque for body — refined, not generic.
const hanken = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Monospace for source-row citations and figures.
const mono = Spline_Sans_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EquiTie · Investor Assistant",
  description:
    "A personalised, grounded AI assistant for EquiTie investors — ask about your portfolio, positions, fees and statements.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${hanken.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
