export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 border-r bg-card p-4 md:block">
        <h2 className="text-lg font-semibold mb-4">Patient Portal</h2>
        <nav className="space-y-2 text-sm text-muted-foreground">
          <p>Dashboard</p>
          <p>Appointments</p>
          <p>Medical History</p>
          <p>Prescriptions</p>
          <p>Documents</p>
          <p>Invoices</p>
          <p>Family Members</p>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
