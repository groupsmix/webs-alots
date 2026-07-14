"use client";

import { MessageSquarePlus, LifeBuoy, Star, Send, X, CheckCircle2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { logger } from "@/lib/logger";

type Tab = "feedback" | "support";
type Priority = "low" | "normal" | "high" | "urgent";

/**
 * Floating "Help & Feedback" launcher rendered at the bottom of every role
 * dashboard. Offers two actions to any authenticated user: submit product
 * feedback (→ /api/feedback) or open a support ticket (→ /api/support/contact).
 * The submitter's role and clinic are derived server-side from the session.
 */
export function HelpFeedback() {
  const [locale] = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("feedback");

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const [subject, setSubject] = useState("");
  const [supportMsg, setSupportMsg] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setRating(0);
    setHoverRating(0);
    setFeedbackMsg("");
    setSubject("");
    setSupportMsg("");
    setPriority("normal");
    setDone(false);
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submitFeedback() {
    if (feedbackMsg.trim().length < 3) {
      setError(t(locale, "help.messageRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: rating > 0 ? rating : undefined,
          message: feedbackMsg.trim(),
          page_url: pathname,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDone(true);
    } catch (err) {
      logger.warn("Failed to submit feedback", { context: "help-feedback", error: err });
      setError(t(locale, "help.error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSupport() {
    if (subject.trim().length < 3 || supportMsg.trim().length < 3) {
      setError(t(locale, "help.messageRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          message: supportMsg.trim(),
          priority,
          language: locale === "ary" ? "ar" : locale,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDone(true);
    } catch (err) {
      logger.warn("Failed to contact support", { context: "help-feedback", error: err });
      setError(t(locale, "help.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Floating launcher — sits above the mobile tab bar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t(locale, "help.button")}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 md:bottom-6"
      >
        <MessageSquarePlus className="h-4 w-4" />
        <span className="hidden sm:inline">{t(locale, "help.button")}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t(locale, "help.title")}
        >
          <button
            type="button"
            aria-label={t(locale, "help.close")}
            className="absolute inset-0 bg-black/40"
            onClick={close}
          />
          <div className="relative w-full max-w-md rounded-t-2xl border bg-card p-5 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">{t(locale, "help.title")}</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={close}
                aria-label={t(locale, "help.close")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {done ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                  <CheckCircle2 className="h-7 w-7 text-green-600" />
                </div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  {tab === "feedback"
                    ? t(locale, "help.feedbackThanks")
                    : t(locale, "help.supportThanks")}
                </p>
                <Button className="mt-4" variant="outline" size="sm" onClick={close}>
                  {t(locale, "help.close")}
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex gap-2 rounded-lg bg-muted p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTab("feedback");
                      setError(null);
                    }}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      tab === "feedback"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                    {t(locale, "help.tabFeedback")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTab("support");
                      setError(null);
                    }}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      tab === "support"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <LifeBuoy className="h-4 w-4" />
                    {t(locale, "help.tabSupport")}
                  </button>
                </div>

                {tab === "feedback" ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {t(locale, "help.feedbackIntro")}
                    </p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          aria-label={`${star}/5`}
                          className="p-1"
                        >
                          <Star
                            className={`h-6 w-6 transition-colors ${
                              star <= (hoverRating || rating)
                                ? "fill-yellow-500 text-yellow-500"
                                : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={t(locale, "help.feedbackPlaceholder")}
                      value={feedbackMsg}
                      onChange={(e) => setFeedbackMsg(e.target.value)}
                      maxLength={2000}
                    />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button className="w-full" onClick={submitFeedback} disabled={submitting}>
                      <Send className="mr-2 h-4 w-4" />
                      {submitting ? t(locale, "help.sending") : t(locale, "help.submit")}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {t(locale, "help.supportIntro")}
                    </p>
                    <input
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={t(locale, "help.subjectPlaceholder")}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      maxLength={300}
                    />
                    <textarea
                      className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={t(locale, "help.supportMessagePlaceholder")}
                      value={supportMsg}
                      onChange={(e) => setSupportMsg(e.target.value)}
                      maxLength={2000}
                    />
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t(locale, "help.priorityLabel")}
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as Priority)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="low">{t(locale, "help.priorityLow")}</option>
                        <option value="normal">{t(locale, "help.priorityNormal")}</option>
                        <option value="high">{t(locale, "help.priorityHigh")}</option>
                        <option value="urgent">{t(locale, "help.priorityUrgent")}</option>
                      </select>
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button className="w-full" onClick={submitSupport} disabled={submitting}>
                      <Send className="mr-2 h-4 w-4" />
                      {submitting ? t(locale, "help.sending") : t(locale, "help.supportSubmit")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
