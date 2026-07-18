import {
  evaluateRevisionRequest,
  RevisionEvaluationRequestSchema,
} from "../../../server/modelduel/revision";
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
import type { SafetyIdentifierResolution } from "../../../server/modelduel/safety-identifier";
import { resolveRevisionReplayCoordinator } from "../../../server/modelduel/revision-replay-cloudflare";
import type { RevisionReplayCoordinator } from "../../../server/modelduel/revision-replay-contract";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function handleRevisionRequest(
  request: Request,
  dependencies: Readonly<{
    gateway?: ModelDuelGateway;
    now?: number;
    rateLimitStore?: RateLimitStore;
    cloudflareRateLimitBindings?: CloudflareRateLimitBindings;
    replayCoordinator?: RevisionReplayCoordinator;
  }> = {},
): Promise<Response> {
  let safety: SafetyIdentifierResolution | undefined;

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
    const response = jsonResponse(
      await evaluateRevisionRequest(input, dependencies.now ?? Date.now(), {
        signal,
        resolveSafetyIdentifier: () => {
          const resolution = resolveSafetyIdentifier(
            request.headers.get("cookie"),
          );
          safety = resolution;
          return resolution.safetyIdentifier;
        },
        gateway: dependencies.gateway,
        resolveReplayCoordinator: async () =>
          dependencies.replayCoordinator ??
          resolveRevisionReplayCoordinator(),
        beforeLiveGateway: () =>
          enforcePaidApiRateLimit("live-revision", request, {
            now: dependencies.now,
            store: dependencies.rateLimitStore,
            cloudflareBindings: dependencies.cloudflareRateLimitBindings,
          }),
      }),
    );
    return safety === undefined
      ? response
      : attachSafetyIdentifierCookie(response, safety);
  } catch (error) {
    const response = safeErrorResponse(error);
    return safety === undefined
      ? response
      : attachSafetyIdentifierCookie(response, safety);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleRevisionRequest(request);
}
