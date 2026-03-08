import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar, MobileSidebar } from "@/components/layout/Sidebar";
import { OnboardingGuard } from "@/components/layout/OnboardingGuard";
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
  title: "Thinking Buddy",
  description: "Your personal job search & interview prep dashboard",
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
          <Sidebar />
          <MobileSidebar />
          <main className="md:ml-56 min-h-screen pt-14 md:pt-0">
            <div className="p-6">
              {children}
            </div>
          </main>
        </OnboardingGuard>
      </body>
    </html>
  );
}
