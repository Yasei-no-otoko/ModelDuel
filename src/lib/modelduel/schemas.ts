import { z } from "zod";

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);
const finiteNumber = z.number().finite();
const stableId = boundedText(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const ScenarioIdSchema = z.enum(["moon-phases", "seasons"]);
export const ModelKindSchema = z.enum(["learner", "scientific"]);
export const BodySchema = z.enum(["sun", "earth", "moon"]);
export const MisconceptionTypeSchema = z.enum([
  "earth-shadow-phases",
  "distance-causes-seasons",
  "other",
]);

export const SessionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const SketchReferenceSchema = z.strictObject({
  id: SessionIdSchema,
  mime: z.enum(["png", "jpeg", "webp"]),
  sizeBytes: finiteNumber.int().positive().max(10 * 1024 * 1024),
});

export const CausalRelationSchema = z.strictObject({
  subject: BodySchema,
  relation: z.enum([
    "illuminates",
    "orbits",
    "casts-shadow-on",
    "changes-apparent-phase",
    "causes-seasonal-energy",
  ]),
  object: BodySchema,
});

export const SpatialRelationSchema = z.strictObject({
  subject: BodySchema,
  relation: z.enum([
    "orbits",
    "near-shadow-axis",
    "between",
    "opposite",
    "tilted-relative-to",
  ]),
  reference: BodySchema,
});

export const LearnerModelSchema = z.strictObject({
  summary: boundedText(500),
  entities: z.array(BodySchema).min(1).max(3),
  causalRelations: z.array(CausalRelationSchema).max(12),
  spatialRelations: z.array(SpatialRelationSchema).max(12),
  predictedObservations: z.array(boundedText(240)).min(1).max(8),
  confidence: finiteNumber.min(0).max(1),
  misconceptionType: MisconceptionTypeSchema,
});

export const MoonCaseSpecSchema = z.strictObject({
  id: stableId,
  scenario: z.literal("moon-phases"),
  elongationDeg: finiteNumber.min(0).max(360),
  lunarOrbitLatitudeDeg: finiteNumber.min(-10).max(10),
});

export const SeasonsCaseSpecSchema = z.strictObject({
  id: stableId,
  scenario: z.literal("seasons"),
  earthSolarLongitudeDeg: finiteNumber.min(0).max(360),
  earthSunDistanceAu: finiteNumber.min(0.9).max(1.1),
  latitudeDeg: finiteNumber.min(0).max(75),
  observedAxialTiltDeg: finiteNumber.min(23.4).max(23.5),
});

export const CaseSpecSchema = z.discriminatedUnion("scenario", [
  MoonCaseSpecSchema,
  SeasonsCaseSpecSchema,
]);

const WorldIdentityFields = {
  version: z.literal("1.0"),
  worldId: stableId,
  modelKind: ModelKindSchema,
  bodies: z.array(BodySchema).min(2).max(3),
};

const MoonWorldSpecSchema = z.strictObject({
  ...WorldIdentityFields,
  scenario: z.literal("moon-phases"),
  claims: z.strictObject({
    earthShadowCausesPhases: z.boolean(),
  }),
  parameters: z.strictObject({
    assumedShadowMaskFraction: finiteNumber.min(0).max(1),
  }),
});

const SeasonsWorldSpecSchema = z.strictObject({
  ...WorldIdentityFields,
  scenario: z.literal("seasons"),
  claims: z.strictObject({
    distanceCausesSeasons: z.boolean(),
  }),
  parameters: z.strictObject({
    axialTiltDeg: finiteNumber.min(0).max(30),
  }),
});

export const WorldSpecSchema = z
  .discriminatedUnion("scenario", [
    MoonWorldSpecSchema,
    SeasonsWorldSpecSchema,
  ])
  .superRefine((world, context) => {
    const expectedBodies =
      world.scenario === "moon-phases"
        ? ["sun", "earth", "moon"]
        : ["sun", "earth"];

    if (
      world.bodies.length !== expectedBodies.length ||
      expectedBodies.some((body, index) => world.bodies[index] !== body)
    ) {
      context.addIssue({
        code: "custom",
        path: ["bodies"],
        message: `${world.scenario} requires the exact ordered body allow-list`,
      });
    }

    if (world.scenario === "moon-phases") {
      if (
        world.modelKind === "scientific" &&
        world.claims.earthShadowCausesPhases
      ) {
        context.addIssue({
          code: "custom",
          path: ["claims", "earthShadowCausesPhases"],
          message: "The scientific Moon model cannot assert the misconception",
        });
      }

      if (
        world.claims.earthShadowCausesPhases !==
        (world.parameters.assumedShadowMaskFraction > 0)
      ) {
        context.addIssue({
          code: "custom",
          path: ["parameters", "assumedShadowMaskFraction"],
          message: "Shadow-mask parameters must agree with the world claim",
        });
      }
    } else if (
      world.modelKind === "scientific" &&
      world.claims.distanceCausesSeasons
    ) {
      context.addIssue({
        code: "custom",
        path: ["claims", "distanceCausesSeasons"],
        message: "The scientific seasons model cannot assert the misconception",
      });
    }
  });

export const QuestionOptionSchema = z.strictObject({
  id: stableId,
  label: boundedText(240),
});

const uniqueOptions = z
  .array(QuestionOptionSchema)
  .min(2)
  .max(5)
  .refine(
    (options) => new Set(options.map((option) => option.id)).size === options.length,
    { message: "Question option IDs must be unique" },
  );

const QuestionFields = {
  id: stableId,
  prompt: boundedText(500),
  options: uniqueOptions,
  version: stableId,
};

export const PredictionQuestionSchema = z.strictObject(QuestionFields);
export const TransferQuestionSchema = z.strictObject({
  evaluationId: stableId,
  questionId: stableId,
  version: stableId,
  prompt: boundedText(500),
  options: uniqueOptions,
});

export const OrchestrationToolNameSchema = z.enum([
  "validate_world_spec",
  "simulate_world",
  "compare_predictions",
  "select_discriminating_case",
  "grade_revised_explanation",
  "generate_transfer_question",
]);

export const RuntimeModelIdSchema = z.enum([
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
]);

export const AnalysisMetadataSchema = z
  .strictObject({
    mode: z.enum(["live", "verified-sample"]),
    modelId: RuntimeModelIdSchema.nullable(),
    analyzedSubmission: z.boolean(),
    orchestrationToolNames: z.array(OrchestrationToolNameSchema).max(6),
  })
  .superRefine((metadata, context) => {
    if (
      metadata.mode === "verified-sample" &&
      (metadata.modelId !== null || metadata.analyzedSubmission)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Verified samples require modelId null and analyzedSubmission false",
      });
    }

    if (
      metadata.mode === "live" &&
      (metadata.modelId === null || !metadata.analyzedSubmission)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Live analysis requires an allowed model ID and analyzedSubmission true",
      });
    }
  });

