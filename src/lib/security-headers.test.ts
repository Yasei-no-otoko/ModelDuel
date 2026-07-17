import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
  initOpenNextCloudflareForDev: vi.fn(),
}));

import nextConfig from "../../next.config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production security headers", () => {
  it("applies a strict browser policy to every production route", async () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(nextConfig.headers).toBeTypeOf("function");
    const routes = await nextConfig.headers!();

    expect(routes).toHaveLength(1);
    expect(routes[0]?.source).toBe("/(.*)");

    const headers = new Map(
      routes[0]?.headers.map(({ key, value }) => [key, value]),
    );
    const csp = headers.get("Content-Security-Policy");

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(headers.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Permissions-Policy")).toContain("microphone=()");
  });

  it("does not weaken the policy with development-only eval permissions", async () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(nextConfig.headers).toBeTypeOf("function");
    await expect(nextConfig.headers!()).resolves.toEqual([]);
  });
});
