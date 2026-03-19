export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 border-r bg-card p-4 md:block">
        <h2 className="text-lg font-semibold mb-4">Master Control Panel</h2>
        <nav className="space-y-2 text-sm text-muted-foreground">
          <p>Dashboard</p>
          <p>All Clinics</p>
          <p>Billing</p>
          <p>Feature Toggles</p>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
