import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createRateLimitStore,
  enforcePaidApiRateLimit,
  enforceRateLimit,
  hashedClientKey,
} from "./rate-limit";
import type { CloudflareRateLimitBindings } from "./rate-limit";

const CLOUDFLARE = { trustedProxy: "cloudflare" as const };

afterEach(() => {
  vi.unstubAllEnvs();
});

function cloudflareRequest(ip: string): Request {
  return request({ "CF-Connecting-IP": ip });
}

function request(headers: HeadersInit): Request {
  return new Request("http://localhost/api/analyze", { headers });
}

describe("best-effort server rate limiter", () => {
  it("keeps local limiting disabled unless a store is explicitly injected", () => {
    for (let index = 0; index < 500; index += 1) {
      expect(() =>
        enforceRateLimit("analysis", cloudflareRequest("192.0.2.1"), {
          now: 1_000,
          ...CLOUDFLARE,
        }),
      ).not.toThrow();
    }
  });

  it("limits analysis per trusted client and does not charge denials", () => {
    const store = createRateLimitStore();
    for (let index = 0; index < 8; index += 1) {
      expect(() =>
        enforceRateLimit("analysis", cloudflareRequest("192.0.2.1"), {
          now: 1_000,
          store,
          ...CLOUDFLARE,
        }),
      ).not.toThrow();
    }

    expect(() =>
      enforceRateLimit("analysis", cloudflareRequest("192.0.2.1"), {
        now: 1_000,
        store,
        ...CLOUDFLARE,
      }),
    ).toThrowError(expect.objectContaining({ code: "RATE_LIMITED" }));
    expect(store.globals.get("analysis")?.count).toBe(8);

    expect(() =>
      enforceRateLimit("analysis", cloudflareRequest("192.0.2.1"), {
        now: 61_000,
        store,
        ...CLOUDFLARE,
      }),
    ).not.toThrow();
  });

  it("isolates trusted clients", () => {
    const store = createRateLimitStore();
    for (let index = 0; index < 8; index += 1) {
      enforceRateLimit("analysis", cloudflareRequest("192.0.2.10"), {
        now: 1_000,
        store,
        ...CLOUDFLARE,
      });
    }
    expect(() =>
      enforceRateLimit("analysis", cloudflareRequest("192.0.2.11"), {
        now: 1_000,
        store,
        ...CLOUDFLARE,
      }),
    ).not.toThrow();
  });

  it("keeps analysis and live-revision counters separate", () => {
    const store = createRateLimitStore();
    for (let index = 0; index < 8; index += 1) {
      enforceRateLimit("analysis", cloudflareRequest("198.51.100.2"), {
        now: 1_000,
        store,
        ...CLOUDFLARE,
      });
    }
    expect(() =>
      enforceRateLimit("live-revision", cloudflareRequest("198.51.100.2"), {
        now: 1_000,
        store,
        ...CLOUDFLARE,
      }),
    ).not.toThrow();
  });

  it("bounds client storage without resetting the global counter", () => {
    const store = createRateLimitStore();
    for (let index = 0; index < 3_000; index += 1) {
      store.clients.set(`stale-${index}`, {
        windowStartedAt: 1_000,
        count: 1,
      });
    }
    store.globals.set("analysis", { windowStartedAt: 1_000, count: 50 });

    enforceRateLimit("analysis", cloudflareRequest("203.0.113.10"), {
      now: 1_000,
      store,
      ...CLOUDFLARE,
    });

    expect(store.clients.size).toBeLessThanOrEqual(2_048);
    expect(store.globals.get("analysis")?.count).toBe(51);
  });

  it("enforces the global cap across distinct trusted clients", () => {
    const store = createRateLimitStore();
    for (let index = 1; index <= 120; index += 1) {
      const third = Math.floor(index / 250);
      const fourth = (index % 250) + 1;
      enforceRateLimit(
        "analysis",
        cloudflareRequest(`198.18.${third}.${fourth}`),
        { now: 1_000, store, ...CLOUDFLARE },
      );
    }
    expect(() =>
      enforceRateLimit("analysis", cloudflareRequest("198.19.0.1"), {
        now: 1_000,
        store,
        ...CLOUDFLARE,
      }),
    ).toThrowError(expect.objectContaining({ code: "RATE_LIMITED" }));
    expect(store.globals.get("analysis")?.count).toBe(120);
  });

  it("uses only the Vercel forwarding header on Vercel", () => {
    const store = createRateLimitStore();
    for (let index = 0; index < 8; index += 1) {
      enforceRateLimit(
        "analysis",
        request({
          "CF-Connecting-IP": `198.51.100.${index + 1}`,
          "x-vercel-forwarded-for": "not-an-ip, 192.0.2.70",
        }),
        { now: 1_000, store, trustedProxy: "vercel" },
      );
    }
    expect(() =>
      enforceRateLimit(
        "analysis",
        request({
          "CF-Connecting-IP": "198.51.100.99",
          "x-vercel-forwarded-for": "192.0.2.70",
        }),
        { now: 1_000, store, trustedProxy: "vercel" },
      ),
    ).toThrowError(expect.objectContaining({ code: "RATE_LIMITED" }));
  });

  it("uses only the Cloudflare header in explicitly trusted Cloudflare mode", () => {
    const store = createRateLimitStore();
    for (let index = 0; index < 8; index += 1) {
      enforceRateLimit(
        "analysis",
        request({
          "CF-Connecting-IP": "203.0.113.80",
          "x-vercel-forwarded-for": `192.0.2.${index + 1}`,
        }),
        { now: 1_000, store, trustedProxy: "cloudflare" },
      );
    }
    expect(() =>
      enforceRateLimit(
        "analysis",
        request({
          "CF-Connecting-IP": "203.0.113.80",
          "x-vercel-forwarded-for": "192.0.2.99",
        }),
        { now: 1_000, store, trustedProxy: "cloudflare" },
      ),
    ).toThrowError(expect.objectContaining({ code: "RATE_LIMITED" }));
  });

  it("ignores all forwarding headers when no proxy is trusted", () => {
    const store = createRateLimitStore();
    for (let index = 0; index < 8; index += 1) {
      enforceRateLimit(
        "analysis",
        request({
          "CF-Connecting-IP": `203.0.113.${index + 1}`,
          "x-vercel-forwarded-for": `192.0.2.${index + 1}`,
        }),
        { now: 1_000, store, trustedProxy: "none" },
      );
    }
    expect(() =>
      enforceRateLimit(
        "analysis",
        request({
          "CF-Connecting-IP": "203.0.113.99",
          "x-vercel-forwarded-for": "192.0.2.99",
        }),
        { now: 1_000, store, trustedProxy: "none" },
      ),
    ).toThrowError(expect.objectContaining({ code: "RATE_LIMITED" }));
  });
});

