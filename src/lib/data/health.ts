import { GET, type HealthResponse } from "@/app/api/health/route";

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await GET();
  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error ?? "Health check failed");
  }
  return json.data as HealthResponse;
}