export const AnalysisResultSchema = z
  .strictObject({
    scenarioId: ScenarioIdSchema,
    metadata: AnalysisMetadataSchema,
    learnerModel: LearnerModelSchema,
    caseSpec: CaseSpecSchema,
    learnerWorld: WorldSpecSchema,
    scientificWorld: WorldSpecSchema,
    predictionQuestion: PredictionQuestionSchema,
    transferQuestion: TransferQuestionSchema,
  })
  .superRefine((analysis, context) => {
    if (
      analysis.caseSpec.scenario !== analysis.scenarioId ||
      analysis.learnerWorld.scenario !== analysis.scenarioId ||
      analysis.scientificWorld.scenario !== analysis.scenarioId
    ) {
      context.addIssue({
        code: "custom",
        path: ["scenarioId"],
        message: "Analysis, CaseSpec, and WorldSpec scenarios must match",
      });
    }

    if (analysis.learnerWorld.modelKind !== "learner") {
      context.addIssue({
        code: "custom",
        path: ["learnerWorld", "modelKind"],
        message: "Learner world must use learner modelKind",
      });
    }

    if (analysis.scientificWorld.modelKind !== "scientific") {
      context.addIssue({
        code: "custom",
        path: ["scientificWorld", "modelKind"],
        message: "Scientific world must use scientific modelKind",
      });
    }

    if (analysis.scenarioId === "moon-phases") {
      if (analysis.learnerModel.misconceptionType === "distance-causes-seasons") {
        context.addIssue({
          code: "custom",
          path: ["learnerModel", "misconceptionType"],
          message: "Moon analysis cannot use the seasons misconception",
        });
      }
      if (
        analysis.learnerWorld.scenario === "moon-phases" &&
        analysis.learnerWorld.claims.earthShadowCausesPhases !==
          (analysis.learnerModel.misconceptionType === "earth-shadow-phases")
      ) {
        context.addIssue({
          code: "custom",
          path: ["learnerWorld", "claims"],
          message: "Moon learner claim must match the classified misconception",
        });
      }
    } else {
      if (analysis.learnerModel.misconceptionType === "earth-shadow-phases") {
        context.addIssue({
          code: "custom",
          path: ["learnerModel", "misconceptionType"],
          message: "Seasons analysis cannot use the Moon misconception",
        });
      }
      if (
        analysis.learnerWorld.scenario === "seasons" &&
        analysis.learnerWorld.claims.distanceCausesSeasons !==
          (analysis.learnerModel.misconceptionType === "distance-causes-seasons")
      ) {
        context.addIssue({
          code: "custom",
          path: ["learnerWorld", "claims"],
          message: "Seasons learner claim must match the classified misconception",
        });
      }
      if (
        analysis.learnerWorld.scenario === "seasons" &&
        analysis.learnerWorld.claims.distanceCausesSeasons &&
        analysis.learnerWorld.parameters.axialTiltDeg !== 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["learnerWorld", "parameters", "axialTiltDeg"],
          message: "A distance-only learner world must not also use axial tilt",
        });
      }
      if (
        analysis.scientificWorld.scenario === "seasons" &&
        (analysis.scientificWorld.parameters.axialTiltDeg < 23.4 ||
          analysis.scientificWorld.parameters.axialTiltDeg > 23.5)
      ) {
        context.addIssue({
          code: "custom",
          path: ["scientificWorld", "parameters", "axialTiltDeg"],
          message: "Scientific seasons world must use Earth's observed axial tilt",
        });
      }
    }

  });

