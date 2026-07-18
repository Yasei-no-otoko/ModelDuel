import { afterEach, describe, expect, it, vi } from "vitest";

import { createEphemeralRevisionReplayCoordinator } from "./revision-replay-memory";

const NOW = 1_800_000_000_000;
const REPLAY_KEY = "a".repeat(64);
const FINGERPRINT = "b".repeat(64);

describe("ephemeral revision replay cleanup", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("evicts normalized feedback after expiry and cleanup grace", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const coordinator = createEphemeralRevisionReplayCoordinator();
    const claim = await coordinator.claim({
      replayKey: REPLAY_KEY,
      fingerprint: FINGERPRINT,
      now: NOW,
      expiresAt: NOW + 1_000,
    });
    if (claim.status !== "claimed") throw new Error("Expected claim leader");
    const transition = {
      replayKey: REPLAY_KEY,
      fingerprint: FINGERPRINT,
      claimId: claim.claimId,
    };
    await coordinator.commit(transition);
    await coordinator.complete({
      ...transition,
      result: {
        modelId: "gpt-5.6-luna",
        feedback: {
          conceptualChange: "revised",
          score: 1,
          summary: "Uses illumination and viewing geometry.",
          strengths: ["Connects evidence to the model."],
          nextStep: "Apply it to first quarter.",
        },
      },
    });

    await vi.advanceTimersByTimeAsync(61_000);
    await expect(
      coordinator.claim({
        replayKey: REPLAY_KEY,
        fingerprint: FINGERPRINT,
        now: NOW + 61_000,
        expiresAt: NOW + 120_000,
      }),
    ).resolves.toMatchObject({ status: "claimed" });
  });
});
