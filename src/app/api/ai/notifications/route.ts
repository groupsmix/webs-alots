/**
 * AI Notifications API
 * 
 * Get and manage AI notifications.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api-response';
import { requireTenant } from '@/lib/tenant';
import { 
  getUnreadNotifications, 
  markNotificationRead,
  markAllNotificationsRead
} from '@/lib/ai/notifications';
import { logger } from '@/lib/logger';

// GET - Get notifications
export async function GET(req: NextRequest) {
  try {
    const { clinicId } = await requireTenant();
    const { searchParams } = new URL(req.url);
    
    const businessId = searchParams.get('businessId') || clinicId;

    if (businessId !== clinicId) {
      return apiUnauthorized('Cannot view other businesses');
    }

    const notifications = await getUnreadNotifications(businessId);

    return apiSuccess(notifications);

  } catch (error) {
    logger.error('Failed to get notifications', {
      context: 'ai-notifications-api',
      error,
    });

    return apiError('Failed to get notifications', 500);
  }
}

// POST - Mark notifications as read
export async function POST(req: NextRequest) {
  try {
    const { clinicId } = await requireTenant();
    const { notificationId, markAll } = await req.json();

    if (markAll) {
      await markAllNotificationsRead(clinicId);
      return apiSuccess({ marked: 'all' });
    }

    if (notificationId) {
      await markNotificationRead(clinicId, notificationId);
      return apiSuccess({ marked: notificationId });
    }

    return apiError('Missing notificationId or markAll', 400);

  } catch (error) {
    logger.error('Failed to mark notifications', {
      context: 'ai-notifications-api',
      error,
    });

    return apiError('Failed to mark notifications', 500);
  }
}
