import {
  CaseSpecSchema,
  MoonSimulationObservationSchema,
  SeasonsSimulationObservationSchema,
  WorldSpecSchema,
} from "./schemas";
import type {
  CaseSpec,
  SimulationObservation,
  WorldSpec,
} from "./schemas";

export type Vector3 = Readonly<{ x: number; y: number; z: number }>;
export type EarthShadowIntersection = "none" | "partial" | "total";
export type MoonSimulationObservation = Extract<
  SimulationObservation,
  { scenario: "moon-phases" }
>;
export type SeasonsSimulationObservation = Extract<
  SimulationObservation,
  { scenario: "seasons" }
>;

type MoonWorldSpec = Extract<WorldSpec, { scenario: "moon-phases" }>;
type SeasonsWorldSpec = Extract<WorldSpec, { scenario: "seasons" }>;
type MoonCaseSpec = Extract<CaseSpec, { scenario: "moon-phases" }>;
type SeasonsCaseSpec = Extract<CaseSpec, { scenario: "seasons" }>;

export const ASTRONOMY_CONSTANTS_KM = Object.freeze({
  sunRadius: 696_340,
  earthRadius: 6_371,
  moonRadius: 1_737.4,
  earthSunDistance: 149_597_870.7,
  earthMoonDistance: 384_400,
});

const RENDER_SCALE = Object.freeze({
  distanceScale: "logarithmic-normalized",
  bodyRadiusScale: "visually-exaggerated",
  label: "Not to scale",
});

export class SimulationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SimulationInputError";
  }
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const round = (value: number, digits = 6) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};
const fingerprintNumber = (value: number) => value.toFixed(6);

export function createCaseFingerprint(caseSpec: CaseSpec): string {
  return caseSpec.scenario === "moon-phases"
    ? [
        "case-v1",
        caseSpec.scenario,
        `id=${caseSpec.id}`,
        `elongation=${fingerprintNumber(caseSpec.elongationDeg)}`,
        `latitude=${fingerprintNumber(caseSpec.lunarOrbitLatitudeDeg)}`,
      ].join("|")
    : [
        "case-v1",
        caseSpec.scenario,
        `id=${caseSpec.id}`,
        `longitude=${fingerprintNumber(caseSpec.earthSolarLongitudeDeg)}`,
        `distance=${fingerprintNumber(caseSpec.earthSunDistanceAu)}`,
        `latitude=${fingerprintNumber(caseSpec.latitudeDeg)}`,
        `observed-tilt=${fingerprintNumber(caseSpec.observedAxialTiltDeg)}`,
      ].join("|");
}

export function moonIlluminationFraction(elongationDeg: number): number {
  return round((1 - Math.cos(toRadians(elongationDeg))) / 2);
}

function moonPositionKm(caseSpec: MoonCaseSpec): Vector3 {
  const longitude = toRadians(caseSpec.elongationDeg);
  const latitude = toRadians(caseSpec.lunarOrbitLatitudeDeg);
  const radius = ASTRONOMY_CONSTANTS_KM.earthMoonDistance;
  return {
    x: round(radius * Math.cos(latitude) * Math.cos(longitude), 3),
    y: round(radius * Math.cos(latitude) * Math.sin(longitude), 3),
    z: round(radius * Math.sin(latitude), 3),
  };
}

function classifyEarthShadowIntersection(
  moonPosition: Vector3,
): EarthShadowIntersection {
  const axialDistanceKm = -moonPosition.x;
  const umbraLengthKm =
    (ASTRONOMY_CONSTANTS_KM.earthSunDistance *
      ASTRONOMY_CONSTANTS_KM.earthRadius) /
    (ASTRONOMY_CONSTANTS_KM.sunRadius -
      ASTRONOMY_CONSTANTS_KM.earthRadius);

  if (axialDistanceKm <= 0 || axialDistanceKm >= umbraLengthKm) {
    return "none";
  }

  const umbraRadiusKm =
    ASTRONOMY_CONSTANTS_KM.earthRadius *
    (1 - axialDistanceKm / umbraLengthKm);
  const perpendicularDistanceKm = Math.hypot(
    moonPosition.y,
    moonPosition.z,
  );

  if (
    perpendicularDistanceKm + ASTRONOMY_CONSTANTS_KM.moonRadius <=
    umbraRadiusKm
  ) {
    return "total";
  }

  if (
    perpendicularDistanceKm <
    umbraRadiusKm + ASTRONOMY_CONSTANTS_KM.moonRadius
  ) {
    return "partial";
  }

  return "none";
}

