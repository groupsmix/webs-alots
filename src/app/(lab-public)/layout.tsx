import { LabHeader } from "@/components/lab/lab-header";
import { LabFooter } from "@/components/lab/lab-footer";

export default function LabPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LabHeader />
      <main className="flex-1">{children}</main>
      <LabFooter />
    </>
  );
}
