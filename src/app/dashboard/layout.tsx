import Sidebar from '@/components/dashboard/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 pt-20 md:p-8">
        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
