import "server-only";

import type { RevisionReplayLedger } from "./revision-replay-do";
import type {
  RevisionReplayClaimInput,
  RevisionReplayCompleteInput,
  RevisionReplayCoordinator,
  RevisionReplayFailInput,
  RevisionReplayTransitionInput,
} from "./revision-replay-contract";
import { RevisionReplayClaimResultSchema } from "./revision-replay-contract";
import { RevisionReplayError } from "./revision-replay";
import { createEphemeralRevisionReplayCoordinator } from "./revision-replay-memory";

let developmentCoordinator: RevisionReplayCoordinator | undefined;

function stubFor(
  namespace: DurableObjectNamespace<RevisionReplayLedger>,
  replayKey: string,
) {
  return namespace.getByName(`revision-replay-v1:${replayKey}`);
}

export async function resolveRevisionReplayCoordinator(): Promise<RevisionReplayCoordinator> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const namespace = env.REVISION_REPLAY_LEDGER;
    if (namespace === undefined) {
      throw new Error("Missing REVISION_REPLAY_LEDGER binding");
    }

    return {
      async claim(input: RevisionReplayClaimInput) {
        return RevisionReplayClaimResultSchema.parse(
          await stubFor(namespace, input.replayKey).claim(input),
        );
      },
      async commit(input: RevisionReplayTransitionInput) {
        await stubFor(namespace, input.replayKey).commit(input);
      },
      async release(input: RevisionReplayTransitionInput) {
        await stubFor(namespace, input.replayKey).release(input);
      },
      async complete(input: RevisionReplayCompleteInput) {
        await stubFor(namespace, input.replayKey).complete(input);
      },
      async fail(input: RevisionReplayFailInput) {
        await stubFor(namespace, input.replayKey).fail(input);
      },
    };
  } catch {
    const durableReplayRequired =
      process.env.NODE_ENV === "production" ||
      process.env.MODELDUEL_REVISION_REPLAY === "durable-object";
    if (!durableReplayRequired) {
      developmentCoordinator ??= createEphemeralRevisionReplayCoordinator();
      return developmentCoordinator;
    }
    throw new RevisionReplayError("SERVER_CONFIGURATION");
  }
}
