import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";
import { getPublicBranding } from "@/lib/data/public";

export default async function DentistPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getPublicBranding();

  return (
    <div
      style={
        {
          "--brand-primary": branding.primaryColor,
          "--brand-secondary": branding.secondaryColor,
          "--brand-heading-font": branding.headingFont,
          "--brand-body-font": branding.bodyFont,
        } as React.CSSProperties
      }
    >
      <PublicHeader
        logoUrl={branding.logoUrl}
        clinicName={branding.clinicName}
      />
      <main className="flex-1">{children}</main>
      <PublicFooter clinicName={branding.clinicName} />
    </div>
  );
}
