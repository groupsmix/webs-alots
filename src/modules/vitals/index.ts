/**
 * Vitals Module
 *
 * Real-time patient vital signs streaming and monitoring.
 * Uses SSE (Server-Sent Events) for one-way server→client push.
 */

export { createVitalsStream } from "./stream";
export type { VitalsEventType, VitalsUpdatePayload } from "./stream";
