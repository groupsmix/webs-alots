import { ClinicPublicLayout } from "@/components/layouts/clinic-public-layout";

export default async function DentistPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClinicPublicLayout>{children}</ClinicPublicLayout>;
}
