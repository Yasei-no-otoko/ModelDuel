import { describe, expect, it } from "vitest";

import { formatCausalRelation } from "./learner-copy";

describe("learner-facing causal relation copy", () => {
  it.each([
    ["sun", "illuminates", "moon", "The Sun illuminates the Moon."],
    ["moon", "orbits", "earth", "The Moon orbits Earth."],
    [
      "earth",
      "casts-shadow-on",
      "moon",
      "Earth casts a shadow on the Moon.",
    ],
    [
      "earth",
      "changes-apparent-phase",
      "moon",
      "Earth changes the apparent phase of the Moon.",
    ],
    [
      "sun",
      "causes-seasonal-energy",
      "earth",
      "The Sun changes the seasonal energy received by Earth.",
    ],
  ] as const)(
    "formats %s %s %s without exposing the DSL token",
    (subject, relation, object, expected) => {
      const copy = formatCausalRelation({ subject, relation, object });
      expect(copy).toBe(expected);
      expect(copy).not.toMatch(
        /casts-shadow-on|changes-apparent-phase|causes-seasonal-energy/,
      );
    },
  );
});
