import { describe, expect, it } from "vitest";

import * as domain from "./index";
import {
  ASTRONOMY_CONSTANTS_KM,
  AnalysisResultSchema,
  MOON_HERO_SAMPLE,
  RevisionTraceSchema,
  SEASONS_SAMPLE,
  SESSION_STAGE_SEQUENCE,
  TransferResultSchema,
  WorldSpecSchema,
  createCaseFingerprint,
  createInitialSession,
  moonIlluminationFraction,
  reduceSession,
  simulateWorld,
  solarDeclinationDeg,
} from "./index";
import type {
  ModelDuelSession,
  MoonSimulationObservation,
  RevisionFeedback,
  RevisionTrace,
  SeasonsSimulationObservation,
  SessionAction,
  SimulationObservation,
} from "./index";

const SESSION_ID = "session-a";
const REQUEST_ID = "request-a";
const EXPLANATION = "Earth's shadow causes the Moon's phases.";
const SKETCH = { id: "sketch-a", mime: "png", sizeBytes: 24_000 };
const REVISION_TEXT =
  "We see half because our viewing angle exposes half of the illuminated side.";
const FEEDBACK: RevisionFeedback = {
  conceptualChange: "revised",
  score: 1,
  summary: "The revision now uses illumination and viewing angle.",
  strengths: ["Connects phase to the visible illuminated hemisphere."],
  nextStep: "Apply the same geometry to a new Moon.",
};

function accept(
  state: ModelDuelSession,
  action: SessionAction,
): ModelDuelSession {
  const transition = reduceSession(state, action);
  if (!transition.accepted) {
    throw new Error(`Expected ${action.type} to be accepted: ${transition.reason}`);
  }
  return transition.state;
}

function requireMoon(
  observation: SimulationObservation,
): MoonSimulationObservation {
  if (observation.scenario !== "moon-phases") {
    throw new Error("Expected a Moon observation");
  }
  return observation;
}

function requireSeasons(
  observation: SimulationObservation,
): SeasonsSimulationObservation {
  if (observation.scenario !== "seasons") {
    throw new Error("Expected a seasons observation");
  }
  return observation;
}

function requireTrace(state: ModelDuelSession): RevisionTrace {
  if (state.trace === null) throw new Error("Expected a revision trace");
  return state.trace;
}

function reachInput(): ModelDuelSession {
  return accept(createInitialSession(SESSION_ID), {
    type: "START_INPUT",
    scenarioId: "moon-phases",
    explanation: EXPLANATION,
    submittedAt: 1,
  });
}

function reachAnalyzing(): ModelDuelSession {
  return accept(reachInput(), {
    type: "BEGIN_ANALYSIS",
    sessionId: SESSION_ID,
    requestId: REQUEST_ID,
    startedAt: 2,
  });
}

function reachPredictionOpen(): ModelDuelSession {
  let state = accept(reachAnalyzing(), {
    type: "RECEIVE_ANALYSIS",
    sessionId: SESSION_ID,
    requestId: REQUEST_ID,
    analysis: MOON_HERO_SAMPLE,
    receivedAt: 3,
  });
  state = accept(state, { type: "CONFIRM_MODEL", confirmedAt: 4 });
  return state;
}

function reachPredictionLocked(): ModelDuelSession {
  let state = accept(reachPredictionOpen(), {
    type: "SELECT_PREDICTION",
    optionId: "shadow-masks-half",
    selectedAt: 5,
  });
  state = accept(state, { type: "LOCK_PREDICTION", lockedAt: 6 });
  return state;
}

function reachRevision(): ModelDuelSession {
  let state = accept(reachPredictionLocked(), {
    type: "BEGIN_OBSERVATION",
    startedAt: 7,
  });
  state = accept(state, { type: "COMPLETE_OBSERVATION", completedAt: 8 });
  return state;
}

function reachRevisionSubmitted(): ModelDuelSession {
  return accept(reachRevision(), {
    type: "SUBMIT_REVISION",
    text: REVISION_TEXT,
    submittedAt: 9,
  });
}

function reachRevisionPending(): ModelDuelSession {
  return accept(reachRevisionSubmitted(), {
    type: "BEGIN_REVISION_EVALUATION",
    sessionId: SESSION_ID,
    requestId: "revision-request-a",
    idempotencyKey: "revision-key-a",
    requestedAt: 10,
  });
}

function reachTransferOpen(): ModelDuelSession {
  return accept(reachRevisionPending(), {
    type: "RECEIVE_REVISION_FEEDBACK",
    sessionId: SESSION_ID,
    requestId: "revision-request-a",
    feedback: FEEDBACK,
    evaluatedAt: 11,
  });
}

function reachTransferLocked(optionId = "toward-sun"): ModelDuelSession {
  let state = accept(reachTransferOpen(), {
    type: "SELECT_TRANSFER",
    optionId,
    selectedAt: 12,
  });
  state = accept(state, { type: "LOCK_TRANSFER", lockedAt: 13 });
  return state;
}

