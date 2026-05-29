/* eslint-disable i18next/no-literal-string -- patient experience UI strings */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface NpsSurveyFormProps {
  surveyId: string;
}

export function NpsSurveyForm({ surveyId }: NpsSurveyFormProps) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (score === null) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/nps/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId, score, comment: comment || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error ?? "Failed to submit");
      }
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="py-8 text-center">
          <p className="text-lg font-medium">شكرا لك! / Merci !</p>
          <p className="text-sm text-muted-foreground mt-2">
            Your feedback helps us improve our services.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle className="text-center">How was your experience?</CardTitle>
        <p className="text-sm text-muted-foreground text-center">
          Rate from 0 (not at all likely) to 10 (extremely likely)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-11 gap-1">
          {Array.from({ length: 11 }, (_, i) => (
            <Button
              key={i}
              variant={score === i ? "default" : "outline"}
              size="sm"
              className="h-10 w-full text-sm"
              onClick={() => setScore(i)}
            >
              {i}
            </Button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground px-1">
          <span>Not likely</span>
          <span>Very likely</span>
        </div>

        <Textarea
          placeholder="Any comments? (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={2000}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={handleSubmit} disabled={score === null || submitting} className="w-full">
          {submitting ? "Submitting..." : "Submit"}
        </Button>
      </CardContent>
    </Card>
  );
}
