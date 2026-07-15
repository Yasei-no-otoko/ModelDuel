import "server-only";

import { Buffer } from "node:buffer";

import { z } from "zod";

const MAX_JSON_BODY_BYTES = 32 * 1_024;

type SafeErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_EVALUATION"
  | "SERVER_CONFIGURATION"
  | "INTERNAL_ERROR";

const SAFE_ERRORS: Record<
  SafeErrorCode,
  Readonly<{ status: number; message: string; retryable: boolean }>
> = {
  INVALID_REQUEST: {
    status: 400,
    message: "The request is invalid.",
    retryable: false,
  },
  INVALID_EVALUATION: {
    status: 400,
    message: "The evaluation could not be verified.",
    retryable: false,
  },
  SERVER_CONFIGURATION: {
    status: 503,
    message: "The evaluation service is unavailable.",
    retryable: true,
  },
  INTERNAL_ERROR: {
    status: 500,
    message: "The request could not be completed.",
    retryable: true,
  },
};

export class HttpInputError extends Error {
  constructor() {
    super("INVALID_REQUEST");
    this.name = "HttpInputError";
  }
}

function responseHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  };
}

export async function readStrictJson<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
): Promise<z.output<TSchema>> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const mediaType = contentType.split(";", 1)[0]?.trim();
  if (mediaType !== "application/json") {
    throw new HttpInputError();
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    if (!/^\d+$/.test(contentLengthHeader)) {
      throw new HttpInputError();
    }
    const declaredLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(declaredLength) || declaredLength > MAX_JSON_BODY_BYTES) {
      throw new HttpInputError();
    }
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    throw new HttpInputError();
  }
  if (!body || Buffer.byteLength(body, "utf8") > MAX_JSON_BODY_BYTES) {
    throw new HttpInputError();
  }

  let json: unknown;
  try {
    json = JSON.parse(body) as unknown;
  } catch {
    throw new HttpInputError();
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new HttpInputError();
  }
  return parsed.data;
}

export function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: responseHeaders(),
  });
}

function hasErrorCode(error: unknown): error is { code: unknown } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  );
}

export function safeErrorResponse(error: unknown): Response {
  let code: SafeErrorCode = "INTERNAL_ERROR";
  if (error instanceof HttpInputError) {
    code = "INVALID_REQUEST";
  } else if (hasErrorCode(error)) {
    if (error.code === "INVALID_REQUEST") {
      code = "INVALID_REQUEST";
    } else if (error.code === "INVALID_TOKEN") {
      code = "INVALID_EVALUATION";
    } else if (error.code === "SERVER_CONFIGURATION") {
      code = "SERVER_CONFIGURATION";
    }
  }

  const safe = SAFE_ERRORS[code];
  return jsonResponse(
    {
      error: {
        code,
        message: safe.message,
        retryable: safe.retryable,
      },
    },
    safe.status,
  );
}
