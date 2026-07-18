import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveRevisionReplayCoordinator } from "./revision-replay-cloudflare";

describe("revision replay coordinator resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when production requires an unavailable Durable Object", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MODELDUEL_REVISION_REPLAY", "durable-object");

    await expect(resolveRevisionReplayCoordinator()).rejects.toMatchObject({
      code: "SERVER_CONFIGURATION",
    });
  });

  it("uses an ephemeral coordinator only outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MODELDUEL_REVISION_REPLAY", "");
    const coordinator = await resolveRevisionReplayCoordinator();

    await expect(
      coordinator.claim({
        replayKey: "a".repeat(64),
        fingerprint: "b".repeat(64),
        now: 1,
        expiresAt: 2,
      }),
    ).resolves.toMatchObject({ status: "claimed" });
  });
});
