"use client";

/* eslint-disable i18next/no-literal-string -- Admin/super-admin internal surface: French UI strings are the intended output language; adding them to the i18n keyset would inflate the translation backlog for internal-only tooling. */

import { Download, RotateCcw, Rocket, Save, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatMessage, type ChatMessageData } from "@/components/agent-builder/chat-message";
import { presetPalettes } from "@/components/agent-builder/color-palette";
import { DesignPreview } from "@/components/agent-builder/design-preview";
import type { ClinicConfig, TemplateStyle } from "@/components/agent-builder/types";
import { createEmptyConfig } from "@/components/agent-builder/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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

function processUserMessage(
  input: string,
  currentConfig: ClinicConfig,
): { response: string; config: ClinicConfig } {
  const lower = input.toLowerCase();
  const config = { ...currentConfig };
  const updates: string[] = [];

  // Extract name
  const nameMatch = input.match(
    /(?:name|clinic|called|named)\s*(?:is|:)?\s*["']?([A-Z][A-Za-z\s&'.]+)/i,
  );
  if (nameMatch) {
    config.name = nameMatch[1].trim();
    config.subdomain = slugify(config.name);
    updates.push(`clinic name: **${config.name}**`);
    updates.push(`subdomain: ${config.subdomain}.oltigo.com`);
  }

  // Extract specialty
  const specialtyMatch = input.match(
    /(?:specialty|speciality|type|specializ|field)\s*(?:is|:)?\s*["']?([A-Za-z\s]+)/i,
  );
  if (specialtyMatch) {
    config.specialty = specialtyMatch[1].trim();
    config.colors = inferSpecialtyColors(config.specialty);
    config.services = inferServices(config.specialty);
    updates.push(`specialty: **${config.specialty}**`);
    updates.push(`suggested palette for ${config.specialty}`);
    updates.push(`auto-generated ${config.services.length} services`);
  } else if (lower.includes("dental") || lower.includes("dentist")) {
    config.specialty = "Dental";
    config.colors = presetPalettes.dental;
    config.services = inferServices("dental");
    updates.push(`specialty: **Dental**`);
  } else if (lower.includes("pharmacy") || lower.includes("pharmacie")) {
    config.specialty = "Pharmacy";
    config.colors = presetPalettes.pharmacy;
    config.services = inferServices("pharmacy");
    updates.push(`specialty: **Pharmacy**`);
  }

  // Extract city
  const cityMatch = input.match(
    /(?:city|location|located|ville|in)\s*(?:is|:)?\s*["']?([A-Z][A-Za-z\s-]+)/i,
  );
  if (cityMatch && !cityMatch[1].toLowerCase().startsWith("a ")) {
    config.city = cityMatch[1].trim();
    updates.push(`city: **${config.city}**`);
  }

  // Extract phone
  const phoneMatch = input.match(
    /(?:phone|tel|call|mobile|whatsapp)\s*(?:is|:)?\s*["']?([+\d\s()-]{8,})/i,
  );
  if (phoneMatch) {
    config.phone = phoneMatch[1].trim();
    updates.push(`phone: ${config.phone}`);
  }

  // Extract email
  const emailMatch = input.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) {
    config.email = emailMatch[0];
    updates.push(`email: ${config.email}`);
  }

  // Template selection
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

  // Color keywords
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

  // Build response
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
        "\n\nThe design looks complete! You can adjust colors, template style, or click **Deploy Site** when ready.";
    }
  } else if (
    lower.includes("create") ||
    lower.includes("build") ||
    lower.includes("design") ||
    lower.includes("make")
  ) {
    response =
      "I'd love to help! Please provide:\n\n• Clinic name\n• Specialty (dental, pharmacy, general, etc.)\n• City\n• Phone number\n• Email (optional)\n\nYou can share all at once or one by one.";
  } else {
    response =
      "I'm not sure what to update. Try telling me the clinic name, specialty, city, phone, or email — or ask me to change the template or colors!";
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
  const scrollRef = useRef<HTMLDivElement>(null);

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
    sessionStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ config, messages }));
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

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* Chat Panel */}
      <div className="flex flex-1 flex-col border-r lg:w-[60%]">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Website Builder</h1>
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
            <Button variant="ghost" size="sm" onClick={handleStartOver} title="Start Over">
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Reset</span>
            </Button>
            <Button variant="default" size="sm" title="Deploy Site">
              <Rocket className="mr-1 h-3.5 w-3.5" />
              <span className="text-xs">Deploy</span>
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
    </div>
  );
}
