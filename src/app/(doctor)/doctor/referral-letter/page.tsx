import { ReferralLetterGenerator } from "@/components/doctor/referral-letter-generator";
import { requireRole } from "@/lib/auth";

export default async function ReferralLetterPage() {
  await requireRole("doctor", "clinic_admin");
  return (
    <div className="mx-auto max-w-3xl p-4">
      <ReferralLetterGenerator />
    </div>
  );
}
