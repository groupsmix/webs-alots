"use client";

/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */

import { Download, RotateCcw, Rocket, Save, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatMessage, type ChatMessageData } from "@/components/agent-builder/chat-message";
import { presetPalettes } from "@/components/agent-builder/color-palette";
import { DesignPreview } from "@/components/agent-builder/design-preview";
import type { ClinicConfig, TemplateStyle } from "@/components/agent-builder/types";
import { createEmptyConfig } from "@/components/agent-builder/types";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/toast";

const GREETING_MESSAGE =
  "Hi! I can help you create a new clinic website. Just give me the customer info (name, specialty, city, phone) and I'll design their site.";

const QUICK_PROMPTS = ["Create a clinic site", "Design a dental office", "Build a pharmacy page"];

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function inferSpecialtyColors(specialty: string): string[] {
  const lower = specialty.toLowerCase();
  if (lower.includes("dent")) return presetPalettes.dental;
  if (lower.includes("pharma")) return presetPalettes.pharmacy;
  if (lower.includes("cardio") || lower.includes("heart")) return presetPalettes.warm;
  return presetPalettes.clinical;
}

function inferServices(specialty: string): string[] {
  const lower = specialty.toLowerCase();
  if (lower.includes("dent")) {
    return [
      "Dental Checkup",
      "Teeth Whitening",
      "Orthodontics",
      "Root Canal",
      "Implants",
      "Pediatric Dentistry",
    ];
  }
  if (lower.includes("pharma")) {
    return [
      "Prescription Filling",
      "OTC Medications",
      "Health Consultation",
      "Vaccinations",
      "Lab Tests",
      "Home Delivery",
    ];
  }
  if (lower.includes("cardio")) {
    return [
      "ECG",
      "Echocardiography",
      "Stress Test",
      "Cardiac Consultation",
      "Blood Pressure Monitoring",
      "Holter Monitor",
    ];
  }
  if (lower.includes("derma")) {
    return [
      "Skin Consultation",
      "Acne Treatment",
      "Laser Therapy",
      "Mole Removal",
      "Anti-Aging",
      "Dermatoscopy",
    ];
  }
  if (lower.includes("pediatr") || lower.includes("child")) {
    return [
      "Well-Child Visit",
      "Vaccinations",
      "Growth Monitoring",
      "Pediatric Consultation",
      "Nutrition Advice",
      "Developmental Screening",
    ];
  }
  return [
    "General Consultation",
    "Diagnosis",
    "Treatment Plan",
    "Follow-up Visit",
    "Lab Tests",
    "Preventive Care",
  ];
}

type ClinicType =
  | "doctor"
  | "dentist"
  | "pharmacy"
  | "clinic"
  | "hospital"
  | "laboratory"
  | "veterinary";

/** Map a free-text specialty to the clinic_type the provisioning API expects. */
function inferClinicType(specialty: string): ClinicType {
  const lower = specialty.toLowerCase();
  if (lower.includes("dent")) return "dentist";
  if (lower.includes("pharma")) return "pharmacy";
  if (lower.includes("vet")) return "veterinary";
  if (lower.includes("lab")) return "laboratory";
  if (lower.includes("hospital") || lower.includes("hôpital")) return "hospital";
  return "clinic";
}

const EMAIL_RE = /^[\w.-]+@[\w.-]+\.\w+$/;

/** Single-word tokens that name a medical specialty (substring match). */
const SPECIALTY_HINTS = [
  "dent",
  "pharma",
  "cardio",
  "heart",
  "derma",
  "skin",
  "pediatr",
  "child",
  "general",
  "généralist",
  "generalist",
  "vet",
  "lab",
  "hospital",
  "hôpital",
  "ophtalmo",
  "ophthalmo",
  "gyneco",
  "gynéco",
  "ortho",
  "neuro",
  "gastro",
  "radio",
  "uro",
  "nephro",
  "pneumo",
  "rhumato",
  "endocrino",
  "psychi",
];

function looksLikeEmail(s: string): boolean {
  return /[\w.-]+@[\w.-]+\.\w+/.test(s);
}

function looksLikePhone(s: string): boolean {
  const t = s.trim();
  // Only phone-shaped characters, and at least 8 digits.
  return /^[+\d\s()./-]+$/.test(t) && t.replace(/\D/g, "").length >= 8;
}

/** A single-word token that names a medical specialty (e.g. "dental"). */
function isSpecialtyToken(s: string): boolean {
  const t = s.trim();
  if (t.split(/\s+/).length !== 1) return false;
  const lower = t.toLowerCase();
  return SPECIALTY_HINTS.some((k) => lower.includes(k));
}

/**
 * Return the list of human-readable fields still required before the design
 * can be deployed. The provisioning API requires name, subdomain, owner email
 * and a valid clinic type; specialty/city/phone make the generated site usable.
 */