function simulateMoonWorld(
  world: MoonWorldSpec,
  caseSpec: MoonCaseSpec,
): MoonSimulationObservation {
  const moon = moonPositionKm(caseSpec);
  const illuminationFraction = moonIlluminationFraction(
    caseSpec.elongationDeg,
  );
  const earthShadowIntersection = classifyEarthShadowIntersection(moon);
  const assumesEarthShadowMask = world.claims.earthShadowCausesPhases;
  const predictedIlluminationFraction = assumesEarthShadowMask
    ? round(1 - world.parameters.assumedShadowMaskFraction)
    : illuminationFraction;
  const physicalSummary =
    earthShadowIntersection === "none"
      ? "There is no physical overlap with Earth's umbral shadow."
      : `The Moon has a ${earthShadowIntersection} umbral intersection.`;
  const modelSummary = assumesEarthShadowMask
    ? "This learner model attributes the phase to an assumed Earth-shadow mask."
    : "This model attributes the phase to illumination and viewing angle.";

  return MoonSimulationObservationSchema.parse({
    caseId: caseSpec.id,
    caseFingerprint: createCaseFingerprint(caseSpec),
    worldId: world.worldId,
    scenario: "moon-phases",
    modelKind: world.modelKind,
    physicalPositionsKm: {
      sun: {
        x: ASTRONOMY_CONSTANTS_KM.earthSunDistance,
        y: 0,
        z: 0,
      },
      earth: { x: 0, y: 0, z: 0 },
      moon,
    },
    incomingLightDirection: { x: -1, y: 0, z: 0 },
    physicalObservation: {
      illuminationFraction,
      earthShadowIntersection,
    },
    modelPrediction: {
      assumesEarthShadowMask,
      cause: assumesEarthShadowMask ? "earth-shadow" : "viewing-angle",
      predictedIlluminationFraction,
    },
    renderScale: RENDER_SCALE,
    accessibleText: `The Moon is ${Math.round(
      illuminationFraction * 100,
    )}% illuminated at ${caseSpec.elongationDeg} degrees elongation. ${physicalSummary} ${modelSummary}`,
  });
}

export function solarDeclinationDeg(
  axialTiltDeg: number,
  earthSolarLongitudeDeg: number,
): number {
  return round(
    toDegrees(
      Math.asin(
        Math.sin(toRadians(axialTiltDeg)) *
          Math.sin(toRadians(earthSolarLongitudeDeg)),
      ),
    ),
  );
}

function surfaceEnergy(
  latitudeDeg: number,
  declinationDeg: number,
  distanceAu: number,
) {
  const incidence = Math.max(
    0,
    Math.cos(toRadians(latitudeDeg - declinationDeg)),
  );
  return round(incidence / distanceAu ** 2);
}

function seasonsFromEnergy(
  northernEnergy: number,
  southernEnergy: number,
): Readonly<{
  northern: "summer" | "winter" | "equinox-like";
  southern: "summer" | "winter" | "equinox-like";
}> {
  const difference = northernEnergy - southernEnergy;
  if (Math.abs(difference) < 0.05) {
    return { northern: "equinox-like", southern: "equinox-like" };
  }
  return difference > 0
    ? { northern: "summer", southern: "winter" }
    : { northern: "winter", southern: "summer" };
}

