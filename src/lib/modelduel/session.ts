import {
  AnalysisResultSchema,
  RevisionFeedbackSchema,
  RevisionTraceSchema,
  ScenarioIdSchema,
  SessionIdSchema,
  SimulationObservationSchema,
  SketchReferenceSchema,
  TransferResultSchema,
} from "./schemas";
import type {
  AnalysisResult,
  RevisionFeedback,
  RevisionTrace,
  ScenarioId,
  SimulationObservation,
  SketchReference,
  TransferResult,
} from "./schemas";
import { createCaseFingerprint, simulateWorld } from "./simulation";

export const SESSION_STAGE_SEQUENCE = [
  "HOME",
  "INPUT",
  "ANALYZING",
  "MODEL_REVIEW",
  "PREDICTION_OPEN",
  "PREDICTION_LOCKED",
  "OBSERVING",
  "REVISION",
  "TRANSFER_OPEN",
  "TRANSFER_LOCKED",
  "REVISION_TRACE",
] as const;

export type SessionStage = (typeof SESSION_STAGE_SEQUENCE)[number];

export type TimedChoice = Readonly<{
  optionId: string;
  selectedAt: number;
  lockedAt: number | null;
}>;

export type ObservationComparison = Readonly<{
  caseFingerprint: string;
  learner: SimulationObservation;
  scientific: SimulationObservation;
  completedAt: number;
}>;

export type TransferEvaluationRequest = Readonly<{
  requestId: string;
  idempotencyKey: string;
  requestedAt: number;
}>;

export type RevisionEvaluationRequest = Readonly<{
  requestId: string;
  idempotencyKey: string;
  requestedAt: number;
}>;

export type ModelDuelSession = Readonly<{
  sessionId: string;
  stage: SessionStage;
  lastEventAt: number | null;
  scenarioId: ScenarioId | null;
  input: Readonly<{
    explanation: string;
    sketchReference: SketchReference | null;
  }> | null;
  inputSubmittedAt: number | null;
  analysisRequestId: string | null;
  analysisStartedAt: number | null;
  analysis: AnalysisResult | null;
  analysisReceivedAt: number | null;
  modelConfirmedAt: number | null;
  prediction: TimedChoice | null;
  observationStartedAt: number | null;
  comparison: ObservationComparison | null;
  revision: Readonly<{
    text: string;
    submittedAt: number;
    feedback: RevisionFeedback | null;
    feedbackEvaluatedAt: number | null;
  }> | null;
  revisionEvaluationRequest: RevisionEvaluationRequest | null;
  transfer: TimedChoice | null;
  transferEvaluationRequest: TransferEvaluationRequest | null;
  transferResult: TransferResult | null;
  trace: RevisionTrace | null;
}>;

export type SessionAction =
  | Readonly<{
      type: "START_INPUT";
      scenarioId: unknown;
      explanation?: string;
      sketchReference?: unknown;
      submittedAt: number;
    }>
  | Readonly<{
      type: "BEGIN_ANALYSIS";
      sessionId: string;
      requestId: string;
      startedAt: number;
    }>
  | Readonly<{
      type: "RECEIVE_ANALYSIS";
      sessionId: string;
      requestId: string;
      analysis: unknown;
      receivedAt: number;
    }>
  | Readonly<{ type: "CONFIRM_MODEL"; confirmedAt: number }>
  | Readonly<{
      type: "SELECT_PREDICTION";
      optionId: string;
      selectedAt: number;
    }>
  | Readonly<{ type: "LOCK_PREDICTION"; lockedAt: number }>
  | Readonly<{ type: "BEGIN_OBSERVATION"; startedAt: number }>
  | Readonly<{ type: "COMPLETE_OBSERVATION"; completedAt: number }>
  | Readonly<{
      type: "SUBMIT_REVISION";
      text: string;
      submittedAt: number;
    }>
  | Readonly<{
      type: "BEGIN_REVISION_EVALUATION";
      sessionId: string;
      requestId: string;
      idempotencyKey: string;
      requestedAt: number;
    }>
  | Readonly<{
      type: "RECEIVE_REVISION_FEEDBACK";
      sessionId: string;
      requestId: string;
      feedback: unknown;
      evaluatedAt: number;
    }>
  | Readonly<{
      type: "SELECT_TRANSFER";
      optionId: string;
      selectedAt: number;
    }>
  | Readonly<{ type: "LOCK_TRANSFER"; lockedAt: number }>
  | Readonly<{
      type: "BEGIN_TRANSFER_EVALUATION";
      sessionId: string;
      requestId: string;
      idempotencyKey: string;
      requestedAt: number;
    }>
  | Readonly<{
      type: "RECEIVE_TRANSFER_RESULT";
      sessionId: string;
      requestId: string;
      result: unknown;
    }>
  | Readonly<{
      type: "RESTART";
      newSessionId: string;
      restartedAt: number;
    }>;

