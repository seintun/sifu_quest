import { MobileSidebar, Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Sidebar />
      <MobileSidebar />
      <main className="md:ml-56 min-h-screen pt-12 md:pt-0">
        <div className="p-3 sm:p-4 md:p-6">
          {children}
        </div>
      </main>
    </>
  );
}
