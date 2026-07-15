import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { HttpInputError, readStrictJson } from "./http";

const Schema = z.strictObject({ value: z.string() });

function request(body: string, contentLength?: number): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (contentLength !== undefined) {
    headers["Content-Length"] = String(contentLength);
  }
  return new Request("http://localhost/test", {
    method: "POST",
    headers,
    body,
  });
}

async function expectPayloadTooLarge(operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpInputError);
    if (!(error instanceof HttpInputError)) {
      throw error;
    }
    expect(error.code).toBe("PAYLOAD_TOO_LARGE");
    return;
  }
  throw new Error("Expected PAYLOAD_TOO_LARGE");
}

describe("readStrictJson streaming byte limit", () => {
  it("accepts the exact UTF-8 byte boundary", async () => {
    const body = JSON.stringify({ value: "月" });
    const maxBytes = Buffer.byteLength(body, "utf8");
    await expect(readStrictJson(request(body), Schema, { maxBytes })).resolves.toEqual({
      value: "月",
    });
  });

  it("rejects an oversized body without Content-Length", async () => {
    const body = JSON.stringify({ value: "x".repeat(128) });
    await expectPayloadTooLarge(() =>
      readStrictJson(request(body), Schema, { maxBytes: 32 }),
    );
  });

  it("rejects a body that exceeds a lying small Content-Length", async () => {
    const body = JSON.stringify({ value: "x".repeat(128) });
    await expectPayloadTooLarge(() =>
      readStrictJson(request(body, 1), Schema, { maxBytes: 32 }),
    );
  });

  it("rejects a declared oversized body before reading", async () => {
    await expectPayloadTooLarge(() =>
      readStrictJson(request("{}", 33), Schema, { maxBytes: 32 }),
    );
  });

  it("cancels body reading when the route-wide signal aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      readStrictJson(request(JSON.stringify({ value: "x" })), Schema, {
        maxBytes: 32,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" });
  });
});