export type RejectionCode =
  | "WRONG_STAGE"
  | "INVALID_TIMESTAMP"
  | "INVALID_SCENARIO"
  | "INVALID_INPUT"
  | "INVALID_IDENTIFIER"
  | "ID_MISMATCH"
  | "INVALID_ANALYSIS"
  | "SCENARIO_MISMATCH"
  | "OPTION_NOT_FOUND"
  | "MISSING_SELECTION"
  | "SIMULATION_INVALID"
  | "INVALID_REVISION"
  | "REVISION_ALREADY_SUBMITTED"
  | "INVALID_TRANSFER_RESULT"
  | "INCOMPLETE_SESSION";

export type SessionTransition = Readonly<{
  state: ModelDuelSession;
  accepted: boolean;
  reason: RejectionCode | null;
  idempotent: boolean;
}>;

export function createInitialSession(sessionId: string): ModelDuelSession {
  const validatedSessionId = SessionIdSchema.parse(sessionId);
  return {
    sessionId: validatedSessionId,
    stage: "HOME",
    lastEventAt: null,
    scenarioId: null,
    input: null,
    inputSubmittedAt: null,
    analysisRequestId: null,
    analysisStartedAt: null,
    analysis: null,
    analysisReceivedAt: null,
    modelConfirmedAt: null,
    prediction: null,
    observationStartedAt: null,
    comparison: null,
    revision: null,
    revisionEvaluationRequest: null,
    transfer: null,
    transferEvaluationRequest: null,
    transferResult: null,
    trace: null,
  };
}

function accepted(
  state: ModelDuelSession,
  eventAt: number,
): SessionTransition {
  return {
    state: { ...state, lastEventAt: eventAt },
    accepted: true,
    reason: null,
    idempotent: false,
  };
}

function acceptedIdempotently(state: ModelDuelSession): SessionTransition {
  return { state, accepted: true, reason: null, idempotent: true };
}

function rejected(
  state: ModelDuelSession,
  reason: RejectionCode,
): SessionTransition {
  return { state, accepted: false, reason, idempotent: false };
}

function actionTimestamp(action: SessionAction): number {
  switch (action.type) {
    case "START_INPUT":
    case "SUBMIT_REVISION":
      return action.submittedAt;
    case "BEGIN_ANALYSIS":
    case "BEGIN_OBSERVATION":
      return action.startedAt;
    case "RECEIVE_ANALYSIS":
      return action.receivedAt;
    case "CONFIRM_MODEL":
      return action.confirmedAt;
    case "SELECT_PREDICTION":
    case "SELECT_TRANSFER":
      return action.selectedAt;
    case "LOCK_PREDICTION":
    case "LOCK_TRANSFER":
      return action.lockedAt;
    case "COMPLETE_OBSERVATION":
      return action.completedAt;
    case "BEGIN_TRANSFER_EVALUATION":
    case "BEGIN_REVISION_EVALUATION":
      return action.requestedAt;
    case "RECEIVE_REVISION_FEEDBACK":
      return action.evaluatedAt;
    case "RECEIVE_TRANSFER_RESULT": {
      const result = TransferResultSchema.safeParse(action.result);
      return result.success ? result.data.evaluatedAt : Number.NaN;
    }
    case "RESTART":
      return action.restartedAt;
  }
}

