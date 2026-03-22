"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Plus,
  Trash2,
  Save,
  GripVertical,
  MessageCircle,
  Zap,
  Brain,
  Sparkles,
  Power,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserClient } from "@supabase/ssr";
import { PageLoader } from "@/components/ui/page-loader";

interface ChatbotConfig {
  enabled: boolean;
  intelligence: "basic" | "smart" | "advanced";
  greeting: string;
  language: string;
}

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  sort_order: number;
  is_active: boolean;
  isNew?: boolean;
}

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

const intelligenceLevels = [
  {
    value: "basic" as const,
    label: "Basic",
    description: "FAQ automatiques depuis les données du cabinet. Pas d'IA.",
    icon: MessageCircle,
    badge: "Gratuit",
    badgeVariant: "secondary" as const,
  },
  {
    value: "smart" as const,
    label: "Smart",
    description: "Cloudflare Workers AI pour comprendre le langage naturel.",
    icon: Zap,
    badge: "Gratuit",
    badgeVariant: "default" as const,
  },
  {
    value: "advanced" as const,
    label: "Advanced",
    description: "Conversation IA complète avec OpenAI ou Claude.",
    icon: Brain,
    badge: "Payant",
    badgeVariant: "destructive" as const,
  },
];

export default function ChatbotSettingsPage() {
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [config, setConfig] = useState<ChatbotConfig>({
    enabled: true,
    intelligence: "basic",
    greeting: "Bonjour ! Comment puis-je vous aider ?",
    language: "fr",
  });
  const [faqs, setFaqs] = useState<FaqEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = getSupabase();

      // Get current user's clinic
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("users")
        .select("clinic_id")
        .eq("auth_id", user.id)
        .single();

      if (!profile?.clinic_id) return;
      setClinicId(profile.clinic_id as string);

      // Load chatbot config
      const { data: configData } = await supabase
        .from("chatbot_config")
        .select("enabled, intelligence, greeting, language")
        .eq("clinic_id", profile.clinic_id)
        .single();

      if (configData) {
        const row = configData as Record<string, unknown>;
        setConfig({
          enabled: row.enabled as boolean,
          intelligence: row.intelligence as ChatbotConfig["intelligence"],
          greeting:
            (row.greeting as string) || "Bonjour ! Comment puis-je vous aider ?",
          language: (row.language as string) || "fr",
        });
      }

      // Load FAQs
      const { data: faqData } = await supabase
        .from("chatbot_faqs")
        .select("id, question, answer, keywords, sort_order, is_active")
        .eq("clinic_id", profile.clinic_id)
        .order("sort_order", { ascending: true });

      if (faqData) {
        setFaqs(faqData as FaqEntry[]);
      }

      setLoading(false);
    })();
  }, []);

  async function saveConfig() {
    if (!clinicId) return;
    setSaving(true);

    const supabase = getSupabase();

    // Upsert chatbot config
    const { error: configError } = await supabase
      .from("chatbot_config")
      .upsert(
        {
          clinic_id: clinicId,
          enabled: config.enabled,
          intelligence: config.intelligence,
          greeting: config.greeting,
          language: config.language,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "clinic_id" },
      );

    if (configError) {
      console.error("Failed to save config:", configError);
      setSaving(false);
      return;
    }

    // Save FAQs: delete removed ones, upsert existing and new
    const existingIds = faqs.filter((f) => !f.isNew).map((f) => f.id);

    // Delete FAQs that were removed
    if (existingIds.length > 0) {
      await supabase
        .from("chatbot_faqs")
        .delete()
        .eq("clinic_id", clinicId)
        .not("id", "in", `(${existingIds.join(",")})`);
    } else {
      await supabase
        .from("chatbot_faqs")
        .delete()
        .eq("clinic_id", clinicId);
    }

    // Upsert FAQs
    for (let i = 0; i < faqs.length; i++) {
      const faq = faqs[i];
      const faqPayload = {
        clinic_id: clinicId,
        question: faq.question,
        answer: faq.answer,
        keywords: faq.keywords,
        sort_order: i,
        is_active: faq.is_active,
        updated_at: new Date().toISOString(),
      };

      if (faq.isNew) {
        await supabase.from("chatbot_faqs").insert(faqPayload);
      } else {
        await supabase
          .from("chatbot_faqs")
          .update(faqPayload)
          .eq("id", faq.id);
      }
    }

    setSaving(false);
    setSavedMessage("Paramètres sauvegardés !");
    setTimeout(() => setSavedMessage(null), 3000);

    // Refresh FAQs after save to get server-assigned IDs
    const { data: refreshedFaqs } = await supabase
      .from("chatbot_faqs")
      .select("id, question, answer, keywords, sort_order, is_active")
      .eq("clinic_id", clinicId)
      .order("sort_order", { ascending: true });
    if (refreshedFaqs) {
      setFaqs(refreshedFaqs as FaqEntry[]);
    }
  }

  function addFaq() {
    setFaqs((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        question: "",
        answer: "",
        keywords: [],
        sort_order: prev.length,
        is_active: true,
        isNew: true,
      },
    ]);
  }

  function removeFaq(id: string) {
    setFaqs((prev) => prev.filter((f) => f.id !== id));
  }

  function updateFaq(id: string, field: keyof FaqEntry, value: unknown) {
    setFaqs((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)),
    );
  }

  if (loading) {
    return <PageLoader message="Loading..." />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Chatbot Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configurez l&apos;assistant virtuel de votre cabinet
          </p>
        </div>
        <Button onClick={saveConfig} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Sauvegarde..." : savedMessage || "Sauvegarder"}
        </Button>
      </div>

      {/* Enable/Disable */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Power className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Activer le chatbot</p>
                <p className="text-xs text-muted-foreground">
                  Affiche la bulle de chat sur votre site public
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={config.enabled}
                onCheckedChange={(enabled) =>
                  setConfig({ ...config, enabled })
                }
              />
              <Badge variant={config.enabled ? "default" : "secondary"}>
                {config.enabled ? "Activé" : "Désactivé"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intelligence Level */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Niveau d&apos;intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {intelligenceLevels.map((level) => {
              const isSelected = config.intelligence === level.value;
              return (
                <button
                  key={level.value}
                  onClick={() =>
                    setConfig({ ...config, intelligence: level.value })
                  }
                  className={`relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <level.icon
                      className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span className="font-medium text-sm">{level.label}</span>
                    <Badge
                      variant={level.badgeVariant}
                      className="ml-auto text-[10px]"
                    >
                      {level.badge}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {level.description}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Greeting & Language */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Message d&apos;accueil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Message de bienvenue</Label>
              <Textarea
                value={config.greeting}
                onChange={(e) =>
                  setConfig({ ...config, greeting: e.target.value })
                }
                placeholder="Bonjour ! Comment puis-je vous aider ?"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Langue par défaut</Label>
              <select
                value={config.language}
                onChange={(e) =>
                  setConfig({ ...config, language: e.target.value })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
                <option value="en">English</option>
                <option value="darija">Darija (دارجة)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom FAQs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" />
              FAQ personnalisées
              <Badge variant="secondary" className="text-[10px]">
                {faqs.length}
              </Badge>
            </CardTitle>
            <Button size="sm" variant="outline" onClick={addFaq}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ajoutez des questions/réponses personnalisées. Le chatbot les
            utilisera en priorité.
          </p>
        </CardHeader>
        <CardContent>
          {faqs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-10 w-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm">Aucune FAQ personnalisée</p>
              <p className="text-xs mt-1">
                Ajoutez des questions fréquentes pour aider vos patients
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={addFaq}
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter une FAQ
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {faqs.map((faq) => (
                <div
                  key={faq.id}
                  className={`border rounded-lg p-4 space-y-3 ${!faq.is_active ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GripVertical className="h-4 w-4 cursor-grab" />
                      <Badge
                        variant={faq.is_active ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {faq.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={faq.is_active}
                        onCheckedChange={(active) =>
                          updateFaq(faq.id, "is_active", active)
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => removeFaq(faq.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Question</Label>
                    <Input
                      value={faq.question}
                      onChange={(e) =>
                        updateFaq(faq.id, "question", e.target.value)
                      }
                      placeholder="Ex: Est-ce que vous faites l'Invisalign ?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Réponse</Label>
                    <Textarea
                      value={faq.answer}
                      onChange={(e) =>
                        updateFaq(faq.id, "answer", e.target.value)
                      }
                      placeholder="Ex: Oui, nous proposons Invisalign à partir de 15 000 MAD."
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Mots-clés (séparés par des virgules)
                    </Label>
                    <Input
                      value={(faq.keywords ?? []).join(", ")}
                      onChange={(e) =>
                        updateFaq(
                          faq.id,
                          "keywords",
                          e.target.value
                            .split(",")
                            .map((k) => k.trim())
                            .filter(Boolean),
                        )
                      }
                      placeholder="invisalign, aligneur, orthodontie"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
