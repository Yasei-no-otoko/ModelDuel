import { z } from "zod";

import {
  RevisionFeedbackSchema,
  ScenarioIdSchema,
} from "../../lib/modelduel/schemas";

const RevisionRubricInputSchema = z
  .object({
    scenarioId: ScenarioIdSchema,
    revisionText: z.string().trim().min(1).max(1_500),
  })
  .strict();

type ConceptGroup = Readonly<{
  id: string;
  strength: string;
  matches: (text: string) => boolean;
}>;

type AuthoredRubric = Readonly<{
  groups: readonly ConceptGroup[];
  fullSummary: string;
  partialSummary: string;
  retainedSummary: string;
  fullNextStep: string;
  missingNextSteps: Readonly<Record<string, string>>;
}>;

function moonIlluminationRelation(text: string): boolean {
  const negated =
    /\b(?:sun|sunlight)\b.{0,30}\b(?:is not|isn't|isnt|does not|doesn't|doesnt|never)\b.{0,35}\b(?:involved|illuminat(?:e|es|ing)|light(?:s|ing)?)\b/i.test(
      text,
    ) || /\b(?:not|without)\b.{0,12}\b(?:sun|sunlight)\b/i.test(text);
  if (negated || !/\bmoon\b/i.test(text)) {
    return false;
  }

  return (
    /\b(?:sun|sunlight)\b.{0,45}\b(?:illuminates?|lights?|shines? on)\b.{0,45}\b(?:half|one half|one side)\b/i.test(
      text,
    ) ||
    /\b(?:half|one half|one side)\b.{0,35}\b(?:of (?:the )?moon|moon)\b.{0,45}\b(?:illuminated|lit)\b.{0,25}\b(?:by|from)\b.{0,15}\b(?:the )?(?:sun|sunlight)\b/i.test(
      text,
    )
  );
}

function moonViewpointRelation(text: string): boolean {
  const negated =
    /\b(?:view(?:ing)?|angle|position|perspective)\b.{0,30}\b(?:does not|doesn't|doesnt|is not|isn't|isnt|never)\b.{0,30}\b(?:matter|change|reveal|determine|involved|relevant)\b/i.test(
      text,
    );
  const negatedObservation =
    /\b(?:do(?:es)?\s+not|don't|doesn't|dont|doesnt|never)\s+(?:see|observe|reveal)\b.{0,30}\b(?:different|changing|visible|lit|illuminated)?\s*(?:fractions?|portions?|parts?)\b/i.test(
      text,
    );
  if (negated || negatedObservation) {
    return false;
  }

  return (
    /\b(?:view(?:ing)?(?: angle)?|angle|position|perspective)\b.{0,45}\b(?:changes?|reveals?|determines?|shows?|controls?)\b.{0,35}\b(?:visible|lit|illuminated)?\s*(?:fraction|portion|part|half)\b/i.test(
      text,
    ) ||
    /\b(?:visible|lit|illuminated)\s+(?:fraction|portion|part|half)\b.{0,40}\b(?:changes?|depends?)\b.{0,55}\b(?:view(?:ing)?|angle|position|perspective)\b/i.test(
      text,
    ) ||
    /\b(?:orbit|orbital\s+position|position)\b.{0,35}\b(?:chang(?:e(?:s|d)?|ing)|shift(?:s|ed|ing)?|alter(?:s|ed|ing)?)\b.{0,30}\b(?:our\s+)?(?:view(?:ing)?\s+angle|viewpoint|perspective)\b.{0,55}\b(?:see(?:s|ing)?|reveal(?:s|ed|ing)?|show(?:s|ed|ing)?)\b.{0,30}\b(?:different|changing|visible|lit|illuminated)?\s*(?:fractions?|portions?|parts?)\b/i.test(
      text,
    )
  );
}

function moonShadowDistinction(text: string): boolean {
  if (moonRetainsMisconception(text)) {
    return false;
  }

  return (
    /\bearth'?s shadow\b.{0,25}\b(?:does not|doesn't|doesnt|cannot|can't|cant)\b.{0,25}\b(?:cause|make|create|produce|intersect|cover)\b/i.test(
      text,
    ) ||
    /\bearth'?s shadow\b.{0,25}\b(?:is not|isn't|isnt)\b.{0,15}\b(?:the )?(?:cause|mechanism|reason|responsible)\b/i.test(
      text,
    ) ||
    /\b(?:ordinary )?phases?\b.{0,30}\b(?:are not|aren't|arent|do not|don't|dont)\b.{0,30}\b(?:caused|made|produced)?\b.{0,20}\b(?:by )?earth'?s shadow\b/i.test(
      text,
    ) ||
    /\bearth'?s shadow\b.{0,30}\bonly\b.{0,30}\b(?:during|causes?|creates?|produces?)?\s*(?:an )?eclipse\b/i.test(
      text,
    )
  );
}

