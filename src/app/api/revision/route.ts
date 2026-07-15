import {
  evaluateRevisionRequest,
  RevisionEvaluationRequestSchema,
} from "../../../server/modelduel/revision";
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

export async function handleRevisionRequest(
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
    const input = await readStrictJson(
      request,
      RevisionEvaluationRequestSchema,
      { signal },
    );
    return jsonResponse(
      await evaluateRevisionRequest(input, dependencies.now ?? Date.now(), {
        signal,
        gateway: dependencies.gateway,
        beforeLiveGateway: () =>
          enforceRateLimit("live-revision", request, {
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
  return handleRevisionRequest(request);
}
