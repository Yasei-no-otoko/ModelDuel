import { z } from "zod";

import {
  ScenarioIdSchema,
  SessionIdSchema,
} from "../../../lib/modelduel/schemas";
import { issueVerifiedDemo } from "../../../server/modelduel/evaluation";
import {
  HttpInputError,
  jsonResponse,
  readStrictJson,
  safeErrorResponse,
} from "../../../server/modelduel/http";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const DemoRequestSchema = z
  .object({
    sessionId: SessionIdSchema,
    scenarioId: ScenarioIdSchema,
  })
  .strict();

function readStrictQuery(request: Request): z.output<typeof DemoRequestSchema> {
  const searchParams = new URL(request.url).searchParams;
  const keys = [...searchParams.keys()];
  if (
    keys.length !== 2 ||
    new Set(keys).size !== keys.length ||
    !searchParams.has("sessionId") ||
    !searchParams.has("scenarioId")
  ) {
    throw new HttpInputError();
  }

  const parsed = DemoRequestSchema.safeParse({
    sessionId: searchParams.get("sessionId"),
    scenarioId: searchParams.get("scenarioId"),
  });
  if (!parsed.success) {
    throw new HttpInputError();
  }
  return parsed.data;
}

export async function GET(request: Request): Promise<Response> {
  try {
    return jsonResponse(issueVerifiedDemo(readStrictQuery(request)));
  } catch (error) {
    return safeErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const input = await readStrictJson(request, DemoRequestSchema);
    return jsonResponse(issueVerifiedDemo(input));
  } catch (error) {
    return safeErrorResponse(error);
  }
}
