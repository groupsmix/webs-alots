'use client';

import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, AlertCircle, Info, TrendingUp, AlertTriangle } from 'lucide-react';

interface NotificationMetadata {
  action_id?: string;
  [key: string]: unknown;
}

interface Notification {
  id: string;
  type: 'action_approval' | 'daily_summary' | 'insight' | 'performance_alert' | 'anomaly';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata?: NotificationMetadata;
}

export function AINotificationsPanel({ businessId }: { businessId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');

  useEffect(() => {
    loadNotifications();
  }, [businessId, filter]);

  async function loadNotifications() {
    try {
      const params = new URLSearchParams({ business_id: businessId });
      if (filter === 'unread') params.append('unread_only', 'true');

      const response = await fetch(`/api/ai/notifications?${params}`);
      const data = await response.json();

      if (data.ok) {
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      await fetch('/api/ai/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          notification_id: notificationId,
          action: 'mark_read',
        }),
      });

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  async function markAllAsRead() {
    try {
      await fetch('/api/ai/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          action: 'mark_all_read',
        }),
      });

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }

  function getIcon(type: Notification['type']) {
    switch (type) {
      case 'action_approval':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'daily_summary':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'insight':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'performance_alert':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'anomaly':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  }

  function getPriorityColor(priority: Notification['priority']) {
    switch (priority) {
      case 'urgent':
        return 'border-l-4 border-red-500 bg-red-50';
      case 'high':
        return 'border-l-4 border-orange-500 bg-orange-50';
      case 'medium':
        return 'border-l-4 border-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-l-4 border-blue-500 bg-blue-50';
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-1 text-xs font-medium bg-red-500 text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-sm rounded ${
                filter === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 text-sm rounded ${
                filter === 'unread'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Unread
            </button>
          </div>

          {/* Mark all as read */}
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bell className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No notifications</p>
          </div>
        ) : (
          notifications.map(notification => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg ${getPriorityColor(notification.priority)} ${
                !notification.read ? 'shadow-sm' : 'opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">{getIcon(notification.type)}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        {notification.title}
                      </h4>
                      <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                    </div>

                    {/* Mark as read button */}
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Timestamp */}
                  <p className="mt-2 text-xs text-gray-500">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>

                  {/* Action button for action_approval type */}
                  {notification.type === 'action_approval' && notification.metadata?.action_id && (
                    <a
                      href={`/admin/ai?tab=approvals&action=${notification.metadata.action_id}`}
                      className="mt-2 inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
                    >
                      Review action →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