export const Vector3Schema = z.strictObject({
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
});

export const RenderScaleSchema = z.strictObject({
  distanceScale: z.literal("logarithmic-normalized"),
  bodyRadiusScale: z.literal("visually-exaggerated"),
  label: z.literal("Not to scale"),
});

const ObservationIdentityFields = {
  caseId: stableId,
  caseFingerprint: boundedText(220),
  worldId: stableId,
  modelKind: ModelKindSchema,
  renderScale: RenderScaleSchema,
  accessibleText: boundedText(1_000),
};

export const MoonSimulationObservationSchema = z.strictObject({
  ...ObservationIdentityFields,
  scenario: z.literal("moon-phases"),
  physicalPositionsKm: z.strictObject({
    sun: Vector3Schema,
    earth: Vector3Schema,
    moon: Vector3Schema,
  }),
  incomingLightDirection: Vector3Schema,
  physicalObservation: z.strictObject({
    illuminationFraction: finiteNumber.min(0).max(1),
    earthShadowIntersection: z.enum(["none", "partial", "total"]),
  }),
  modelPrediction: z.strictObject({
    assumesEarthShadowMask: z.boolean(),
    cause: z.enum(["earth-shadow", "viewing-angle"]),
    predictedIlluminationFraction: finiteNumber.min(0).max(1),
  }),
});

export const SeasonsSimulationObservationSchema = z.strictObject({
  ...ObservationIdentityFields,
  scenario: z.literal("seasons"),
  physicalPositionsKm: z.strictObject({
    sun: Vector3Schema,
    earth: Vector3Schema,
  }),
  incomingLightDirection: Vector3Schema,
  physicalObservation: z.strictObject({
    solarDeclinationDeg: finiteNumber.min(-30).max(30),
    northernEnergy: finiteNumber.min(0).max(2),
    southernEnergy: finiteNumber.min(0).max(2),
    northernSeason: z.enum(["summer", "winter", "equinox-like"]),
    southernSeason: z.enum(["summer", "winter", "equinox-like"]),
  }),
  modelPrediction: z.strictObject({
    basis: z.enum(["distance-only", "axial-tilt"]),
    predictedSolarDeclinationDeg: finiteNumber.min(-30).max(30),
    predictedNorthernSeason: z.enum(["summer", "winter", "equinox-like"]),
    predictedSouthernSeason: z.enum(["summer", "winter", "equinox-like"]),
    predictsSameSeasonBothHemispheres: z.boolean(),
    contradictsObservedOppositeSeasons: z.boolean(),
    matchesPhysicalObservation: z.boolean(),
  }),
});

export const SimulationObservationSchema = z.discriminatedUnion("scenario", [
  MoonSimulationObservationSchema,
  SeasonsSimulationObservationSchema,
]);

export const TransferResultSchema = z.strictObject({
  receiptId: stableId,
  evaluationId: stableId,
  questionId: stableId,
  questionVersion: stableId,
  selectedOptionId: stableId,
  isCorrect: z.boolean(),
  score: finiteNumber.min(0).max(1),
  rationale: boundedText(500),
  evaluatedAt: finiteNumber.nonnegative(),
  source: z.enum(["deterministic-question-bank", "gpt-5.6"]),
}).superRefine((result, context) => {
  if (result.score !== (result.isCorrect ? 1 : 0)) {
    context.addIssue({
      code: "custom",
      path: ["score"],
      message: "Binary transfer score must agree with isCorrect",
    });
  }
});

export const RevisionFeedbackSchema = z.strictObject({
  conceptualChange: z.enum(["retained", "partial", "revised"]),
  score: finiteNumber.min(0).max(1),
  summary: boundedText(500),
  strengths: z.array(boundedText(240)).max(5),
  nextStep: boundedText(300),
});

