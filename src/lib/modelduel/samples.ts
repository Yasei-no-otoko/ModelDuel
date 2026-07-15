import { AnalysisResultSchema } from "./schemas";

export const MOON_HERO_SAMPLE = AnalysisResultSchema.parse({
  scenarioId: "moon-phases",
  metadata: {
    mode: "verified-sample",
    modelId: null,
    analyzedSubmission: false,
    orchestrationToolNames: [],
  },
  learnerModel: {
    summary: "Earth's shadow moves across the Moon and creates its phases.",
    entities: ["sun", "earth", "moon"],
    causalRelations: [
      { subject: "earth", relation: "casts-shadow-on", object: "moon" },
    ],
    spatialRelations: [
      {
        subject: "moon",
        relation: "near-shadow-axis",
        reference: "earth",
      },
    ],
    predictedObservations: [
      "At first quarter, Earth's shadow should mask half of the Moon.",
    ],
    confidence: 0.74,
    misconceptionType: "earth-shadow-phases",
  },
  caseSpec: {
    id: "moon-first-quarter-at-sunset",
    scenario: "moon-phases",
    elongationDeg: 90,
    lunarOrbitLatitudeDeg: 0,
  },
  learnerWorld: {
    version: "1.0",
    worldId: "moon-learner-shadow-v1",
    scenario: "moon-phases",
    modelKind: "learner",
    bodies: ["sun", "earth", "moon"],
    claims: { earthShadowCausesPhases: true },
    parameters: { assumedShadowMaskFraction: 0.5 },
  },
  scientificWorld: {
    version: "1.0",
    worldId: "moon-scientific-light-v1",
    scenario: "moon-phases",
    modelKind: "scientific",
    bodies: ["sun", "earth", "moon"],
    claims: { earthShadowCausesPhases: false },
    parameters: { assumedShadowMaskFraction: 0 },
  },
  predictionQuestion: {
    id: "moon-first-quarter-prediction",
    version: "moon-prediction-v1",
    prompt:
      "At sunset, what relationship should a first-quarter Moon have to the incoming sunlight and Earth's shadow?",
    options: [
      {
        id: "shadow-masks-half",
        label: "Earth's shadow masks half of the Moon",
      },
      {
        id: "view-reveals-half",
        label: "Our viewing angle reveals half of the sunlit side",
      },
      {
        id: "both-same-cause",
        label: "Both descriptions predict the same cause",
      },
    ],
  },
  transferQuestion: {
    evaluationId: "moon-transfer-evaluation-v1",
    questionId: "moon-new-phase-transfer",
    version: "moon-transfer-v1",
    prompt:
      "For a new Moon, which arrangement places the Moon's lit half mostly away from Earth?",
    options: [
      { id: "toward-sun", label: "The Moon is in the Sun's direction" },
      { id: "away-from-sun", label: "The Moon is opposite the Sun" },
      { id: "above-pole", label: "The Moon is above Earth's north pole" },
    ],
  },
});

export const SEASONS_SAMPLE = AnalysisResultSchema.parse({
  scenarioId: "seasons",
  metadata: {
    mode: "verified-sample",
    modelId: null,
    analyzedSubmission: false,
    orchestrationToolNames: [],
  },
  learnerModel: {
    summary: "Summer happens when Earth is closer to the Sun.",
    entities: ["sun", "earth"],
    causalRelations: [
      { subject: "sun", relation: "causes-seasonal-energy", object: "earth" },
    ],
    spatialRelations: [
      { subject: "earth", relation: "orbits", reference: "sun" },
    ],
    predictedObservations: [
      "Both hemispheres should have the same season because they share one distance.",
    ],
    confidence: 0.69,
    misconceptionType: "distance-causes-seasons",
  },
  caseSpec: {
    id: "seasons-june-solstice",
    scenario: "seasons",
    earthSolarLongitudeDeg: 90,
    earthSunDistanceAu: 1.017,
    latitudeDeg: 45,
    observedAxialTiltDeg: 23.44,
  },
  learnerWorld: {
    version: "1.0",
    worldId: "seasons-learner-distance-v1",
    scenario: "seasons",
    modelKind: "learner",
    bodies: ["sun", "earth"],
    claims: { distanceCausesSeasons: true },
    parameters: { axialTiltDeg: 0 },
  },
  scientificWorld: {
    version: "1.0",
    worldId: "seasons-scientific-tilt-v1",
    scenario: "seasons",
    modelKind: "scientific",
    bodies: ["sun", "earth"],
    claims: { distanceCausesSeasons: false },
    parameters: { axialTiltDeg: 23.44 },
  },
  predictionQuestion: {
    id: "seasons-june-hemispheres",
    version: "seasons-prediction-v1",
    prompt:
      "At the same June orbital position, what should observers at 45 degrees north and south experience?",
    options: [
      { id: "both-warmer", label: "Both hemispheres become warmer together" },
      {
        id: "opposite-energy",
        label: "One receives more direct light while the other receives less",
      },
      { id: "distance-only", label: "Only orbital distance changes the result" },
    ],
  },
  transferQuestion: {
    evaluationId: "seasons-transfer-evaluation-v1",
    questionId: "seasons-december-transfer",
    version: "seasons-transfer-v1",
    prompt:
      "At the December orbital position, how should the hemisphere energy contrast change?",
    options: [
      { id: "reverse", label: "The higher-energy hemisphere reverses" },
      { id: "stay-north", label: "The north remains higher-energy" },
      { id: "equal", label: "Both remain equal at every latitude" },
    ],
  },
});