function moonRetainsMisconception(text: string): boolean {
  return (
    /\bearth'?s shadow\b\s+(?:(?:actually|directly|really)\s+)?(?:causes?|makes?|creates?|produces?)\s+(?:(?:ordinary|lunar|the moon'?s)\s+)?phases?\b/i.test(
      text,
    ) ||
    /\b(?:(?:ordinary|lunar|the moon'?s)\s+)?phases?\b\s+(?:are|is)\s+(?:(?:actually|directly|really)\s+)?(?:caused|made|created|produced)\s+by\s+earth'?s shadow\b/i.test(
      text,
    )
  );
}

function seasonsTiltRelation(text: string): boolean {
  const negated =
    /\b(?:tilt|axis|axial)\b.{0,35}\b(?:is not|isn't|isnt|does not|doesn't|doesnt|never)\b.{0,30}\b(?:involved|matter|cause|affect|relevant)\b/i.test(
      text,
    );
  if (negated) {
    return false;
  }

  return /\b(?:(?:the )?earth'?s )?(?:axis is tilted|axial tilt|tilt of (?:the )?earth|earth'?s tilt)\b/i.test(
    text,
  );
}

function seasonsHemisphereRelation(text: string): boolean {
  const sameSeason =
    /\b(?:hemispheres?|north(?:ern)?|south(?:ern)?)\b.{0,55}\b(?:same|identical)\b.{0,20}\bseasons?\b/i.test(
      text,
    );
  if (sameSeason) {
    return false;
  }

  return (
    /\bhemispheres?\b.{0,55}\b(?:opposite|different|reverse)\b.{0,20}\bseasons?\b/i.test(
      text,
    ) ||
    /\b(?:north(?:ern)?|south(?:ern)?)\b.{0,35}\b(?:and|versus|while)\b.{0,20}\b(?:north(?:ern)?|south(?:ern)?)\b.{0,55}\b(?:opposite|different|reverse)\b.{0,20}\bseasons?\b/i.test(
      text,
    )
  );
}

function seasonsSolarRelation(text: string): boolean {
  const negated =
    /\b(?:sunlight|solar|light|angle|energy)\b.{0,30}\b(?:is not|isn't|isnt|does not|doesn't|doesnt|never)\b.{0,30}\b(?:involved|matter|change|affect|relevant)\b/i.test(
      text,
    );
  if (negated) {
    return false;
  }

  return (
    /\b(?:receives?|gets?)\b.{0,30}\b(?:sunlight|solar energy)\b.{0,35}\b(?:angle|direct|indirect|energy|concentrat(?:e|ed|ion))\b/i.test(
      text,
    ) ||
    /\b(?:sunlight|solar energy)\b.{0,40}\b(?:angle|direct|indirect|concentrat(?:e|ed|ion)|more energy|less energy)\b/i.test(
      text,
    )
  );
}

function seasonsRetainsMisconception(text: string): boolean {
  return (
    /\b(?:earth'?s\s+)?(?:distance|proximity|closeness)\s+(?:from|to)\s+(?:the\s+)?sun\b\s+(?:(?:actually|directly|really)\s+)?(?:causes?|makes?|creates?|produces?)\s+(?:the\s+)?(?:seasons?|summer|winter)\b/i.test(
      text,
    ) ||
    /\b(?:seasons?|summer|winter)\b\s+(?:are|is)\s+(?:(?:actually|directly|really)\s+)?(?:caused|made|created|produced)\s+by\s+(?:the\s+)?earth\s+(?:being\s+)?(?:closer|farther|further|nearer)\s+(?:to|from)\s+(?:the\s+)?sun\b/i.test(
      text,
    )
  );
}

const MOON_RUBRIC: AuthoredRubric = {
  groups: [
    {
      id: "illumination",
      strength: "Identifies sunlight illuminating half of the Moon.",
      matches: moonIlluminationRelation,
    },
    {
      id: "viewpoint",
      strength: "Connects the observed phase to viewing geometry from Earth.",
      matches: moonViewpointRelation,
    },
    {
      id: "shadow-distinction",
      strength: "Distinguishes ordinary lunar phases from an eclipse or shadow.",
      matches: moonShadowDistinction,
    },
  ],
  fullSummary:
    "The revision causally connects sunlight, Earth's viewing geometry, and the distinction between lunar phases and eclipses.",
  partialSummary:
    "The revision includes part of the scientific model, but one or more causal links are still incomplete.",
  retainedSummary:
    "The revision does not yet replace the shadow model with a causal illumination-and-viewpoint explanation.",
  fullNextStep:
    "Apply the same model to predict which part of the Moon is illuminated at first quarter.",
  missingNextSteps: {
    illumination:
      "Explain that sunlight always illuminates half of the Moon.",
    viewpoint:
      "Explain how the visible fraction changes with the viewing angle from Earth.",
    "shadow-distinction":
      "State why Earth's shadow produces an eclipse, not the ordinary sequence of phases.",
  },
};

