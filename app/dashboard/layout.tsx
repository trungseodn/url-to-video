import ZTTeamSidebar from "@/components/Sidebar";

export default function ZTTeamDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen overflow-x-clip">
      <ZTTeamSidebar />
      <main className="ml-72 flex-1 p-8 min-w-0">{children}</main>
    </div>
  );
}
