"use client";

import { Mic, MicOff, Loader2, Save, FileText, RefreshCw } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

type Language = "fr" | "ar" | "darija";

export default function VoiceNotesPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [language, setLanguage] = useState<Language>("fr");
  const [isStructuring, setIsStructuring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [soap, setSoap] = useState<SoapNote | null>(null);
  const [voiceNoteId, setVoiceNoteId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startRecording = useCallback(() => {
    setError(null);

    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionAPI) {
      setError("La reconnaissance vocale n'est pas supportée par ce navigateur.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === "ar" ? "ar-MA" : "fr-FR";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result && result[0]) {
          finalTranscript += result[0].transcript;
        }
      }
      setTranscript(finalTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "aborted") {
        setError(`Erreur de reconnaissance: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [language]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const structureWithAI = useCallback(async () => {
    if (!transcript.trim() || !patientId.trim()) {
      setError("Veuillez saisir l'ID du patient et dicter une note.");
      return;
    }

    setIsStructuring(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/ai/voice-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          rawTranscript: transcript,
          language,
        }),
      });

      const result = (await response.json()) as {
        ok: boolean;
        data?: {
          id: string;
          soap: SoapNote;
          disclaimer: string;
        };
        error?: string;
      };

      if (!result.ok) {
        setError(result.error ?? "Erreur lors de la structuration.");
        return;
      }

      if (result.data) {
        setSoap(result.data.soap);
        setVoiceNoteId(result.data.id);
        setDisclaimer(result.data.disclaimer);
      }
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setIsStructuring(false);
    }
  }, [transcript, patientId, language]);

  const saveNote = useCallback(
    async (status: "reviewed" | "finalized") => {
      if (!soap || !patientId) return;

      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch("/api/v1/ai/voice-notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: voiceNoteId,
            patientId,
            rawTranscript: transcript,
            language,
            soapSubjective: soap.subjective,
            soapObjective: soap.objective,
            soapAssessment: soap.assessment,
            soapPlan: soap.plan,
            status,
          }),
        });

        const result = (await response.json()) as { ok: boolean; error?: string };

        if (!result.ok) {
          setError(result.error ?? "Erreur lors de la sauvegarde.");
          return;
        }
      } catch {
        setError("Erreur réseau. Veuillez réessayer.");
      } finally {
        setIsSaving(false);
      }
    },
    [soap, patientId, voiceNoteId, transcript, language],
  );

  const updateSoapField = useCallback((field: keyof SoapNote, value: string) => {
    setSoap((prev) => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        items={[
          { label: "Tableau de bord", href: "/doctor/dashboard" },
          { label: "Notes vocales" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notes Vocales — SOAP</h1>
          <p className="text-muted-foreground">
            Dictez vos observations, l&apos;IA structure en format SOAP
          </p>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Recording & Transcript */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Dictée
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>ID Patient</Label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="ID du patient"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Langue</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="ar">Arabe</SelectItem>
                  <SelectItem value="darija">Darija</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              {!isRecording ? (
                <Button onClick={startRecording} className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Commencer la dictée
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <MicOff className="h-4 w-4" />
                  Arrêter
                </Button>
              )}

              {isRecording && (
                <Badge variant="destructive" className="animate-pulse">
                  Enregistrement en cours...
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label>Transcription</Label>
              <Textarea
                rows={10}
                placeholder="La transcription apparaîtra ici, ou saisissez le texte manuellement..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
              />
            </div>

            <Button
              onClick={structureWithAI}
              disabled={isStructuring || !transcript.trim() || !patientId.trim()}
              className="w-full"
            >
              {isStructuring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Structuration IA en cours...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Structurer en SOAP (IA)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Right: SOAP Output */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Note SOAP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {disclaimer && (
              <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-700">{disclaimer}</div>
            )}

            <div className="space-y-2">
              <Label className="font-semibold">S — Subjectif</Label>
              <Textarea
                rows={3}
                placeholder="Ce que le patient rapporte..."
                value={soap?.subjective ?? ""}
                onChange={(e) => updateSoapField("subjective", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">O — Objectif</Label>
              <Textarea
                rows={3}
                placeholder="Observations cliniques..."
                value={soap?.objective ?? ""}
                onChange={(e) => updateSoapField("objective", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">A — Évaluation</Label>
              <Textarea
                rows={3}
                placeholder="Diagnostic / évaluation..."
                value={soap?.assessment ?? ""}
                onChange={(e) => updateSoapField("assessment", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">P — Plan</Label>
              <Textarea
                rows={3}
                placeholder="Plan de traitement..."
                value={soap?.plan ?? ""}
                onChange={(e) => updateSoapField("plan", e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => saveNote("reviewed")}
                disabled={isSaving || !soap}
                variant="outline"
              >
                <Save className="mr-2 h-4 w-4" />
                Marquer comme vérifié
              </Button>
              <Button onClick={() => saveNote("finalized")} disabled={isSaving || !soap}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Finaliser
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
