import { DurableObject } from "cloudflare:workers";

import {
  RevisionReplayClaimInputSchema,
  RevisionReplayClaimResultSchema,
  RevisionReplayCompleteInputSchema,
  RevisionReplayFailInputSchema,
  RevisionReplayResultSchema,
  RevisionReplayTransitionInputSchema,
} from "./revision-replay-contract";
import type {
  RevisionReplayClaimInput,
  RevisionReplayClaimResult,
  RevisionReplayCompleteInput,
  RevisionReplayFailInput,
  RevisionReplayTransitionInput,
} from "./revision-replay-contract";

const CLEANUP_GRACE_MS = 60_000;
const CLEANUP_RETRY_MS = 60_000;

type ReplayCleanupStorage = Readonly<{
  deleteAll(): Promise<void>;
  setAlarm(scheduledTime: number): Promise<void>;
}>;

export async function scheduleInitialReplayCleanup(
  storage: Pick<ReplayCleanupStorage, "setAlarm">,
  scheduledTime: number,
  rollbackClaim: () => void,
): Promise<void> {
  try {
    await storage.setAlarm(scheduledTime);
  } catch (error) {
    // The caller must never receive a usable claim without a cleanup alarm.
    // SQL rollback is synchronous inside the same Durable Object event.
    rollbackClaim();
    throw error;
  }
}

export async function deleteExpiredReplayState(
  storage: ReplayCleanupStorage,
  now: () => number = Date.now,
): Promise<void> {
  try {
    await storage.deleteAll();
  } catch {
    // Cloudflare automatically retries a thrown alarm only six times. A fresh
    // alarm keeps privacy cleanup live through longer transient outages.
    await storage.setAlarm(now() + CLEANUP_RETRY_MS);
  }
}

type LedgerRow = {
  status: string;
  fingerprint: string;
  claim_id: string;
  result_json: string | null;
  error_code: string | null;
  expires_at: number;
};

export class RevisionReplayLedger extends DurableObject<CloudflareEnv> {
  constructor(ctx: DurableObjectState, env: CloudflareEnv) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS revision_replay (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        status TEXT NOT NULL CHECK (status IN ('claimed', 'committed', 'completed', 'failed')),
        fingerprint TEXT NOT NULL,
        claim_id TEXT NOT NULL,
        result_json TEXT,
        error_code TEXT,
        expires_at INTEGER NOT NULL
      )
    `);
  }

  async claim(
    rawInput: RevisionReplayClaimInput,
  ): Promise<RevisionReplayClaimResult> {
    const input = RevisionReplayClaimInputSchema.parse(rawInput);
    if (input.now > input.expiresAt) {
      return { status: "expired" };
    }

    let row: LedgerRow | null = this.ctx.storage.sql
      .exec<LedgerRow>(
        `SELECT status, fingerprint, claim_id, result_json, error_code, expires_at
         FROM revision_replay WHERE singleton = 1`,
      )
      .toArray()[0] ?? null;

    if (row !== null && input.now > row.expires_at) {
      this.ctx.storage.sql.exec(
        "DELETE FROM revision_replay WHERE singleton = 1",
      );
      row = null;
    }

    if (row === null) {
      const claimId = crypto.randomUUID();
      this.ctx.storage.sql.exec(
        `INSERT INTO revision_replay
          (singleton, status, fingerprint, claim_id, result_json, error_code, expires_at)
         VALUES (1, 'claimed', ?, ?, NULL, NULL, ?)`,
        input.fingerprint,
        claimId,
        input.expiresAt,
      );
      await scheduleInitialReplayCleanup(
        this.ctx.storage,
        input.expiresAt + CLEANUP_GRACE_MS,
        () => {
          this.ctx.storage.sql.exec(
            `DELETE FROM revision_replay
             WHERE singleton = 1 AND status = 'claimed'
               AND fingerprint = ? AND claim_id = ?`,
            input.fingerprint,
            claimId,
          );
        },
      );
      return RevisionReplayClaimResultSchema.parse({
        status: "claimed",
        claimId,
      });
    }

    if (
      row.fingerprint !== input.fingerprint ||
      row.expires_at !== input.expiresAt
    ) {
      return { status: "conflict" };
    }
    if (row.status === "claimed" || row.status === "committed") {
      return { status: "in-progress" };
    }
    if (row.status === "failed") {
      return RevisionReplayClaimResultSchema.parse({
        status: "failed",
        errorCode: row.error_code,
      });
    }
    if (row.status !== "completed" || row.result_json === null) {
      throw new Error("Invalid revision replay ledger state");
    }
    return RevisionReplayClaimResultSchema.parse({
      status: "cached",
      result: RevisionReplayResultSchema.parse(JSON.parse(row.result_json)),
    });
  }

  commit(rawInput: RevisionReplayTransitionInput): void {
    const input = RevisionReplayTransitionInputSchema.parse(rawInput);
    const cursor = this.ctx.storage.sql.exec(
      `UPDATE revision_replay SET status = 'committed'
       WHERE singleton = 1 AND status = 'claimed'
         AND fingerprint = ? AND claim_id = ?`,
      input.fingerprint,
      input.claimId,
    );
    if (cursor.rowsWritten !== 1) {
      throw new Error("Invalid revision replay commit");
    }
  }

  release(rawInput: RevisionReplayTransitionInput): void {
    const input = RevisionReplayTransitionInputSchema.parse(rawInput);
    const cursor = this.ctx.storage.sql.exec(
      `DELETE FROM revision_replay
       WHERE singleton = 1 AND status = 'claimed'
         AND fingerprint = ? AND claim_id = ?`,
      input.fingerprint,
      input.claimId,
    );
    if (cursor.rowsWritten !== 1) {
      throw new Error("Invalid revision replay release");
    }
  }

  complete(rawInput: RevisionReplayCompleteInput): void {
    const input = RevisionReplayCompleteInputSchema.parse(rawInput);
    const result = RevisionReplayResultSchema.parse(input.result);
    const cursor = this.ctx.storage.sql.exec(
      `UPDATE revision_replay
       SET status = 'completed', result_json = ?, error_code = NULL
       WHERE singleton = 1 AND status = 'committed'
         AND fingerprint = ? AND claim_id = ?`,
      JSON.stringify(result),
      input.fingerprint,
      input.claimId,
    );
    if (cursor.rowsWritten !== 1) {
      throw new Error("Invalid revision replay completion");
    }
  }

  fail(rawInput: RevisionReplayFailInput): void {
    const input = RevisionReplayFailInputSchema.parse(rawInput);
    const cursor = this.ctx.storage.sql.exec(
      `UPDATE revision_replay
       SET status = 'failed', result_json = NULL, error_code = ?
       WHERE singleton = 1 AND status = 'committed'
         AND fingerprint = ? AND claim_id = ?`,
      input.errorCode,
      input.fingerprint,
      input.claimId,
    );
    if (cursor.rowsWritten !== 1) {
      throw new Error("Invalid revision replay failure transition");
    }
  }

  async alarm(): Promise<void> {
    await deleteExpiredReplayState(this.ctx.storage);
  }
}