function createTransferReceipt(
  optionId = "toward-sun",
  isCorrect = true,
  evaluatedAt = 15,
) {
  return {
    receiptId: "transfer-receipt-a",
    evaluationId: MOON_HERO_SAMPLE.transferQuestion.evaluationId,
    questionId: MOON_HERO_SAMPLE.transferQuestion.questionId,
    questionVersion: MOON_HERO_SAMPLE.transferQuestion.version,
    selectedOptionId: optionId,
    isCorrect,
    score: isCorrect ? 1 : 0,
    rationale: "Receipt contract fixture.",
    evaluatedAt,
    source: "deterministic-question-bank",
  };
}

function reachTransferPending(optionId = "toward-sun"): ModelDuelSession {
  return accept(reachTransferLocked(optionId), {
    type: "BEGIN_TRANSFER_EVALUATION",
    sessionId: SESSION_ID,
    requestId: "transfer-request-a",
    idempotencyKey: "transfer-key-a",
    requestedAt: 14,
  });
}

function reachTrace(
  optionId = "toward-sun",
  isCorrect = true,
): ModelDuelSession {
  return accept(reachTransferPending(optionId), {
    type: "RECEIVE_TRANSFER_RESULT",
    sessionId: SESSION_ID,
    requestId: "transfer-request-a",
    result: createTransferReceipt(optionId, isCorrect),
  });
}

