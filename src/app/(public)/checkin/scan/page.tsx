import type { Metadata } from "next";
import { QrCheckinResult } from "@/components/patient-experience/qr-checkin-result";

export const metadata: Metadata = {
  title: "Check-in",
  description: "Scan your QR code to check in for your appointment.",
  robots: { index: false, follow: false },
};

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