function missingForDeploy(config: ClinicConfig): string[] {
  const missing: string[] = [];
  if (!config.name.trim()) missing.push("clinic name");
  if (!config.subdomain.trim()) missing.push("subdomain");
  if (!config.specialty.trim()) missing.push("specialty");
  if (!config.city.trim()) missing.push("city");
  if (!config.phone.trim()) missing.push("phone number");
  if (!config.email.trim() || !EMAIL_RE.test(config.email.trim())) missing.push("a valid email");
  return missing;
}

/** Build the request body for POST /api/admin/onboarding-provision. */
function buildProvisionBody(config: ClinicConfig) {
  return {
    clinic_name: config.name.trim(),
    clinic_type: inferClinicType(config.specialty),
    tier: "vitrine" as const,
    subdomain: config.subdomain.trim(),
    owner_name: config.name.trim(),
    owner_email: config.email.trim(),
    owner_phone: config.phone.trim() || undefined,
    city: config.city.trim() || undefined,
    specialty: config.specialty.trim() || undefined,
    // Canonical branding columns so the live site matches the preview.
    primary_color: config.colors[0],
    secondary_color: config.colors[1],
    template_id: config.template,
    // Richer builder snapshot persisted into clinics.config: the full palette,
    // the chosen template, and the generated service list.
    template: config.template,
    theme_colors: config.colors,
    services: config.services,
  };
}

