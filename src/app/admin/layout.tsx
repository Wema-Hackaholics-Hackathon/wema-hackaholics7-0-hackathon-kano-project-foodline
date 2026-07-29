import { requireRole } from "@/lib/session";
import { AdminSidebar, AdminTopBar } from "./admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireRole("admin");
  return (
    <div className="min-h-full bg-oat">
      <AdminSidebar name={admin.name} />
      <AdminTopBar name={admin.name} />
      <main className="md:pl-64">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-8">{children}</div>
      </main>
    </div>
  );
}
