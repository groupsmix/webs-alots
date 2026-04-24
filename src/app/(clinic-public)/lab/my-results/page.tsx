"use client";

import {
  FileText, Shield, Search, AlertCircle, Clock,
  CheckCircle, Lock,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ResultEntry {
  id: string;
  testName: string;
  date: string;
  status: "ready" | "pending" | "in-progress";
  downloadUrl?: string;
}

export default function LabResultsPage() {
  const [patientCode, setPatientCode] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [results, setResults] = useState<ResultEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientCode.trim() || !dateOfBirth.trim()) {
      setError("Please enter both your patient code and date of birth.");
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    // Simulate API call — in production this would call a server action
    // that validates the code + DOB and returns results from Supabase
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // For now, show empty results with guidance
    setResults([]);
    setLoading(false);
  };

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline"; icon: React.ReactNode }> = {
    ready: { label: "Ready", variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
    pending: { label: "Pending", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
    "in-progress": { label: "Processing", variant: "outline", icon: <Clock className="h-3 w-3" /> },
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Access Your Results</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Enter your patient code and date of birth to securely access your lab and radiology results online.
        </p>
      </div>

      <div className="max-w-xl mx-auto">
        {/* Security Notice */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg mb-8">
          <Shield className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Secure Access</p>
            <p className="text-xs text-blue-600 dark:text-blue-300">
              Your results are protected. You need your patient code (provided at sample collection) and your date of birth to access them.
            </p>
          </div>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-600" />
              Patient Portal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="patientCode" className="block text-sm font-medium mb-1.5">
                  Patient Code
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="patientCode"
                    type="text"
                    placeholder="e.g. LAB-2024-00123"
                    className="pl-10"
                    value={patientCode}
                    onChange={(e) => setPatientCode(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Found on your sample collection receipt
                </p>
              </div>

              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium mb-1.5">
                  Date of Birth
                </label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Access Results
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results Display */}
        {searched && !loading && results !== null && (
          <div className="mt-8">
            {results.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium mb-1">No Results Found</p>
                  <p className="text-sm text-muted-foreground">
                    No results were found for the provided code and date of birth.
                    Results typically become available within 24-48 hours after sample collection.
                    Please verify your information or contact us for assistance.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Your Results</h2>
                {results.map((result) => {
                  const config = statusConfig[result.status];
                  return (
                    <Card key={result.id}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{result.testName}</p>
                            <p className="text-xs text-muted-foreground">{result.date}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={config.variant} className="text-xs">
                              {config.icon}
                              <span className="ml-1">{config.label}</span>
                            </Badge>
                            {result.status === "ready" && result.downloadUrl && (
                              <Button size="sm" variant="outline" className="text-blue-600">
                                <FileText className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-2">Need Help?</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>&bull; Your patient code is printed on the receipt given at sample collection.</li>
            <li>&bull; Results are typically available within 24-48 hours.</li>
            <li>&bull; Radiology results may take 2-5 business days.</li>
            <li>&bull; Contact us at +212 5 22 40 50 60 if you need assistance.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
