//
// Sentry Cron Monitoring utility.
//
// Wraps cron job handlers with Sentry check-in calls so that missed or
// failing jobs are surfaced automatically in the Sentry Crons dashboard.
//
// @see https://docs.sentry.io/product/crons/

import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";

type CronHandler = (request: NextRequest) => Promise<NextResponse | Response>;

/** Wrap a Next.js cron route handler with Sentry Cron Monitoring check-ins. */
export function withSentryCron(
  monitorSlug: string,
  schedule: string,
  handler: CronHandler,
): CronHandler {
  return async (request: NextRequest) => {
    // Start an in_progress check-in. Sentry auto-creates the monitor if it
    // doesn't exist yet, using the schedule we provide.
    const checkInId = Sentry.captureCheckIn(
      {
        monitorSlug,
        status: "in_progress",
      },
      {
        schedule: {
          type: "crontab",
          value: schedule,
        },
        // Allow up to 10 minutes for the job to complete before marking as missed.
        maxRuntime: 10,
        // Mark as missed if the job doesn't start within 5 minutes of expected time.
        checkinMargin: 5,
      },
    );

    try {
      const response = await handler(request);

      // Determine success from the HTTP status code.
      const status = response instanceof NextResponse
        ? response.status
        : response.status;

      const isSuccess = status >= 200 && status < 300;

      Sentry.captureCheckIn({
        checkInId,
        monitorSlug,
        status: isSuccess ? "ok" : "error",
      });

      return response;
    } catch (error) {
      // Report the error check-in and re-throw so the caller still sees the error.
      Sentry.captureCheckIn({
        checkInId,
        monitorSlug,
        status: "error",
      });

      Sentry.captureException(error);
      throw error;
    }
  };
}