const SEASONS_RUBRIC: AuthoredRubric = {
  groups: [
    {
      id: "axial-tilt",
      strength: "Identifies Earth's axial tilt as the seasonal mechanism.",
      matches: seasonsTiltRelation,
    },
    {
      id: "hemispheres",
      strength: "Recognizes that the hemispheres experience opposite seasons.",
      matches: seasonsHemisphereRelation,
    },
    {
      id: "solar-energy",
      strength: "Connects seasonality to the angle or concentration of sunlight.",
      matches: seasonsSolarRelation,
    },
  ],
  fullSummary:
    "The revision causally connects axial tilt, opposite hemispheres, and the changing angle or concentration of sunlight.",
  partialSummary:
    "The revision includes part of the axial-tilt model, but one or more causal links are still incomplete.",
  retainedSummary:
    "The revision does not yet replace the distance model with a causal axial-tilt explanation.",
  fullNextStep:
    "Use the same model to predict the season in the Southern Hemisphere when the Northern Hemisphere tilts toward the Sun.",
  missingNextSteps: {
    "axial-tilt": "Name Earth's axial tilt as the cause of seasonal change.",
    hemispheres:
      "Explain why the Northern and Southern Hemispheres have opposite seasons.",
    "solar-energy":
      "Connect tilt to the angle or concentration of incoming sunlight.",
  },
};

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
}

function hasCausalRelation(text: string): boolean {
  const connector =
    /\b(?:because|therefore|which means|as a result|due to|so that|so)\b/gi;
  for (const match of text.matchAll(connector)) {
    const index = match.index ?? -1;
    if (index < 0) {
      continue;
    }
    const left = words(text.slice(0, index));
    const right = words(text.slice(index + match[0].length));
    if (left.length >= 3 && right.length >= 3) {
      return true;
    }
  }
  return false;
}

function hasExplanatoryVerb(text: string): boolean {
  return /\b(?:is|are|causes?|changes?|depends?|receives?|appears?|happens?|occurs?|faces?|see|sees|means|results?|leads?)\b/i.test(
    text,
  );
}

function rubricFor(scenarioId: string): AuthoredRubric {
  if (scenarioId === "moon-phases") {
    return MOON_RUBRIC;
  }
  if (scenarioId === "seasons") {
    return SEASONS_RUBRIC;
  }
  throw new Error("Unsupported authored rubric scenario");
}

export function evaluateRevisionRubric(input: {
  scenarioId: string;
  revisionText: string;
}): z.output<typeof RevisionFeedbackSchema> {
  const parsed = RevisionRubricInputSchema.parse(input);
  const rubric = rubricFor(parsed.scenarioId);
  const matched = rubric.groups.filter((group) =>
    group.matches(parsed.revisionText),
  );
  const matchedIds = new Set(matched.map((group) => group.id));
  const missing = rubric.groups.filter((group) => !matchedIds.has(group.id));
  const wordCount = words(parsed.revisionText).length;
  const causal = hasCausalRelation(parsed.revisionText);
  const explanatory = hasExplanatoryVerb(parsed.revisionText);
  const retainsMisconception =
    parsed.scenarioId === "moon-phases"
      ? moonRetainsMisconception(parsed.revisionText)
      : seasonsRetainsMisconception(parsed.revisionText);
  const isRevised =
    !retainsMisconception &&
    matched.length === rubric.groups.length &&
    causal &&
    explanatory &&
    wordCount >= 12;
  const isPartial =
    !isRevised &&
    ((matched.length >= 2 && (causal || explanatory)) ||
      (matched.length === rubric.groups.length && wordCount >= 8));

  const conceptualChange = isRevised
    ? "revised"
    : isPartial
      ? "partial"
      : "retained";
  const score = isRevised ? 1 : isPartial ? 0.5 : 0;
  const nextStep = isRevised
    ? rubric.fullNextStep
    : (rubric.missingNextSteps[
        missing[0]?.id ?? rubric.groups[0]?.id ?? ""
      ] ??
      rubric.fullNextStep);

  return RevisionFeedbackSchema.parse({
    conceptualChange,
    score,
    summary: isRevised
      ? rubric.fullSummary
      : isPartial
        ? rubric.partialSummary
        : rubric.retainedSummary,
    strengths: matched.map((group) => group.strength),
    nextStep,
  });
}
