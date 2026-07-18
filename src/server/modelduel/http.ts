import "server-only";

import { Buffer } from "node:buffer";

import { z } from "zod";

const DEFAULT_MAX_JSON_BODY_BYTES = 32 * 1_024;

type SafeErrorCode =
  | "INVALID_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INVALID_EVALUATION"
  | "MODEL_REFUSAL"
  | "REVISION_IN_PROGRESS"
  | "RATE_LIMITED"
  | "MODEL_OUTPUT_INVALID"
  | "UPSTREAM_INCOMPLETE"
  | "ORCHESTRATION_INVALID"
  | "UPSTREAM_UNAVAILABLE"
  | "SERVER_CONFIGURATION"
  | "CONFIGURATION_REQUIRED"
  | "UPSTREAM_AUTHENTICATION"
  | "MODEL_ACCESS_REQUIRED"
  | "REQUEST_TIMEOUT"
  | "UPSTREAM_TIMEOUT"
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
  PAYLOAD_TOO_LARGE: {
    status: 413,
    message: "The request payload is too large.",
    retryable: false,
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: 415,
    message: "The request media type is not supported.",
    retryable: false,
  },
  INVALID_EVALUATION: {
    status: 400,
    message: "The evaluation could not be verified.",
    retryable: false,
  },
  MODEL_REFUSAL: {
    status: 422,
    message: "The model declined to process this request.",
    retryable: false,
  },
  REVISION_IN_PROGRESS: {
    status: 409,
    message: "Revision feedback is still being generated.",
    retryable: true,
  },
  RATE_LIMITED: {
    status: 429,
    message: "The model service is temporarily rate limited.",
    retryable: true,
  },
  MODEL_OUTPUT_INVALID: {
    status: 502,
    message: "The model returned an invalid result.",
    retryable: true,
  },
  UPSTREAM_INCOMPLETE: {
    status: 502,
    message: "The model did not complete the request.",
    retryable: true,
  },
  ORCHESTRATION_INVALID: {
    status: 502,
    message: "The model orchestration could not be verified.",
    retryable: true,
  },
  UPSTREAM_UNAVAILABLE: {
    status: 502,
    message: "The model service is unavailable.",
    retryable: true,
  },
  SERVER_CONFIGURATION: {
    status: 503,
    message: "The evaluation service is unavailable.",
    retryable: true,
  },
  CONFIGURATION_REQUIRED: {
    status: 503,
    message: "Server configuration is required.",
    retryable: false,
  },
  UPSTREAM_AUTHENTICATION: {
    status: 503,
    message: "The model service could not be authenticated.",
    retryable: false,
  },
  MODEL_ACCESS_REQUIRED: {
    status: 503,
    message: "The configured model is not available.",
    retryable: false,
  },
  REQUEST_TIMEOUT: {
    status: 408,
    message: "The request body timed out.",
    retryable: true,
  },
  UPSTREAM_TIMEOUT: {
    status: 504,
    message: "The model service timed out.",
    retryable: true,
  },
  INTERNAL_ERROR: {
    status: 500,
    message: "The request could not be completed.",
    retryable: true,
  },
};

export class HttpInputError extends Error {
  readonly code:
    | "INVALID_REQUEST"
    | "PAYLOAD_TOO_LARGE"
    | "UNSUPPORTED_MEDIA_TYPE"
    | "REQUEST_TIMEOUT";

  constructor(
    code:
      | "INVALID_REQUEST"
      | "PAYLOAD_TOO_LARGE"
      | "UNSUPPORTED_MEDIA_TYPE"
      | "REQUEST_TIMEOUT" = "INVALID_REQUEST",
  ) {
    super(code);
    this.name = "HttpInputError";
    this.code = code;
  }
}

function responseHeaders(): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  };
}

async function readBodyWithLimit(
  request: Request,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<string> {
  if (!request.body) {
    throw new HttpInputError();
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteLength = 0;
  let body = "";
  let aborted = signal?.aborted ?? false;
  const abortReader = () => {
    aborted = true;
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener("abort", abortReader, { once: true });
  try {
    while (true) {
      if (aborted) {
        throw new HttpInputError("REQUEST_TIMEOUT");
      }
      const chunk = await reader.read();
      if (chunk.done) {
        if (aborted) {
          throw new HttpInputError("REQUEST_TIMEOUT");
        }
        body += decoder.decode();
        return body;
      }
      byteLength += chunk.value.byteLength;
      if (byteLength > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The safe payload error wins even if cancellation itself fails.
        }
        throw new HttpInputError("PAYLOAD_TOO_LARGE");
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
  } catch (error) {
    if (error instanceof HttpInputError) {
      throw error;
    }
    throw new HttpInputError();
  } finally {
    signal?.removeEventListener("abort", abortReader);
    reader.releaseLock();
  }
}

export async function readStrictJson<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
  options: Readonly<{ maxBytes?: number; signal?: AbortSignal }> = {},
): Promise<z.output<TSchema>> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BODY_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new HttpInputError();
  }
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const mediaType = contentType.split(";", 1)[0]?.trim();
  if (mediaType !== "application/json") {
    throw new HttpInputError("UNSUPPORTED_MEDIA_TYPE");
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    if (!/^\d+$/.test(contentLengthHeader)) {
      throw new HttpInputError();
    }
    const declaredLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(declaredLength)) {
      throw new HttpInputError();
    }
    if (declaredLength > maxBytes) {
      throw new HttpInputError("PAYLOAD_TOO_LARGE");
    }
  }

  let body: string;
  try {
    body = await readBodyWithLimit(request, maxBytes, options.signal);
  } catch (error) {
    if (error instanceof HttpInputError) {
      throw error;
    }
    throw new HttpInputError();
  }
  if (!body) {
    throw new HttpInputError();
  }
  if (Buffer.byteLength(body, "utf8") > maxBytes) {
    throw new HttpInputError("PAYLOAD_TOO_LARGE");
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

function isSafeErrorCode(value: unknown): value is SafeErrorCode {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(SAFE_ERRORS, value)
  );
}

export function safeErrorResponse(error: unknown): Response {
  let code: SafeErrorCode = "INTERNAL_ERROR";
  if (error instanceof HttpInputError) {
    code = error.code;
  } else if (hasErrorCode(error)) {
    if (error.code === "INVALID_REQUEST") {
      code = "INVALID_REQUEST";
    } else if (error.code === "INVALID_TOKEN") {
      code = "INVALID_EVALUATION";
    } else if (isSafeErrorCode(error.code)) {
      code = error.code;
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
