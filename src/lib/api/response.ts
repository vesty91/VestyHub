import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError, InternalServerError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

export function apiSuccess<T>(
  data: T,
  init?: { status?: number; meta?: Record<string, unknown> },
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    { success: true, data, ...(init?.meta ? { meta: init.meta } : {}) },
    { status: init?.status ?? 200 },
  );
}

/**
 * Converts any thrown error into a consistent `ApiErrorBody`, mapping known
 * `AppError` subclasses and Zod validation failures to the right HTTP
 * status. Never leaks a stack trace to the client, even in development.
 */
export function apiErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  const requestId = randomUUID();

  if (error instanceof ZodError) {
    logger.warn("API validation error", { requestId, issues: error.issues });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "The request payload is invalid.",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
          requestId,
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    if (error.httpStatus >= 500) {
      logger.error(error.message, { requestId, code: error.code });
    } else {
      logger.warn(error.message, { requestId, code: error.code });
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
      { status: error.httpStatus },
    );
  }

  logger.error("Unhandled API error", {
    requestId,
    message: error instanceof Error ? error.message : String(error),
  });

  const fallback = new InternalServerError();
  return NextResponse.json(
    {
      success: false,
      error: {
        code: fallback.code,
        message: fallback.message,
        requestId,
      },
    },
    { status: fallback.httpStatus },
  );
}
