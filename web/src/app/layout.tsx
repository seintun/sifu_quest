import { OnboardingGuard } from "@/components/layout/OnboardingGuard";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { Toaster } from "@/components/ui/sonner";
import { APP_KEYWORDS, BRAND_DESCRIPTION, BRAND_NAME, BRAND_TAGLINE, getCanonicalSiteUrl } from "@/lib/brand";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(getCanonicalSiteUrl()),
  title: {
    default: BRAND_NAME,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  keywords: APP_KEYWORDS,
  openGraph: {
    title: BRAND_NAME,
    description: BRAND_TAGLINE,
    siteName: BRAND_NAME,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: BRAND_NAME,
    description: BRAND_TAGLINE,
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: BRAND_NAME,
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090B",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geist.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegistration />
        <OfflineBanner />
        <OnboardingGuard>
          {children}
        </OnboardingGuard>
        <Toaster />
      </body>
    </html>
  );
}
