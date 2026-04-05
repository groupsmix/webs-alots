/**
 * Health Check Endpoint
 * 
 * Returns system health status for monitoring
 */

import { NextResponse } from 'next/server';
import { getHealthStatus } from '@/lib/monitoring';

export const runtime = 'edge';

export async function GET() {
  try {
    const health = await getHealthStatus();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;
    
    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
