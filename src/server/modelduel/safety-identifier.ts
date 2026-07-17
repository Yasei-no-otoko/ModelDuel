import "server-only";

import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";

const COOKIE_NAME = "__Host-modelduel-safety-v1";
const MAX_COOKIE_HEADER_BYTES = 4_096;
const RAW_IDENTIFIER_PATTERN = /^mds1_[a-f0-9]{32}$/;
const DERIVED_IDENTIFIER_PATTERN = /^mds1_[A-Za-z0-9_-]{43}$/;

export type SafetyIdentifierResolution = Readonly<{
  safetyIdentifier: string;
  setCookie?: string;
}>;

export function isValidSafetyIdentifier(value: unknown): value is string {
  return typeof value === "string" && DERIVED_IDENTIFIER_PATTERN.test(value);
}

function deriveSafetyIdentifier(rawIdentifier: string): string {
  const identifier = `mds1_${createHash("sha256")
    .update(rawIdentifier, "utf8")
    .digest("base64url")}`;

  if (!isValidSafetyIdentifier(identifier)) {
    throw new Error("Unable to derive a valid safety identifier.");
  }

  return identifier;
}

function mintRawIdentifier(createUuid: () => string): string {
  const compactUuid = createUuid().replaceAll("-", "").toLowerCase();
  const identifier = `mds1_${compactUuid}`;

  if (!RAW_IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error("Unable to mint a valid safety identifier cookie.");
  }

  return identifier;
}

function readRawIdentifier(cookieHeader: string | null): string | undefined {
  if (
    cookieHeader === null ||
    Buffer.byteLength(cookieHeader, "utf8") > MAX_COOKIE_HEADER_BYTES
  ) {
    return undefined;
  }

  const matches = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${COOKIE_NAME}=`))
    .map((part) => part.slice(COOKIE_NAME.length + 1));

  if (matches.length !== 1 || !RAW_IDENTIFIER_PATTERN.test(matches[0] ?? "")) {
    return undefined;
  }

  return matches[0];
}

export function resolveSafetyIdentifier(
  cookieHeader: string | null,
  createUuid: () => string = randomUUID,
): SafetyIdentifierResolution {
  const existingIdentifier = readRawIdentifier(cookieHeader);
  const rawIdentifier = existingIdentifier ?? mintRawIdentifier(createUuid);

  return {
    safetyIdentifier: deriveSafetyIdentifier(rawIdentifier),
    ...(existingIdentifier === undefined
      ? {
          setCookie: `${COOKIE_NAME}=${rawIdentifier}; Path=/; HttpOnly; Secure; SameSite=Strict`,
        }
      : {}),
  };
}

export function attachSafetyIdentifierCookie(
  response: Response,
  resolution: SafetyIdentifierResolution,
): Response {
  if (resolution.setCookie !== undefined) {
    response.headers.append("Set-Cookie", resolution.setCookie);
  }

  return response;
}
