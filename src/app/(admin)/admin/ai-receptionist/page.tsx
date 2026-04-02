"use client";

import { Bot, MessageSquare, Settings2, Phone, Clock, Languages, Send } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logger } from "@/lib/logger";

interface AiSettings {
  ai_enabled: boolean;
  business_hours_only: boolean;
  custom_greeting: string;
  custom_responses: Record<string, string>;
  handoff_enabled: boolean;
  handoff_phone: string;
  language: string;
}

interface ConversationLog {
  id: string;
  action: string;
  description: string;
  metadata: {
    from?: string;
    intent?: string;
    contact_name?: string;
  };
  timestamp: string;
}

export default function AiReceptionistPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [conversations, setConversations] = useState<ConversationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/whatsapp-receptionist/admin");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { settings: AiSettings };
      setSettings(data.settings);
    } catch (err) {
      logger.warn("Failed to load AI receptionist settings", { context: "ai-receptionist-page", error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/whatsapp-receptionist/admin?section=conversations");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as { conversations: ConversationLog[] };
      setConversations(data.conversations ?? []);
    } catch (err) {
      logger.warn("Failed to load conversations", { context: "ai-receptionist-page", error: err });
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (activeTab === "conversations") {
      void loadConversations();
    }
  }, [activeTab, loadConversations]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ai/whatsapp-receptionist/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch (err) {
      logger.warn("Failed to save AI receptionist settings", { context: "ai-receptionist-page", error: err });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin/dashboard" }, { label: "AI Receptionist" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            AI WhatsApp Receptionist
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure AI-powered WhatsApp responses, view conversation logs, and manage handoff settings
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="settings">
            <Settings2 className="h-3.5 w-3.5 mr-1" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="conversations">
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Conversation Log
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="space-y-4">
            {/* Toggle AI On/Off */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  AI Receptionist
                </CardTitle>
                <CardDescription>Enable or disable the AI-powered WhatsApp receptionist</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">AI Enabled</Label>
                    <p className="text-xs text-muted-foreground">When enabled, AI will automatically respond to WhatsApp messages</p>
                  </div>
                  <Switch
                    checked={settings.ai_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, ai_enabled: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Business Hours */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Business Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Business Hours Only</Label>
                    <p className="text-xs text-muted-foreground">Only respond during clinic business hours</p>
                  </div>
                  <Switch
                    checked={settings.business_hours_only}
                    onCheckedChange={(checked) => setSettings({ ...settings, business_hours_only: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Custom Greeting */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Custom Greeting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Greeting Message</Label>
                  <Input
                    value={settings.custom_greeting}
                    onChange={(e) => setSettings({ ...settings, custom_greeting: e.target.value })}
                    placeholder="e.g., Bonjour et bienvenue chez notre clinique!"
                  />
                  <p className="text-xs text-muted-foreground">Custom greeting sent as the first message to new contacts</p>
                </div>
              </CardContent>
            </Card>

            {/* Language */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Language
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Response Language</Label>
                  <select
                    value={settings.language}
                    onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="fr">Français</option>
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Smart Handoff */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Smart Handoff
                </CardTitle>
                <CardDescription>Configure when AI should hand off to a human</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Enable Handoff</Label>
                    <p className="text-xs text-muted-foreground">Notify staff when AI cannot handle a request</p>
                  </div>
                  <Switch
                    checked={settings.handoff_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, handoff_enabled: checked })}
                  />
                </div>
                {settings.handoff_enabled && (
                  <div className="space-y-2">
                    <Label>Handoff Phone Number</Label>
                    <Input
                      value={settings.handoff_phone}
                      onChange={(e) => setSettings({ ...settings, handoff_phone: e.target.value })}
                      placeholder="+212 6XX XXX XXX"
                    />
                    <p className="text-xs text-muted-foreground">Staff phone number to notify when handoff is needed</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Save Settings
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Conversations Tab */}
        <TabsContent value="conversations">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Recent Conversations
                <Badge variant="secondary">{conversations.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No conversation logs yet. Conversations will appear here when patients message via WhatsApp.
                </p>
              ) : (
                <div className="space-y-3">
                  {conversations.map((conv) => (
                    <div key={conv.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Bot className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{conv.metadata?.contact_name ?? "Unknown"}</span>
                          <Badge variant="secondary" className="text-[10px]">{conv.metadata?.intent ?? "general"}</Badge>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(conv.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{conv.description}</p>
                        {conv.metadata?.from && (
                          <p className="text-xs text-muted-foreground mt-1">From: {conv.metadata.from}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