function processUserMessage(
  input: string,
  currentConfig: ClinicConfig,
): { response: string; config: ClinicConfig } {
  const lower = input.toLowerCase();
  const config = { ...currentConfig };
  const updates: string[] = [];

  const applyName = (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    config.name = name;
    config.subdomain = slugify(name);
    updates.push(`clinic name: **${config.name}**`);
    updates.push(`subdomain: ${config.subdomain}.oltigo.com`);
  };
  const applySpecialty = (raw: string) => {
    const sp = raw.trim();
    if (!sp) return;
    config.specialty = sp;
    config.colors = inferSpecialtyColors(sp);
    config.services = inferServices(sp);
    updates.push(`specialty: **${config.specialty}**`);
    updates.push(`auto-generated ${config.services.length} services`);
  };
  const applyCity = (raw: string) => {
    const city = raw.trim();
    if (!city) return;
    config.city = city;
    updates.push(`city: **${config.city}**`);
  };
  const applyPhone = (raw: string) => {
    const phone = raw.trim();
    if (!phone) return;
    config.phone = phone;
    updates.push(`phone: ${config.phone}`);
  };

  // Email can appear anywhere in the message.
  const emailMatch = input.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) {
    config.email = emailMatch[0];
    updates.push(`email: ${config.email}`);
  }

  // ── Primary path: comma-separated "Name, specialty, city, phone[, email]" ──
  // This is the format the greeting asks for and is the most reliable to parse.
  // (Fixes the prior regex parser, where the /i flag defeated the [A-Z] anchor
  // and unbounded keywords like "in" matched INSIDE words — e.g. the "in" of
  // "Clinique" — capturing "ique Dentaire Smile" as the city and dropping the
  // real city after the comma.)
  const parts = input
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const textParts: string[] = [];
    for (const part of parts) {
      if (looksLikeEmail(part)) continue; // handled above
      if (looksLikePhone(part)) {
        if (!config.phone) applyPhone(part);
        continue;
      }
      if (isSpecialtyToken(part)) {
        applySpecialty(part);
        continue;
      }
      textParts.push(part);
    }
    // Remaining free-text tokens are, in order, the clinic name then the city.
    if (textParts[0]) applyName(textParts[0]);
    if (textParts[1]) applyCity(textParts[1]);
  } else {
    // ── Fallback: conversational single-field edits ("name is X", "city: Y") ──
    // Keywords are anchored with \b so they never match INSIDE a word.
    let nameMatch = input.match(
      /\b(?:clinic name|name)\b\s*(?:is|:)\s*["']?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s&'.-]*?)["']?$/i,
    );
    if (!nameMatch) {
      nameMatch = input.match(
        /\b(?:called|named)\b\s+["']?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s&'.-]*?)["']?$/i,
      );
    }
    if (nameMatch) applyName(nameMatch[1]);

    const specialtyMatch = input.match(
      /\b(?:specialty|speciality|specialism|field)\b\s*(?:is|:)?\s*["']?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s-]*?)["']?$/i,
    );
    if (specialtyMatch) {
      applySpecialty(specialtyMatch[1]);
    } else if (lower.includes("dental") || lower.includes("dentist")) {
      applySpecialty("Dental");
    } else if (lower.includes("pharmacy") || lower.includes("pharmacie")) {
      applySpecialty("Pharmacy");
    }

    const cityMatch = input.match(
      /\b(?:city|located in|location|ville)\b\s*(?:is|:)?\s*["']?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s-]*?)["']?$/i,
    );
    if (cityMatch) applyCity(cityMatch[1]);

    const phoneMatch = input.match(
      /\b(?:phone|tel|call|mobile|whatsapp)\b\s*(?:is|:)?\s*([+\d][\d\s()./-]{7,})/i,
    );
    if (phoneMatch) applyPhone(phoneMatch[1]);
  }

  // ── Template selection (any path) ──
  if (lower.includes("modern")) {
    config.template = "modern" as TemplateStyle;
    updates.push("template: **Modern**");
  } else if (lower.includes("classic")) {
    config.template = "classic" as TemplateStyle;
    updates.push("template: **Classic**");
  } else if (lower.includes("minimal")) {
    config.template = "minimal" as TemplateStyle;
    updates.push("template: **Minimal**");
  }

  // ── Color keywords (any path) ──
  if (lower.includes("green")) {
    config.colors = presetPalettes.pharmacy;
    updates.push("applied green color scheme");
  } else if (lower.includes("purple") || lower.includes("violet")) {
    config.colors = presetPalettes.modern;
    updates.push("applied purple color scheme");
  } else if (lower.includes("red") || lower.includes("warm")) {
    config.colors = presetPalettes.warm;
    updates.push("applied warm/red color scheme");
  } else if (lower.includes("neutral") || lower.includes("gray") || lower.includes("grey")) {
    config.colors = presetPalettes.neutral;
    updates.push("applied neutral color scheme");
  }

  // ── Build response ──
  let response: string;
  if (updates.length > 0) {
    response = "Got it! I've updated the design:\n\n" + updates.map((u) => `• ${u}`).join("\n");

    const missing: string[] = [];
    if (!config.name) missing.push("clinic name");
    if (!config.specialty) missing.push("specialty");
    if (!config.city) missing.push("city");
    if (!config.phone) missing.push("phone number");

    if (missing.length > 0) {
      response += `\n\nI still need: ${missing.join(", ")}. Feel free to provide them!`;
    } else {
      response +=
        "\n\nThe design looks complete! You can adjust colors, template style, or click **Deploy** when ready.";
    }
  } else if (
    lower.includes("create") ||
    lower.includes("build") ||
    lower.includes("design") ||
    lower.includes("make")
  ) {
    response =
      "I'd love to help! Please provide:\n\n• Clinic name\n• Specialty (dental, pharmacy, general, etc.)\n• City\n• Phone number\n• Email (optional)\n\nThe quickest way is one line: **Name, specialty, city, phone**.";
  } else {
    response =
      "I'm not sure what to update. Try a single line like **Smile Dental, dental, Casablanca, +212 600 000 000** — or tell me the clinic name, specialty, city, phone, or email.";
  }

  return { response, config };
}

const LOCAL_STORAGE_KEY = "agent-builder-draft";

function loadDraft(): { config: ClinicConfig; messages: ChatMessageData[] } | null {
  if (typeof window === "undefined") return null;
  const saved = sessionStorage.getItem(LOCAL_STORAGE_KEY);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as {
      config: ClinicConfig;
      messages: Array<Omit<ChatMessageData, "timestamp"> & { timestamp: string }>;
    };
    return {
      config: parsed.config,
      messages: parsed.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
    };
  } catch {
    return null;
  }
}

const defaultMessages: ChatMessageData[] = [
  {
    id: "greeting",
    role: "assistant",
    content: GREETING_MESSAGE,
    timestamp: new Date(),
  },
];

export default function AgentBuilderPage() {
  const [messages, setMessages] = useState<ChatMessageData[]>(
    () => loadDraft()?.messages ?? defaultMessages,
  );
  const [input, setInput] = useState("");
  const [config, setConfig] = useState<ClinicConfig>(
    () => loadDraft()?.config ?? createEmptyConfig(),
  );
  const [deploying, setDeploying] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [deployConfirmOpen, setDeployConfirmOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  const pushAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: generateId(), role: "assistant", content, timestamp: new Date() },
    ]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      const userMsg: ChatMessageData = {
        id: generateId(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      const { response, config: newConfig } = processUserMessage(text, config);

      const aiMsg: ChatMessageData = {
        id: generateId(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setConfig(newConfig);
      setInput("");
    },
    [config],
  );

  const handleSaveDraft = () => {
    try {
      sessionStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ config, messages }));
      addToast("Draft saved for this session", "success");
    } catch {
      addToast("Couldn't save the draft (storage unavailable)", "error");
    }
  };

  const handleExportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.subdomain || "clinic"}-config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStartOver = () => {
    setMessages([
      {
        id: "greeting",
        role: "assistant",
        content: GREETING_MESSAGE,
        timestamp: new Date(),
      },
    ]);
    setConfig(createEmptyConfig());
    sessionStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  const handleDeploy = useCallback(async () => {
    if (deploying) return;

    const missing = missingForDeploy(config);
    if (missing.length > 0) {
      pushAssistantMessage(
        `Before I can deploy, I still need: ${missing.join(", ")}. Add ${
          missing.length > 1 ? "those" : "that"
        } and click **Deploy** again.`,
      );
      return;
    }

    setDeploying(true);
    pushAssistantMessage(`🚀 Deploying **${config.name}** to ${config.subdomain}.oltigo.com…`);

    try {
      const res = await fetch("/api/admin/onboarding-provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildProvisionBody(config)),
      });

      const json = (await res.json().catch(() => null)) as
        | { ok: true; data: { clinicId: string; subdomain: string } }
        | { ok: false; error?: { message?: string } }
        | null;

      if (!res.ok || !json || json.ok !== true) {
        const reason =
          (json && json.ok === false && json.error?.message) ||
          (res.status === 403
            ? "you need super-admin access to deploy"
            : res.status === 409
              ? "that subdomain is already in use — try another name"
              : `the server returned ${res.status}`);
        pushAssistantMessage(
          `❌ Deploy failed: ${reason}. Nothing was created — you can try again.`,
        );
        return;
      }

      const url = `https://${json.data.subdomain}.oltigo.com`;
      pushAssistantMessage(
        `✅ **${config.name}** is live!\n\n🔗 ${url}\n\nThe clinic record, subdomain, and design have been provisioned. You can refine services, schedule, and content from the clinic's admin dashboard.`,
      );
      // Clear the saved draft now that it has been deployed.
      sessionStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      pushAssistantMessage(
        "❌ Deploy failed: couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setDeploying(false);
    }
  }, [config, deploying, pushAssistantMessage]);

  const requestDeploy = useCallback(() => {
    if (deploying) return;
    const missing = missingForDeploy(config);
    if (missing.length > 0) {
      pushAssistantMessage(
        `Before I can deploy, I still need: ${missing.join(", ")}. Add ${
          missing.length > 1 ? "those" : "that"
        } and click **Deploy** again.`,
      );
      return;
    }
    setDeployConfirmOpen(true);
  }, [config, deploying, pushAssistantMessage]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* Chat Panel */}
      <div className="flex flex-1 flex-col border-r lg:w-[60%]">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex flex-col gap-1">
            <Breadcrumb
              className="mb-0"
              items={[
                { label: "Super Admin", href: "/super-admin/dashboard" },
                { label: "Website Builder" },
              ]}
            />
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Website Builder</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleSaveDraft} title="Save Draft">
              <Save className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Save</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExportConfig} title="Export Config">
              <Download className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Export</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResetConfirmOpen(true)}
              title="Start Over"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Reset</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              title="Deploy Site"
              onClick={requestDeploy}
              disabled={deploying}
            >
              <Rocket className={`mr-1 h-3.5 w-3.5 ${deploying ? "animate-pulse" : ""}`} />
              <span className="text-xs">{deploying ? "Deploying…" : "Deploy"}</span>
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </div>
        </ScrollArea>

        {/* Quick Prompts */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 border-t px-4 py-2">
            {QUICK_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleSend(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe the clinic (name, specialty, city, phone...)"
              className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" size="sm" className="h-10 px-4" disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="flex-1 lg:w-[40%]">
        <DesignPreview config={config} onConfigChange={setConfig} />
      </div>

      {/* Reset confirmation (WB-6 / WB-R2: no accidental data loss) */}
      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start over?</DialogTitle>
            <DialogDescription>
              This clears the current conversation and design and reverts to a blank template. Any
              unsaved progress will be lost. Use Save first if you want to keep it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                handleStartOver();
                setResetConfirmOpen(false);
              }}
            >
              Reset everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deploy confirmation (WB-R1: no accidental publish to a live subdomain) */}
      <Dialog open={deployConfirmOpen} onOpenChange={setDeployConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish this website?</DialogTitle>
            <DialogDescription>
              This provisions a live clinic at{" "}
              <span className="font-mono font-semibold">
                {config.subdomain || "clinic"}.oltigo.com
              </span>{" "}
              for <span className="font-semibold">{config.name || "this clinic"}</span>. It creates
              a real clinic record and subdomain. You can refine content afterwards from the
              clinic&apos;s admin dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeployConfirmOpen(false)}
              disabled={deploying}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setDeployConfirmOpen(false);
                void handleDeploy();
              }}
              disabled={deploying}
            >
              <Rocket className="mr-1 h-3.5 w-3.5" />
              Deploy now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
