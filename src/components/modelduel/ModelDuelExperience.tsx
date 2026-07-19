"use client";

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  createInitialSession,
  reduceSession,
  type ModelDuelSession,
  type ScenarioId,
  type SessionAction,
} from "@/lib/modelduel";
import { PRODUCT, SCENARIO_CONTENT } from "@/lib/product";

import {
  ModelDuelApiError,
  analyzeSubmission,
  buildTransferRequest,
  evaluateTransfer,
  fileToAnalyzeSketch,
  loadVerifiedDemo,
  submitRevision,
  type AnalysisLoad,
  type ApiErrorCode,
  type LiveAnalysisRequest,
  type RevisionSubmissionCommon,
  type RevisionSubmissionRequest,
  type RevisionSubmissionResult,
  type TransferEvaluationRequest,
} from "./client";
import {
  EXPERIENCE_STEPS,
  createStableId,
  experienceStageForSession,
  stageIndex,
  validateCaptureInput,
  validateRevision,
  validateSketchFile,
} from "./flow";
import { getTraceHeroCopy } from "./trace-copy";
import {
  TRACE_HANDOFF_FILENAME,
  buildTraceHandoffText,
  type TraceHandoffContent,
} from "./trace-handoff";
import { formatCausalRelation } from "./learner-copy";
import { useHydrationReady } from "./browser";
import { ModelDuelLogo } from "./ModelDuelLogo";
import { DynamicHeroVisualizer } from "./hero-visualizer-loader";
import {
  loadWorldComparison,
  ResilientWorldComparison,
} from "./world-comparison-loader";

type SessionContainer = Readonly<{
  value: ModelDuelSession;
  rejection: string | null;
}>;

type TransportKind = "analysis" | "revision" | "transfer";

type TransportGuard = Readonly<{
  key: string;
  generation: number;
  sessionId: string;
  requestId: string;
  controller: AbortController;
}>;

const VERIFIED_EMPTY_INPUT_TRACE =
  "No learner explanation was submitted; the verified sample was selected explicitly.";

const LIVE_USE_DISCLOSURE =
  "Live GPT is only for people 18 or older, or learners using it with teacher or guardian authorization. Do not enter a student’s name or any personal or identifying information. For replay safety, ModelDuel schedules normalized live revision feedback for deletion after the authorization window and a one-minute grace. It attempts to re-arm cleanup after storage failures; its replay ledger does not store the raw revised explanation. The verified sample is open to everyone, sends no learner input to GPT, and requires no confirmation.";

const LIVE_USE_CONFIRMATION =
  "I am 18 or older, or I have teacher or guardian authorization, and I will not include personal or identifying student information anywhere in this live attempt, including my revised explanation.";

const LIVE_REVISION_GUIDANCE =
  "Your live-use confirmation covers this entire attempt, including this revised explanation. Do not include names or personal or identifying student information. To prevent duplicate API charges, normalized feedback is scheduled for deletion after the authorization window and a one-minute grace. ModelDuel attempts to re-arm cleanup after storage failures. GPT feedback may be wrong; verify it with a teacher.";

function sessionReducer(
  state: SessionContainer,
  action: SessionAction,
): SessionContainer {
  const transition = reduceSession(state.value, action);
  return {
    value: transition.state,
    rejection: transition.accepted ? null : transition.reason,
  };
}

function nextTimestamp(clock: { current: number }) {
  const next = Math.max(Date.now(), clock.current + 1);
  clock.current = next;
  return next;
}

function humanError(error: unknown, fallback: string) {
  return error instanceof ModelDuelApiError || error instanceof Error
    ? error.message
    : fallback;
}

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function optionLabel(
  options: ReadonlyArray<Readonly<{ id: string; label: string }>>,
  optionId: string | null | undefined,
) {
  return options.find((option) => option.id === optionId)?.label ?? "Not recorded";
}

function formatReceipt(receiptId: string) {
  return receiptId.length > 24
    ? `${receiptId.slice(0, 12)}…${receiptId.slice(-8)}`
    : receiptId;
}

function traceObservationText(trace: NonNullable<ModelDuelSession["trace"]>) {
  const observation = trace.observation.scientific;
  return observation.scenario === "moon-phases"
    ? `${Math.round(observation.physicalObservation.illuminationFraction * 100)}% illuminated; Earth-shadow intersection: ${observation.physicalObservation.earthShadowIntersection}`
    : `Northern ${observation.physicalObservation.northernSeason}; Southern ${observation.physicalObservation.southernSeason}; relative incident energy ${observation.physicalObservation.northernEnergy.toFixed(2)} vs ${observation.physicalObservation.southernEnergy.toFixed(2)}`;
}

function SourceNotice({
  load,
  hadExplanation,
  hadSketch,
}: Readonly<{
  load: AnalysisLoad;
  hadExplanation: boolean;
  hadSketch: boolean;
}>) {
  const isLive = load.source === "live";
  const modelId = load.analysis.metadata.modelId ?? "model-id-unavailable";
  const analyzedInput = hadExplanation
    ? hadSketch
      ? "your typed explanation and attached sketch"
      : "your typed explanation"
    : hadSketch
      ? "your attached sketch"
      : "the submitted input";
  return (
    <aside className="source-notice">
      <span className={`source-badge ${isLive ? "live" : "verified"}`}>
        {isLive ? `Live analysis · ${modelId}` : "Verified authored sample"}
      </span>
      <p>{load.notice}</p>
      <p>
        {isLive
          ? `GPT-5.6 analyzed ${analyzedInput} and mapped it to this pilot's validated contrast. ModelDuel did not generate arbitrary physics or grading.`
          : "The verified sample did not analyze your typed explanation or sketch; they remain part of your local learning trace."}
      </p>
    </aside>
  );
}

