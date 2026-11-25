import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: ApiErrorPayload | null;
  meta?: PaginationMeta;
}

/** Create a consistent JSON success response envelope. */
export function apiSuccess<T>(
  data: T,
  options?: { status?: number; meta?: PaginationMeta; headers?: HeadersInit }
): NextResponse<ApiEnvelope<T>> {
  const body: ApiEnvelope<T> = {
    success: true,
    data,
    error: null,
    ...(options?.meta ? { meta: options.meta } : {}),
  };
  return NextResponse.json(body, {
    status: options?.status ?? 200,
    headers: options?.headers,
  });
}

/** Create a consistent JSON error response envelope. */
export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
  headers?: HeadersInit
): NextResponse<ApiEnvelope<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status, headers }
  );
}

/** Generate a human-readable submission tracking code like PV-A7C2F9. */
export function generateTrackingCode(): string {
  const hex = randomBytes(3).toString("hex").toUpperCase();
  return `PV-${hex}`;
}

/** Extract client IP cleanly from proxy headers with safe fallback. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}