function cloudflareBindings(
  events: string[],
  results: Partial<Record<string, boolean>> = {},
): CloudflareRateLimitBindings {
  const limiter = (name: string) => ({
    async limit({ key }: { key: string }) {
      events.push(`${name}:${key}`);
      return { success: results[name] ?? true };
    },
  });
  return {
    ANALYSIS_AGGREGATE_LIMITER: limiter("analysis-aggregate"),
    ANALYSIS_CLIENT_LIMITER: limiter("analysis-client"),
    REVISION_AGGREGATE_LIMITER: limiter("revision-aggregate"),
    REVISION_CLIENT_LIMITER: limiter("revision-client"),
  };
}

describe("Cloudflare paid-API rate limiter", () => {
  it("fails closed in production when the enable flag drifts", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MODELDUEL_CLOUDFLARE_RATE_LIMITS", "");

    await expect(
      enforcePaidApiRateLimit("analysis", cloudflareRequest("192.0.2.40")),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("keeps the no-binding bypass limited to local development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MODELDUEL_CLOUDFLARE_RATE_LIMITS", "");

    await expect(
      enforcePaidApiRateLimit("analysis", cloudflareRequest("192.0.2.41")),
    ).resolves.toBeUndefined();
  });

  it("awaits the SHA-256 client bucket before the aggregate ceiling", async () => {
    const events: string[] = [];
    const request = cloudflareRequest("192.0.2.44");
    await enforcePaidApiRateLimit("analysis", request, {
      cloudflareBindings: cloudflareBindings(events),
      trustedProxy: "cloudflare",
    });

    const expectedHash = hashedClientKey(request, "cloudflare");
    expect(expectedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(expectedHash).not.toContain("192.0.2.44");
    expect(events).toEqual([
      `analysis-client:${expectedHash}`,
      "analysis-aggregate:analysis",
    ]);
  });

  it("fails closed at client denial without charging the aggregate bucket", async () => {
    const events: string[] = [];
    const deniedRequest = cloudflareRequest("192.0.2.45");
    await expect(
      enforcePaidApiRateLimit("live-revision", deniedRequest, {
        cloudflareBindings: cloudflareBindings(events, {
          "revision-client": false,
        }),
        trustedProxy: "cloudflare",
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(events).toEqual([
      `revision-client:${hashedClientKey(deniedRequest, "cloudflare")}`,
    ]);
  });

  it("fails closed at aggregate denial after the accepted client check", async () => {
    const events: string[] = [];
    const deniedRequest = cloudflareRequest("192.0.2.46");
    await expect(
      enforcePaidApiRateLimit("analysis", deniedRequest, {
        cloudflareBindings: cloudflareBindings(events, {
          "analysis-aggregate": false,
        }),
        trustedProxy: "cloudflare",
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(events).toEqual([
      `analysis-client:${hashedClientKey(deniedRequest, "cloudflare")}`,
      "analysis-aggregate:analysis",
    ]);
  });

  it("does not consume aggregate capacity when the client binding throws", async () => {
    const events: string[] = [];
    const bindings: CloudflareRateLimitBindings = {
      ...cloudflareBindings(events),
      ANALYSIS_CLIENT_LIMITER: {
        async limit() {
          events.push("analysis-client:throw");
          throw new Error("binding unavailable");
        },
      },
    };
    await expect(
      enforcePaidApiRateLimit("analysis", cloudflareRequest("192.0.2.46"), {
        cloudflareBindings: bindings,
        trustedProxy: "cloudflare",
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(events).toEqual(["analysis-client:throw"]);
  });

  it("shares one privacy-safe unknown-client hash", () => {
    const first = hashedClientKey(request({ "CF-Connecting-IP": "invalid" }), "cloudflare");
    const second = hashedClientKey(request({}), "cloudflare");
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });
});
