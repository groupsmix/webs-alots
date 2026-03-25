import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";
import { getPublicBranding } from "@/lib/data/public";
import { getTenant } from "@/lib/tenant";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getTenant();

  // Root domain (no tenant) → render children directly.
  // The landing page provides its own header/footer.
  if (!tenant) {
    return <>{children}</>;
  }

  // Subdomain → wrap with clinic branding, header, and footer
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