describe("strict schemas and evaluation receipt contracts", () => {
  it("rejects a body outside the allow-list", () => {
    const result = WorldSpecSchema.safeParse({
      ...MOON_HERO_SAMPLE.scientificWorld,
      bodies: ["sun", "earth", "mars"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects executable or unknown WorldSpec keys", () => {
    const result = WorldSpecSchema.safeParse({
      ...MOON_HERO_SAMPLE.scientificWorld,
      executableCode: "alert('not allowed')",
    });
    expect(result.success).toBe(false);
  });

  it("rejects NaN", () => {
    const result = WorldSpecSchema.safeParse({
      ...SEASONS_SAMPLE.scientificWorld,
      parameters: { axialTiltDeg: Number.NaN },
    });
    expect(result.success).toBe(false);
  });

  it("rejects out-of-range physical parameters", () => {
    const result = WorldSpecSchema.safeParse({
      ...SEASONS_SAMPLE.scientificWorld,
      parameters: { axialTiltDeg: 31 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects cross-scenario body sets", () => {
    const result = WorldSpecSchema.safeParse({
      ...SEASONS_SAMPLE.scientificWorld,
      bodies: ["sun", "earth", "moon"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects cross-scenario claims", () => {
    const result = WorldSpecSchema.safeParse({
      ...MOON_HERO_SAMPLE.learnerWorld,
      claims: { distanceCausesSeasons: true },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a scientific world that asserts the Moon misconception", () => {
    const result = WorldSpecSchema.safeParse({
      ...MOON_HERO_SAMPLE.scientificWorld,
      claims: { earthShadowCausesPhases: true },
      parameters: { assumedShadowMaskFraction: 0.5 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a scientific world that asserts the seasons misconception", () => {
    const result = WorldSpecSchema.safeParse({
      ...SEASONS_SAMPLE.scientificWorld,
      claims: { distanceCausesSeasons: true },
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate option IDs", () => {
    const duplicate = MOON_HERO_SAMPLE.predictionQuestion.options[0];
    const result = AnalysisResultSchema.safeParse({
      ...MOON_HERO_SAMPLE,
      predictionQuestion: {
        ...MOON_HERO_SAMPLE.predictionQuestion,
        options: [duplicate, duplicate],
      },
    });
    expect(result.success).toBe(false);
  });

  it("keeps public transfer options free of answer-key fields", () => {
    for (const option of MOON_HERO_SAMPLE.transferQuestion.options) {
      expect("isCorrect" in option).toBe(false);
      expect("score" in option).toBe(false);
      expect("rationale" in option).toBe(false);
    }
    expect("transferEvaluation" in MOON_HERO_SAMPLE).toBe(false);
    expect("rationale" in MOON_HERO_SAMPLE.transferQuestion).toBe(false);
    expect(JSON.stringify(MOON_HERO_SAMPLE)).not.toContain("correctOptionId");
    expect("TransferEvaluationSchema" in domain).toBe(false);
  });

  it("rejects a Moon analysis classified with the seasons misconception", () => {
    const result = AnalysisResultSchema.safeParse({
      ...MOON_HERO_SAMPLE,
      learnerModel: {
        ...MOON_HERO_SAMPLE.learnerModel,
        misconceptionType: "distance-causes-seasons",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a seasons analysis classified with the Moon misconception", () => {
    const result = AnalysisResultSchema.safeParse({
      ...SEASONS_SAMPLE,
      learnerModel: {
        ...SEASONS_SAMPLE.learnerModel,
        misconceptionType: "earth-shadow-phases",
      },
    });
    expect(result.success).toBe(false);
  });

  it("requires the scientific seasons world to use observed axial tilt", () => {
    const result = AnalysisResultSchema.safeParse({
      ...SEASONS_SAMPLE,
      scientificWorld: {
        ...SEASONS_SAMPLE.scientificWorld,
        parameters: { axialTiltDeg: 20 },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a distance-only learner analysis that also uses axial tilt", () => {
    const result = AnalysisResultSchema.safeParse({
      ...SEASONS_SAMPLE,
      learnerWorld: {
        ...SEASONS_SAMPLE.learnerWorld,
        parameters: { axialTiltDeg: 12 },
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects inconsistent binary transfer score receipts", () => {
    const result = TransferResultSchema.safeParse({
      ...createTransferReceipt("toward-sun", true),
      score: 0,
    });
    expect(result.success).toBe(false);
  });

  it("enforces verified-sample metadata constraints", () => {
    const result = AnalysisResultSchema.safeParse({
      ...MOON_HERO_SAMPLE,
      metadata: {
        ...MOON_HERO_SAMPLE.metadata,
        modelId: "gpt-5.6-terra",
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts only allow-listed live model IDs", () => {
    const allowed = AnalysisResultSchema.safeParse({
      ...MOON_HERO_SAMPLE,
      metadata: {
        mode: "live",
        modelId: "gpt-5.6-luna",
        analyzedSubmission: true,
        orchestrationToolNames: ["validate_world_spec"],
      },
    });
    const unknown = AnalysisResultSchema.safeParse({
      ...MOON_HERO_SAMPLE,
      metadata: {
        mode: "live",
        modelId: "gpt-unknown",
        analyzedSubmission: true,
        orchestrationToolNames: [],
      },
    });
    expect(allowed.success).toBe(true);
    expect(unknown.success).toBe(false);
  });

  it("requires live metadata to represent an analyzed submission", () => {
    const result = AnalysisResultSchema.safeParse({
      ...MOON_HERO_SAMPLE,
      metadata: {
        mode: "live",
        modelId: "gpt-5.6-sol",
        analyzedSubmission: false,
        orchestrationToolNames: [],
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a nonmonotonic RevisionTrace", () => {
    const trace = requireTrace(reachTrace());
    const result = RevisionTraceSchema.safeParse({
      ...trace,
      analysisStartedAt: trace.inputSubmittedAt - 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("verified cases and deterministic physical simulation", () => {
  it("parses both verified samples", () => {
    expect(AnalysisResultSchema.safeParse(MOON_HERO_SAMPLE).success).toBe(true);
    expect(AnalysisResultSchema.safeParse(SEASONS_SAMPLE).success).toBe(true);
  });

  it("uses one CaseSpec and fingerprint for both Moon worlds", () => {
    const learner = requireMoon(
      simulateWorld(MOON_HERO_SAMPLE.learnerWorld, MOON_HERO_SAMPLE.caseSpec),
    );
    const scientific = requireMoon(
      simulateWorld(
        MOON_HERO_SAMPLE.scientificWorld,
        MOON_HERO_SAMPLE.caseSpec,
      ),
    );
    expect(learner.caseFingerprint).toBe(scientific.caseFingerprint);
    expect(learner.caseFingerprint).toBe(
      createCaseFingerprint(MOON_HERO_SAMPLE.caseSpec),
    );
  });

  it("rejects simulation when world and CaseSpec scenarios differ", () => {
    expect(() =>
      simulateWorld(MOON_HERO_SAMPLE.scientificWorld, SEASONS_SAMPLE.caseSpec),
    ).toThrow("WorldSpec and CaseSpec scenarios must match");
  });

  it("keeps both first-quarter physical observations at one-half and no shadow", () => {
    const learner = requireMoon(
      simulateWorld(MOON_HERO_SAMPLE.learnerWorld, MOON_HERO_SAMPLE.caseSpec),
    );
    const scientific = requireMoon(
      simulateWorld(
        MOON_HERO_SAMPLE.scientificWorld,
        MOON_HERO_SAMPLE.caseSpec,
      ),
    );
    expect(learner.physicalObservation.illuminationFraction).toBeCloseTo(0.5, 6);
    expect(scientific.physicalObservation.illuminationFraction).toBeCloseTo(0.5, 6);
    expect(learner.physicalObservation.earthShadowIntersection).toBe("none");
    expect(scientific.physicalObservation.earthShadowIntersection).toBe("none");
  });

  it("separates the learner shadow assumption from physical geometry", () => {
    const learner = requireMoon(
      simulateWorld(MOON_HERO_SAMPLE.learnerWorld, MOON_HERO_SAMPLE.caseSpec),
    );
    const scientific = requireMoon(
      simulateWorld(
        MOON_HERO_SAMPLE.scientificWorld,
        MOON_HERO_SAMPLE.caseSpec,
      ),
    );
    expect(learner.modelPrediction.assumesEarthShadowMask).toBe(true);
    expect(learner.modelPrediction.cause).toBe("earth-shadow");
    expect(scientific.modelPrediction.assumesEarthShadowMask).toBe(false);
    expect(scientific.modelPrediction.cause).toBe("viewing-angle");
  });

  it("computes a new Moon", () => {
    const observation = requireMoon(
      simulateWorld(MOON_HERO_SAMPLE.scientificWorld, {
        ...MOON_HERO_SAMPLE.caseSpec,
        id: "moon-new",
        elongationDeg: 0,
      }),
    );
    expect(observation.physicalObservation.illuminationFraction).toBeCloseTo(0, 6);
    expect(observation.physicalObservation.earthShadowIntersection).toBe("none");
  });

  it("computes a centered total umbral intersection at full Moon", () => {
    const observation = requireMoon(
      simulateWorld(MOON_HERO_SAMPLE.scientificWorld, {
        ...MOON_HERO_SAMPLE.caseSpec,
        id: "moon-full-total",
        elongationDeg: 180,
      }),
    );
    expect(observation.physicalObservation.illuminationFraction).toBeCloseTo(1, 6);
    expect(observation.physicalObservation.earthShadowIntersection).toBe("total");
  });

  it("computes a partial umbral intersection near contact", () => {
    const observation = requireMoon(
      simulateWorld(MOON_HERO_SAMPLE.scientificWorld, {
        ...MOON_HERO_SAMPLE.caseSpec,
        id: "moon-full-partial",
        elongationDeg: 180,
        lunarOrbitLatitudeDeg: 0.7,
      }),
    );
    expect(observation.physicalObservation.earthShadowIntersection).toBe("partial");
  });

  it("returns no umbral intersection beyond sphere contact", () => {
    const observation = requireMoon(
      simulateWorld(MOON_HERO_SAMPLE.scientificWorld, {
        ...MOON_HERO_SAMPLE.caseSpec,
        id: "moon-full-clear",
        elongationDeg: 180,
        lunarOrbitLatitudeDeg: 1.1,
      }),
    );
    expect(observation.physicalObservation.earthShadowIntersection).toBe("none");
  });

  it("uses the analytic illumination equation at both quarter positions", () => {
    expect(moonIlluminationFraction(90)).toBeCloseTo(0.5, 6);
    expect(moonIlluminationFraction(270)).toBeCloseTo(0.5, 6);
  });

  it("reports real Sun distance, incoming light, and not-to-scale metadata", () => {
    const observation = requireMoon(
      simulateWorld(
        MOON_HERO_SAMPLE.scientificWorld,
        MOON_HERO_SAMPLE.caseSpec,
      ),
    );
    expect(observation.physicalPositionsKm.sun.x).toBe(
      ASTRONOMY_CONSTANTS_KM.earthSunDistance,
    );
    expect(observation.incomingLightDirection).toEqual({ x: -1, y: 0, z: 0 });
    expect(observation.renderScale.label).toBe("Not to scale");
  });

  it("derives positive June declination for the scientific world", () => {
    const learner = requireSeasons(
      simulateWorld(SEASONS_SAMPLE.learnerWorld, SEASONS_SAMPLE.caseSpec),
    );
    const scientific = requireSeasons(
      simulateWorld(SEASONS_SAMPLE.scientificWorld, SEASONS_SAMPLE.caseSpec),
    );
    expect(learner.physicalObservation.solarDeclinationDeg).toBeCloseTo(23.44, 2);
    expect(scientific.physicalObservation.solarDeclinationDeg).toBeCloseTo(23.44, 2);
    expect(learner.modelPrediction.predictedSolarDeclinationDeg).toBeCloseTo(0, 6);
    expect(scientific.modelPrediction.predictedSolarDeclinationDeg).toBeCloseTo(
      23.44,
      2,
    );
  });

  it("derives negative December declination", () => {
    const observation = requireSeasons(
      simulateWorld(SEASONS_SAMPLE.scientificWorld, {
        ...SEASONS_SAMPLE.caseSpec,
        id: "seasons-december-solstice",
        earthSolarLongitudeDeg: 270,
      }),
    );
    expect(observation.physicalObservation.solarDeclinationDeg).toBeCloseTo(
      -23.44,
      2,
    );
    expect(observation.physicalObservation.northernSeason).toBe("winter");
    expect(observation.physicalObservation.southernSeason).toBe("summer");
  });

  it("derives zero declination at an equinox", () => {
    expect(solarDeclinationDeg(23.44, 0)).toBeCloseTo(0, 6);
    expect(solarDeclinationDeg(23.44, 180)).toBeCloseTo(0, 6);
  });

  it("keeps declination zero when axial tilt is zero", () => {
    expect(solarDeclinationDeg(0, 90)).toBeCloseTo(0, 6);
    expect(solarDeclinationDeg(0, 270)).toBeCloseTo(0, 6);
  });

  it("uses the same June distance and position for both seasons worlds", () => {
    const learner = requireSeasons(
      simulateWorld(SEASONS_SAMPLE.learnerWorld, SEASONS_SAMPLE.caseSpec),
    );
    const scientific = requireSeasons(
      simulateWorld(SEASONS_SAMPLE.scientificWorld, SEASONS_SAMPLE.caseSpec),
    );
    expect(learner.physicalPositionsKm.earth).toEqual(
      scientific.physicalPositionsKm.earth,
    );
    if (SEASONS_SAMPLE.caseSpec.scenario !== "seasons") {
      throw new Error("Expected a seasons CaseSpec");
    }
    expect(SEASONS_SAMPLE.caseSpec.earthSunDistanceAu).toBe(1.017);
  });

  it("shares physical seasons evidence while model predictions differ", () => {
    const learner = requireSeasons(
      simulateWorld(SEASONS_SAMPLE.learnerWorld, SEASONS_SAMPLE.caseSpec),
    );
    const scientific = requireSeasons(
      simulateWorld(SEASONS_SAMPLE.scientificWorld, SEASONS_SAMPLE.caseSpec),
    );
    expect(learner.physicalObservation).toEqual(scientific.physicalObservation);
    expect(learner.physicalObservation.northernSeason).toBe("summer");
    expect(learner.physicalObservation.southernSeason).toBe("winter");
    expect(learner.modelPrediction.predictsSameSeasonBothHemispheres).toBe(true);
    expect(learner.modelPrediction.contradictsObservedOppositeSeasons).toBe(true);
    expect(learner.modelPrediction.predictedNorthernSeason).toBe("equinox-like");
    expect(learner.modelPrediction.predictedSouthernSeason).toBe("equinox-like");
    expect(learner.modelPrediction.matchesPhysicalObservation).toBe(false);
    expect(scientific.modelPrediction.predictedNorthernSeason).toBe("summer");
    expect(scientific.modelPrediction.predictedSouthernSeason).toBe("winter");
    expect(scientific.modelPrediction.matchesPhysicalObservation).toBe(true);
  });

  it("ignores a contradictory tilt value in a distance-only simulation branch", () => {
    const observation = requireSeasons(
      simulateWorld(
        {
          ...SEASONS_SAMPLE.learnerWorld,
          parameters: { axialTiltDeg: 12 },
        },
        SEASONS_SAMPLE.caseSpec,
      ),
    );
    expect(observation.modelPrediction.predictedSolarDeclinationDeg).toBe(0);
    expect(observation.modelPrediction.predictedNorthernSeason).toBe(
      "equinox-like",
    );
    expect(observation.modelPrediction.predictedSouthernSeason).toBe(
      "equinox-like",
    );
  });
});

describe("session identity, evidence timing, and evaluation receipts", () => {
  it("rejects an unknown scenario at runtime", () => {
    const home = createInitialSession(SESSION_ID);
    const transition = reduceSession(home, {
      type: "START_INPUT",
      scenarioId: "chemistry",
      explanation: EXPLANATION,
      submittedAt: 1,
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("INVALID_SCENARIO");
    expect(transition.state).toBe(home);
  });

  it("accepts text-only input and trims it", () => {
    const state = accept(createInitialSession(SESSION_ID), {
      type: "START_INPUT",
      scenarioId: "moon-phases",
      explanation: `  ${EXPLANATION}  `,
      submittedAt: 1,
    });
    if (state.input === null) throw new Error("Expected input");
    expect(state.input.explanation).toBe(EXPLANATION);
    expect(state.input.sketchReference).toBeNull();
  });

  it("accepts sketch-only input without raw image data", () => {
    const state = accept(createInitialSession(SESSION_ID), {
      type: "START_INPUT",
      scenarioId: "moon-phases",
      sketchReference: SKETCH,
      submittedAt: 1,
    });
    if (state.input === null) throw new Error("Expected input");
    expect(state.input.explanation).toBe("");
    expect(state.input.sketchReference).toEqual(SKETCH);
  });

  it("accepts text and sketch together", () => {
    const state = accept(createInitialSession(SESSION_ID), {
      type: "START_INPUT",
      scenarioId: "moon-phases",
      explanation: EXPLANATION,
      sketchReference: SKETCH,
      submittedAt: 1,
    });
    if (state.input === null) throw new Error("Expected input");
    expect(state.input.explanation).toBe(EXPLANATION);
    expect(state.input.sketchReference).toEqual(SKETCH);
  });

  it("rejects empty input without changing state", () => {
    const home = createInitialSession(SESSION_ID);
    const transition = reduceSession(home, {
      type: "START_INPUT",
      scenarioId: "moon-phases",
      explanation: "   ",
      submittedAt: 1,
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("INVALID_INPUT");
    expect(transition.state).toBe(home);
  });

  it("rejects sketch metadata containing raw data", () => {
    const home = createInitialSession(SESSION_ID);
    const transition = reduceSession(home, {
      type: "START_INPUT",
      scenarioId: "moon-phases",
      sketchReference: { ...SKETCH, data: "base64-content" },
      submittedAt: 1,
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("INVALID_INPUT");
    expect(transition.state).toBe(home);
  });

  it("rejects an analysis response with a mismatched request ID", () => {
    const analyzing = reachAnalyzing();
    const transition = reduceSession(analyzing, {
      type: "RECEIVE_ANALYSIS",
      sessionId: SESSION_ID,
      requestId: "request-b",
      analysis: MOON_HERO_SAMPLE,
      receivedAt: 3,
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("ID_MISMATCH");
    expect(transition.state).toBe(analyzing);
  });

  it("rejects an old response after restart", () => {
    const analyzing = reachAnalyzing();
    const restarted = accept(analyzing, {
      type: "RESTART",
      newSessionId: "session-b",
      restartedAt: 3,
    });
    const transition = reduceSession(restarted, {
      type: "RECEIVE_ANALYSIS",
      sessionId: SESSION_ID,
      requestId: REQUEST_ID,
      analysis: MOON_HERO_SAMPLE,
      receivedAt: 4,
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("ID_MISMATCH");
    expect(transition.state).toBe(restarted);
  });

  it("traverses the canonical stage sequence", () => {
    const stages = [createInitialSession(SESSION_ID).stage];
    let state = reachInput();
    stages.push(state.stage);
    state = accept(state, {
      type: "BEGIN_ANALYSIS",
      sessionId: SESSION_ID,
      requestId: REQUEST_ID,
      startedAt: 2,
    });
    stages.push(state.stage);
    state = accept(state, {
      type: "RECEIVE_ANALYSIS",
      sessionId: SESSION_ID,
      requestId: REQUEST_ID,
      analysis: MOON_HERO_SAMPLE,
      receivedAt: 3,
    });
    stages.push(state.stage);
    state = accept(state, { type: "CONFIRM_MODEL", confirmedAt: 4 });
    stages.push(state.stage);
    state = accept(state, {
      type: "SELECT_PREDICTION",
      optionId: "shadow-masks-half",
      selectedAt: 5,
    });
    state = accept(state, { type: "LOCK_PREDICTION", lockedAt: 6 });
    stages.push(state.stage);
    state = accept(state, { type: "BEGIN_OBSERVATION", startedAt: 7 });
    stages.push(state.stage);
    state = accept(state, { type: "COMPLETE_OBSERVATION", completedAt: 8 });
    stages.push(state.stage);
    state = accept(state, {
      type: "SUBMIT_REVISION",
      text: REVISION_TEXT,
      submittedAt: 9,
    });
    expect(state.stage).toBe("REVISION");
    state = accept(state, {
      type: "BEGIN_REVISION_EVALUATION",
      sessionId: SESSION_ID,
      requestId: "revision-request-a",
      idempotencyKey: "revision-key-a",
      requestedAt: 10,
    });
    expect(state.stage).toBe("REVISION");
    state = accept(state, {
      type: "RECEIVE_REVISION_FEEDBACK",
      sessionId: SESSION_ID,
      requestId: "revision-request-a",
      feedback: FEEDBACK,
      evaluatedAt: 11,
    });
    stages.push(state.stage);
    state = accept(state, {
      type: "SELECT_TRANSFER",
      optionId: "toward-sun",
      selectedAt: 12,
    });
    state = accept(state, { type: "LOCK_TRANSFER", lockedAt: 13 });
    stages.push(state.stage);
    state = accept(state, {
      type: "BEGIN_TRANSFER_EVALUATION",
      sessionId: SESSION_ID,
      requestId: "transfer-request-a",
      idempotencyKey: "transfer-key-a",
      requestedAt: 14,
    });
    expect(state.stage).toBe("TRANSFER_LOCKED");
    state = accept(state, {
      type: "RECEIVE_TRANSFER_RESULT",
      sessionId: SESSION_ID,
      requestId: "transfer-request-a",
      result: createTransferReceipt(),
    });
    stages.push(state.stage);
    expect(stages).toEqual(SESSION_STAGE_SEQUENCE);
  });

  it("accepts duplicate prediction lock idempotently", () => {
    const locked = reachPredictionLocked();
    if (locked.prediction === null || locked.prediction.lockedAt === null) {
      throw new Error("Expected locked prediction");
    }
    const originalLockedAt = locked.prediction.lockedAt;
    const transition = reduceSession(locked, {
      type: "LOCK_PREDICTION",
      lockedAt: 7,
    });
    expect(transition.accepted).toBe(true);
    expect(transition.idempotent).toBe(true);
    expect(transition.state).toBe(locked);
    if (transition.state.prediction === null) {
      throw new Error("Expected prediction to remain locked");
    }
    expect(transition.state.prediction.lockedAt).toBe(originalLockedAt);
  });

  it("rejects prediction changes after lock", () => {
    const locked = reachPredictionLocked();
    const transition = reduceSession(locked, {
      type: "SELECT_PREDICTION",
      optionId: "view-reveals-half",
      selectedAt: 7,
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("WRONG_STAGE");
    expect(transition.state).toBe(locked);
  });

  it("rejects reverse timestamps", () => {
    const predictionOpen = reachPredictionOpen();
    const transition = reduceSession(predictionOpen, {
      type: "SELECT_PREDICTION",
      optionId: "shadow-masks-half",
      selectedAt: 3,
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("INVALID_TIMESTAMP");
    expect(transition.state).toBe(predictionOpen);
  });

  it("rejects nonfinite action timestamps", () => {
    const home = createInitialSession(SESSION_ID);
    const transition = reduceSession(home, {
      type: "START_INPUT",
      scenarioId: "moon-phases",
      explanation: EXPLANATION,
      submittedAt: Number.NaN,
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("INVALID_TIMESTAMP");
    expect(transition.state).toBe(home);
  });

  it("does not expose evidence before observation completion", () => {
    const locked = reachPredictionLocked();
    expect(locked.comparison).toBeNull();
    const observing = accept(locked, {
      type: "BEGIN_OBSERVATION",
      startedAt: 7,
    });
    expect(observing.comparison).toBeNull();
  });

  it("recomputes both observations internally with trusted identity", () => {
    const state = reachRevision();
    if (state.comparison === null || state.analysis === null) {
      throw new Error("Expected trusted comparison and analysis");
    }
    const expectedFingerprint = createCaseFingerprint(state.analysis.caseSpec);
    expect(state.comparison.caseFingerprint).toBe(expectedFingerprint);
    expect(state.comparison.learner.caseFingerprint).toBe(expectedFingerprint);
    expect(state.comparison.scientific.caseFingerprint).toBe(expectedFingerprint);
    expect(state.comparison.learner.worldId).toBe(
      state.analysis.learnerWorld.worldId,
    );
    expect(state.comparison.scientific.worldId).toBe(
      state.analysis.scientificWorld.worldId,
    );
  });

  it("fixes revision text without accepting feedback at submission time", () => {
    const state = reachRevisionSubmitted();
    if (state.revision === null) throw new Error("Expected submitted revision");
    expect(state.stage).toBe("REVISION");
    expect(state.revision.text).toBe(REVISION_TEXT);
    expect(state.revision.feedback).toBeNull();
    expect(state.revisionEvaluationRequest).toBeNull();
  });

  it("rejects revision text replacement after submission", () => {
    const submitted = reachRevisionSubmitted();
    const transition = reduceSession(submitted, {
      type: "SUBMIT_REVISION",
      text: "A replacement revision must not overwrite the first.",
      submittedAt: 10,
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("REVISION_ALREADY_SUBMITTED");
    expect(transition.state).toBe(submitted);
  });

  it("accepts duplicate revision evaluation begin idempotently", () => {
    const pending = reachRevisionPending();
    const transition = reduceSession(pending, {
      type: "BEGIN_REVISION_EVALUATION",
      sessionId: SESSION_ID,
      requestId: "revision-request-a",
      idempotencyKey: "revision-key-a",
      requestedAt: 11,
    });
    expect(transition.accepted).toBe(true);
    expect(transition.idempotent).toBe(true);
    expect(transition.state).toBe(pending);
  });

  it("rejects revision feedback with a mismatched request ID", () => {
    const pending = reachRevisionPending();
    const transition = reduceSession(pending, {
      type: "RECEIVE_REVISION_FEEDBACK",
      sessionId: SESSION_ID,
      requestId: "revision-request-b",
      feedback: FEEDBACK,
      evaluatedAt: 11,
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("ID_MISMATCH");
    expect(transition.state).toBe(pending);
  });

  it("rejects stale revision feedback after restart", () => {
    const pending = reachRevisionPending();
    const restarted = accept(pending, {
      type: "RESTART",
      newSessionId: "session-b",
      restartedAt: 11,
    });
    const transition = reduceSession(restarted, {
      type: "RECEIVE_REVISION_FEEDBACK",
      sessionId: SESSION_ID,
      requestId: "revision-request-a",
      feedback: FEEDBACK,
      evaluatedAt: 12,
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("ID_MISMATCH");
    expect(transition.state).toBe(restarted);
  });

  it("runtime-validates revision feedback receipts", () => {
    const pending = reachRevisionPending();
    const transition = reduceSession(pending, {
      type: "RECEIVE_REVISION_FEEDBACK",
      sessionId: SESSION_ID,
      requestId: "revision-request-a",
      feedback: { ...FEEDBACK, score: 2 },
      evaluatedAt: 11,
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("INVALID_REVISION");
    expect(transition.state).toBe(pending);
  });

  it("accepts duplicate correlated revision feedback idempotently", () => {
    const completed = reachTransferOpen();
    const transition = reduceSession(completed, {
      type: "RECEIVE_REVISION_FEEDBACK",
      sessionId: SESSION_ID,
      requestId: "revision-request-a",
      feedback: FEEDBACK,
      evaluatedAt: 11,
    });
    expect(transition.accepted).toBe(true);
    expect(transition.idempotent).toBe(true);
    expect(transition.state).toBe(completed);
  });

  it("accepts duplicate transfer lock idempotently", () => {
    const locked = reachTransferLocked();
    if (locked.transfer === null || locked.transfer.lockedAt === null) {
      throw new Error("Expected locked transfer choice");
    }
    const originalLockedAt = locked.transfer.lockedAt;
    const transition = reduceSession(locked, {
      type: "LOCK_TRANSFER",
      lockedAt: 14,
    });
    expect(transition.accepted).toBe(true);
    expect(transition.idempotent).toBe(true);
    expect(transition.state).toBe(locked);
    if (transition.state.transfer === null) {
      throw new Error("Expected transfer choice to remain locked");
    }
    expect(transition.state.transfer.lockedAt).toBe(originalLockedAt);
  });

  it("rejects transfer selection changes after lock", () => {
    const locked = reachTransferLocked();
    const transition = reduceSession(locked, {
      type: "SELECT_TRANSFER",
      optionId: "away-from-sun",
      selectedAt: 14,
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("WRONG_STAGE");
    expect(transition.state).toBe(locked);
  });

  it("accepts a duplicate transfer evaluation request idempotently", () => {
    const pending = reachTransferPending();
    const transition = reduceSession(pending, {
      type: "BEGIN_TRANSFER_EVALUATION",
      sessionId: SESSION_ID,
      requestId: "transfer-request-a",
      idempotencyKey: "transfer-key-a",
      requestedAt: 15,
    });
    expect(transition.accepted).toBe(true);
    expect(transition.idempotent).toBe(true);
    expect(transition.state).toBe(pending);
  });

  it("rejects a transfer receipt with a mismatched request ID", () => {
    const pending = reachTransferPending();
    const transition = reduceSession(pending, {
      type: "RECEIVE_TRANSFER_RESULT",
      sessionId: SESSION_ID,
      requestId: "transfer-request-b",
      result: createTransferReceipt(),
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("ID_MISMATCH");
    expect(transition.state).toBe(pending);
  });

  it("rejects transfer result identity that differs from the locked question", () => {
    const pending = reachTransferPending();
    const mismatchedResults = [
      { ...createTransferReceipt(), evaluationId: "wrong-evaluation" },
      { ...createTransferReceipt(), questionId: "wrong-question" },
      { ...createTransferReceipt(), questionVersion: "wrong-version" },
      { ...createTransferReceipt(), selectedOptionId: "away-from-sun" },
    ];

    for (const result of mismatchedResults) {
      const transition = reduceSession(pending, {
        type: "RECEIVE_TRANSFER_RESULT",
        sessionId: SESSION_ID,
        requestId: "transfer-request-a",
        result,
      });
      expect(transition.accepted).toBe(false);
      expect(transition.reason).toBe("INVALID_TRANSFER_RESULT");
      expect(transition.state).toBe(pending);
    }
  });

  it("rejects a receipt whose binary score contradicts isCorrect", () => {
    const pending = reachTransferPending();
    const transition = reduceSession(pending, {
      type: "RECEIVE_TRANSFER_RESULT",
      sessionId: SESSION_ID,
      requestId: "transfer-request-a",
      result: { ...createTransferReceipt(), score: 0 },
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("INVALID_TRANSFER_RESULT");
    expect(transition.state).toBe(pending);
  });

  it("rejects a stale transfer receipt after restart", () => {
    const pending = reachTransferPending();
    const restarted = accept(pending, {
      type: "RESTART",
      newSessionId: "session-b",
      restartedAt: 15,
    });
    const transition = reduceSession(restarted, {
      type: "RECEIVE_TRANSFER_RESULT",
      sessionId: SESSION_ID,
      requestId: "transfer-request-a",
      result: createTransferReceipt("toward-sun", true, 16),
    });
    expect(transition.accepted).toBe(false);
    expect(transition.reason).toBe("ID_MISMATCH");
    expect(transition.state).toBe(restarted);
  });

  it("accepts a duplicate correlated transfer receipt idempotently", () => {
    const completed = reachTrace();
    const transition = reduceSession(completed, {
      type: "RECEIVE_TRANSFER_RESULT",
      sessionId: SESSION_ID,
      requestId: "transfer-request-a",
      result: createTransferReceipt(),
    });
    expect(transition.accepted).toBe(true);
    expect(transition.idempotent).toBe(true);
    expect(transition.state).toBe(completed);
  });

  it("accepts a contract-valid correlated correct receipt fixture", () => {
    const state = reachTrace("toward-sun");
    if (state.transferResult === null) throw new Error("Expected transfer result");
    expect(state.transferResult.isCorrect).toBe(true);
    expect(state.transferResult.score).toBe(1);
    expect(state.transferResult.source).toBe("deterministic-question-bank");
  });

  it("accepts a contract-valid internally-consistent incorrect receipt fixture", () => {
    const state = reachTrace("away-from-sun", false);
    if (state.transferResult === null) throw new Error("Expected transfer result");
    expect(state.transferResult.selectedOptionId).toBe("away-from-sun");
    expect(state.transferResult.isCorrect).toBe(false);
    expect(state.transferResult.score).toBe(0);
  });

  it("records exact transfer result, source, version, and timestamps in trace", () => {
    const state = reachTrace();
    const trace = requireTrace(state);
    expect(trace.transfer).toEqual({
      evaluationId: "moon-transfer-evaluation-v1",
      questionId: "moon-new-phase-transfer",
      questionVersion: "moon-transfer-v1",
      selectedOptionId: "toward-sun",
      selectedAt: 12,
      lockedAt: 13,
      result: {
        receiptId: "transfer-receipt-a",
        evaluationId: "moon-transfer-evaluation-v1",
        questionId: "moon-new-phase-transfer",
        questionVersion: "moon-transfer-v1",
        selectedOptionId: "toward-sun",
        isCorrect: true,
        score: 1,
        rationale: "Receipt contract fixture.",
        evaluatedAt: 15,
        source: "deterministic-question-bank",
      },
    });
    expect(trace.startedAt).toBe(1);
    expect(trace.analysisStartedAt).toBe(2);
    expect(trace.observation.startedAt).toBe(7);
    expect(trace.observation.completedAt).toBe(8);
    expect(trace.revision.feedbackEvaluatedAt).toBe(11);
    expect(trace.completedAt).toBe(15);
  });

  it("accepts a complete trace with one long opaque evaluation identity", () => {
    const trace = requireTrace(reachTrace());
    const evaluationId = `v1.${"A".repeat(16)}.${"A".repeat(512)}.${"A".repeat(22)}`;

    const parsed = RevisionTraceSchema.parse({
      ...trace,
      transfer: {
        ...trace.transfer,
        evaluationId,
        result: {
          ...trace.transfer.result,
          evaluationId,
        },
      },
    });

    expect(parsed.transfer.evaluationId).toBe(evaluationId);
    expect(parsed.transfer.result.evaluationId).toBe(evaluationId);
    expect(parsed.transfer.questionId).toBe(parsed.transfer.result.questionId);
    expect(parsed.transfer.questionVersion).toBe(
      parsed.transfer.result.questionVersion,
    );
  });

  it("restart replaces identity and clears all accumulated data", () => {
    const completed = reachTrace();
    const restarted = accept(completed, {
      type: "RESTART",
      newSessionId: "session-b",
      restartedAt: 16,
    });
    expect(restarted).toEqual({
      ...createInitialSession("session-b"),
      lastEventAt: 16,
    });
  });
});
