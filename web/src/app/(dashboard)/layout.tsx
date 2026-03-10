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
      <main className="md:ml-56 min-h-screen pt-14 md:pt-0">
        <div className="p-6">
          {children}
        </div>
      </main>
    </>
  );
}
