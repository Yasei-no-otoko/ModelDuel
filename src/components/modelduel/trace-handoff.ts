export const TRACE_HANDOFF_FILENAME = "modelduel-revision-trace.txt";

export type TraceHandoffContent = Readonly<{
  scenario: string;
  evidenceSource: string;
  initialBeliefLabel: string;
  initialBelief: string;
  lockedPrediction: string;
  observationLabel: string;
  observation: string;
  revisedExplanation: string;
  revisionFeedback: string;
  transferResult: string;
  transferRationale: string;
}>;

function safeLineBlock(value: string) {
  const normalized = value
    .normalize("NFC")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\t", " ")
    .replaceAll(/\p{C}/gu, (character) => (character === "\n" ? character : ""))
    .trim();
  return normalized
    .split("\n")
    .map((line) => {
      const trimmedEnd = line.trimEnd();
      const spreadsheetSafe = /^[=+@-]/u.test(trimmedEnd.trimStart())
        ? `'${trimmedEnd}`
        : trimmedEnd;
      return `  ${spreadsheetSafe}`;
    })
    .join("\n");
}

function section(number: number, label: string, value: string) {
  return `${number}. ${label}\n${safeLineBlock(value)}`;
}

export function buildTraceHandoffText(content: TraceHandoffContent) {
  return [
    "ModelDuel — Learner-controlled Revision Trace",
    "",
    `Scenario\n${safeLineBlock(content.scenario)}`,
    `Evidence source\n${safeLineBlock(content.evidenceSource)}`,
    "",
    section(1, content.initialBeliefLabel, content.initialBelief),
    "",
    section(2, "Locked prediction", content.lockedPrediction),
    "",
    section(3, content.observationLabel, content.observation),
    "",
    section(4, "Revised explanation", content.revisedExplanation),
    `Revision feedback\n${safeLineBlock(content.revisionFeedback)}`,
    "",
    section(5, "Transfer result", content.transferResult),
    `Transfer rationale\n${safeLineBlock(content.transferRationale)}`,
    "",
    "Sharing boundary",
    "  This learner-controlled handoff was created from the active browser session. ModelDuel did not send it or create a server-side record.",
    "  The trace remains visible in the active page until reset, reload, or page close.",
    "  It contains the learner's explanations. Review it before sharing with a teacher or anyone else.",
    "  Copying places it on the system clipboard, which the operating system or device policy may retain or sync.",
    "  After download, the browser or device may retain the file until someone deletes it.",
    "  This editable text is not signed, tamper-proof, or teacher-authenticated. It is a conversation aid, not a grade or proof of durable learning.",
    "",
  ].join("\n");
}
