import { PharmacyHeader } from "@/components/pharmacy/pharmacy-header";
import { PharmacyFooter } from "@/components/pharmacy/pharmacy-footer";

export default function PharmacyPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PharmacyHeader />
      <main className="flex-1">{children}</main>
      <PharmacyFooter />
    </>
  );
}