function hasValidTimestamp(state: ModelDuelSession, timestamp: number) {
  return (
    Number.isFinite(timestamp) &&
    timestamp >= 0 &&
    (state.lastEventAt === null || timestamp >= state.lastEventAt)
  );
}

function optionExists(
  options: ReadonlyArray<Readonly<{ id: string }>>,
  optionId: string,
) {
  return options.some((option) => option.id === optionId);
}

function hasMatchingObservationIdentity(
  observation: SimulationObservation,
  analysis: AnalysisResult,
  expectedWorldId: string,
  expectedModelKind: "learner" | "scientific",
  fingerprint: string,
) {
  return (
    observation.caseId === analysis.caseSpec.id &&
    observation.caseFingerprint === fingerprint &&
    observation.worldId === expectedWorldId &&
    observation.modelKind === expectedModelKind &&
    observation.scenario === analysis.scenarioId
  );
}

function transferResultsEqual(left: TransferResult, right: TransferResult) {
  return (
    left.receiptId === right.receiptId &&
    left.evaluationId === right.evaluationId &&
    left.questionId === right.questionId &&
    left.questionVersion === right.questionVersion &&
    left.selectedOptionId === right.selectedOptionId &&
    left.isCorrect === right.isCorrect &&
    left.score === right.score &&
    left.rationale === right.rationale &&
    left.evaluatedAt === right.evaluatedAt &&
    left.source === right.source
  );
}

function revisionFeedbackEqual(
  left: RevisionFeedback,
  right: RevisionFeedback,
) {
  return (
    left.conceptualChange === right.conceptualChange &&
    left.score === right.score &&
    left.summary === right.summary &&
    left.nextStep === right.nextStep &&
    left.strengths.length === right.strengths.length &&
    left.strengths.every((strength, index) => strength === right.strengths[index])
  );
}

export function buildRevisionTrace(
  state: ModelDuelSession,
  transferResult: TransferResult,
): RevisionTrace | null {
  if (
    state.scenarioId === null ||
    state.input === null ||
    state.inputSubmittedAt === null ||
    state.analysisStartedAt === null ||
    state.analysis === null ||
    state.analysisReceivedAt === null ||
    state.modelConfirmedAt === null ||
    state.prediction === null ||
    state.prediction.lockedAt === null ||
    state.observationStartedAt === null ||
    state.comparison === null ||
    state.revision === null ||
    state.revision.feedback === null ||
    state.revision.feedbackEvaluatedAt === null ||
    state.transfer === null ||
    state.transfer.lockedAt === null ||
    state.transfer.optionId !== transferResult.selectedOptionId
  ) {
    return null;
  }

  const parsed = RevisionTraceSchema.safeParse({
    scenarioId: state.scenarioId,
    startedAt: state.inputSubmittedAt,
    inputSubmittedAt: state.inputSubmittedAt,
    analysisStartedAt: state.analysisStartedAt,
    analysisReceivedAt: state.analysisReceivedAt,
    modelConfirmedAt: state.modelConfirmedAt,
    initialExplanation: state.input.explanation,
    sketchReference: state.input.sketchReference,
    learnerModelSummary: state.analysis.learnerModel.summary,
    prediction: {
      questionId: state.analysis.predictionQuestion.id,
      optionId: state.prediction.optionId,
      selectedAt: state.prediction.selectedAt,
      lockedAt: state.prediction.lockedAt,
    },
    observation: {
      caseFingerprint: state.comparison.caseFingerprint,
      learner: state.comparison.learner,
      scientific: state.comparison.scientific,
      startedAt: state.observationStartedAt,
      completedAt: state.comparison.completedAt,
    },
    revision: {
      text: state.revision.text,
      submittedAt: state.revision.submittedAt,
      feedbackEvaluatedAt: state.revision.feedbackEvaluatedAt,
      feedback: state.revision.feedback,
    },
    transfer: {
      evaluationId: state.analysis.transferQuestion.evaluationId,
      questionId: state.analysis.transferQuestion.questionId,
      questionVersion: state.analysis.transferQuestion.version,
      selectedOptionId: state.transfer.optionId,
      selectedAt: state.transfer.selectedAt,
      lockedAt: state.transfer.lockedAt,
      result: transferResult,
    },
    completedAt: transferResult.evaluatedAt,
  });

  return parsed.success ? parsed.data : null;
}

