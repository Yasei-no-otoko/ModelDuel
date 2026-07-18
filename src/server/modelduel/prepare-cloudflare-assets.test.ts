import { describe, expect, it } from "vitest";

import { normalizeClientMiddlewareManifest } from "../../../scripts/prepare-cloudflare-assets.mjs";

const GENERATED_MANIFEST =
  "self.__MIDDLEWARE_MATCHERS = [];self.__MIDDLEWARE_MATCHERS_CB && self.__MIDDLEWARE_MATCHERS_CB()";

describe("normalizeClientMiddlewareManifest", () => {
  it("adds a semicolon without changing the generated program", () => {
    expect(normalizeClientMiddlewareManifest(GENERATED_MANIFEST)).toBe(
      `${GENERATED_MANIFEST};`,
    );
  });

  it("is idempotent", () => {
    expect(normalizeClientMiddlewareManifest(`${GENERATED_MANIFEST};`)).toBe(
      `${GENERATED_MANIFEST};`,
    );
  });

  it("fails closed when Next changes the generated contract", () => {
    expect(() => normalizeClientMiddlewareManifest("unexpected")).toThrow(
      "Unexpected _clientMiddlewareManifest.js contents",
    );
  });
});