export const RevisionTraceSchema = z
  .strictObject({
    scenarioId: ScenarioIdSchema,
    startedAt: finiteNumber.nonnegative(),
    inputSubmittedAt: finiteNumber.nonnegative(),
    analysisStartedAt: finiteNumber.nonnegative(),
    analysisReceivedAt: finiteNumber.nonnegative(),
    modelConfirmedAt: finiteNumber.nonnegative(),
    initialExplanation: z.string().trim().max(1_500),
    sketchReference: SketchReferenceSchema.nullable(),
    learnerModelSummary: boundedText(500),
    prediction: z.strictObject({
      questionId: stableId,
      optionId: stableId,
      selectedAt: finiteNumber.nonnegative(),
      lockedAt: finiteNumber.nonnegative(),
    }),
    observation: z.strictObject({
      caseFingerprint: boundedText(220),
      learner: SimulationObservationSchema,
      scientific: SimulationObservationSchema,
      startedAt: finiteNumber.nonnegative(),
      completedAt: finiteNumber.nonnegative(),
    }),
    revision: z.strictObject({
      text: boundedText(1_500),
      submittedAt: finiteNumber.nonnegative(),
      feedbackEvaluatedAt: finiteNumber.nonnegative(),
      feedback: RevisionFeedbackSchema,
    }),
    transfer: z.strictObject({
      evaluationId: stableId,
      questionId: stableId,
      questionVersion: stableId,
      selectedOptionId: stableId,
      selectedAt: finiteNumber.nonnegative(),
      lockedAt: finiteNumber.nonnegative(),
      result: TransferResultSchema,
    }),
    completedAt: finiteNumber.nonnegative(),
  })
  .superRefine((trace, context) => {
    if (
      trace.observation.learner.scenario !== trace.scenarioId ||
      trace.observation.scientific.scenario !== trace.scenarioId ||
      trace.observation.learner.modelKind !== "learner" ||
      trace.observation.scientific.modelKind !== "scientific" ||
      trace.observation.learner.caseId !== trace.observation.scientific.caseId ||
      trace.observation.learner.caseFingerprint !==
        trace.observation.caseFingerprint ||
      trace.observation.scientific.caseFingerprint !==
        trace.observation.caseFingerprint
    ) {
      context.addIssue({
        code: "custom",
        path: ["observation"],
        message: "Trace observations must share one scenario and case fingerprint",
      });
    }

    if (trace.completedAt !== trace.transfer.result.evaluatedAt) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "Trace completion must match transfer evaluation time",
      });
    }

    if (
      trace.transfer.evaluationId !== trace.transfer.result.evaluationId ||
      trace.transfer.questionId !== trace.transfer.result.questionId ||
      trace.transfer.questionVersion !== trace.transfer.result.questionVersion ||
      trace.transfer.selectedOptionId !== trace.transfer.result.selectedOptionId
    ) {
      context.addIssue({
        code: "custom",
        path: ["transfer"],
        message: "Trace transfer identity must match its evaluated result",
      });
    }

    const timestamps = [
      trace.startedAt,
      trace.inputSubmittedAt,
      trace.analysisStartedAt,
      trace.analysisReceivedAt,
      trace.modelConfirmedAt,
      trace.prediction.selectedAt,
      trace.prediction.lockedAt,
      trace.observation.startedAt,
      trace.observation.completedAt,
      trace.revision.submittedAt,
      trace.revision.feedbackEvaluatedAt,
      trace.transfer.selectedAt,
      trace.transfer.lockedAt,
      trace.transfer.result.evaluatedAt,
      trace.completedAt,
    ];

    if (timestamps.some((value, index) => index > 0 && value < timestamps[index - 1])) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "RevisionTrace timestamps must be monotonically nondecreasing",
      });
    }
  });

export type ScenarioId = z.infer<typeof ScenarioIdSchema>;
export type ModelKind = z.infer<typeof ModelKindSchema>;
export type Body = z.infer<typeof BodySchema>;
export type MisconceptionType = z.infer<typeof MisconceptionTypeSchema>;
export type LearnerModel = z.infer<typeof LearnerModelSchema>;
export type SketchReference = z.infer<typeof SketchReferenceSchema>;
export type MoonCaseSpec = z.infer<typeof MoonCaseSpecSchema>;
export type SeasonsCaseSpec = z.infer<typeof SeasonsCaseSpecSchema>;
export type CaseSpec = z.infer<typeof CaseSpecSchema>;
export type WorldSpec = z.infer<typeof WorldSpecSchema>;
export type PredictionQuestion = z.infer<typeof PredictionQuestionSchema>;
export type TransferQuestion = z.infer<typeof TransferQuestionSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type SimulationObservation = z.infer<typeof SimulationObservationSchema>;
export type TransferResult = z.infer<typeof TransferResultSchema>;
export type RevisionFeedback = z.infer<typeof RevisionFeedbackSchema>;
export type RevisionTrace = z.infer<typeof RevisionTraceSchema>;
