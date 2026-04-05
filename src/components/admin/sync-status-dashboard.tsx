'use client';

/**
 * Sync Status Dashboard
 * 
 * Shows the status of data synchronization between local storage and cloud.
 */

import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Database, Cloud, HardDrive } from 'lucide-react';
import { localDB } from '@/lib/storage/local-db';

export default function SyncStatusDashboard() {
  const [syncStatus, setSyncStatus] = useState<{
    pending: number;
    synced: number;
    failed: number;
  } | null>(null);
  
  const [dbSize, setDbSize] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    loadStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadStatus() {
    try {
      const status = await localDB.getSyncStatus();
      setSyncStatus(status);
      
      const size = await localDB.getDatabaseSize();
      setDbSize(size);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await localDB.syncToCloud();
      setLastSync(new Date());
      await loadStatus();
      
      if (result.failed > 0) {
        alert(`Sync completed with ${result.failed} failures. Check the logs for details.`);
      }
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleClearSynced() {
    if (!confirm('Clear all synced items from the queue? This cannot be undone.')) {
      return;
    }
    
    try {
      await localDB.clearSyncedItems();
      await loadStatus();
    } catch (error) {
      console.error('Failed to clear synced items:', error);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  if (!syncStatus) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totalItems = syncStatus.pending + syncStatus.synced + syncStatus.failed;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sync Status</h2>
          <p className="text-gray-600 mt-1">
            Monitor data synchronization between local and cloud storage
          </p>
        </div>
        
        <button
          onClick={handleSync}
          disabled={syncing || syncStatus.pending === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Pending */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <span className="text-2xl font-bold text-gray-900">{syncStatus.pending}</span>
          </div>
          <p className="text-sm text-gray-600">Pending Sync</p>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-yellow-500 transition-all"
              style={{ width: `${totalItems > 0 ? (syncStatus.pending / totalItems) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Synced */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-2xl font-bold text-gray-900">{syncStatus.synced}</span>
          </div>
          <p className="text-sm text-gray-600">Synced</p>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all"
              style={{ width: `${totalItems > 0 ? (syncStatus.synced / totalItems) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Failed */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-2xl font-bold text-gray-900">{syncStatus.failed}</span>
          </div>
          <p className="text-sm text-gray-600">Failed</p>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-500 transition-all"
              style={{ width: `${totalItems > 0 ? (syncStatus.failed / totalItems) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Storage */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Database className="w-5 h-5 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">{formatBytes(dbSize)}</span>
          </div>
          <p className="text-sm text-gray-600">Local Storage</p>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${(dbSize / (50 * 1024 * 1024)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Last Sync */}
      {lastSync && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-medium text-green-900">Last sync completed</p>
              <p className="text-sm text-green-700">
                {lastSync.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Failed Items Warning */}
      {syncStatus.failed > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div className="flex-1">
              <p className="font-medium text-red-900">
                {syncStatus.failed} items failed to sync
              </p>
              <p className="text-sm text-red-700">
                These items will be retried automatically. If the problem persists, check your internet connection.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Storage Breakdown */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Breakdown</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">Local Storage</p>
                <p className="text-sm text-gray-600">Sensitive data stored on your device</p>
              </div>
            </div>
            <span className="text-lg font-semibold text-gray-900">{formatBytes(dbSize)}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">Cloud Storage</p>
                <p className="text-sm text-gray-600">Non-sensitive data synced to cloud</p>
              </div>
            </div>
            <span className="text-lg font-semibold text-gray-900">
              {formatBytes(dbSize * 0.3)} {/* Estimate: 30% of local data */}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleClearSynced}
          disabled={syncStatus.synced === 0}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear Synced Items
        </button>
        
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Refresh Status
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-1">How Sync Works</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Sensitive data (medical records, prescriptions) stays on your device</li>
              <li>• Non-sensitive metadata (names, phone numbers) syncs to cloud</li>
              <li>• Sync happens automatically every 15 minutes</li>
              <li>• You can manually sync anytime using the "Sync Now" button</li>
              <li>• Failed items are automatically retried up to 3 times</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
