import { AnalyzeRequestSchema, MAX_ANALYZE_JSON_BYTES } from "../../../lib/modelduel/input";
import { analyzeSubmission } from "../../../server/modelduel/openai/analysis";
import type { ModelDuelGateway } from "../../../server/modelduel/openai/gateway";
import { enforceRateLimit } from "../../../server/modelduel/rate-limit";
import type { RateLimitStore } from "../../../server/modelduel/rate-limit";
import {
  jsonResponse,
  readStrictJson,
  safeErrorResponse,
} from "../../../server/modelduel/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function handleAnalyzeRequest(
  request: Request,
  dependencies: Readonly<{
    gateway?: ModelDuelGateway;
    now?: number;
    rateLimitStore?: RateLimitStore;
  }> = {},
): Promise<Response> {
  try {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(50_000),
    ]);
    const input = await readStrictJson(request, AnalyzeRequestSchema, {
      maxBytes: MAX_ANALYZE_JSON_BYTES,
      signal,
    });
    return jsonResponse(
      await analyzeSubmission(input, {
        signal,
        gateway: dependencies.gateway,
        now: dependencies.now,
        beforeModelCall: () =>
          enforceRateLimit("analysis", request, {
            now: dependencies.now,
            store: dependencies.rateLimitStore,
          }),
      }),
    );
  } catch (error) {
    return safeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleAnalyzeRequest(request);
}
