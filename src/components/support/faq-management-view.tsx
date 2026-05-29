"use client";

import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FAQ_CATEGORIES, SUPPORTED_LANGUAGES } from "@/lib/validations/support";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string | null;
  language: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string | null;
}

const LANGUAGE_LABELS: Record<string, string> = {
  fr: "FR",
  ar: "AR",
  en: "EN",
};

export function FAQManagementView() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLang, setFilterLang] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formQuestion, setFormQuestion] = useState("");
  const [formAnswer, setFormAnswer] = useState("");
  const [formKeywords, setFormKeywords] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [formLanguage, setFormLanguage] = useState("fr");
  const [formActive, setFormActive] = useState(true);

  const didMount = useRef(false);

  const fetchFaqs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterLang) params.set("language", filterLang);
    if (filterCategory) params.set("category", filterCategory);

    const res = await fetch(`/api/support/faq?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      setFaqs(json.data?.faqs ?? []);
    }
    setLoading(false);
  }, [filterLang, filterCategory]);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      void fetchFaqs();
    }
  }, [fetchFaqs]);

  function openCreateForm() {
    setEditingFaq(null);
    setFormQuestion("");
    setFormAnswer("");
    setFormKeywords("");
    setFormCategory("general");
    setFormLanguage("fr");
    setFormActive(true);
    setShowForm(true);
  }

  function openEditForm(faq: FAQ) {
    setEditingFaq(faq);
    setFormQuestion(faq.question);
    setFormAnswer(faq.answer);
    setFormKeywords((faq.keywords ?? []).join(", "));
    setFormCategory(faq.category ?? "general");
    setFormLanguage(faq.language ?? "fr");
    setFormActive(faq.is_active ?? true);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const keywords = formKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (editingFaq) {
      await fetch("/api/support/faq", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingFaq.id,
          question: formQuestion,
          answer: formAnswer,
          keywords,
          category: formCategory,
          language: formLanguage,
          is_active: formActive,
        }),
      });
    } else {
      await fetch("/api/support/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: formQuestion,
          answer: formAnswer,
          keywords,
          category: formCategory,
          language: formLanguage,
          is_active: formActive,
        }),
      });
    }

    setShowForm(false);
    void fetchFaqs();
  }

  async function handleDelete(id: string) {
    await fetch("/api/support/faq", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    void fetchFaqs();
  }

  const filteredFaqs = faqs.filter((faq) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      faq.question.toLowerCase().includes(q) ||
      faq.answer.toLowerCase().includes(q) ||
      (faq.keywords ?? []).some((k) => k.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <h1 className="text-2xl font-bold">Gestion des FAQ</h1>
        {/* eslint-disable i18next/no-literal-string */}
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une FAQ
        </Button>
        {/* eslint-enable i18next/no-literal-string */}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher des FAQ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filterLang}
          onChange={(e) => setFilterLang(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        >
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <option value="">Toutes les langues</option>
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {LANGUAGE_LABELS[l] ?? l}
            </option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        >
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <option value="">Toutes les catégories</option>
          {FAQ_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Form Modal */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingFaq ? "Modifier la FAQ" : "Nouvelle FAQ"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="faq-question" className="text-sm font-medium">
                  {"Question"}
                </label>
                <Input
                  id="faq-question"
                  value={formQuestion}
                  onChange={(e) => setFormQuestion(e.target.value)}
                  required
                  minLength={3}
                />
              </div>
              <div>
                <label htmlFor="faq-answer" className="text-sm font-medium">
                  {"Réponse"}
                </label>
                <textarea
                  id="faq-answer"
                  value={formAnswer}
                  onChange={(e) => setFormAnswer(e.target.value)}
                  required
                  minLength={3}
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-[100px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="faq-language" className="text-sm font-medium">
                    {"Langue"}
                  </label>
                  <select
                    id="faq-language"
                    value={formLanguage}
                    onChange={(e) => setFormLanguage(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {LANGUAGE_LABELS[l] ?? l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="faq-category" className="text-sm font-medium">
                    {"Catégorie"}
                  </label>
                  <select
                    id="faq-category"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    {FAQ_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="faq-keywords" className="text-sm font-medium">
                  {"Mots-clés (séparés par des virgules)"}
                </label>
                <Input
                  id="faq-keywords"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  placeholder="rendez-vous, booking, appointment"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  id="faq-active"
                />
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <label htmlFor="faq-active" className="text-sm">
                  Actif
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="submit">{editingFaq ? "Mettre à jour" : "Créer"}</Button>
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* FAQ List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-12 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFaqs.map((faq) => (
            <Card key={faq.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {LANGUAGE_LABELS[faq.language ?? "fr"] ?? faq.language}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {faq.category ?? "general"}
                      </Badge>
                      {/* eslint-disable i18next/no-literal-string */}
                      {!faq.is_active && (
                        <Badge variant="destructive" className="text-xs">
                          Inactif
                        </Badge>
                      )}
                      {/* eslint-enable i18next/no-literal-string */}
                    </div>
                    <p className="font-medium text-sm">{faq.question}</p>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{faq.answer}</p>
                    {(faq.keywords ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {faq.keywords.map((kw) => (
                          <span key={kw} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEditForm(faq)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(faq.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredFaqs.length === 0 && (
            <Card>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <CardContent className="p-8 text-center text-muted-foreground">
                Aucune FAQ trouvée. Créez votre première FAQ pour commencer.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