export function reduceSession(
  state: ModelDuelSession,
  action: SessionAction,
): SessionTransition {
  if (
    action.type === "RECEIVE_TRANSFER_RESULT" &&
    !TransferResultSchema.safeParse(action.result).success
  ) {
    return rejected(state, "INVALID_TRANSFER_RESULT");
  }
  const eventAt = actionTimestamp(action);
  if (!hasValidTimestamp(state, eventAt)) {
    return rejected(state, "INVALID_TIMESTAMP");
  }

  switch (action.type) {
    case "START_INPUT": {
      if (state.stage !== "HOME") return rejected(state, "WRONG_STAGE");
      const scenarioId = ScenarioIdSchema.safeParse(action.scenarioId);
      if (!scenarioId.success) return rejected(state, "INVALID_SCENARIO");
      const explanation = action.explanation?.trim() ?? "";
      let sketchReference: SketchReference | null = null;
      if (action.sketchReference !== undefined) {
        const sketch = SketchReferenceSchema.safeParse(action.sketchReference);
        if (!sketch.success) return rejected(state, "INVALID_INPUT");
        sketchReference = sketch.data;
      }
      if (explanation.length > 1_500 || (explanation.length === 0 && sketchReference === null)) {
        return rejected(state, "INVALID_INPUT");
      }
      return accepted(
        {
          ...state,
          stage: "INPUT",
          scenarioId: scenarioId.data,
          input: {
            explanation,
            sketchReference,
          },
          inputSubmittedAt: action.submittedAt,
        },
        eventAt,
      );
    }

    case "BEGIN_ANALYSIS": {
      if (state.stage !== "INPUT") return rejected(state, "WRONG_STAGE");
      const requestId = SessionIdSchema.safeParse(action.requestId);
      const sessionId = SessionIdSchema.safeParse(action.sessionId);
      if (!requestId.success || !sessionId.success) {
        return rejected(state, "INVALID_IDENTIFIER");
      }
      if (sessionId.data !== state.sessionId) {
        return rejected(state, "ID_MISMATCH");
      }
      return accepted(
        {
          ...state,
          stage: "ANALYZING",
          analysisRequestId: requestId.data,
          analysisStartedAt: action.startedAt,
        },
        eventAt,
      );
    }

    case "RECEIVE_ANALYSIS": {
      const sessionId = SessionIdSchema.safeParse(action.sessionId);
      const requestId = SessionIdSchema.safeParse(action.requestId);
      if (!sessionId.success || !requestId.success) {
        return rejected(state, "INVALID_IDENTIFIER");
      }
      if (
        sessionId.data !== state.sessionId ||
        requestId.data !== state.analysisRequestId
      ) {
        return rejected(state, "ID_MISMATCH");
      }
      if (state.stage !== "ANALYZING") {
        return rejected(state, "WRONG_STAGE");
      }
      const analysis = AnalysisResultSchema.safeParse(action.analysis);
      if (!analysis.success) return rejected(state, "INVALID_ANALYSIS");
      if (analysis.data.scenarioId !== state.scenarioId) {
        return rejected(state, "SCENARIO_MISMATCH");
      }
      return accepted(
        {
          ...state,
          stage: "MODEL_REVIEW",
          analysis: analysis.data,
          analysisReceivedAt: action.receivedAt,
        },
        eventAt,
      );
    }

    case "CONFIRM_MODEL": {
      if (state.stage !== "MODEL_REVIEW") {
        return rejected(state, "WRONG_STAGE");
      }
      return accepted(
        {
          ...state,
          stage: "PREDICTION_OPEN",
          modelConfirmedAt: action.confirmedAt,
        },
        eventAt,
      );
    }

    case "SELECT_PREDICTION": {
      if (state.stage !== "PREDICTION_OPEN") {
        return rejected(state, "WRONG_STAGE");
      }
      if (
        state.analysis === null ||
        !optionExists(state.analysis.predictionQuestion.options, action.optionId)
      ) {
        return rejected(state, "OPTION_NOT_FOUND");
      }
      return accepted(
        {
          ...state,
          prediction: {
            optionId: action.optionId,
            selectedAt: action.selectedAt,
            lockedAt: null,
          },
        },
        eventAt,
      );
    }

    case "LOCK_PREDICTION": {
      if (state.stage === "PREDICTION_LOCKED") {
        return acceptedIdempotently(state);
      }
      if (state.stage !== "PREDICTION_OPEN") {
        return rejected(state, "WRONG_STAGE");
      }
      if (state.prediction === null) {
        return rejected(state, "MISSING_SELECTION");
      }
      return accepted(
        {
          ...state,
          stage: "PREDICTION_LOCKED",
          prediction: { ...state.prediction, lockedAt: action.lockedAt },
        },
        eventAt,
      );
    }

    case "BEGIN_OBSERVATION": {
      if (state.stage !== "PREDICTION_LOCKED") {
        return rejected(state, "WRONG_STAGE");
      }
      return accepted(
        {
          ...state,
          stage: "OBSERVING",
          observationStartedAt: action.startedAt,
        },
        eventAt,
      );
    }

    case "COMPLETE_OBSERVATION": {
      if (state.stage !== "OBSERVING") {
        return rejected(state, "WRONG_STAGE");
      }
      if (state.analysis === null) {
        return rejected(state, "INCOMPLETE_SESSION");
      }

      let learnerResult: SimulationObservation;
      let scientificResult: SimulationObservation;
      try {
        learnerResult = simulateWorld(
          state.analysis.learnerWorld,
          state.analysis.caseSpec,
        );
        scientificResult = simulateWorld(
          state.analysis.scientificWorld,
          state.analysis.caseSpec,
        );
      } catch {
        return rejected(state, "SIMULATION_INVALID");
      }

      const learner = SimulationObservationSchema.safeParse(learnerResult);
      const scientific = SimulationObservationSchema.safeParse(scientificResult);
      const fingerprint = createCaseFingerprint(state.analysis.caseSpec);
      if (
        !learner.success ||
        !scientific.success ||
        !hasMatchingObservationIdentity(
          learner.data,
          state.analysis,
          state.analysis.learnerWorld.worldId,
          "learner",
          fingerprint,
        ) ||
        !hasMatchingObservationIdentity(
          scientific.data,
          state.analysis,
          state.analysis.scientificWorld.worldId,
          "scientific",
          fingerprint,
        )
      ) {
        return rejected(state, "SIMULATION_INVALID");
      }

      return accepted(
        {
          ...state,
          stage: "REVISION",
          comparison: {
            caseFingerprint: fingerprint,
            learner: learner.data,
            scientific: scientific.data,
            completedAt: action.completedAt,
          },
        },
        eventAt,
      );
    }

    case "SUBMIT_REVISION": {
      if (state.stage !== "REVISION") {
        return rejected(state, "WRONG_STAGE");
      }
      if (state.revision !== null) {
        return rejected(state, "REVISION_ALREADY_SUBMITTED");
      }
      const text = action.text.trim();
      if (text.length === 0 || text.length > 1_500) {
        return rejected(state, "INVALID_REVISION");
      }
      return accepted(
        {
          ...state,
          revision: {
            text,
            submittedAt: action.submittedAt,
            feedback: null,
            feedbackEvaluatedAt: null,
          },
        },
        eventAt,
      );
    }

    case "BEGIN_REVISION_EVALUATION": {
      const sessionId = SessionIdSchema.safeParse(action.sessionId);
      const requestId = SessionIdSchema.safeParse(action.requestId);
      const idempotencyKey = SessionIdSchema.safeParse(action.idempotencyKey);
      if (!sessionId.success || !requestId.success || !idempotencyKey.success) {
        return rejected(state, "INVALID_IDENTIFIER");
      }
      if (sessionId.data !== state.sessionId) {
        return rejected(state, "ID_MISMATCH");
      }
      if (state.revisionEvaluationRequest !== null) {
        return state.revisionEvaluationRequest.requestId === requestId.data &&
          state.revisionEvaluationRequest.idempotencyKey === idempotencyKey.data
          ? acceptedIdempotently(state)
          : rejected(state, "ID_MISMATCH");
      }
      if (state.stage !== "REVISION" || state.revision === null) {
        return rejected(state, "WRONG_STAGE");
      }
      return accepted(
        {
          ...state,
          revisionEvaluationRequest: {
            requestId: requestId.data,
            idempotencyKey: idempotencyKey.data,
            requestedAt: action.requestedAt,
          },
        },
        eventAt,
      );
    }

    case "RECEIVE_REVISION_FEEDBACK": {
      const sessionId = SessionIdSchema.safeParse(action.sessionId);
      const requestId = SessionIdSchema.safeParse(action.requestId);
      const feedback = RevisionFeedbackSchema.safeParse(action.feedback);
      if (!sessionId.success || !requestId.success) {
        return rejected(state, "INVALID_IDENTIFIER");
      }
      if (!feedback.success) return rejected(state, "INVALID_REVISION");
      if (
        sessionId.data !== state.sessionId ||
        state.revisionEvaluationRequest === null ||
        requestId.data !== state.revisionEvaluationRequest.requestId
      ) {
        return rejected(state, "ID_MISMATCH");
      }
      if (
        state.revision !== null &&
        state.revision.feedback !== null &&
        state.revision.feedbackEvaluatedAt === action.evaluatedAt
      ) {
        return revisionFeedbackEqual(state.revision.feedback, feedback.data)
          ? acceptedIdempotently(state)
          : rejected(state, "INVALID_REVISION");
      }
      if (state.stage !== "REVISION" || state.revision === null) {
        return rejected(state, "WRONG_STAGE");
      }
      return accepted(
        {
          ...state,
          stage: "TRANSFER_OPEN",
          revision: {
            ...state.revision,
            feedback: feedback.data,
            feedbackEvaluatedAt: action.evaluatedAt,
          },
        },
        eventAt,
      );
    }

    case "SELECT_TRANSFER": {
      if (state.stage !== "TRANSFER_OPEN") {
        return rejected(state, "WRONG_STAGE");
      }
      if (
        state.analysis === null ||
        !optionExists(state.analysis.transferQuestion.options, action.optionId)
      ) {
        return rejected(state, "OPTION_NOT_FOUND");
      }
      return accepted(
        {
          ...state,
          transfer: {
            optionId: action.optionId,
            selectedAt: action.selectedAt,
            lockedAt: null,
          },
        },
        eventAt,
      );
    }

    case "LOCK_TRANSFER": {
      if (state.stage === "TRANSFER_LOCKED") {
        return acceptedIdempotently(state);
      }
      if (state.stage !== "TRANSFER_OPEN") {
        return rejected(state, "WRONG_STAGE");
      }
      if (state.transfer === null) {
        return rejected(state, "MISSING_SELECTION");
      }
      return accepted(
        {
          ...state,
          stage: "TRANSFER_LOCKED",
          transfer: { ...state.transfer, lockedAt: action.lockedAt },
        },
        eventAt,
      );
    }

    case "BEGIN_TRANSFER_EVALUATION": {
      const sessionId = SessionIdSchema.safeParse(action.sessionId);
      const requestId = SessionIdSchema.safeParse(action.requestId);
      const idempotencyKey = SessionIdSchema.safeParse(action.idempotencyKey);
      if (!sessionId.success || !requestId.success || !idempotencyKey.success) {
        return rejected(state, "INVALID_IDENTIFIER");
      }
      if (sessionId.data !== state.sessionId) {
        return rejected(state, "ID_MISMATCH");
      }
      if (state.transferEvaluationRequest !== null) {
        return state.transferEvaluationRequest.requestId === requestId.data &&
          state.transferEvaluationRequest.idempotencyKey === idempotencyKey.data
          ? acceptedIdempotently(state)
          : rejected(state, "ID_MISMATCH");
      }
      if (state.stage !== "TRANSFER_LOCKED") {
        return rejected(state, "WRONG_STAGE");
      }
      return accepted(
        {
          ...state,
          transferEvaluationRequest: {
            requestId: requestId.data,
            idempotencyKey: idempotencyKey.data,
            requestedAt: action.requestedAt,
          },
        },
        eventAt,
      );
    }

    case "RECEIVE_TRANSFER_RESULT": {
      const sessionId = SessionIdSchema.safeParse(action.sessionId);
      const requestId = SessionIdSchema.safeParse(action.requestId);
      const result = TransferResultSchema.safeParse(action.result);
      if (!sessionId.success || !requestId.success) {
        return rejected(state, "INVALID_IDENTIFIER");
      }
      if (!result.success) return rejected(state, "INVALID_TRANSFER_RESULT");
      if (
        sessionId.data !== state.sessionId ||
        state.transferEvaluationRequest === null ||
        requestId.data !== state.transferEvaluationRequest.requestId
      ) {
        return rejected(state, "ID_MISMATCH");
      }
      if (state.stage === "REVISION_TRACE" && state.transferResult !== null) {
        return transferResultsEqual(state.transferResult, result.data)
          ? acceptedIdempotently(state)
          : rejected(state, "INVALID_TRANSFER_RESULT");
      }
      if (state.stage !== "TRANSFER_LOCKED") {
        return rejected(state, "WRONG_STAGE");
      }
      if (state.analysis === null || state.transfer === null) {
        return rejected(state, "INCOMPLETE_SESSION");
      }
      const question = state.analysis.transferQuestion;
      if (
        result.data.evaluationId !== question.evaluationId ||
        result.data.questionId !== question.questionId ||
        result.data.questionVersion !== question.version ||
        result.data.selectedOptionId !== state.transfer.optionId
      ) {
        return rejected(state, "INVALID_TRANSFER_RESULT");
      }
      const trace = buildRevisionTrace(state, result.data);
      if (trace === null) return rejected(state, "INCOMPLETE_SESSION");
      return accepted(
        {
          ...state,
          stage: "REVISION_TRACE",
          transferResult: result.data,
          trace,
        },
        result.data.evaluatedAt,
      );
    }

    case "RESTART": {
      const newSessionId = SessionIdSchema.safeParse(action.newSessionId);
      if (!newSessionId.success) {
        return rejected(state, "INVALID_IDENTIFIER");
      }
      return accepted(
        createInitialSession(newSessionId.data),
        action.restartedAt,
      );
    }
  }

  return rejected(state, "WRONG_STAGE");
}
