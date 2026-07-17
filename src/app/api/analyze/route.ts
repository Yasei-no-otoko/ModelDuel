import { AnalyzeRequestSchema, MAX_ANALYZE_JSON_BYTES } from "../../../lib/modelduel/input";
import { analyzeSubmission } from "../../../server/modelduel/openai/analysis";
import type { ModelDuelGateway } from "../../../server/modelduel/openai/gateway";
import { enforcePaidApiRateLimit } from "../../../server/modelduel/rate-limit";
import type {
  CloudflareRateLimitBindings,
  RateLimitStore,
} from "../../../server/modelduel/rate-limit";
import {
  jsonResponse,
  readStrictJson,
  safeErrorResponse,
} from "../../../server/modelduel/http";
import {
  attachSafetyIdentifierCookie,
  resolveSafetyIdentifier,
} from "../../../server/modelduel/safety-identifier";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function handleAnalyzeRequest(
  request: Request,
  dependencies: Readonly<{
    gateway?: ModelDuelGateway;
    now?: number;
    rateLimitStore?: RateLimitStore;
    cloudflareRateLimitBindings?: CloudflareRateLimitBindings;
  }> = {},
): Promise<Response> {
  const safety = resolveSafetyIdentifier(request.headers.get("cookie"));

  try {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(50_000),
    ]);
    const input = await readStrictJson(request, AnalyzeRequestSchema, {
      maxBytes: MAX_ANALYZE_JSON_BYTES,
      signal,
    });
    const response = jsonResponse(
      await analyzeSubmission(input, {
        signal,
        safetyIdentifier: safety.safetyIdentifier,
        gateway: dependencies.gateway,
        now: dependencies.now,
        beforeModelCall: () =>
          enforcePaidApiRateLimit("analysis", request, {
            now: dependencies.now,
            store: dependencies.rateLimitStore,
            cloudflareBindings: dependencies.cloudflareRateLimitBindings,
          }),
      }),
    );
    return attachSafetyIdentifierCookie(response, safety);
  } catch (error) {
    return attachSafetyIdentifierCookie(safeErrorResponse(error), safety);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleAnalyzeRequest(request);
}
