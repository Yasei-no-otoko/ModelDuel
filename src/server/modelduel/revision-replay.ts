import "server-only";

import { createHmac } from "node:crypto";

import type { RevisionReplayClaimResult } from "./revision-replay-contract";

export class RevisionReplayError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "RevisionReplayError";
    this.code = code;
  }
}

export function createRevisionRequestFingerprint(input: Readonly<{
  replayKey: string;
  sessionId: string;
  revisionText: string;
}>): string {
  return createHmac("sha256", Buffer.from(input.replayKey, "hex"))
    .update(
      JSON.stringify({
        version: 1,
        sessionId: input.sessionId,
        revisionText: input.revisionText,
      }),
      "utf8",
    )
    .digest("hex");
}

export function replayClaimError(
  claim: Exclude<RevisionReplayClaimResult, { status: "claimed" | "cached" }>,
): RevisionReplayError {
  if (claim.status === "in-progress") {
    return new RevisionReplayError("REVISION_IN_PROGRESS");
  }
  if (claim.status === "failed") {
    return new RevisionReplayError(claim.errorCode);
  }
  return new RevisionReplayError("INVALID_TOKEN");
}
