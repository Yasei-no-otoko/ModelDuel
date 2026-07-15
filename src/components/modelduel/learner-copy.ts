import type { LearnerModel } from "@/lib/modelduel";

type CausalRelation = LearnerModel["causalRelations"][number];
type CausalRelationCopyInput = Pick<
  CausalRelation,
  "subject" | "relation" | "object"
>;

const SUBJECT_LABELS = {
  sun: "The Sun",
  earth: "Earth",
  moon: "The Moon",
} as const satisfies Record<CausalRelation["subject"], string>;

const OBJECT_LABELS = {
  sun: "the Sun",
  earth: "Earth",
  moon: "the Moon",
} as const satisfies Record<CausalRelation["object"], string>;

const RELATION_PHRASES = {
  illuminates: "illuminates",
  orbits: "orbits",
  "casts-shadow-on": "casts a shadow on",
  "changes-apparent-phase": "changes the apparent phase of",
  "causes-seasonal-energy": "changes the seasonal energy received by",
} as const satisfies Record<CausalRelation["relation"], string>;

export function formatCausalRelation(
  relation: CausalRelationCopyInput,
): string {
  return `${SUBJECT_LABELS[relation.subject]} ${RELATION_PHRASES[relation.relation]} ${OBJECT_LABELS[relation.object]}.`;
}
