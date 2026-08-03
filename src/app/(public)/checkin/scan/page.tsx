import type { Metadata } from "next";
import { QrCheckinResult } from "@/components/patient-experience/qr-checkin-result";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Check-in",
  description: "Scannez votre QR code pour confirmer votre rendez-vous.",
  path: "/checkin/scan",
  noIndex: true,
});

export default async function CheckinScanPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const searchParams = await props.searchParams;
  const token = searchParams.token;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">Invalid check-in link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <QrCheckinResult token={token} />
    </div>
  );
}
