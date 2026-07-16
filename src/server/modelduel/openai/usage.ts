import "server-only";

import type * as Responses from "openai/resources/responses/responses";

export const OPENAI_PRICING_VERSION = "2026-07-17-standard" as const;

type UsageOperation =
  | "learner_extraction"
  | "programmatic_orchestration"
  | "revision_feedback";

type Price = Readonly<{
  input: number;
  cached: number;
  cacheWrite: number;
  output: number;
}>;

const MICRO_USD_PER_TOKEN: Readonly<Record<string, Price>> = {
  "gpt-5.6-terra": {
    input: 2.5,
    cached: 0.25,
    cacheWrite: 3.125,
    output: 15,
  },
  "gpt-5.6-luna": { input: 1, cached: 0.1, cacheWrite: 1.25, output: 6 },
};

type UsageResponse = Readonly<{
  service_tier?: string | null;
  status?: string | null;
  usage?: Responses.ResponseUsage | null;
}>;

export type OpenAIUsageRecord = Readonly<{
  operation: UsageOperation;
  model: string;
  serviceTier: string;
  status: string;
  input: number;
  cached: number;
  cacheWrite: number;
  output: number;
  reasoning: number;
  total: number;
  estimatedMicroUsd: number | null;
  pricingVersion: typeof OPENAI_PRICING_VERSION;
}>;

function tokenCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

export function createOpenAIUsageRecord(
  operation: UsageOperation,
  model: string,
  response: UsageResponse,
): OpenAIUsageRecord {
  const usage = response.usage;
  const input = tokenCount(usage?.input_tokens);
  const cached = tokenCount(usage?.input_tokens_details?.cached_tokens);
  const cacheWrite = tokenCount(
    usage?.input_tokens_details?.cache_write_tokens,
  );
  const output = tokenCount(usage?.output_tokens);
  const reasoning = tokenCount(
    usage?.output_tokens_details?.reasoning_tokens,
  );
  const total = tokenCount(usage?.total_tokens);
  const price = MICRO_USD_PER_TOKEN[model];
  const ordinaryInput = Math.max(0, input - cached - cacheWrite);
  const estimatedMicroUsd = price
    ? Math.round(
        ordinaryInput * price.input +
          cached * price.cached +
          cacheWrite * price.cacheWrite +
          output * price.output,
      )
    : null;

  return {
    operation,
    model,
    serviceTier: response.service_tier ?? "unknown",
    status: response.status ?? "unknown",
    input,
    cached,
    cacheWrite,
    output,
    reasoning,
    total,
    estimatedMicroUsd,
    pricingVersion: OPENAI_PRICING_VERSION,
  };
}

export function logOpenAIUsage(
  operation: UsageOperation,
  model: string,
  response: UsageResponse,
  sink: (record: OpenAIUsageRecord) => void = console.info,
): void {
  try {
    sink(createOpenAIUsageRecord(operation, model, response));
  } catch {
    // Telemetry must never break, retry, or alter a learner request.
  }
}
