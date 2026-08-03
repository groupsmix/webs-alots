import type { Metadata } from "next";
import { NpsSurveyForm } from "@/components/patient-experience/nps-survey-form";
import { buildMetadata } from "@/lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Enquête de satisfaction",
  description: "Partagez votre expérience et aidez-nous à améliorer nos services.",
  path: "/nps",
  noIndex: true,
});

export default async function NpsPage(props: { searchParams: Promise<{ id?: string }> }) {
  const searchParams = await props.searchParams;
  const surveyId = searchParams.id;

  if (!surveyId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">Invalid survey link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <NpsSurveyForm surveyId={surveyId} />
    </div>
  );
}
