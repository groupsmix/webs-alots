/* eslint-disable i18next/no-literal-string -- patient experience page */
import type { Metadata } from "next";
import { NpsSurveyForm } from "@/components/patient-experience/nps-survey-form";

export const metadata: Metadata = {
  title: "Patient Satisfaction Survey",
  description: "Share your experience and help us improve our services.",
  robots: { index: false, follow: false },
};

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
