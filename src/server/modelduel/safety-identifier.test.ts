import { describe, expect, it } from "vitest";

import {
  attachSafetyIdentifierCookie,
  isValidSafetyIdentifier,
  resolveSafetyIdentifier,
} from "./safety-identifier";

const UUID_A = "00112233-4455-6677-8899-aabbccddeeff";
const UUID_B = "ffeeddcc-bbaa-9988-7766-554433221100";
const RAW_A = "mds1_00112233445566778899aabbccddeeff";
const RAW_B = "mds1_ffeeddccbbaa99887766554433221100";
const COOKIE_NAME = "__Host-modelduel-safety-v1";

describe("safety identifier", () => {
  it("mints an opaque HttpOnly host cookie and a separate derived identifier", () => {
    const resolution = resolveSafetyIdentifier(null, () => UUID_A);

    expect(resolution.safetyIdentifier).toMatch(
      /^mds1_[A-Za-z0-9_-]{43}$/,
    );
    expect(resolution.safetyIdentifier).toHaveLength(48);
    expect(resolution.safetyIdentifier).not.toContain(RAW_A);
    expect(isValidSafetyIdentifier(resolution.safetyIdentifier)).toBe(true);
    expect(resolution.setCookie).toBe(
      `${COOKIE_NAME}=${RAW_A}; Path=/; HttpOnly; Secure; SameSite=Strict`,
    );
    expect(resolution.setCookie).not.toMatch(
      /Domain=|Expires=|Max-Age=/i,
    );
  });

  it("reuses one valid cookie without rotating or re-exposing it", () => {
    const first = resolveSafetyIdentifier(null, () => UUID_A);
    const existing = resolveSafetyIdentifier(
      `theme=dark; ${COOKIE_NAME}=${RAW_A}; locale=en`,
      () => UUID_B,
    );

    expect(existing.safetyIdentifier).toBe(first.safetyIdentifier);
    expect(existing.setCookie).toBeUndefined();
  });

  it.each([
    ["malformed", `${COOKIE_NAME}=not-valid`],
    ["duplicate", `${COOKIE_NAME}=${RAW_A}; ${COOKIE_NAME}=${RAW_A}`],
    ["oversize", `padding=${"x".repeat(4_097)}`],
  ])("rotates a %s cookie header", (_caseName, cookieHeader) => {
    const resolution = resolveSafetyIdentifier(cookieHeader, () => UUID_B);

    expect(resolution.setCookie).toContain(`${COOKIE_NAME}=${RAW_B};`);
    expect(resolution.safetyIdentifier).not.toContain(RAW_B);
  });

  it("appends Set-Cookie only when rotation is required", () => {
    const minted = resolveSafetyIdentifier(null, () => UUID_A);
    const mintedResponse = attachSafetyIdentifierCookie(
      new Response(null, { status: 204 }),
      minted,
    );
    expect(mintedResponse.headers.get("set-cookie")).toBe(minted.setCookie);

    const existing = resolveSafetyIdentifier(
      `${COOKIE_NAME}=${RAW_A}`,
      () => UUID_B,
    );
    const existingResponse = attachSafetyIdentifierCookie(
      new Response(null, { status: 204 }),
      existing,
    );
    expect(existingResponse.headers.has("set-cookie")).toBe(false);
  });
});
