"use client";
/* eslint-disable i18next/no-literal-string -- Doctor-facing clinical UI */

/**
 * SmartConsultationRecorder — AI-powered consultation note recorder.
 *
 * Records audio via Web Speech API (browser built-in transcription) or
 * accepts manual text input, then structures the note via the AI API.
 *
 * OWASP A03: rawNote trimmed + bounded to 10,000 chars before sending.
 */

import {
  Mic,
  MicOff,
  Loader2,
  RefreshCw,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
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

// ── Types ──

export interface StructuredNote {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  physicalExamination: string;
  assessment: string;
  plan: string;
  followUp: string;
  prescriptionHints: string[];
  labOrderHints: string[];
  redFlags: string[];
}

interface Props {
  patientId: string;
  consultationId?: string;
  onNoteStructured?: (note: StructuredNote) => void;
}

type Language = "fr" | "ar" | "darija";

const LANGUAGE_LABELS: Record<Language, string> = {
  fr: "Français",
  ar: "Arabe",
  darija: "Darija",
};

const SPEECH_LANG: Record<Language, string> = {
  fr: "fr-FR",
  ar: "ar-MA",
  darija: "fr-FR", // closest available
};

const NOTE_MAX_CHARS = 10_000;

// ── Structured Note Display ──

function StructuredNoteDisplay({ note, disclaimer }: { note: StructuredNote; disclaimer?: string }) {
  const sections = [
    { key: "chiefComplaint", label: "Motif de consultation", value: note.chiefComplaint },
    {
      key: "historyOfPresentIllness",
      label: "Anamnèse",
      value: note.historyOfPresentIllness,
    },
    { key: "physicalExamination", label: "Examen clinique", value: note.physicalExamination },
    { key: "assessment", label: "Évaluation / Diagnostic", value: note.assessment },
    { key: "plan", label: "Plan de traitement", value: note.plan },
    { key: "followUp", label: "Suivi", value: note.followUp },
  ];

  return (
    <div className="space-y-4">
      {disclaimer && (
        <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-700">{disclaimer}</div>
      )}

      {note.redFlags.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800">
            <AlertTriangle className="h-4 w-4" />
            Signes d&apos;alarme détectés
          </div>
          <ul className="space-y-1">
            {note.redFlags.map((flag, i) => (
              <li key={i} className="text-sm text-red-700">
                • {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3">
        {sections.map(({ key, label, value }) =>
          value ? (
            <div key={key} className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </Label>
              <p className="rounded-md bg-muted/30 p-2 text-sm leading-relaxed">{value}</p>
            </div>
          ) : null,
        )}
      </div>

      {(note.prescriptionHints.length > 0 || note.labOrderHints.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {note.prescriptionHints.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Suggestions de prescription
              </Label>
              <div className="flex flex-wrap gap-1">
                {note.prescriptionHints.map((hint, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {hint}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {note.labOrderHints.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Examens suggérés
              </Label>
              <div className="flex flex-wrap gap-1">
                {note.labOrderHints.map((hint, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {hint}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export function SmartConsultationRecorder({ patientId, consultationId, onNoteStructured }: Props) {
  const [language, setLanguage] = useState<Language>("fr");
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isStructuring, setIsStructuring] = useState(false);
  const [structuredNote, setStructuredNote] = useState<StructuredNote | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(true);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // ── Recording ──

  const startRecording = useCallback(() => {
    setError(null);

    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
        : null;

    if (!SpeechRecognitionAPI) {
      setError("La reconnaissance vocale n'est pas supportée par ce navigateur. Saisissez le texte manuellement.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = SPEECH_LANG[language];

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.[0]) {
          finalTranscript += result[0].transcript;
        }
      }
      // OWASP A03: Limit transcript length in real-time
      setTranscript(finalTranscript.slice(0, NOTE_MAX_CHARS));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "aborted") {
        setError(`Erreur de reconnaissance vocale: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [language]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
  }, []);

  // ── AI Structuring ──

  const structureWithAI = useCallback(async () => {
    const trimmedNote = transcript.trim().slice(0, NOTE_MAX_CHARS);

    if (!trimmedNote) {
      setError("Veuillez saisir ou dicter une note de consultation.");
      return;
    }
    if (!patientId) {
      setError("ID patient manquant. Rechargez la page.");
      return;
    }

    setIsStructuring(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/ai/structure-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawNote: trimmedNote,
          patientId,
          consultationId,
          language,
        }),
      });

      const result = (await response.json()) as {
        ok: boolean;
        data?: {
          structuredNote: StructuredNote;
          disclaimer: string;
        };
        error?: string;
      };

      if (!result.ok) {
        setError(result.error ?? "Erreur lors de la structuration. Réessayez.");
        return;
      }

      if (result.data) {
        setStructuredNote(result.data.structuredNote);
        setDisclaimer(result.data.disclaimer);
        setShowNote(true);
        onNoteStructured?.(result.data.structuredNote);
      }
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion et réessayez.");
    } finally {
      setIsStructuring(false);
    }
  }, [transcript, patientId, consultationId, language, onNoteStructured]);

  const charCount = transcript.length;
  const charPercent = Math.min((charCount / NOTE_MAX_CHARS) * 100, 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-5 w-5" />
            Dictée — Note de consultation IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Language selector */}
          <div className="space-y-1">
            <Label className="text-xs">Langue de la dictée</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {LANGUAGE_LABELS[lang]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Record controls */}
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <Button
                size="sm"
                onClick={startRecording}
                className="flex items-center gap-2"
                type="button"
              >
                <Mic className="h-4 w-4" />
                Commencer la dictée
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onClick={stopRecording}
                className="flex items-center gap-2"
                type="button"
              >
                <MicOff className="h-4 w-4" />
                Arrêter
              </Button>
            )}
            {isRecording && (
              <Badge variant="destructive" className="animate-pulse">
                Enregistrement en cours…
              </Badge>
            )}
          </div>

          {/* Transcript area */}
          <div className="space-y-1">
            <Label className="text-xs">
              Note de consultation
              <span className={`ml-2 text-xs ${charPercent > 90 ? "text-orange-500" : "text-muted-foreground"}`}>
                {charCount.toLocaleString()} / {NOTE_MAX_CHARS.toLocaleString()} caractères
              </span>
            </Label>
            <Textarea
              rows={8}
              placeholder="La transcription apparaît ici au fil de la dictée, ou saisissez directement votre note…"
              value={transcript}
              onChange={(e) =>
                setTranscript(e.target.value.slice(0, NOTE_MAX_CHARS))
              }
              className="font-mono text-sm"
            />
          </div>

          {/* Structure button */}
          <Button
            onClick={structureWithAI}
            disabled={isStructuring || !transcript.trim()}
            className="w-full"
            type="button"
          >
            {isStructuring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Structuration IA en cours…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Structurer avec l&apos;IA
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Structured output */}
      {structuredNote && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Note structurée par l&apos;IA
              </div>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setShowNote((v) => !v)}
                className="h-7 w-7 p-0"
              >
                {showNote ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          {showNote && (
            <CardContent>
              <StructuredNoteDisplay note={structuredNote} disclaimer={disclaimer ?? undefined} />
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
