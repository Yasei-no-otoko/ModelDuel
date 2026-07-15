import {
  evaluateRevisionRequest,
  RevisionEvaluationRequestSchema,
} from "../../../server/modelduel/revision";
import {
  jsonResponse,
  readStrictJson,
  safeErrorResponse,
} from "../../../server/modelduel/http";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const input = await readStrictJson(
      request,
      RevisionEvaluationRequestSchema,
    );
    return jsonResponse(evaluateRevisionRequest(input));
  } catch (error) {
    return safeErrorResponse(error);
  }
}
