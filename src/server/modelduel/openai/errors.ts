export type ModelDuelUpstreamErrorCode =
  | "MODEL_REFUSAL"
  | "RATE_LIMITED"
  | "UNSUPPORTED_MISCONCEPTION"
  | "MODEL_OUTPUT_INVALID"
  | "UPSTREAM_INCOMPLETE"
  | "ORCHESTRATION_INVALID"
  | "UPSTREAM_UNAVAILABLE"
  | "CONFIGURATION_REQUIRED"
  | "UPSTREAM_AUTHENTICATION"
  | "MODEL_ACCESS_REQUIRED"
  | "UPSTREAM_TIMEOUT";

export class ModelDuelUpstreamError extends Error {
  readonly code: ModelDuelUpstreamErrorCode;

  constructor(code: ModelDuelUpstreamErrorCode) {
    super(code);
    this.name = "ModelDuelUpstreamError";
    this.code = code;
  }
}

export function upstreamError(code: ModelDuelUpstreamErrorCode): never {
  throw new ModelDuelUpstreamError(code);
}