function ExperienceProgress({
  activeStage,
  progressLabel,
}: Readonly<{
  activeStage: (typeof EXPERIENCE_STEPS)[number]["id"];
  progressLabel: string;
}>) {
  const activeIndex = stageIndex(activeStage);
  const activeStep = EXPERIENCE_STEPS[activeIndex] ?? EXPERIENCE_STEPS[0];
  return (
    <nav className="experience-progress" aria-label={progressLabel}>
      <ol>
        {EXPERIENCE_STEPS.map((step, index) => (
          <li
            key={step.id}
            className={index < activeIndex ? "complete" : index === activeIndex ? "active" : ""}
            aria-current={index === activeIndex ? "step" : undefined}
          >
            <span className="progress-dot" aria-hidden="true">
              {index < activeIndex ? "✓" : index + 1}
            </span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
      <p className="progress-current" aria-hidden="true">
        Step {activeIndex + 1} of {EXPERIENCE_STEPS.length} ·{" "}
        {activeStep.label}
      </p>
    </nav>
  );
}

export function ModelDuelExperience() {
  const [container, dispatch] = useReducer(
    sessionReducer,
    undefined,
    (): SessionContainer => ({
      value: createInitialSession(createStableId("session")),
      rejection: null,
    }),
  );
  const session = container.value;
  const clock = useRef(0);
  const attemptGeneration = useRef(0);
  const currentSessionId = useRef(session.sessionId);
  const activeTransports = useRef(new Map<string, TransportGuard>());
  const analysisPreparationActive = useRef(false);
  const sketchInputRef = useRef<HTMLInputElement>(null);
  const tracePreviewRef = useRef<HTMLTextAreaElement>(null);
  const hydrationReady = useHydrationReady();
  const [selectedScenarioId, setSelectedScenarioId] =
    useState<ScenarioId>("moon-phases");
  const activeScenarioId = session.scenarioId ?? selectedScenarioId;
  const scenarioContent = SCENARIO_CONTENT[activeScenarioId];
  const teacherListenFor = session.trace?.transfer.result.isCorrect
    ? scenarioContent.teacherListenForCorrect
    : scenarioContent.teacherListenForNeedsSupport;
  const [explanation, setExplanation] = useState<string>(
    SCENARIO_CONTENT["moon-phases"].sampleMisconception,
  );
  const [sketch, setSketch] = useState<Readonly<{ file: File; previewUrl: string }> | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [sketchError, setSketchError] = useState<string | null>(null);
  const [analysisLoad, setAnalysisLoad] = useState<AnalysisLoad | null>(null);
  const [analysisPending, setAnalysisPending] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisErrorCode, setAnalysisErrorCode] = useState<ApiErrorCode | null>(null);
  const [analysisErrorRetryable, setAnalysisErrorRetryable] =
    useState<boolean | null>(null);
  const [analysisAttempt, setAnalysisAttempt] = useState<
    "live" | "verified-sample" | null
  >(null);
  const [liveUseConfirmed, setLiveUseConfirmed] = useState(false);
  const [liveAnalysisRequest, setLiveAnalysisRequest] =
    useState<LiveAnalysisRequest | null>(null);
  const [observationReviewed, setObservationReviewed] = useState(false);
  const [revisionDraft, setRevisionDraft] = useState("");
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [revisionPending, setRevisionPending] = useState(false);
  const [revisionNotice, setRevisionNotice] = useState<string | null>(null);
  const [revisionResult, setRevisionResult] =
    useState<RevisionSubmissionResult | null>(null);
  const [transferPending, setTransferPending] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [traceExportConfirmed, setTraceExportConfirmed] = useState(false);
  const [traceHandoffStatus, setTraceHandoffStatus] = useState("");
  const [status, setStatus] = useState("");

  function beginTransport(
    kind: TransportKind,
    sessionId: string,
    requestId: string,
  ): TransportGuard | null {
    if (sessionId !== currentSessionId.current) return null;
    const key = `${kind}:${sessionId}`;
    if (activeTransports.current.has(key)) return null;
    const guard: TransportGuard = {
      key,
      generation: attemptGeneration.current,
      sessionId,
      requestId,
      controller: new AbortController(),
    };
    activeTransports.current.set(key, guard);
    return guard;
  }

  function isTransportCurrent(guard: TransportGuard) {
    const active = activeTransports.current.get(guard.key);
    return (
      !guard.controller.signal.aborted &&
      guard.generation === attemptGeneration.current &&
      guard.sessionId === currentSessionId.current &&
      active === guard &&
      active.requestId === guard.requestId
    );
  }

  function finishTransport(guard: TransportGuard) {
    if (activeTransports.current.get(guard.key) === guard) {
      activeTransports.current.delete(guard.key);
    }
  }

  function cancelPendingTransports() {
    attemptGeneration.current += 1;
    for (const guard of activeTransports.current.values()) {
      guard.controller.abort();
    }
    activeTransports.current.clear();
  }

  useEffect(() => {
    return () => {
      if (sketch) URL.revokeObjectURL(sketch.previewUrl);
    };
  }, [sketch]);

  useEffect(() => {
    const transports = activeTransports.current;
    const generation = attemptGeneration;
    return () => {
      generation.current += 1;
      for (const guard of transports.values()) {
        guard.controller.abort();
      }
      transports.clear();
    };
  }, []);

  const stage = experienceStageForSession(session.stage, observationReviewed);
  const analysis = session.analysis;
  const activeStep = stageIndex(stage);
  const comparison = session.comparison;
  const scenarioComparison =
    comparison?.learner.scenario === "moon-phases" &&
    comparison.scientific.scenario === "moon-phases"
      ? {
          scenario: "moon-phases" as const,
          learner: comparison.learner,
          scientific: comparison.scientific,
        }
      : comparison?.learner.scenario === "seasons" &&
          comparison.scientific.scenario === "seasons"
        ? {
            scenario: "seasons" as const,
            learner: comparison.learner,
            scientific: comparison.scientific,
          }
        : null;

  function handleSketch(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateSketchFile(file);
    if (validationError) {
      setSketch(null);
      setSketchError(validationError);
      event.target.value = "";
      return;
    }
    setSketchError(null);
    setSketch({ file, previewUrl: URL.createObjectURL(file) });
  }

  function clearSketchSelection() {
    if (sketchInputRef.current) {
      sketchInputRef.current.value = "";
    }
    setSketch(null);
    setSketchError(null);
  }

  async function requestValidatedChallenge(
    requestId: string,
    sessionId: string,
    scenarioId: ScenarioId,
  ) {
    const transport = beginTransport("analysis", sessionId, requestId);
    if (!transport) return;
    setAnalysisAttempt("verified-sample");
    setStatus(`Loading the validated ${SCENARIO_CONTENT[scenarioId].label} challenge.`);
    setAnalysisPending(true);
    setAnalysisError(null);
    setAnalysisErrorCode(null);
    setAnalysisErrorRetryable(null);

    try {
      const loaded = await loadVerifiedDemo(
        sessionId,
        scenarioId,
        fetch,
        transport.controller.signal,
      );
      if (!isTransportCurrent(transport)) return;
      setAnalysisLoad(loaded);
      dispatch({
        type: "RECEIVE_ANALYSIS",
        sessionId,
        requestId,
        analysis: loaded.analysis,
        receivedAt: nextTimestamp(clock),
      });
      setStatus("Verified challenge response passed to the protected session.");
    } catch (error) {
      if (!isTransportCurrent(transport) || isAbortError(error)) return;
      setAnalysisLoad(null);
      setAnalysisErrorCode(
        error instanceof ModelDuelApiError && error.code !== "INVALID_RESPONSE"
          ? error.code
          : null,
      );
      setAnalysisErrorRetryable(
        error instanceof ModelDuelApiError ? error.retryable : true,
      );
      setAnalysisError(
        humanError(error, "The validated authored challenge could not be loaded."),
      );
      setStatus("Authored challenge unavailable. No evidence or score was shown.");
    } finally {
      const isCurrent = isTransportCurrent(transport);
      finishTransport(transport);
      if (isCurrent) setAnalysisPending(false);
    }
  }

  async function requestLiveAnalysis(request: LiveAnalysisRequest) {
    const transport = beginTransport(
      "analysis",
      request.sessionId,
      request.requestId,
    );
    if (!transport) return;
    setAnalysisAttempt("live");
    setStatus("GPT-5.6 is analyzing the submitted explanation and sketch.");
    setAnalysisPending(true);
    setAnalysisError(null);
    setAnalysisErrorCode(null);
    setAnalysisErrorRetryable(null);

    try {
      const loaded = await analyzeSubmission(
        request,
        fetch,
        transport.controller.signal,
      );
      if (!isTransportCurrent(transport)) return;
      setAnalysisLoad(loaded);
      dispatch({
        type: "RECEIVE_ANALYSIS",
        sessionId: request.sessionId,
        requestId: request.requestId,
        analysis: loaded.analysis,
        receivedAt: nextTimestamp(clock),
      });
      setStatus("Live analysis response passed to the protected session.");
    } catch (error) {
      if (!isTransportCurrent(transport) || isAbortError(error)) return;
      const code =
        error instanceof ModelDuelApiError && error.code !== "INVALID_RESPONSE"
          ? error.code
          : null;
      setAnalysisLoad(null);
      setAnalysisErrorCode(code);
      setAnalysisErrorRetryable(
        error instanceof ModelDuelApiError ? error.retryable : true,
      );
      setAnalysisError(
        code === "CONFIGURATION_REQUIRED"
          ? "API key is not configured for live GPT-5.6 analysis. You can explicitly run the verified sample instead."
          : code === "UNSUPPORTED_MISCONCEPTION"
            ? `Your explanation is outside the ${SCENARIO_CONTENT[request.scenarioId].label} contrast this pilot can simulate. The confirmed live request already sent it once for GPT extraction with store: false; this page retains the review copy below, and no additional model call will run automatically.`
          : humanError(error, "The GPT-5.6 analysis could not be completed."),
      );
      setStatus(
        code === "UNSUPPORTED_MISCONCEPTION"
          ? "Explanation outside this pilot's validated scope. No evidence, score, or automatic retry was produced."
          : "Live analysis unavailable. No evidence or score was shown.",
      );
    } finally {
      const isCurrent = isTransportCurrent(transport);
      finishTransport(transport);
      if (isCurrent) setAnalysisPending(false);
    }
  }

  async function beginAnalysis(mode: "live" | "verified-sample") {
    if (!hydrationReady || analysisPending || analysisPreparationActive.current) {
      return;
    }
    if (mode === "live" && !liveUseConfirmed) {
      setStatus("Confirm the live GPT use boundary before submitting learner input.");
      return;
    }
    const selectedSketchError = sketch
      ? validateSketchFile(sketch.file)
      : null;
    if (selectedSketchError) {
      setSketchError(selectedSketchError);
      return;
    }
    setSketchError(null);
    const validationError = validateCaptureInput(
      explanation,
      Boolean(sketch),
      mode,
    );
    if (validationError) {
      setInputError(validationError);
      return;
    }
    setInputError(null);
    analysisPreparationActive.current = true;
    setAnalysisAttempt(mode);
    setAnalysisPending(true);
    const preparationGeneration = attemptGeneration.current;
    const preparationSessionId = session.sessionId;
    const preparationScenarioId = selectedScenarioId;

    let encodedSketch: LiveAnalysisRequest["sketch"] = null;
    if (mode === "live" && sketch) {
      try {
        encodedSketch = await fileToAnalyzeSketch(sketch.file);
        if (
          preparationGeneration !== attemptGeneration.current ||
          preparationSessionId !== currentSessionId.current
        ) {
          analysisPreparationActive.current = false;
          return;
        }
      } catch (error) {
        if (
          preparationGeneration !== attemptGeneration.current ||
          preparationSessionId !== currentSessionId.current ||
          isAbortError(error)
        ) {
          analysisPreparationActive.current = false;
          return;
        }
        setInputError(humanError(error, "The selected sketch could not be read."));
        setAnalysisPending(false);
        analysisPreparationActive.current = false;
        return;
      }
    }

    const submittedAt = nextTimestamp(clock);
    const sketchReference = sketch
      ? {
          id: createStableId("sketch"),
          mime: sketch.file.type.replace("image/", "") as "png" | "jpeg" | "webp",
          sizeBytes: sketch.file.size,
        }
      : undefined;
    const domainExplanation =
      mode === "verified-sample" && explanation.trim().length === 0 && !sketch
        ? VERIFIED_EMPTY_INPUT_TRACE
        : explanation;
    dispatch({
      type: "START_INPUT",
      scenarioId: preparationScenarioId,
      explanation: domainExplanation,
      sketchReference,
      submittedAt,
    });

    const requestId = createStableId("analysis");
    const analysisStartedAt = nextTimestamp(clock);
    dispatch({
      type: "BEGIN_ANALYSIS",
      sessionId: session.sessionId,
      requestId,
      startedAt: analysisStartedAt,
    });

    if (mode === "live") {
      const request: LiveAnalysisRequest = {
        schemaVersion: "1.0",
        requestId,
      sessionId: session.sessionId,
        requestedAt: analysisStartedAt,
        scenarioId: preparationScenarioId,
        liveUseAttestation: true,
        explanation: explanation.trim(),
        sketch: encodedSketch,
      };
      setLiveAnalysisRequest(request);
      analysisPreparationActive.current = false;
      await requestLiveAnalysis(request);
      return;
    }

    setLiveAnalysisRequest(null);
    analysisPreparationActive.current = false;
      await requestValidatedChallenge(
        requestId,
        session.sessionId,
        preparationScenarioId,
      );
  }

  async function handleCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await beginAnalysis("verified-sample");
  }

  function handleConfirmModels() {
    dispatch({ type: "CONFIRM_MODEL", confirmedAt: nextTimestamp(clock) });
    setStatus("Choose a prediction before any physical evidence is revealed.");
  }

  function handleLockPrediction() {
    if (!session.prediction) return;
    dispatch({ type: "LOCK_PREDICTION", lockedAt: nextTimestamp(clock) });
    void loadWorldComparison().catch(() => undefined);
    setStatus("Prediction locked. It can no longer be changed.");
  }

  function handleRevealEvidence() {
    dispatch({ type: "BEGIN_OBSERVATION", startedAt: nextTimestamp(clock) });
    dispatch({ type: "COMPLETE_OBSERVATION", completedAt: nextTimestamp(clock) });
    setObservationReviewed(false);
    setStatus(
      "Both models ran the same validated case. Verified evidence is now visible.",
    );
  }

  async function handleRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      revisionPending ||
      activeTransports.current.has(`revision:${session.sessionId}`)
    ) {
      return;
    }
    const validationError = validateRevision(revisionDraft);
    if (validationError) {
      setRevisionError(validationError);
      return;
    }
    const comparison = session.comparison;
    const revisionAnalysis = analysis;
    if (!comparison || !revisionAnalysis) return;
    if (revisionAnalysis.metadata.mode === "live" && !liveUseConfirmed) {
      setRevisionError(
        "The live-use confirmation must remain active for live revision feedback.",
      );
      return;
    }

    setRevisionError(null);
    setRevisionPending(true);
    setRevisionNotice(null);
    setRevisionResult(null);

    const withRevisionMode = (
      common: RevisionSubmissionCommon,
    ): RevisionSubmissionRequest => {
      if (revisionAnalysis.metadata.mode === "live") {
        return {
          ...common,
          mode: "live",
          liveUseAttestation: true,
          evaluationId: revisionAnalysis.transferQuestion.evaluationId,
        };
      }
      return {
        ...common,
        mode: "verified-sample",
        scenarioId: revisionAnalysis.scenarioId,
        caseFingerprint: comparison.caseFingerprint,
      };
    };

    let request: RevisionSubmissionRequest;
    if (session.revision && session.revisionEvaluationRequest) {
      request = withRevisionMode({
        ...session.revisionEvaluationRequest,
        sessionId: session.sessionId,
        revisionText: session.revision.text,
      });
    } else {
      const submittedAt = nextTimestamp(clock);
      dispatch({ type: "SUBMIT_REVISION", text: revisionDraft, submittedAt });
      const requestId = createStableId("revision");
      const idempotencyKey = createStableId("revision-key");
      const requestedAt = nextTimestamp(clock);
      dispatch({
        type: "BEGIN_REVISION_EVALUATION",
        sessionId: session.sessionId,
        requestId,
        idempotencyKey,
        requestedAt,
      });
      request = withRevisionMode({
        requestId,
        idempotencyKey,
        requestedAt,
        sessionId: session.sessionId,
        revisionText: revisionDraft.trim(),
      });
    }

    const transport = beginTransport(
      "revision",
      session.sessionId,
      request.requestId,
    );
    if (!transport) return;

    try {
      const result = await submitRevision(
        request,
        fetch,
        transport.controller.signal,
      );
      if (!isTransportCurrent(transport)) return;
      dispatch({
        type: "RECEIVE_REVISION_FEEDBACK",
        sessionId: session.sessionId,
        requestId: request.requestId,
        feedback: result.feedback,
        evaluatedAt: result.evaluatedAt,
      });
      clock.current = Math.max(clock.current, result.evaluatedAt);
      setRevisionNotice(result.notice);
      setRevisionResult(result);
      setStatus("Revision response received and passed to the protected session.");
    } catch (error) {
      if (!isTransportCurrent(transport) || isAbortError(error)) return;
      setRevisionError(humanError(error, "The revision could not be checked."));
      setStatus("Revision check failed. No AI feedback was invented.");
    } finally {
      const isCurrent = isTransportCurrent(transport);
      finishTransport(transport);
      if (isCurrent) setRevisionPending(false);
    }
  }

  async function handleTransfer() {
    if (
      transferPending ||
      activeTransports.current.has(`transfer:${session.sessionId}`)
    ) {
      return;
    }
    if (!analysis || !session.transfer) return;
    setTransferError(null);
    setTransferPending(true);

    let request: TransferEvaluationRequest;
    if (session.transferEvaluationRequest) {
      request = buildTransferRequest({
        ...session.transferEvaluationRequest,
        sessionId: session.sessionId,
        question: analysis.transferQuestion,
        selectedOptionId: session.transfer.optionId,
      });
    } else {
      const lockedAt = nextTimestamp(clock);
      dispatch({ type: "LOCK_TRANSFER", lockedAt });
      const requestId = createStableId("transfer");
      const idempotencyKey = createStableId("transfer-key");
      const requestedAt = nextTimestamp(clock);
      dispatch({
        type: "BEGIN_TRANSFER_EVALUATION",
        sessionId: session.sessionId,
        requestId,
        idempotencyKey,
        requestedAt,
      });
      request = buildTransferRequest({
        requestId,
        idempotencyKey,
        requestedAt,
        sessionId: session.sessionId,
        question: analysis.transferQuestion,
        selectedOptionId: session.transfer.optionId,
      });
    }

    const transport = beginTransport(
      "transfer",
      session.sessionId,
      request.requestId,
    );
    if (!transport) return;

    try {
      const result = await evaluateTransfer(
        request,
        fetch,
        transport.controller.signal,
      );
      if (!isTransportCurrent(transport)) return;
      dispatch({
        type: "RECEIVE_TRANSFER_RESULT",
        sessionId: session.sessionId,
        requestId: request.requestId,
        result,
      });
      clock.current = Math.max(clock.current, result.evaluatedAt);
      setStatus("Transfer response received and passed to the protected session.");
    } catch (error) {
      if (!isTransportCurrent(transport) || isAbortError(error)) return;
      setTransferError(humanError(error, "The transfer check could not be completed."));
      setStatus("Transfer check failed. No score was inferred in the browser.");
    } finally {
      const isCurrent = isTransportCurrent(transport);
      finishTransport(transport);
      if (isCurrent) setTransferPending(false);
    }
  }

  function resetExperience(
    nextScenarioId: ScenarioId,
    nextStatus = "New attempt ready.",
  ) {
    cancelPendingTransports();
    analysisPreparationActive.current = false;
    const newSessionId = createStableId("session");
    currentSessionId.current = newSessionId;
    dispatch({
      type: "RESTART",
      newSessionId,
      restartedAt: nextTimestamp(clock),
    });
    setSelectedScenarioId(nextScenarioId);
    setExplanation(SCENARIO_CONTENT[nextScenarioId].sampleMisconception);
    clearSketchSelection();
    setInputError(null);
    setAnalysisLoad(null);
    setAnalysisPending(false);
    setAnalysisError(null);
    setAnalysisErrorCode(null);
    setAnalysisErrorRetryable(null);
    setAnalysisAttempt(null);
    setLiveUseConfirmed(false);
    setLiveAnalysisRequest(null);
    setObservationReviewed(false);
    setRevisionDraft("");
    setRevisionError(null);
    setRevisionPending(false);
    setRevisionNotice(null);
    setRevisionResult(null);
    setTransferError(null);
    setTransferPending(false);
    setTraceExportConfirmed(false);
    setTraceHandoffStatus("");
    setStatus(nextStatus);
  }

  function handleReset() {
    resetExperience(activeScenarioId);
  }

  function currentTraceHandoff(): TraceHandoffContent | null {
    if (!session.trace || !analysis) return null;
    const feedbackSource =
      revisionResult?.source === "gpt-5.6"
        ? "GPT-5.6 structured feedback"
        : analysis.metadata.mode === "live"
          ? "GPT-5.6 structured feedback"
          : "Authored deterministic rubric · not AI-graded";
    return {
      scenario: scenarioContent.label,
      evidenceSource:
        analysis.metadata.mode === "live"
          ? "Live GPT-5.6 analysis"
          : "Verified authored sample · no learner input sent to GPT-5.6",
      initialBeliefLabel:
        session.trace.initialExplanation === VERIFIED_EMPTY_INPUT_TRACE
          ? "Initial input status"
          : "Initial belief",
      initialBelief: session.trace.initialExplanation,
      lockedPrediction: optionLabel(
        analysis.predictionQuestion.options,
        session.trace.prediction.optionId,
      ),
      observationLabel: scenarioContent.traceObservationLabel,
      observation: traceObservationText(session.trace),
      revisedExplanation: session.trace.revision.text,
      revisionFeedback: `${feedbackSource} · ${session.trace.revision.feedback.conceptualChange}`,
      transferResult: `${session.trace.transfer.result.isCorrect ? "Correct · 1/1" : "Not yet · 0/1"} · server-verified`,
      transferRationale: session.trace.transfer.result.rationale,
      teacherNextQuestion: scenarioContent.teacherNextQuestion,
      teacherListenFor,
    };
  }

  function currentTraceHandoffText() {
    const handoff = currentTraceHandoff();
    return handoff ? buildTraceHandoffText(handoff) : null;
  }

  async function handleCopyTrace() {
    if (!traceExportConfirmed) {
      const message = "Review and confirm the learner-text export boundary first.";
      setTraceHandoffStatus(message);
      setStatus(message);
      return;
    }
    const text = currentTraceHandoffText();
    if (!text) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      const message = "Teacher summary copied to the system clipboard. ModelDuel did not send it.";
      setTraceHandoffStatus(message);
    } catch {
      tracePreviewRef.current?.focus();
      tracePreviewRef.current?.select();
      const message = "Automatic copy is unavailable. The preview is selected; use your browser's Copy command.";
      setTraceHandoffStatus(message);
    }
  }

  function handleDownloadTrace() {
    if (!traceExportConfirmed) {
      const message = "Review and confirm the learner-text export boundary first.";
      setTraceHandoffStatus(message);
      setStatus(message);
      return;
    }
    const text = currentTraceHandoffText();
    if (!text) return;
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;
    try {
      const blob = new Blob([text], {
        type: "text/plain;charset=utf-8",
      });
      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.download = TRACE_HANDOFF_FILENAME;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      const message = "Trace downloaded locally. Review the learner text before sharing it.";
      setTraceHandoffStatus(message);
    } catch {
      const message = "The local trace download could not start. Nothing was uploaded.";
      setTraceHandoffStatus(message);
    } finally {
      link?.remove();
      const urlToRevoke = url;
      if (urlToRevoke) window.setTimeout(() => URL.revokeObjectURL(urlToRevoke), 1_000);
    }
  }

  const traceHandoffPreview = currentTraceHandoffText() ?? "";

  return (
    <>
      <header className="app-header">
        <a className="brand" href="#main-content" aria-label="ModelDuel challenge home">
          <span className="brand-mark" aria-hidden="true">
            <ModelDuelLogo className="brand-logo" />
          </span>
          <span className="brand-wordmark">{PRODUCT.name}</span>
        </a>
        <div className="header-meta">
        <span>Education · {scenarioContent.label}</span>
          {activeStep > 0 ? (
            <button type="button" className="quiet-button" onClick={handleReset}>
              New attempt
            </button>
          ) : null}
        </div>
      </header>

    <ExperienceProgress
      activeStage={stage}
      progressLabel={scenarioContent.progressLabel}
    />

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {container.rejection ? (
        <div className="protected-state-error" role="alert">
          <strong>Protected learning state stopped this action.</strong>
          <p>
            The transition was rejected ({container.rejection}). No later evidence or score
            was accepted. Start a new attempt to return to a known state.
          </p>
          <button type="button" className="quiet-button" onClick={handleReset}>
            Start a new attempt
          </button>
        </div>
      ) : null}

      <main id="main-content" className="experience-main">
        {stage === "capture" ? (
          <section className="capture-layout" aria-labelledby="capture-title">
            <div className="capture-copy">
              <div className="capture-copy-intro">
                <p className="eyebrow"><span aria-hidden="true" /> Evidence-led science learning</p>
                <h1 id="capture-title" aria-label={PRODUCT.tagline}>
                  <span>Two models predict.</span>
                  <span className="evidence-text">Evidence decides.</span>
                </h1>
              </div>
              <div className="capture-copy-support">
                <p className="hero-summary">{scenarioContent.heroSummary}</p>
                <button
                  className="primary-button full-button mobile-verified-cta"
                  type="button"
                  aria-label="Run verified sample"
                  data-testid="mobile-verified-cta"
                  data-hydrated={hydrationReady ? "true" : "false"}
                  disabled={!hydrationReady || analysisPending}
                  onClick={() => void beginAnalysis("verified-sample")}
                >
                  <span>Run verified sample <span aria-hidden="true">→</span></span>
                  <small>Instant {scenarioContent.label} challenge · no API wait</small>
                </button>
              </div>
              <DynamicHeroVisualizer />
              <ul className="promise-list">
                <li>Evidence stays hidden until you commit.</li>
                <li>Physical observation stays separate from model claims.</li>
                <li>Your final transfer result is checked only by the server.</li>
              </ul>
            </div>

            <form
              className="capture-card"
              onSubmit={handleCapture}
            noValidate
            aria-busy={analysisPending}
          >
            <fieldset className="scenario-selector" disabled={analysisPending}>
              <legend>Choose a science challenge</legend>
              {(["moon-phases", "seasons"] as const).map((scenarioId) => {
                const content = SCENARIO_CONTENT[scenarioId];
                return (
                  <label key={scenarioId}>
                    <input
                      type="radio"
                      name="scenario"
                      value={scenarioId}
                      checked={selectedScenarioId === scenarioId}
                      onChange={() =>
                        resetExperience(
                          scenarioId,
                          `${content.label} challenge ready.`,
                        )
                      }
                    />
                    <span>
                      <strong>{content.label}</strong>
                      <small>{content.topic}</small>
                    </span>
                  </label>
                );
              })}
            </fieldset>
              <div className="card-heading">
                <div>
                  <p className="micro-label">Verified experiment · step 1 of 7</p>
                <h2>{scenarioContent.capturePrompt}</h2>
                </div>
                <span className="sample-pill">Editable sample</span>
              </div>
              <div className="capture-actions capture-actions-verified">
                <button
                  className="primary-button full-button capture-card-verified-action"
                  type="submit"
                  disabled={!hydrationReady || analysisPending}
                  data-hydrated={hydrationReady ? "true" : "false"}
                >
                  {!hydrationReady
                    ? "Preparing challenge…"
                    : analysisPending && analysisAttempt === "verified-sample"
                      ? "Loading verified sample…"
                      : (
                          <>
                            <span>Run verified sample <span aria-hidden="true">→</span></span>
                            <small>Instant {scenarioContent.label} challenge · no API wait</small>
                          </>
                        )}
                </button>
              </div>
              <div className="live-analysis-divider" aria-hidden="true">
                <span>Optional live analysis</span>
              </div>
              <label htmlFor="learner-explanation">Your current explanation</label>
              <textarea
                id="learner-explanation"
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                rows={5}
                maxLength={1_500}
                aria-describedby={`explanation-help${inputError ? " explanation-error" : ""}`}
                aria-invalid={Boolean(inputError)}
              />
              <div className="field-meta" id="explanation-help">
                <span>
                  Live analysis needs a 20+ character explanation or a valid sketch.
                  Explanation is optional for the verified sample.
                </span>
                <span>{explanation.length}/1,500</span>
              </div>
              {inputError ? <p className="field-error" id="explanation-error">{inputError}</p> : null}

              <div className="sketch-field">
                <div>
                  <p className="sketch-heading">
                    Add a sketch <span>optional</span>
                  </p>
                  <p className="sketch-help" id="sketch-help">
                    PNG, JPEG, or WebP · up to 3 MB
                  </p>
                </div>
                <div className="sketch-upload-control">
                  <input
                    ref={sketchInputRef}
                    className="sketch-upload-input"
                    id="learner-sketch"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleSketch}
                    aria-describedby={`sketch-help${sketchError ? " sketch-error" : ""}`}
                    aria-invalid={Boolean(sketchError)}
                  />
                  <label className="sketch-upload-button" htmlFor="learner-sketch">
                    Choose sketch
                  </label>
                  <span className="sketch-upload-status" aria-live="polite">
                    {sketch?.file.name ?? "No sketch selected"}
                  </span>
                </div>
              </div>
              {sketchError ? <p className="field-error" id="sketch-error">{sketchError}</p> : null}
              {sketch ? (
                <div className="sketch-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img src={sketch.previewUrl} alt="Selected learner sketch preview" />
                  <div>
                    <strong>{sketch.file.name}</strong>
                    <span>
                      This local preview is uploaded only if you choose live GPT analysis.
                      The verified sample never uploads or analyzes it.
                    </span>
                    <button type="button" onClick={clearSketchSelection}>
                      Remove sketch
                    </button>
                  </div>
                </div>
              ) : null}

              <aside className="pilot-scope" aria-label="Live pilot scope">
                <strong>Validated comparison scope</strong>
                <p>{scenarioContent.livePilotScope}</p>
                <p>
                  If the explanation does not match this contrast, ModelDuel stops after
                  extraction, does not auto-retry, and offers the API-free verified sample.
                </p>
              </aside>

              <div className="live-use-boundary">
                <p id="live-use-disclosure">{LIVE_USE_DISCLOSURE}</p>
                <label>
                  <input
                    type="checkbox"
                    checked={liveUseConfirmed}
                    disabled={analysisPending}
                    aria-describedby="live-use-disclosure"
                    onChange={(event) => setLiveUseConfirmed(event.target.checked)}
                  />
                  <span>{LIVE_USE_CONFIRMATION}</span>
                </label>
              </div>

              <div className="capture-actions capture-actions-live">
                <button
                  className="secondary-button full-button"
                  type="button"
                  disabled={!hydrationReady || analysisPending || !liveUseConfirmed}
                  data-hydrated={hydrationReady ? "true" : "false"}
                  onClick={() => void beginAnalysis("live")}
                >
                  {analysisPending && analysisAttempt === "live"
                    ? "Analyzing with GPT-5.6…"
                    : (
                        <>
                          <span>Analyze with GPT-5.6</span>
                          <small>Live technical proof · about 20 seconds</small>
                        </>
                      )}
                </button>
              </div>
              <p className="form-disclosure">
                Live analysis uses your submitted text and optional sketch. The verified sample
                is an authored, API-free path and never claims to analyze your input.
              </p>
            </form>
          </section>
        ) : null}

        {stage === "interpret" ? (
          <section className="stage-shell" aria-labelledby="interpret-title">
            {analysisPending ? (
              <div className="loading-panel" role="status">
                <span className="loading-orbit" aria-hidden="true" />
                <p className="micro-label">
                  {analysisAttempt === "live"
                    ? "Live structured analysis"
                    : "Validating authored challenge contract"}
                </p>
                <h1 id="interpret-title">
                  {analysisAttempt === "live"
                    ? "Analyzing with GPT-5.6…"
                    : "Preparing two testable worlds…"}
                </h1>
                <p>No evidence or answer is revealed during this step.</p>
              </div>
            ) : analysisError || !analysis ? (
              <div className="challenge-error-panel" role="alert">
                <span className="error-orbit" aria-hidden="true">!</span>
                <p className="eyebrow">
                  {analysisErrorCode === "UNSUPPORTED_MISCONCEPTION"
                    ? "Outside this pilot's validated scope"
                    : analysisAttempt === "live"
                    ? "Live analysis unavailable"
                    : "Validated source required"}
                </p>
                <h1 id="interpret-title">
                  {analysisErrorCode === "CONFIGURATION_REQUIRED"
                    ? "API key is not configured"
                    : analysisErrorCode === "UNSUPPORTED_MISCONCEPTION"
                      ? "This pilot cannot compare that claim yet"
                    : analysisAttempt === "live"
                      ? "GPT-5.6 analysis unavailable"
                      : "Authored challenge unavailable"}
                </h1>
                <p>
                  {analysisError ??
                    "The challenge response could not be accepted by the protected session."}
                </p>
                {analysisErrorCode === "UNSUPPORTED_MISCONCEPTION" ? (
                  <>
                    <p>
                      No second model request was started. Review the page-local copy below;
                      choosing the validated sample does not send it to GPT again.
                    </p>
                    {session.input ? (
                      <aside
                        className="submitted-input-review"
                        aria-labelledby="submitted-input-review-title"
                        data-testid="submitted-input-review"
                      >
                        <h2 id="submitted-input-review-title">Input sent for the initial extraction</h2>
                        {session.input.explanation ? (
                          <blockquote>{session.input.explanation}</blockquote>
                        ) : (
                          <p>Text: none (sketch-only submission)</p>
                        )}
                        {sketch ? (
                          <div className="submitted-sketch-review">
                            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                            <img src={sketch.previewUrl} alt="Submitted learner sketch review" />
                            <span>{sketch.file.name}</span>
                          </div>
                        ) : (
                          <p>Sketch: none</p>
                        )}
                      </aside>
                    ) : null}
                  </>
                ) : (
                  <p>
                    No local sample was substituted. Evidence, revision feedback, transfer
                    scoring, and the final trace remain unavailable.
                  </p>
                )}
                <div className="error-actions">
                  {analysisAttempt === "live" ? (
                    <>
                      {analysisErrorRetryable ? (
                        <button
                          className="primary-button"
                          type="button"
                          disabled={analysisPending || !liveAnalysisRequest}
                          onClick={() => {
                            if (liveAnalysisRequest) void requestLiveAnalysis(liveAnalysisRequest);
                          }}
                        >
                          Retry GPT-5.6 analysis
                        </button>
                      ) : null}
                      <button
                        className={analysisErrorRetryable ? "secondary-button" : "primary-button"}
                        type="button"
                        disabled={
                          analysisPending ||
                          !session.analysisRequestId ||
                          !session.scenarioId
                        }
                        onClick={() => {
                          if (session.analysisRequestId && session.scenarioId) {
                            setLiveAnalysisRequest(null);
                            void requestValidatedChallenge(
                              session.analysisRequestId,
                              session.sessionId,
                              session.scenarioId,
                            );
                          }
                        }}
                      >
                        Run verified sample instead
                      </button>
                    </>
                  ) : (
                    <button
                      className="primary-button"
                      type="button"
                      disabled={
                        analysisPending ||
                        !session.analysisRequestId ||
                        !session.scenarioId
                      }
                      onClick={() => {
                        if (session.analysisRequestId && session.scenarioId) {
                          void requestValidatedChallenge(
                            session.analysisRequestId,
                            session.sessionId,
                            session.scenarioId,
                          );
                        }
                      }}
                    >
                      Retry validated challenge
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <header className="stage-heading-block">
                  <p className="eyebrow">
                    Interpret · {analysisLoad?.source === "live" ? "live analysis" : "authored challenge"}
                  </p>
                  <h1 id="interpret-title">Turn one disagreement into a fair test.</h1>
                  <p>{scenarioContent.interpretSummary}</p>
                </header>
                {analysisLoad ? (
                  <SourceNotice
                    load={analysisLoad}
                    hadExplanation={explanation.trim().length > 0}
                    hadSketch={Boolean(session.input?.sketchReference)}
                  />
                ) : null}
                <div className="model-review-grid">
                  <article>
                    <span className="world-letter">A</span>
                    <p className="micro-label">
                      {analysisLoad?.source === "live"
                        ? "Interpreted learner model"
                        : "Authored learner model"}
                    </p>
                    <h2>{analysis.learnerModel.summary}</h2>
                    <ul>
                      {analysis.learnerModel.causalRelations.map((relation) => (
                        <li key={`${relation.subject}-${relation.relation}-${relation.object}`}>
                          {formatCausalRelation(relation)}
                        </li>
                      ))}
                    </ul>
                  </article>
                  <div className="versus-chip" aria-hidden="true">
                    <span>Same test</span>
                  </div>
                  <article className="science-card">
                    <span className="world-letter">B</span>
                    <p className="micro-label">Scientific challenger</p>
                  <h2>{scenarioContent.scientificTitle}</h2>
                  <ul>
                    {scenarioContent.scientificBullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                  </article>
                </div>
                <div className="stage-action-row">
                  <p><strong>Still hidden:</strong> {scenarioContent.hiddenEvidenceCopy}</p>
                  <button className="primary-button" type="button" onClick={handleConfirmModels}>
                    Make a prediction <span aria-hidden="true">→</span>
                  </button>
                </div>
              </>
            )}
          </section>
        ) : null}

        {stage === "predict" && analysis ? (
          <section className="narrow-stage" aria-labelledby="predict-title">
            <header className="stage-heading-block">
              <p className="eyebrow">Predict · evidence sealed</p>
              <h1 id="predict-title">Commit before you observe.</h1>
              <p>{analysis.predictionQuestion.prompt}</p>
            </header>
            <div className="sealed-banner" data-testid="evidence-sealed">
              <span aria-hidden="true">◇</span>
              Verified evidence is sealed until your choice is locked.
            </div>
            <fieldset className="option-list">
              <legend>Choose one prediction</legend>
              {analysis.predictionQuestion.options.map((option, index) => (
                <label key={option.id}>
                  <input
                    type="radio"
                    name="prediction"
                    value={option.id}
                    checked={session.prediction?.optionId === option.id}
                    onChange={() =>
                      dispatch({
                        type: "SELECT_PREDICTION",
                        optionId: option.id,
                        selectedAt: nextTimestamp(clock),
                      })
                    }
                  />
                  <span className="option-index" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            <div className="stage-action-row">
              <p>Your selection cannot be changed after locking.</p>
              <button
                className="primary-button"
                type="button"
                disabled={!session.prediction}
                onClick={handleLockPrediction}
              >
                Lock prediction <span aria-hidden="true">↗</span>
              </button>
            </div>
          </section>
        ) : null}

        {stage === "observe" && analysis ? (
          <section className="stage-shell observe-stage" aria-labelledby="observe-title">
            <header className="stage-heading-block compact">
              <p className="eyebrow">Observe · same case, two predictions</p>
              <h1 id="observe-title">
                {scenarioComparison
                  ? "Evidence is now visible."
                  : "Your prediction is locked."}
              </h1>
              <p>
                Locked choice:{" "}
                <strong>
                  {optionLabel(
                    analysis.predictionQuestion.options,
                    session.prediction?.optionId,
                  )}
                </strong>
              </p>
            </header>
            {!scenarioComparison ? (
              <div className="sealed-observation">
                <div className="sealed-worlds" aria-hidden="true">
                  <span>A</span><i>VS</i><span>B</span>
                </div>
                <h2>Prediction locked. Ready to run both worlds.</h2>
                <p>{scenarioContent.sealedCaseCopy}</p>
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleRevealEvidence}
                  disabled={session.stage !== "PREDICTION_LOCKED"}
                >
                  Run both worlds and reveal evidence
                </button>
              </div>
            ) : analysis.caseSpec.scenario === scenarioComparison.scenario ? (
              <>
                {analysis.caseSpec.scenario === "moon-phases" &&
                scenarioComparison.scenario === "moon-phases" ? (
                  <ResilientWorldComparison
                    scenario="moon-phases"
                    caseSpec={analysis.caseSpec}
                    learner={scenarioComparison.learner}
                    scientific={scenarioComparison.scientific}
                  />
                ) : analysis.caseSpec.scenario === "seasons" &&
                  scenarioComparison.scenario === "seasons" ? (
                  <ResilientWorldComparison
                    scenario="seasons"
                    caseSpec={analysis.caseSpec}
                    learner={scenarioComparison.learner}
                    scientific={scenarioComparison.scientific}
                  />
                ) : null}
                <div className="stage-action-row">
                  <p>Observation recorded. Your locked prediction remains unchanged.</p>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      setObservationReviewed(true);
                      setStatus(
                        "Use the verified observation to revise your causal explanation.",
                      );
                    }}
                  >
                    Revise my explanation <span aria-hidden="true">→</span>
                  </button>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {stage === "revise" &&
        analysis &&
        scenarioComparison &&
        analysis.caseSpec.scenario === scenarioComparison.scenario ? (
          <section className="revision-layout" aria-labelledby="revise-title">
            <aside className="evidence-brief">
              <p className="micro-label">Evidence to explain</p>
              {scenarioComparison.scenario === "moon-phases" &&
              analysis.caseSpec.scenario === "moon-phases" ? (
                <>
                  <h2>
                    {Math.round(
                      scenarioComparison.scientific.physicalObservation
                        .illuminationFraction * 100,
                    )}
                    % illuminated
                  </h2>
                  <dl>
                    <div>
                      <dt>Earth-shadow intersection</dt>
                      <dd>
                        {
                          scenarioComparison.scientific.physicalObservation
                            .earthShadowIntersection
                        }
                      </dd>
                    </div>
                    <div>
                      <dt>Elongation</dt>
                      <dd>{analysis.caseSpec.elongationDeg}°</dd>
                    </div>
                    <div>
                      <dt>Your locked prediction</dt>
                      <dd>
                        {optionLabel(
                          analysis.predictionQuestion.options,
                          session.prediction?.optionId,
                        )}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : scenarioComparison.scenario === "seasons" &&
                analysis.caseSpec.scenario === "seasons" ? (
                <>
                  <h2>
                    North {scenarioComparison.scientific.physicalObservation.northernSeason}
                    {" · "}South{" "}
                    {scenarioComparison.scientific.physicalObservation.southernSeason}
                  </h2>
                  <dl>
                    <div>
                      <dt>Solar declination</dt>
                      <dd>
                        {scenarioComparison.scientific.physicalObservation.solarDeclinationDeg.toFixed(
                          2,
                        )}
                        °
                      </dd>
                    </div>
                    <div>
                      <dt>Relative incident energy</dt>
                      <dd>
                        North{" "}
                        {scenarioComparison.scientific.physicalObservation.northernEnergy.toFixed(
                          2,
                        )}
                        ; South{" "}
                        {scenarioComparison.scientific.physicalObservation.southernEnergy.toFixed(
                          2,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Your locked prediction</dt>
                      <dd>
                        {optionLabel(
                          analysis.predictionQuestion.options,
                          session.prediction?.optionId,
                        )}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : null}
              <p>These values are the verified observation, not either model&apos;s claim.</p>
            </aside>
            <form className="revision-card" onSubmit={handleRevision} noValidate>
              <p className="eyebrow">Revise · explain the evidence</p>
              <h1 id="revise-title">What changed in your explanation?</h1>
              <p>
                {analysis.metadata.mode === "live"
                  ? "Connect a cause to the observation. GPT-5.6 will return schema-validated conceptual feedback; no authored score is substituted if it fails."
                  : "Connect a cause to the observation. The check below uses a transparent, authored rubric—it is not GPT-5.6 grading."}
              </p>
              {analysis.metadata.mode === "live" ? (
                <p className="live-revision-guidance" id="live-revision-guidance">
                  {LIVE_REVISION_GUIDANCE}
                </p>
              ) : null}
              <label htmlFor="revision-text">Revised causal explanation</label>
              <textarea
                id="revision-text"
                rows={7}
                value={revisionDraft}
                onChange={(event) => setRevisionDraft(event.target.value)}
                maxLength={1_500}
                disabled={Boolean(session.revision)}
                aria-describedby={`${analysis.metadata.mode === "live" ? "live-revision-guidance " : ""}revision-help${revisionError ? " revision-error" : ""}`}
                aria-invalid={Boolean(revisionError)}
                  placeholder={scenarioContent.revisionPlaceholder}
              />
              <div className="field-meta" id="revision-help">
                <span>Use evidence plus causal language such as “because” or “therefore.”</span>
                <span>{revisionDraft.length}/1,500</span>
              </div>
              {revisionError ? <div className="api-error" id="revision-error" role="alert"><strong>Revision not advanced</strong><p>{revisionError}</p><p>No AI feedback was invented.</p></div> : null}
              {revisionNotice ? <p className="rubric-notice">{revisionNotice}</p> : null}
              <button
                className="primary-button full-button"
                type="submit"
                disabled={revisionPending}
              >
                {revisionPending
                  ? analysis.metadata.mode === "live"
                    ? "Checking with GPT-5.6…"
                    : "Checking authored rubric…"
                  : session.revision
                    ? analysis.metadata.mode === "live"
                      ? "Retry GPT-5.6 feedback"
                      : "Retry authored rubric"
                    : "Capture revision and continue"}
              </button>
            </form>
          </section>
        ) : null}

        {stage === "transfer" && analysis ? (
          <section className="narrow-stage" aria-labelledby="transfer-title">
            <header className="stage-heading-block">
                <p className="eyebrow">{scenarioContent.transferEyebrow}</p>
              <h1 id="transfer-title">Can your revised model travel?</h1>
              <p>{analysis.transferQuestion.prompt}</p>
            </header>
            <div className="server-check-banner">
              <span aria-hidden="true">⌁</span>
              <div><strong>Server-verified result</strong><p>The answer key is not shipped to this browser. No local fallback grading is allowed.</p></div>
            </div>
            <fieldset className="option-list">
              <legend>Choose one transfer answer</legend>
              {analysis.transferQuestion.options.map((option, index) => (
                <label key={option.id} className={session.transferEvaluationRequest ? "locked" : ""}>
                  <input
                    type="radio"
                    name="transfer"
                    value={option.id}
                    checked={session.transfer?.optionId === option.id}
                    disabled={Boolean(session.transferEvaluationRequest)}
                    onChange={() =>
                      dispatch({
                        type: "SELECT_TRANSFER",
                        optionId: option.id,
                        selectedAt: nextTimestamp(clock),
                      })
                    }
                  />
                  <span className="option-index" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            {transferError ? (
              <div className="api-error" role="alert" data-testid="transfer-error">
                <strong>Server check unavailable</strong>
                <p>{transferError}</p>
                <p>No score was inferred in the browser. Your locked choice remains unchanged.</p>
              </div>
            ) : null}
            <div className="stage-action-row">
              <p>{session.transferEvaluationRequest ? "Choice locked for this request." : "This choice locks when sent."}</p>
              <button
                className="primary-button"
                type="button"
                disabled={!session.transfer || transferPending}
                onClick={handleTransfer}
              >
                {transferPending
                  ? "Checking with server…"
                  : session.transferEvaluationRequest
                    ? "Retry server check"
                    : "Lock and check answer"}
              </button>
            </div>
          </section>
        ) : null}

        {stage === "trace" && session.trace && analysis ? (
          <section className="trace-stage" aria-labelledby="trace-title" data-testid="revision-trace">
            <header className="trace-hero">
              <div className={`result-orb ${session.trace.transfer.result.isCorrect ? "correct" : "incorrect"}`}>
                <span>{session.trace.transfer.result.isCorrect ? "✓" : "↻"}</span>
              </div>
              <span className={`source-badge trace-source ${analysis.metadata.mode === "live" ? "live" : "verified"}`}>
                {analysis.metadata.mode === "live"
                  ? `Live analysis · ${analysis.metadata.modelId}`
                  : "Verified authored sample"}
              </span>
              <p className="eyebrow">Model Revision Trace · complete</p>
              <h1 id="trace-title">
                {getTraceHeroCopy(
                  session.trace.revision.feedback.conceptualChange,
                  session.trace.transfer.result.isCorrect,
                )}
              </h1>
              <p>{session.trace.transfer.result.rationale}</p>
              {analysisLoad ? <p className="trace-source-notice">{analysisLoad.notice}</p> : null}
            </header>

            <section className="trace-review-summary" aria-labelledby="trace-review-title">
              <div className="trace-review-heading">
                <p className="micro-label">Same-session teacher review</p>
                <h2 id="trace-review-title">Review what changed—not just whether the answer was right.</h2>
                <p>
                  One compact view connects the learner&apos;s claim, committed prediction,
                  physical evidence, revised explanation, and result on an unseen case.
                </p>
              </div>
              <div className="trace-review-grid">
                <article>
                  <span>Before</span>
                  <strong>{session.trace.initialExplanation}</strong>
                  <p>{optionLabel(analysis.predictionQuestion.options, session.trace.prediction.optionId)}</p>
                </article>
                <article>
                  <span>Evidence → revision</span>
                  <strong>{traceObservationText(session.trace)}</strong>
                  <p>{session.trace.revision.text}</p>
                </article>
                <article>
                  <span>Unseen transfer</span>
                  <strong>{session.trace.transfer.result.isCorrect ? "Correct · 1/1" : "Not yet · 0/1"}</strong>
                  <p>{session.trace.transfer.result.rationale}</p>
                </article>
              </div>
              <section
                className="teacher-debrief"
                aria-labelledby="teacher-debrief-title"
                data-testid="teacher-debrief"
              >
                <p className="micro-label">Teacher discussion cue · authored</p>
                <h2 id="teacher-debrief-title">Keep the discussion on the evidence.</h2>
                <div className="teacher-debrief-grid">
                  <article>
                    <h3>Teacher&apos;s next question</h3>
                    <p>{scenarioContent.teacherNextQuestion}</p>
                  </article>
                  <article>
                    <h3>Listen for</h3>
                    <p>{teacherListenFor}</p>
                  </article>
                </div>
              </section>
              <p className="trace-review-limit">
                This documents one completed attempt—not a grade, a longitudinal record, or proof
                of durable learning.
              </p>
            </section>

            <aside
              className="trace-handoff"
              aria-labelledby="trace-handoff-title"
              data-testid="trace-handoff"
            >
              <div className="trace-handoff-heading">
                <p className="micro-label">Teacher discussion handoff · learner controlled</p>
                <h2 id="trace-handoff-title">Let the learner choose what leaves this browser.</h2>
                <p id="trace-handoff-boundary">
                  This preview is created only in this browser. It contains the learner&apos;s
                  explanations, so review it before copying or downloading. Copy writes to the
                  system clipboard, which the operating system or device policy may retain or
                  sync. ModelDuel does not send the handoff or create a server-side record; it
                  remains in this active page until reset, reload, or page close. A downloaded file
                  may remain on the browser or device. The editable text is a conversation aid,
                  not a signed, tamper-proof, or teacher-authenticated record.
                </p>
              </div>
              <textarea
                ref={tracePreviewRef}
                className="trace-handoff-preview"
                aria-label="Teacher handoff preview"
                aria-describedby="trace-handoff-boundary"
                readOnly
                rows={8}
                value={traceHandoffPreview}
              />
              <fieldset className="trace-handoff-controls" aria-describedby="trace-handoff-boundary">
                <legend className="sr-only">Teacher handoff controls</legend>
                <label className="trace-export-confirmation">
                  <input
                    type="checkbox"
                    aria-describedby="trace-handoff-boundary"
                    checked={traceExportConfirmed}
                    onChange={(event) => {
                      setTraceExportConfirmed(event.target.checked);
                      setTraceHandoffStatus("");
                    }}
                  />
                  <span>I reviewed the learner-written text and want to include it in a clipboard copy or local download.</span>
                </label>
                <div className="trace-handoff-actions">
                  <button
                    className="primary-button"
                    type="button"
                    data-testid="copy-trace"
                    disabled={!traceExportConfirmed}
                    aria-describedby="trace-handoff-boundary"
                    onClick={handleCopyTrace}
                  >
                    Copy teacher summary
                  </button>
                  <button
                    className="quiet-button"
                    type="button"
                    data-testid="download-trace"
                    disabled={!traceExportConfirmed}
                    aria-describedby="trace-handoff-boundary"
                    onClick={handleDownloadTrace}
                  >
                    Download learner-controlled trace (.txt)
                  </button>
                </div>
                <p className="trace-handoff-status" role="status" aria-live="polite">
                  {traceHandoffStatus}
                </p>
              </fieldset>
            </aside>

            <ol className="trace-list">
              <li>
                <span className="trace-number">01</span>
                <div>
                  <p>
                    {session.trace.initialExplanation === VERIFIED_EMPTY_INPUT_TRACE
                      ? "Initial input status"
                      : "Initial belief"}
                  </p>
                  <h2>{session.trace.initialExplanation}</h2>
                </div>
              </li>
              <li>
                <span className="trace-number">02</span>
                <div><p>Locked prediction</p><h2>{optionLabel(analysis.predictionQuestion.options, session.trace.prediction.optionId)}</h2></div>
              </li>
              <li>
                <span className="trace-number">03</span>
                <div><p>{scenarioContent.traceObservationLabel}</p><h2>{traceObservationText(session.trace)}</h2></div>
              </li>
              <li>
                <span className="trace-number">04</span>
                <div>
                  <p>Revised explanation</p><h2>{session.trace.revision.text}</h2>
                  <span className="trace-note">
                    {revisionResult?.source === "gpt-5.6"
                      ? `GPT-5.6 structured feedback · ${revisionResult.modelId}`
                      : analysis.metadata.mode === "live"
                        ? `GPT-5.6 structured feedback · ${analysis.metadata.modelId}`
                        : "Authored deterministic rubric · not AI-graded"}
                    {` · ${session.trace.revision.feedback.conceptualChange}`}
                  </span>
                  {revisionNotice ? <span className="trace-note">{revisionNotice}</span> : null}
                </div>
              </li>
              <li>
                <span className="trace-number">05</span>
                <div>
                  <p>Transfer result</p>
                  <h2>{session.trace.transfer.result.isCorrect ? "Correct · 1/1" : "Not yet · 0/1"}</h2>
                  <span className="trace-note">Server-private answer key · verified by {session.trace.transfer.result.source} · receipt {formatReceipt(session.trace.transfer.result.receiptId)}</span>
                </div>
              </li>
            </ol>

            <div className="trace-footer">
              <div><p className="micro-label">Auditable conceptual-revision evidence</p><strong>A belief, prediction, observation, revision, and unseen transfer case are connected in one reviewable learning trail.</strong></div>
              <button className="quiet-button" type="button" onClick={handleReset}>Start a new attempt</button>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="app-footer">
        <span>{PRODUCT.name}</span>
        <p>Two models predict. Evidence decides.</p>
        <span>Built with Codex · GPT-5.6 live analysis · verified sample available</span>
      </footer>
    </>
  );
}
