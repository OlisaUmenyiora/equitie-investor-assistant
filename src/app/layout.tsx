import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// Poppins across the entire application (display, body, and mono slots).
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
