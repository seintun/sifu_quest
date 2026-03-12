"use client";

import { DesktopCoachFloatingCta, MobileBottomNav, MobileCoachFloatingCta, MobileSidebar, Sidebar } from "@/components/layout/Sidebar";
import { AuthStatusProvider } from "@/context/AuthStatusContext";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const onCoachRoute = pathname.startsWith("/coach");

  return (
    <AuthStatusProvider>
      <Sidebar />
      <MobileSidebar />
      <DesktopCoachFloatingCta />
      <MobileCoachFloatingCta />
      <MobileBottomNav />
      <main
        className={cn(
          "md:ml-56 min-h-screen md:pt-0 md:pb-0",
          onCoachRoute
            ? "pt-0 pb-0 overflow-hidden"
            : "pt-12 pb-[calc(env(safe-area-inset-bottom)+4.5rem)]",
        )}
      >
        <div className={cn(onCoachRoute ? "p-0 md:p-6" : "p-3 sm:p-4 md:p-6")}>
          {children}
        </div>
      </main>
    </AuthStatusProvider>
  );
}
