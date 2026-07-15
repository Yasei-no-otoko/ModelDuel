import {
  evaluateTransferRequest,
  TransferEvaluationRequestSchema,
} from "../../../server/modelduel/evaluation";
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
      TransferEvaluationRequestSchema,
    );
    return jsonResponse(evaluateTransferRequest(input));
  } catch (error) {
    return safeErrorResponse(error);
  }
}
