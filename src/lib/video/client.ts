/**
 * Video Consultation Client
 *
 * Abstraction over the Twilio Programmable Video REST API.
 * Uses direct HTTP calls so no SDK package is required.
 *
 * Environment variables required:
 *   TWILIO_ACCOUNT_SID   — Twilio account SID (ACxxxxxxxx)
 *   TWILIO_API_KEY       — Twilio API Key SID (SKxxxxxxxx)
 *   TWILIO_API_SECRET    — Twilio API Key Secret
 *
 * @see https://www.twilio.com/docs/video
 */

import { getTwilioAccountSid, getTwilioApiKey, getTwilioApiSecret } from "@/lib/env";
import { safeFetch } from "@/lib/fetch-wrapper";
import { logger } from "@/lib/logger";

export type VideoRoomType = "go" | "peer-to-peer" | "group";

export interface VideoRoom {
  sid: string;
  uniqueName: string;
  status: "in-progress" | "completed";
  url: string;
}

export interface VideoToken {
  token: string;
  identity: string;
  roomName: string;
}

interface TwilioRoomResponse {
  sid: string;
  unique_name: string;
  status: string;
  url: string;
}

/**
 * Create or fetch an existing video room for a telemedicine session.
 * Uses `go` type for 1-on-1 consultations (up to 2 participants, lower latency).
 */
export async function createVideoRoom(
  sessionId: string,
  roomType: VideoRoomType = "go",
): Promise<VideoRoom> {
  const accountSid = getTwilioAccountSid();
  const apiKey = getTwilioApiKey();
  const apiSecret = getTwilioApiSecret();

  if (!accountSid || !apiKey || !apiSecret) {
    throw new Error(
      "Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET)",
    );
  }

  const roomName = `oltigo-session-${sessionId}`;
  const credentials = btoa(`${apiKey}:${apiSecret}`);

  const response = await safeFetch(`https://video.twilio.com/v1/Rooms`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      UniqueName: roomName,
      Type: roomType,
      StatusCallbackMethod: "POST",
      RecordParticipantsOnConnect: "false",
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Room may already exist — try to fetch it
    if (response.status === 409) {
      return fetchExistingRoom(roomName, accountSid, apiKey, apiSecret);
    }
    logger.error("Failed to create Twilio video room", {
      context: "video-client",
      error: errorText,
    });
    throw new Error(`Twilio room creation failed: ${errorText}`);
  }

  const room = (await response.json()) as TwilioRoomResponse;

  return {
    sid: room.sid,
    uniqueName: room.unique_name,
    status: room.status as "in-progress" | "completed",
    url: room.url,
  };
}

async function fetchExistingRoom(
  roomName: string,
  accountSid: string,
  apiKey: string,
  apiSecret: string,
): Promise<VideoRoom> {
  const credentials = btoa(`${apiKey}:${apiSecret}`);

  const response = await safeFetch(
    `https://video.twilio.com/v1/Rooms/${encodeURIComponent(roomName)}`,
    {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Twilio room: ${response.statusText}`);
  }

  const room = (await response.json()) as TwilioRoomResponse;
  return {
    sid: room.sid,
    uniqueName: room.unique_name,
    status: room.status as "in-progress" | "completed",
    url: room.url,
  };
}

/**
 * Generate a short-lived JWT access token for a participant to join a room.
 *
 * The token is signed using the Twilio API Key + Secret via HS256.
 * Standard JWT structure with Twilio-specific grants.
 */
export async function generateVideoToken(params: {
  identity: string;
  roomName: string;
  ttlSeconds?: number;
}): Promise<string> {
  const apiKey = getTwilioApiKey();
  const apiSecret = getTwilioApiSecret();
  const accountSid = getTwilioAccountSid();

  if (!apiKey || !apiSecret || !accountSid) {
    throw new Error("Twilio credentials not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = params.ttlSeconds ?? 3600; // 1 hour default

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    jti: `${apiKey}-${now}`,
    iss: apiKey,
    sub: accountSid,
    exp: now + ttl,
    grants: {
      identity: params.identity,
      video: {
        room: params.roomName,
      },
    },
  };

  const encoder = new TextEncoder();
  const toBase64Url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const headerB64 = toBase64Url(header);
  const payloadB64 = toBase64Url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${signatureB64}`;
}
