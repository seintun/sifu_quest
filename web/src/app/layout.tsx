import { OnboardingGuard } from "@/components/layout/OnboardingGuard";
import { Toaster } from "@/components/ui/sonner";

import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Sifu Quest",
  description: "Your path to mastery — AI-powered career coaching dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${geist.variable} ${geistMono.variable} antialiased`}
      >
        <OnboardingGuard>
          {children}
        </OnboardingGuard>
        <Toaster />
      </body>
    </html>
  );
}
