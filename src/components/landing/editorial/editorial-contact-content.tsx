"use client";

import { useState } from "react";
import { useLandingLocale } from "../landing-locale-provider";
import { HairlineRule } from "./hairline-rule";

const PATHS = [
  {
    num: "01",
    title: "Support clinique",
    lines: ["support@oltigo.com", "+212 ___ ___ ___", "09:00\u201318:00 (Africa/Casablanca)"],
  },
  {
    num: "02",
    title: "Ventes",
    lines: ["ventes@oltigo.com", "R\u00E9ponse < 1 jour ouvr\u00E9"],
  },
  {
    num: "03",
    title: "D\u00E9l\u00E9gu\u00E9 \u00E0 la protection des donn\u00E9es (Loi 09-08)",
    lines: ["dpo@oltigo.com"],
  },
] as const;

/**
 * Editorial contact page \u2014 50/50 split.
 * Left: form. Right: three direct paths, hairline-separated.
 * No chatbot bubble.
 */
export function EditorialContactContent() {
  const { t } = useLandingLocale();
  const [submitted, setSubmitted] = useState(false);

  return (
    <div style={{ backgroundColor: "var(--bone)", color: "var(--ink)" }}>
      <div
        className="mx-auto"
        style={{
          maxWidth: "var(--container-max)",
          paddingInline: "var(--gutter-desktop)",
          paddingTop: "var(--space-9)",
          paddingBottom: "var(--space-9)",
        }}
      >
        {/* eslint-disable i18next/no-literal-string */}
        <h1
          style={{
            fontSize: "var(--text-h1)",
            lineHeight: "var(--lh-h1)",
            letterSpacing: "var(--ls-h1)",
            fontWeight: 500,
            color: "var(--ink)",
          }}
        >
          {t("contact.title")}
        </h1>

        <div className="mt-[var(--space-7)] grid grid-cols-1 gap-[var(--space-8)] lg:grid-cols-2">
          {/* Left: form */}
          <div>
            {submitted ? (
              <div>
                <h2
                  style={{
                    fontSize: "var(--text-h3)",
                    lineHeight: "var(--lh-h3)",
                    fontWeight: 500,
                    color: "var(--ink)",
                  }}
                >
                  {t("contact.successTitle")}
                </h2>
                <p
                  className="mt-[var(--space-3)]"
                  style={{
                    fontSize: "var(--text-body)",
                    lineHeight: "var(--lh-body)",
                    color: "var(--ink-70)",
                  }}
                >
                  {t("contact.successMessage")}
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-[var(--space-5)]"
                  style={{
                    fontSize: "var(--text-small)",
                    fontWeight: 500,
                    color: "var(--oltigo-green)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {t("contact.sendAnother")}
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(true);
                }}
                className="space-y-[var(--space-5)]"
              >
                {/* Name */}
                <div>
                  <label
                    htmlFor="contact-name"
                    style={{
                      display: "block",
                      fontSize: "var(--text-small)",
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    {t("contact.name")}
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    required
                    placeholder={t("contact.namePlaceholder")}
                    style={{
                      display: "block",
                      width: "100%",
                      height: "44px",
                      paddingInline: "var(--space-3)",
                      fontSize: "var(--text-body)",
                      lineHeight: "var(--lh-body)",
                      color: "var(--ink)",
                      backgroundColor: "var(--bone)",
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--radius-landing)",
                    }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="contact-email"
                    style={{
                      display: "block",
                      fontSize: "var(--text-small)",
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    {t("contact.email")}
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    style={{
                      display: "block",
                      width: "100%",
                      height: "44px",
                      paddingInline: "var(--space-3)",
                      fontSize: "var(--text-body)",
                      lineHeight: "var(--lh-body)",
                      color: "var(--ink)",
                      backgroundColor: "var(--bone)",
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--radius-landing)",
                    }}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label
                    htmlFor="contact-phone"
                    style={{
                      display: "block",
                      fontSize: "var(--text-small)",
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    {t("contact.phone")}
                  </label>
                  <input
                    id="contact-phone"
                    name="phone"
                    type="tel"
                    style={{
                      display: "block",
                      width: "100%",
                      height: "44px",
                      paddingInline: "var(--space-3)",
                      fontSize: "var(--text-body)",
                      lineHeight: "var(--lh-body)",
                      color: "var(--ink)",
                      backgroundColor: "var(--bone)",
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--radius-landing)",
                    }}
                  />
                </div>

                {/* Subject */}
                <div>
                  <label
                    htmlFor="contact-subject"
                    style={{
                      display: "block",
                      fontSize: "var(--text-small)",
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    {t("contact.subject")}
                  </label>
                  <input
                    id="contact-subject"
                    name="subject"
                    type="text"
                    required
                    placeholder={t("contact.subjectPlaceholder")}
                    style={{
                      display: "block",
                      width: "100%",
                      height: "44px",
                      paddingInline: "var(--space-3)",
                      fontSize: "var(--text-body)",
                      lineHeight: "var(--lh-body)",
                      color: "var(--ink)",
                      backgroundColor: "var(--bone)",
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--radius-landing)",
                    }}
                  />
                </div>

                {/* Message */}
                <div>
                  <label
                    htmlFor="contact-message"
                    style={{
                      display: "block",
                      fontSize: "var(--text-small)",
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    {t("contact.message")}
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    rows={5}
                    placeholder={t("contact.messagePlaceholder")}
                    style={{
                      display: "block",
                      width: "100%",
                      paddingInline: "var(--space-3)",
                      paddingBlock: "var(--space-3)",
                      fontSize: "var(--text-body)",
                      lineHeight: "var(--lh-body)",
                      color: "var(--ink)",
                      backgroundColor: "var(--bone)",
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--radius-landing)",
                      resize: "vertical",
                    }}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  className="landing-btn"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "44px",
                    paddingInline: "var(--space-5)",
                    backgroundColor: "var(--oltigo-green)",
                    color: "var(--bone)",
                    borderRadius: "var(--radius-landing)",
                    fontSize: "var(--text-small)",
                    fontWeight: 500,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {t("contact.submit")}
                </button>
              </form>
            )}
          </div>

          {/* Right: three direct paths */}
          <div>
            {PATHS.map(({ num, title, lines }) => (
              <div key={num}>
                <HairlineRule />
                <div className="py-[var(--space-5)]">
                  <p
                    style={{
                      fontFamily: "var(--font-mono-landing)",
                      fontSize: "var(--text-mono)",
                      lineHeight: "var(--lh-mono)",
                      letterSpacing: "var(--ls-mono)",
                      color: "var(--ink-60)",
                      marginBottom: "var(--space-2)",
                    }}
                  >
                    {num}
                  </p>
                  <h3
                    style={{
                      fontSize: "var(--text-body)",
                      lineHeight: "var(--lh-body)",
                      fontWeight: 500,
                      color: "var(--ink)",
                    }}
                  >
                    {title}
                  </h3>
                  {lines.map((line) => (
                    <p
                      key={line}
                      className="mt-[var(--space-1)]"
                      style={{
                        fontFamily: "var(--font-mono-landing)",
                        fontSize: "var(--text-mono)",
                        lineHeight: "var(--lh-mono)",
                        letterSpacing: "var(--ls-mono)",
                        color: "var(--ink-60)",
                      }}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            <HairlineRule />
          </div>
        </div>
        {/* eslint-enable i18next/no-literal-string */}
      </div>
    </div>
  );
}
