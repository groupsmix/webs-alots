/**
 * Lightweight fetch wrapper for client-side API calls.
 *
 * Centralises base-URL resolution, JSON parsing, and error handling so
 * individual data-fetching modules don't repeat boilerplate.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface FetchOptions extends Omit<RequestInit, "method"> {
  /** Extra query-string parameters appended to the URL. */
  params?: Record<string, string>;
}

async function request<T>(
  method: string,
  path: string,
  options: FetchOptions & { body?: unknown } = {},
): Promise<T> {
  const { params, body, headers: extraHeaders, ...rest } = options;

  const url = new URL(path, globalThis.location?.origin ?? "http://localhost:3000");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
  };

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    ...rest,
  });

  const json = (await res.json()) as { ok: boolean; data?: T; error?: string; code?: string };

  if (!res.ok || !json.ok) {
    throw new ApiError(
      json.error ?? `Request failed with status ${res.status}`,
      res.status,
      json.code,
    );
  }

  return json.data as T;
}

export function get<T>(path: string, options?: FetchOptions): Promise<T> {
  return request<T>("GET", path, options);
}

export function post<T>(path: string, body: unknown, options?: FetchOptions): Promise<T> {
  return request<T>("POST", path, { ...options, body });
}

export function put<T>(path: string, body: unknown, options?: FetchOptions): Promise<T> {
  return request<T>("PUT", path, { ...options, body });
}

export function patch<T>(path: string, body: unknown, options?: FetchOptions): Promise<T> {
  return request<T>("PATCH", path, { ...options, body });
}

export function del<T>(path: string, options?: FetchOptions): Promise<T> {
  return request<T>("DELETE", path, options);
}
