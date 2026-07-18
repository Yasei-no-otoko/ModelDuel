/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { env } from "cloudflare:workers";
import {
  runDurableObjectAlarm,
  runInDurableObject,
} from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";

import {
  deleteExpiredReplayState,
  scheduleInitialReplayCleanup,
} from "./revision-replay-do";

const NOW = 1_800_000_000_000;
const EXPIRES_AT = NOW + 20 * 60 * 1_000 + 60 * 1_000;
const CLEANUP_AT = EXPIRES_AT + 60 * 1_000;
const REPLAY_KEY = "a".repeat(64);
const FINGERPRINT = "b".repeat(64);
const OTHER_FINGERPRINT = "c".repeat(64);
const RESULT = {
  modelId: "gpt-5.6-luna" as const,
  feedback: {
    conceptualChange: "revised" as const,
    score: 1,
    summary: "The explanation now uses illumination and viewing geometry.",
    strengths: ["Connects the evidence to a causal model."],
    nextStep: "Apply the model to first quarter.",
  },
};

function stub(suffix: string) {
  return env.REVISION_REPLAY_LEDGER.getByName(
    `worker-replay-test:${suffix}`,
  );
}

function claimInput(replayKey = REPLAY_KEY) {
  return {
    replayKey,
    fingerprint: FINGERPRINT,
    now: NOW,
    expiresAt: EXPIRES_AT,
  };
}

describe("RevisionReplayLedger Durable Object", () => {
  it("atomically grants one leader under concurrent claims", async () => {
    const ledger = stub("concurrent");
    const claims = await Promise.all(
      Array.from({ length: 16 }, () => ledger.claim(claimInput())),
    );

    expect(claims.filter((claim) => claim.status === "claimed")).toHaveLength(1);
    expect(
      claims.filter((claim) => claim.status === "in-progress"),
    ).toHaveLength(15);
  });

  it("returns only the normalized cache and rejects changed fingerprints", async () => {
    const ledger = stub("cache");
    const claim = await ledger.claim(claimInput());
    expect(claim.status).toBe("claimed");
    if (claim.status !== "claimed") throw new Error("Expected claim leader");
    const transition = {
      replayKey: REPLAY_KEY,
      fingerprint: FINGERPRINT,
      claimId: claim.claimId,
    };

    await ledger.commit(transition);
    await ledger.complete({ ...transition, result: RESULT });

    await expect(ledger.claim(claimInput())).resolves.toEqual({
      status: "cached",
      result: RESULT,
    });
    await expect(
      ledger.claim({ ...claimInput(), fingerprint: OTHER_FINGERPRINT }),
    ).resolves.toEqual({ status: "conflict" });

    const rows = await runInDurableObject(
      ledger,
      (_instance, state) =>
        state.storage.sql
          .exec<{
            status: string;
            fingerprint: string;
            result_json: string;
          }>(
            "SELECT status, fingerprint, result_json FROM revision_replay",
          )
          .toArray(),
    );
    expect(rows).toEqual([
      {
        status: "completed",
        fingerprint: FINGERPRINT,
        result_json: JSON.stringify(RESULT),
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain("Sunlight lights half the Moon");
  });

  it("releases only pre-commit leaders and terminally caches post-commit failures", async () => {
    const released = stub("release");
    const first = await released.claim(claimInput());
    if (first.status !== "claimed") throw new Error("Expected first claim");
    const firstTransition = {
      replayKey: REPLAY_KEY,
      fingerprint: FINGERPRINT,
      claimId: first.claimId,
    };
    await released.release(firstTransition);
    const retry = await released.claim(claimInput());
    expect(retry.status).toBe("claimed");

    const failed = stub("failed");
    const failureClaim = await failed.claim(claimInput());
    if (failureClaim.status !== "claimed") throw new Error("Expected claim");
    const failureTransition = {
      replayKey: REPLAY_KEY,
      fingerprint: FINGERPRINT,
      claimId: failureClaim.claimId,
    };
    await failed.commit(failureTransition);
    await failed.fail({
      ...failureTransition,
      errorCode: "UPSTREAM_TIMEOUT",
    });
    await expect(failed.claim(claimInput())).resolves.toEqual({
      status: "failed",
      errorCode: "UPSTREAM_TIMEOUT",
    });
  });

  it("schedules cleanup after the full authorization window and deletes storage", async () => {
    const ledger = stub("alarm");
    await ledger.claim(claimInput());
    const alarm = await runInDurableObject(
      ledger,
      (_instance, state) => state.storage.getAlarm(),
    );
    expect(alarm).toBe(CLEANUP_AT);

    await expect(runDurableObjectAlarm(ledger)).resolves.toBe(true);
    const tables = await runInDurableObject(
      ledger,
      (_instance, state) =>
        state.storage.sql
          .exec<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'revision_replay'",
          )
          .toArray(),
    );
    expect(tables).toEqual([]);
  });

  it("rejects claims after the trusted replay expiry", async () => {
    const ledger = stub("expired");
    await expect(
      ledger.claim({ ...claimInput(), now: EXPIRES_AT + 1 }),
    ).resolves.toEqual({ status: "expired" });
  });

  it("re-arms privacy cleanup after every deletion failure", async () => {
    const deleteAll = vi.fn().mockRejectedValue(new Error("storage outage"));
    const setAlarm = vi.fn().mockResolvedValue(undefined);

    await deleteExpiredReplayState({ deleteAll, setAlarm }, () => NOW);
    await deleteExpiredReplayState({ deleteAll, setAlarm }, () => NOW + 1_000);

    expect(deleteAll).toHaveBeenCalledTimes(2);
    expect(setAlarm).toHaveBeenNthCalledWith(1, NOW + 60_000);
    expect(setAlarm).toHaveBeenNthCalledWith(2, NOW + 61_000);
  });

  it("rolls back a pre-commit claim when its first cleanup alarm cannot be armed", async () => {
    const setAlarm = vi.fn().mockRejectedValue(new Error("alarm outage"));
    const rollbackClaim = vi.fn();

    await expect(
      scheduleInitialReplayCleanup(
        { setAlarm },
        CLEANUP_AT,
        rollbackClaim,
      ),
    ).rejects.toThrow("alarm outage");

    expect(setAlarm).toHaveBeenCalledWith(CLEANUP_AT);
    expect(rollbackClaim).toHaveBeenCalledOnce();
  });
});