function simulateSeasonsWorld(
  world: SeasonsWorldSpec,
  caseSpec: SeasonsCaseSpec,
): SeasonsSimulationObservation {
  const longitude = toRadians(caseSpec.earthSolarLongitudeDeg);
  const distanceKm =
    caseSpec.earthSunDistanceAu * ASTRONOMY_CONSTANTS_KM.earthSunDistance;
  const observedSolarDeclination = solarDeclinationDeg(
    caseSpec.observedAxialTiltDeg,
    caseSpec.earthSolarLongitudeDeg,
  );
  const northernEnergy = surfaceEnergy(
    caseSpec.latitudeDeg,
    observedSolarDeclination,
    caseSpec.earthSunDistanceAu,
  );
  const southernEnergy = surfaceEnergy(
    -caseSpec.latitudeDeg,
    observedSolarDeclination,
    caseSpec.earthSunDistanceAu,
  );
  const seasons = seasonsFromEnergy(northernEnergy, southernEnergy);
  const usesDistanceOnly = world.claims.distanceCausesSeasons;
  const predictedSolarDeclination = usesDistanceOnly
    ? 0
    : solarDeclinationDeg(
        world.parameters.axialTiltDeg,
        caseSpec.earthSolarLongitudeDeg,
      );
  const predictedNorthernEnergy = surfaceEnergy(
    caseSpec.latitudeDeg,
    predictedSolarDeclination,
    caseSpec.earthSunDistanceAu,
  );
  const predictedSouthernEnergy = surfaceEnergy(
    -caseSpec.latitudeDeg,
    predictedSolarDeclination,
    caseSpec.earthSunDistanceAu,
  );
  const predictedSeasons = seasonsFromEnergy(
    predictedNorthernEnergy,
    predictedSouthernEnergy,
  );
  const matchesPhysicalObservation =
    predictedSeasons.northern === seasons.northern &&
    predictedSeasons.southern === seasons.southern;

  return SeasonsSimulationObservationSchema.parse({
    caseId: caseSpec.id,
    caseFingerprint: createCaseFingerprint(caseSpec),
    worldId: world.worldId,
    scenario: "seasons",
    modelKind: world.modelKind,
    physicalPositionsKm: {
      sun: { x: 0, y: 0, z: 0 },
      earth: {
        x: round(distanceKm * Math.cos(longitude), 3),
        y: round(distanceKm * Math.sin(longitude), 3),
        z: 0,
      },
    },
    incomingLightDirection: {
      x: round(Math.cos(longitude)),
      y: round(Math.sin(longitude)),
      z: 0,
    },
    physicalObservation: {
      solarDeclinationDeg: observedSolarDeclination,
      northernEnergy,
      southernEnergy,
      northernSeason: seasons.northern,
      southernSeason: seasons.southern,
    },
    modelPrediction: {
      basis: usesDistanceOnly ? "distance-only" : "axial-tilt",
      predictedSolarDeclinationDeg: predictedSolarDeclination,
      predictedNorthernSeason: predictedSeasons.northern,
      predictedSouthernSeason: predictedSeasons.southern,
      predictsSameSeasonBothHemispheres: usesDistanceOnly,
      contradictsObservedOppositeSeasons:
        usesDistanceOnly && !matchesPhysicalObservation,
      matchesPhysicalObservation,
    },
    renderScale: RENDER_SCALE,
    accessibleText: `Observed at ${caseSpec.latitudeDeg} degrees north and south, relative energy is ${northernEnergy} and ${southernEnergy}, with solar declination ${observedSolarDeclination} degrees. This world predicts ${predictedSeasons.northern} in the north and ${predictedSeasons.southern} in the south.`,
  });
}

export function simulateWorld(
  worldInput: unknown,
  caseSpecInput: unknown,
): SimulationObservation {
  const worldResult = WorldSpecSchema.safeParse(worldInput);
  if (!worldResult.success) {
    throw new SimulationInputError("WorldSpec failed strict validation");
  }

  const caseResult = CaseSpecSchema.safeParse(caseSpecInput);
  if (!caseResult.success) {
    throw new SimulationInputError("CaseSpec failed strict validation");
  }

  const world = worldResult.data;
  const caseSpec = caseResult.data;
  if (world.scenario !== caseSpec.scenario) {
    throw new SimulationInputError("WorldSpec and CaseSpec scenarios must match");
  }

  if (world.scenario === "moon-phases") {
    if (caseSpec.scenario !== "moon-phases") {
      throw new SimulationInputError("Moon world requires a Moon CaseSpec");
    }
    return simulateMoonWorld(world, caseSpec);
  }

  if (caseSpec.scenario !== "seasons") {
    throw new SimulationInputError("Seasons world requires a Seasons CaseSpec");
  }
  return simulateSeasonsWorld(world, caseSpec);
}
