import { randomUUID } from "node:crypto";

import type {
  RevisionReplayClaimInput,
  RevisionReplayCompleteInput,
  RevisionReplayCoordinator,
  RevisionReplayFailInput,
  RevisionReplayTransitionInput,
} from "./revision-replay-contract";
import {
  RevisionReplayClaimInputSchema,
  RevisionReplayClaimResultSchema,
  RevisionReplayCompleteInputSchema,
  RevisionReplayFailInputSchema,
  RevisionReplayResultSchema,
  RevisionReplayTransitionInputSchema,
} from "./revision-replay-contract";
import { RevisionReplayError } from "./revision-replay";

const MEMORY_CLEANUP_GRACE_MS = 60_000;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

type MemoryEntry =
  | Readonly<{
      status: "claimed";
      fingerprint: string;
      claimId: string;
      expiresAt: number;
    }>
  | Readonly<{
      status: "committed";
      fingerprint: string;
      claimId: string;
      expiresAt: number;
    }>
  | Readonly<{
      status: "completed";
      fingerprint: string;
      result: unknown;
      expiresAt: number;
    }>
  | Readonly<{
      status: "failed";
      fingerprint: string;
      errorCode: string;
      expiresAt: number;
    }>;

export function createEphemeralRevisionReplayCoordinator(): RevisionReplayCoordinator {
  const entries = new Map<string, MemoryEntry>();
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleCleanup(): void {
    if (cleanupTimer !== undefined) clearTimeout(cleanupTimer);
    const nextExpiry = Math.min(
      ...Array.from(
        entries.values(),
        (entry) => entry.expiresAt + MEMORY_CLEANUP_GRACE_MS,
      ),
    );
    if (!Number.isFinite(nextExpiry)) {
      cleanupTimer = undefined;
      return;
    }
    const delay = Math.min(
      MAX_TIMER_DELAY_MS,
      Math.max(0, nextExpiry - Date.now()),
    );
    cleanupTimer = setTimeout(() => {
      cleanupTimer = undefined;
      const now = Date.now();
      for (const [replayKey, entry] of entries) {
        if (now >= entry.expiresAt + MEMORY_CLEANUP_GRACE_MS) {
          entries.delete(replayKey);
        }
      }
      scheduleCleanup();
    }, delay);
    cleanupTimer.unref?.();
  }

  return {
    async claim(rawInput: RevisionReplayClaimInput) {
      const input = RevisionReplayClaimInputSchema.parse(rawInput);
      if (input.now > input.expiresAt) return { status: "expired" };
      const existing = entries.get(input.replayKey);
      if (existing !== undefined && input.now > existing.expiresAt) {
        entries.delete(input.replayKey);
      }
      const current = entries.get(input.replayKey);
      if (current === undefined) {
        const claimId = randomUUID();
        entries.set(input.replayKey, {
          status: "claimed",
          fingerprint: input.fingerprint,
          claimId,
          expiresAt: input.expiresAt,
        });
        scheduleCleanup();
        return RevisionReplayClaimResultSchema.parse({
          status: "claimed",
          claimId,
        });
      }
      if (current.fingerprint !== input.fingerprint) {
        return { status: "conflict" };
      }
      if (current.status === "claimed" || current.status === "committed") {
        return { status: "in-progress" };
      }
      if (current.status === "failed") {
        return { status: "failed", errorCode: current.errorCode };
      }
      return {
        status: "cached",
        result: RevisionReplayResultSchema.parse(current.result),
      };
    },

    async commit(rawInput: RevisionReplayTransitionInput) {
      const input = RevisionReplayTransitionInputSchema.parse(rawInput);
      const current = entries.get(input.replayKey);
      if (
        current?.status !== "claimed" ||
        current.fingerprint !== input.fingerprint ||
        current.claimId !== input.claimId
      ) {
        throw new RevisionReplayError("INVALID_TOKEN");
      }
      entries.set(input.replayKey, { ...current, status: "committed" });
    },

    async release(rawInput: RevisionReplayTransitionInput) {
      const input = RevisionReplayTransitionInputSchema.parse(rawInput);
      const current = entries.get(input.replayKey);
      if (
        current?.status !== "claimed" ||
        current.fingerprint !== input.fingerprint ||
        current.claimId !== input.claimId
      ) {
        throw new RevisionReplayError("INVALID_TOKEN");
      }
      entries.delete(input.replayKey);
      scheduleCleanup();
    },

    async complete(rawInput: RevisionReplayCompleteInput) {
      const input = RevisionReplayCompleteInputSchema.parse(rawInput);
      const current = entries.get(input.replayKey);
      if (
        current?.status !== "committed" ||
        current.fingerprint !== input.fingerprint ||
        current.claimId !== input.claimId
      ) {
        throw new RevisionReplayError("INVALID_TOKEN");
      }
      entries.set(input.replayKey, {
        status: "completed",
        fingerprint: input.fingerprint,
        result: RevisionReplayResultSchema.parse(input.result),
        expiresAt: current.expiresAt,
      });
    },

    async fail(rawInput: RevisionReplayFailInput) {
      const input = RevisionReplayFailInputSchema.parse(rawInput);
      const current = entries.get(input.replayKey);
      if (
        current?.status !== "committed" ||
        current.fingerprint !== input.fingerprint ||
        current.claimId !== input.claimId
      ) {
        throw new RevisionReplayError("INVALID_TOKEN");
      }
      entries.set(input.replayKey, {
        status: "failed",
        fingerprint: input.fingerprint,
        errorCode: input.errorCode,
        expiresAt: current.expiresAt,
      });
    },
  };
}
