import "server-only";

import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { ModelDuelUpstreamError } from "./openai/errors";

const WINDOW_MS = 60_000;
const MAX_ENTRIES = 2_048;

const LIMITS = {
  analysis: { perClient: 8, global: 120 },
  "live-revision": { perClient: 12, global: 180 },
} as const;

export type RateLimitKind = keyof typeof LIMITS;
export type RateLimitCounter = { windowStartedAt: number; count: number };

export type RateLimitStore = {
  clients: Map<string, RateLimitCounter>;
  globals: Map<RateLimitKind, RateLimitCounter>;
};

export type CloudflareRateLimitBindings = Readonly<
  Pick<
    CloudflareEnv,
    | "ANALYSIS_AGGREGATE_LIMITER"
    | "ANALYSIS_CLIENT_LIMITER"
    | "REVISION_AGGREGATE_LIMITER"
    | "REVISION_CLIENT_LIMITER"
  >
>;

export function createRateLimitStore(): RateLimitStore {
  return { clients: new Map(), globals: new Map() };
}

export type TrustedProxy = "vercel" | "cloudflare" | "none";

function inferredTrustedProxy(): TrustedProxy {
  if (process.env.VERCEL === "1") return "vercel";
  if (process.env.MODELDUEL_TRUSTED_PROXY === "cloudflare") {
    return "cloudflare";
  }
  return "none";
}

function boundedIp(candidate: string | null | undefined): string | undefined {
  const value = candidate?.trim();
  return value && value.length <= 64 && isIP(value) !== 0 ? value : undefined;
}

function firstBoundedIp(header: string | null): string | undefined {
  if (!header || header.length > 1_024) return undefined;
  for (const candidate of header.split(",", 16)) {
    const address = boundedIp(candidate);
    if (address) return address;
  }
  return undefined;
}

export function safeClientAddress(
  request: Request,
  trustedProxy: TrustedProxy = inferredTrustedProxy(),
): string {
  if (trustedProxy === "vercel") {
    return firstBoundedIp(request.headers.get("x-vercel-forwarded-for")) ?? "unknown";
  }
  if (trustedProxy === "cloudflare") {
    return boundedIp(request.headers.get("cf-connecting-ip")) ?? "unknown";
  }
  return "unknown";
}

export function hashedClientKey(
  request: Request,
  trustedProxy: TrustedProxy = inferredTrustedProxy(),
): string {
  return createHash("sha256")
    .update(safeClientAddress(request, trustedProxy), "utf8")
    .digest("hex");
}

function cleanup(store: RateLimitStore, now: number): void {
  for (const [key, counter] of store.clients) {
    if (now - counter.windowStartedAt >= WINDOW_MS) {
      store.clients.delete(key);
    }
  }
  for (const [kind, counter] of store.globals) {
    if (now - counter.windowStartedAt >= WINDOW_MS) {
      store.globals.delete(kind);
    }
  }
  while (store.clients.size > MAX_ENTRIES) {
    const oldest = store.clients.keys().next();
    if (oldest.done) {
      return;
    }
    store.clients.delete(oldest.value);
  }
}

function activeCount(
  counter: RateLimitCounter | undefined,
  now: number,
): number {
  return !counter || now - counter.windowStartedAt >= WINDOW_MS
    ? 0
    : counter.count;
}

function acceptedCounter(
  counter: RateLimitCounter | undefined,
  now: number,
): RateLimitCounter {
  if (!counter || now - counter.windowStartedAt >= WINDOW_MS) {
    return { windowStartedAt: now, count: 1 };
  }
  return { windowStartedAt: counter.windowStartedAt, count: counter.count + 1 };
}

export function enforceRateLimit(
  kind: RateLimitKind,
  request: Request,
  options: Readonly<{
    now?: number;
    store?: RateLimitStore;
    trustedProxy?: TrustedProxy;
  }> = {},
): void {
  const now = options.now ?? Date.now();
  if (!Number.isFinite(now) || now < 0) {
    throw new Error("Invalid rate-limit clock");
  }
  const store = options.store;
  if (!store) {
    return;
  }
  cleanup(store, now);
  const limits = LIMITS[kind];
  const key = `${kind}:${hashedClientKey(
    request,
    options.trustedProxy ?? inferredTrustedProxy(),
  )}`;
  const global = store.globals.get(kind);
  const client = store.clients.get(key);
  if (
    activeCount(global, now) >= limits.global ||
    activeCount(client, now) >= limits.perClient
  ) {
    throw new ModelDuelUpstreamError("RATE_LIMITED");
  }
  store.globals.set(kind, acceptedCounter(global, now));
  store.clients.set(key, acceptedCounter(client, now));
  cleanup(store, now);
}

function isCloudflareRateLimitBindings(
  value: unknown,
): value is CloudflareRateLimitBindings {
  if (typeof value !== "object" || value === null) return false;
  return [
    "ANALYSIS_AGGREGATE_LIMITER",
    "ANALYSIS_CLIENT_LIMITER",
    "REVISION_AGGREGATE_LIMITER",
    "REVISION_CLIENT_LIMITER",
  ].every((name) => {
    const binding = (value as Record<string, unknown>)[name];
    return (
      typeof binding === "object" &&
      binding !== null &&
      typeof (binding as { limit?: unknown }).limit === "function"
    );
  });
}

async function productionCloudflareBindings(): Promise<CloudflareRateLimitBindings> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    if (!isCloudflareRateLimitBindings(env)) {
      throw new Error("Cloudflare rate-limit bindings unavailable");
    }
    return env;
  } catch {
    throw new ModelDuelUpstreamError("RATE_LIMITED");
  }
}

export async function enforcePaidApiRateLimit(
  kind: RateLimitKind,
  request: Request,
  options: Readonly<{
    now?: number;
    store?: RateLimitStore;
    trustedProxy?: TrustedProxy;
    cloudflareBindings?: CloudflareRateLimitBindings;
  }> = {},
): Promise<void> {
  if (options.store) {
    enforceRateLimit(kind, request, options);
    return;
  }
  if (
    !options.cloudflareBindings &&
    process.env.MODELDUEL_CLOUDFLARE_RATE_LIMITS !== "enabled"
  ) {
    if (process.env.NODE_ENV === "production") {
      throw new ModelDuelUpstreamError("RATE_LIMITED");
    }
    return;
  }

  const bindings =
    options.cloudflareBindings ?? (await productionCloudflareBindings());
  const aggregate =
    kind === "analysis"
      ? bindings.ANALYSIS_AGGREGATE_LIMITER
      : bindings.REVISION_AGGREGATE_LIMITER;
  const client =
    kind === "analysis"
      ? bindings.ANALYSIS_CLIENT_LIMITER
      : bindings.REVISION_CLIENT_LIMITER;

  try {
    const clientResult = await client.limit({
      key: hashedClientKey(
        request,
        options.trustedProxy ?? inferredTrustedProxy(),
      ),
    });
    if (clientResult?.success !== true) {
      throw new ModelDuelUpstreamError("RATE_LIMITED");
    }
    const aggregateResult = await aggregate.limit({ key: kind });
    if (aggregateResult?.success !== true) {
      throw new ModelDuelUpstreamError("RATE_LIMITED");
    }
  } catch {
    throw new ModelDuelUpstreamError("RATE_LIMITED");
  }
}
