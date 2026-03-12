import { DesktopCoachFloatingCta, MobileBottomNav, MobileCoachFloatingCta, MobileSidebar, Sidebar } from "@/components/layout/Sidebar";
import { AuthStatusProvider } from "@/context/AuthStatusContext";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthStatusProvider>
      <Sidebar />
      <MobileSidebar />
      <DesktopCoachFloatingCta />
      <MobileCoachFloatingCta />
      <MobileBottomNav />
      <main className="md:ml-56 min-h-screen pt-12 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] md:pt-0 md:pb-0">
        <div className="p-3 sm:p-4 md:p-6">
          {children}
        </div>
      </main>
    </AuthStatusProvider>
  );
}
