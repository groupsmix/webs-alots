'use client';

/**
 * Compliance Settings Component
 * 
 * Allows businesses to configure their data storage and compliance settings.
 * Supports three modes: Cloud-First, Hybrid, and Local-Only.
 */

import { useState, useEffect } from 'react';
import { Shield, Cloud, HardDrive, Lock, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import type { ComplianceMode, ComplianceSettings } from '@/lib/compliance-mode';

interface ComplianceSettingsProps {
  businessId: string;
  businessType: string;
}

export default function ComplianceSettingsComponent({ businessId, businessType }: ComplianceSettingsProps) {
  const [settings, setSettings] = useState<ComplianceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [compliance, setCompliance] = useState<{
    compliant: boolean;
    issues: string[];
    recommendations: string[];
  } | null>(null);

  // Load settings
  useEffect(() => {
    loadSettings();
    checkCompliance();
  }, [businessId]);

  async function loadSettings() {
    try {
      const response = await fetch(`/api/compliance?businessId=${businessId}`);
      const data = await response.json();
      setSettings(data.settings);
    } catch (error) {
      console.error('Failed to load compliance settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkCompliance() {
    try {
      const response = await fetch(`/api/compliance/check?businessId=${businessId}`);
      const data = await response.json();
      setCompliance(data);
    } catch (error) {
      console.error('Failed to check compliance:', error);
    }
  }

  async function saveSettings(updates: Partial<ComplianceSettings>) {
    setSaving(true);
    try {
      const response = await fetch('/api/compliance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          settings: { ...settings, ...updates },
        }),
      });

      if (response.ok) {
        await loadSettings();
        await checkCompliance();
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  }

  function handleModeChange(mode: ComplianceMode) {
    saveSettings({ mode });
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Compliance Settings</h2>
          <p className="text-gray-600 mt-1">
            Configure how your data is stored and protected
          </p>
        </div>
        
        {compliance && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            compliance.compliant 
              ? 'bg-green-50 text-green-700' 
              : 'bg-yellow-50 text-yellow-700'
          }`}>
            {compliance.compliant ? (
              <>
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Compliant</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">{compliance.issues.length} Issues</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Compliance Issues */}
      {compliance && !compliance.compliant && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 mb-2">Compliance Issues</h3>
              <ul className="space-y-1">
                {compliance.issues.map((issue, i) => (
                  <li key={i} className="text-sm text-yellow-800">• {issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {compliance && compliance.recommendations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">Recommendations</h3>
              <ul className="space-y-1">
                {compliance.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-blue-800">• {rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Storage Mode Selection */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Mode</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cloud-First */}
          <button
            onClick={() => handleModeChange('cloud-first')}
            disabled={saving}
            className={`relative p-6 rounded-lg border-2 transition-all text-left ${
              settings.mode === 'cloud-first'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <Cloud className={`w-6 h-6 ${
                settings.mode === 'cloud-first' ? 'text-blue-600' : 'text-gray-400'
              }`} />
              <h4 className="font-semibold text-gray-900">Cloud-First</h4>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              All data stored in secure cloud. Best performance and automatic backups.
            </p>
            
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Automatic backups</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Multi-device sync</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Best performance</span>
              </div>
            </div>
            
            <div className="mt-4 text-xs font-medium text-gray-500">
              Recommended for: Restaurants, Gyms, Salons
            </div>
          </button>

          {/* Hybrid */}
          <button
            onClick={() => handleModeChange('hybrid')}
            disabled={saving}
            className={`relative p-6 rounded-lg border-2 transition-all text-left ${
              settings.mode === 'hybrid'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <Shield className={`w-6 h-6 ${
                settings.mode === 'hybrid' ? 'text-blue-600' : 'text-gray-400'
              }`} />
              <h4 className="font-semibold text-gray-900">Hybrid</h4>
              {businessType === 'healthcare' && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                  Recommended
                </span>
              )}
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Sensitive data stays local, non-sensitive syncs to cloud. GDPR/HIPAA compliant.
            </p>
            
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Local sensitive data</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Cloud analytics</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>GDPR/HIPAA compliant</span>
              </div>
            </div>
            
            <div className="mt-4 text-xs font-medium text-gray-500">
              Recommended for: Healthcare, Dental, Medical
            </div>
          </button>

          {/* Local-Only */}
          <button
            onClick={() => handleModeChange('local-only')}
            disabled={saving}
            className={`relative p-6 rounded-lg border-2 transition-all text-left ${
              settings.mode === 'local-only'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <HardDrive className={`w-6 h-6 ${
                settings.mode === 'local-only' ? 'text-blue-600' : 'text-gray-400'
              }`} />
              <h4 className="font-semibold text-gray-900">Local-Only</h4>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              All data stays on your device. Maximum privacy and control.
            </p>
            
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Complete data control</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>No cloud dependency</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Maximum privacy</span>
              </div>
            </div>
            
            <div className="mt-4 text-xs font-medium text-gray-500">
              Recommended for: Legal, Financial, Government
            </div>
          </button>
        </div>
      </div>

      {/* Encryption Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold text-gray-900">Encryption</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Enable Encryption</p>
              <p className="text-sm text-gray-600">
                Encrypt sensitive data with AES-256-GCM
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.encryption.enabled}
                onChange={(e) => saveSettings({
                  encryption: { ...settings.encryption, enabled: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          {settings.encryption.enabled && (
            <div className="pl-4 border-l-2 border-gray-200 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Algorithm
                </label>
                <input
                  type="text"
                  value={settings.encryption.algorithm}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Derivation Iterations
                </label>
                <input
                  type="number"
                  value={settings.encryption.iterations}
                  onChange={(e) => saveSettings({
                    encryption: { ...settings.encryption, iterations: parseInt(e.target.value) }
                  })}
                  min="10000"
                  max="1000000"
                  step="10000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Higher values are more secure but slower (recommended: 100,000)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backup Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Backup Settings</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Enable Automatic Backups</p>
              <p className="text-sm text-gray-600">
                Automatically backup your data
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.backup.enabled}
                onChange={(e) => saveSettings({
                  backup: { ...settings.backup, enabled: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          {settings.backup.enabled && (
            <div className="pl-4 border-l-2 border-gray-200 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Backup Location
                </label>
                <select
                  value={settings.backup.location}
                  onChange={(e) => saveSettings({
                    backup: { ...settings.backup, location: e.target.value as any }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="cloud">Cloud Storage</option>
                  <option value="local-folder">Local Folder</option>
                  <option value="external-drive">External Drive</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Backup Frequency
                </label>
                <select
                  value={settings.backup.frequency}
                  onChange={(e) => saveSettings({
                    backup: { ...settings.backup, frequency: e.target.value as any }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Retention Period (days)
                </label>
                <input
                  type="number"
                  value={settings.backup.retention}
                  onChange={(e) => saveSettings({
                    backup: { ...settings.backup, retention: parseInt(e.target.value) }
                  })}
                  min="1"
                  max="3650"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sync Settings */}
      {settings.mode !== 'local-only' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync Settings</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Enable Cloud Sync</p>
                <p className="text-sm text-gray-600">
                  Sync non-sensitive data to cloud
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.sync.enabled}
                  onChange={(e) => saveSettings({
                    sync: { ...settings.sync, enabled: e.target.checked }
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            {settings.sync.enabled && (
              <div className="pl-4 border-l-2 border-gray-200 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sync Interval (minutes)
                  </label>
                  <input
                    type="number"
                    value={settings.sync.syncInterval}
                    onChange={(e) => saveSettings({
                      sync: { ...settings.sync, syncInterval: parseInt(e.target.value) }
                    })}
                    min="1"
                    max="1440"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Conflict Resolution
                  </label>
                  <select
                    value={settings.sync.conflictResolution}
                    onChange={(e) => saveSettings({
                      sync: { ...settings.sync, conflictResolution: e.target.value as any }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="local-wins">Local Wins</option>
                    <option value="cloud-wins">Cloud Wins</option>
                    <option value="manual">Manual Resolution</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Status */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span>Saving...</span>
        </div>
      )}
    </div>
  );
}
