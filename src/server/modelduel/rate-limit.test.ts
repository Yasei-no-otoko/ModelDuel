import { describe, expect, it } from "vitest";

import { createRateLimitStore, enforceRateLimit } from "./rate-limit";

const CLOUDFLARE = { trustedProxy: "cloudflare" as const };

function cloudflareRequest(ip: string): Request {
  return request({ "CF-Connecting-IP": ip });
}

function request(headers: HeadersInit): Request {
  return new Request("http://localhost/api/analyze", { headers });
}

describe("best-effort server rate limiter", () => {
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
