'use client';

/**
 * AI Campaign Builder
 * 
 * Create and manage marketing campaigns.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Play, Pause, Trash2 } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  results?: {
    messages_sent: number;
    messages_delivered: number;
    bookings: number;
    revenue: number;
  };
}

interface Template {
  id: string;
  name: string;
  type: string;
}

interface AICampaignBuilderProps {
  businessId: string;
}

export function AICampaignBuilder({ businessId }: AICampaignBuilderProps) {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => {
    loadCampaigns();
    loadTemplates();
  }, [businessId]);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/campaigns?businessId=${businessId}`);
      if (res.ok) {
        setCampaigns(await res.json());
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplates() {
    try {
      const res = await fetch(`/api/ai/campaigns?businessId=${businessId}&templates=true`);
      if (res.ok) {
        setTemplates(await res.json());
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }

  if (loading) {
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
          <h3 className="text-lg font-semibold">Marketing Campaigns</h3>
          <p className="text-sm text-muted-foreground">
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowBuilder(!showBuilder)}>
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {showBuilder && (
        <CampaignForm
          businessId={businessId}
          templates={templates}
          onClose={() => setShowBuilder(false)}
          onSuccess={() => {
            setShowBuilder(false);
            loadCampaigns();
          }}
        />
      )}

      {/* Campaign List */}
      <div className="grid gap-4">
        {campaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            businessId={businessId}
            onUpdate={loadCampaigns}
          />
        ))}
      </div>

      {campaigns.length === 0 && !showBuilder && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No campaigns yet</p>
            <Button onClick={() => setShowBuilder(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Campaign
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CampaignForm({ 
  businessId, 
  templates, 
  onClose, 
  onSuccess 
}: { 
  businessId: string; 
  templates: Template[]; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'reengagement',
    segment: 'inactive',
    message: '',
    channel: 'whatsapp',
    start_date: new Date().toISOString().split('T')[0],
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/ai/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign: {
            business_id: businessId,
            name: formData.name,
            type: formData.type,
            target: {
              segment: formData.segment,
              estimated_size: 100,
            },
            message: {
              template: formData.message,
              channel: formData.channel,
            },
            schedule: {
              start_date: formData.start_date,
              frequency: 'once',
            },
            created_by: 'admin',
          },
        }),
      });

      if (res.ok) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to create campaign:', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Campaign</CardTitle>
        <CardDescription>Set up a new marketing campaign</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Campaign Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Win Back Inactive Customers"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Campaign Type</Label>
              <Select
                value={formData.type}
                onValueChange={(type) => setFormData({ ...formData, type })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reengagement">Re-engagement</SelectItem>
                  <SelectItem value="upsell">Upsell</SelectItem>
                  <SelectItem value="retention">Retention</SelectItem>
                  <SelectItem value="promotion">Promotion</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Segment</Label>
              <Select
                value={formData.segment}
                onValueChange={(segment) => setFormData({ ...formData, segment })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inactive">Inactive Customers</SelectItem>
                  <SelectItem value="at_risk">At-Risk Customers</SelectItem>
                  <SelectItem value="vip">VIP Customers</SelectItem>
                  <SelectItem value="regular">Regular Customers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Enter your campaign message..."
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select
                value={formData.channel}
                onValueChange={(channel) => setFormData({ ...formData, channel })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Campaign'
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CampaignCard({ 
  campaign, 
  businessId, 
  onUpdate 
}: { 
  campaign: Campaign; 
  businessId: string; 
  onUpdate: () => void;
}) {
  const [processing, setProcessing] = useState(false);

  async function handleAction(action: 'start' | 'pause') {
    setProcessing(true);
    try {
      const res = await fetch('/api/ai/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          campaignId: campaign.id,
        }),
      });

      if (res.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to update campaign:', error);
    } finally {
      setProcessing(false);
    }
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    scheduled: 'bg-blue-100 text-blue-800',
    running: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-purple-100 text-purple-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{campaign.name}</CardTitle>
            <CardDescription className="capitalize">{campaign.type} campaign</CardDescription>
          </div>
          <Badge className={statusColors[campaign.status as keyof typeof statusColors]}>
            {campaign.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {campaign.results && (
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Sent</p>
                <p className="font-medium">{campaign.results.messages_sent}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Delivered</p>
                <p className="font-medium">{campaign.results.messages_delivered}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Bookings</p>
                <p className="font-medium">{campaign.results.bookings}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Revenue</p>
                <p className="font-medium">{(campaign.results.revenue / 100).toFixed(2)} MAD</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {campaign.status === 'draft' && (
              <Button
                size="sm"
                onClick={() => handleAction('start')}
                disabled={processing}
              >
                <Play className="mr-2 h-4 w-4" />
                Start
              </Button>
            )}
            {campaign.status === 'running' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction('pause')}
                disabled={processing}
              >
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
