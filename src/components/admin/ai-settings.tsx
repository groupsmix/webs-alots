'use client';

/**
 * AI Settings Component
 * 
 * Configure AI behavior and capabilities.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Save } from 'lucide-react';
import type { AIConfig } from '@/lib/ai/types';

interface AISettingsProps {
  businessId: string;
}

export function AISettings({ businessId }: AISettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AIConfig | null>(null);

  useEffect(() => {
    loadConfig();
  }, [businessId]);

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/config?businessId=${businessId}`);
      if (res.ok) {
        setConfig(await res.json());
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!config) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, config })
      });

      if (res.ok) {
        alert('Settings saved successfully!');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Settings</h2>
          <p className="text-muted-foreground">
            Configure how the AI agent behaves
          </p>
        </div>
        <Button onClick={saveConfig} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic AI configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable AI Agent</Label>
              <p className="text-sm text-muted-foreground">
                Turn the AI agent on or off
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
            />
          </div>

          <div className="space-y-2">
            <Label>Autonomy Level</Label>
            <Select
              value={config.autonomy.level}
              onValueChange={(level: any) => 
                setConfig({ ...config, autonomy: { ...config.autonomy, level } })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assistant">Assistant (Suggest only)</SelectItem>
                <SelectItem value="copilot">Copilot (Suggest + Execute low-risk)</SelectItem>
                <SelectItem value="autopilot">Autopilot (Full autonomy)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {config.autonomy.level === 'assistant' && 'AI will only suggest actions for your approval'}
              {config.autonomy.level === 'copilot' && 'AI will execute low-risk actions automatically'}
              {config.autonomy.level === 'autopilot' && 'AI will execute all actions automatically'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Max Actions Per Day</Label>
            <Input
              type="number"
              value={config.autonomy.max_actions_per_day}
              onChange={(e) => 
                setConfig({ 
                  ...config, 
                  autonomy: { 
                    ...config.autonomy, 
                    max_actions_per_day: parseInt(e.target.value) 
                  } 
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Max Spend Per Action (MAD)</Label>
            <Input
              type="number"
              value={config.autonomy.max_spend_per_action / 100}
              onChange={(e) => 
                setConfig({ 
                  ...config, 
                  autonomy: { 
                    ...config.autonomy, 
                    max_spend_per_action: parseFloat(e.target.value) * 100 
                  } 
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto-Approval Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Approval</CardTitle>
          <CardDescription>Which risk levels can execute automatically</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Low Risk Actions</Label>
              <p className="text-sm text-muted-foreground">
                Reminders, follow-ups, review requests
              </p>
            </div>
            <Switch
              checked={config.autonomy.auto_approve.low}
              onCheckedChange={(low) => 
                setConfig({ 
                  ...config, 
                  autonomy: { 
                    ...config.autonomy, 
                    auto_approve: { ...config.autonomy.auto_approve, low } 
                  } 
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Medium Risk Actions</Label>
              <p className="text-sm text-muted-foreground">
                Rescheduling, promotions, campaigns
              </p>
            </div>
            <Switch
              checked={config.autonomy.auto_approve.medium}
              onCheckedChange={(medium) => 
                setConfig({ 
                  ...config, 
                  autonomy: { 
                    ...config.autonomy, 
                    auto_approve: { ...config.autonomy.auto_approve, medium } 
                  } 
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>High Risk Actions</Label>
              <p className="text-sm text-muted-foreground">
                Pricing changes, policy updates
              </p>
            </div>
            <Switch
              checked={config.autonomy.auto_approve.high}
              onCheckedChange={(high) => 
                setConfig({ 
                  ...config, 
                  autonomy: { 
                    ...config.autonomy, 
                    auto_approve: { ...config.autonomy.auto_approve, high } 
                  } 
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle>Capabilities</CardTitle>
          <CardDescription>Enable or disable specific AI features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(config.capabilities).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <Label>{formatCapability(key)}</Label>
              <Switch
                checked={value}
                onCheckedChange={(checked) => 
                  setConfig({ 
                    ...config, 
                    capabilities: { ...config.capabilities, [key]: checked } 
                  })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader>
          <CardTitle>Goals</CardTitle>
          <CardDescription>What should the AI optimize for?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Primary Goal</Label>
            <Select
              value={config.goals.primary}
              onValueChange={(primary: any) => 
                setConfig({ ...config, goals: { ...config.goals, primary } })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Revenue Growth</SelectItem>
                <SelectItem value="retention">Customer Retention</SelectItem>
                <SelectItem value="satisfaction">Customer Satisfaction</SelectItem>
                <SelectItem value="efficiency">Operational Efficiency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Target Revenue Increase (%)</Label>
            <Input
              type="number"
              value={config.goals.target_revenue_increase}
              onChange={(e) => 
                setConfig({ 
                  ...config, 
                  goals: { 
                    ...config.goals, 
                    target_revenue_increase: parseInt(e.target.value) 
                  } 
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Target Retention Rate (%)</Label>
            <Input
              type="number"
              value={config.goals.target_retention_rate}
              onChange={(e) => 
                setConfig({ 
                  ...config, 
                  goals: { 
                    ...config.goals, 
                    target_retention_rate: parseInt(e.target.value) 
                  } 
                })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatCapability(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
