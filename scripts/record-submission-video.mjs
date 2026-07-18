#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { chromium } from "@playwright/test";
import OpenAI from "openai";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..");
const SOURCE_DOCUMENT = path.join(
  REPOSITORY_ROOT,
  "docs",
  "DEVPOST_SUBMISSION.md",
);
const TIMELINE_HEADING = "## 2:45 demo narration and shot list";
const EXPECTED_TIMECODES = Object.freeze([
  "0:00–0:13",
  "0:13–0:30",
  "0:30–0:51",
  "0:51–1:04",
  "1:04–1:28",
  "1:28–1:48",
  "1:48–2:08",
  "2:08–2:30",
  "2:30–2:42",
  "2:42–2:45",
]);
const TOTAL_DURATION_SECONDS = 165;
const RECORDING_WIDTH = 1600;
const RECORDING_HEIGHT = 900;
const DEFAULT_BASE_URL = "https://modelduel.yasei.workers.dev";
const DEFAULT_OUTPUT_ROOT = path.join(
  homedir(),
  ".gstack",
  "projects",
  "DevPostOpenAI",
  "submission",
);
const FINAL_FILENAMES = Object.freeze({
  video: "modelduel-submission.mp4",
  subtitles: "modelduel-submission.srt",
  contactSheet: "modelduel-contact-sheet.png",
  manifest: "modelduel-submission-manifest.json",
});
const OUTPUT_ROOT_MARKER = ".modelduel-submission-root.json";
const RUN_MARKER = ".modelduel-run-owned.json";
const CONTACT_SHEET_TIMESTAMPS = Object.freeze([
  0, 18, 34, 52, 66, 90, 112, 130, 156, 163,
]);
const EXPECTED_API_LEDGER = Object.freeze([
  Object.freeze({ method: "GET", pathname: "/api/demo", revisionMode: null }),
  Object.freeze({
    method: "POST",
    pathname: "/api/revision",
    revisionMode: "verified-sample",
  }),
  Object.freeze({ method: "POST", pathname: "/api/transfer", revisionMode: null }),
]);
const TTS_MODEL = "tts-1";
const TTS_VOICE = "nova";
const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const TTS_DISCLOSURE = "AI-generated narration · OpenAI TTS";
const FULL_SCORE_REVISION =
  "The Moon's phases change because sunlight illuminates half of the Moon while its orbit changes our viewing angle, so we see different fractions of the sunlit half. Earth's shadow does not cause the regular phases; it causes a lunar eclipse.";
const ALLOWED_CONSOLE_MESSAGES = Object.freeze([
  "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.",
  "THREE.WebGLRenderer: Context Lost.",
]);
const ALLOWED_CONSOLE_PATTERNS = Object.freeze([
  /^\[\.WebGL-0x[0-9a-f]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels(?: \(this message will no longer repeat\))?$/i,
]);
const REPRESENTATIVE_COMMITS = Object.freeze([
  "682c206",
  "6186358",
  "8f9895d",
  "2708191",
  "fe91da0",
  "e5e7b03",
]);
const BUILD_EVIDENCE = Object.freeze({
  nodeTests: 356,
  workerdTests: 7,
  chromiumTests: 38,
  securityReviewedSources: 96,
  reportableSecurityFindings: 0,
  productionMerge: "e5e7b03",
});

const SELECTORS = Object.freeze({
  heroHeading: Object.freeze({
    kind: "role",
    role: "heading",
    name: "Two models predict. Evidence decides.",
  }),
  verifiedButton: Object.freeze({
    kind: "role",
    role: "button",
    name: "Run verified sample",
    exact: false,
  }),
  interpretationHeading: Object.freeze({
    kind: "role",
    role: "heading",
    name: "Turn one disagreement into a fair test.",
  }),
  authoredBadge: Object.freeze({
    kind: "text",
    text: "Verified authored sample",
    exact: true,
  }),
  makePrediction: Object.freeze({
    kind: "role",
    role: "button",
    name: "Make a prediction",
  }),
  initialPrediction: Object.freeze({
    kind: "label",
    text: "Earth's shadow masks half of the Moon",
    exact: false,
  }),
  lockPrediction: Object.freeze({
    kind: "role",
    role: "button",
    name: "Lock prediction",
  }),
  sealedHeading: Object.freeze({
    kind: "role",
    role: "heading",
    name: "Your prediction is locked.",
  }),
  revealEvidence: Object.freeze({
    kind: "role",
    role: "button",
    name: "Run both worlds and reveal evidence",
  }),
  verifiedObservation: Object.freeze({
    kind: "testId",
    value: "verified-observation",
  }),
  reviseButton: Object.freeze({
    kind: "role",
    role: "button",
    name: "Revise my explanation",
  }),
  revisionText: Object.freeze({
    kind: "label",
    text: "Revised causal explanation",
  }),
  submitRevision: Object.freeze({
    kind: "role",
    role: "button",
    name: "Capture revision and continue",
  }),
  transferHeading: Object.freeze({
    kind: "role",
    role: "heading",
    name: "Can your revised model travel?",
  }),
  correctTransfer: Object.freeze({
    kind: "label",
    text: "The Moon is in the Sun's direction",
    exact: false,
  }),
  submitTransfer: Object.freeze({
    kind: "role",
    role: "button",
    name: "Lock and check answer",
  }),
  trace: Object.freeze({ kind: "testId", value: "revision-trace" }),
  handoff: Object.freeze({ kind: "testId", value: "trace-handoff" }),
  newAttempt: Object.freeze({
    kind: "role",
    role: "button",
    name: "New attempt",
  }),
});

function parseArguments(argv) {
  const normalized = argv[0] === "--" ? argv.slice(1) : argv;
  const allowed = new Set([
    "--validate-contracts-only",
    "--validate-only",
    "--probe-only",
  ]);
  for (const argument of normalized) {
    if (!allowed.has(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  const validateContractsOnly = normalized.includes("--validate-contracts-only");
  const validateOnly = normalized.includes("--validate-only");
  const probeOnly = normalized.includes("--probe-only");
  if ([validateContractsOnly, validateOnly, probeOnly].filter(Boolean).length > 1) {
    throw new Error("Choose exactly one validation or probe mode.");
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("Duplicate command-line flags are not allowed.");
  }
  return { validateContractsOnly, validateOnly, probeOnly };
}

function expandHome(input) {
  if (input === "~") return homedir();
  if (input.startsWith(`~${path.sep}`)) {
    return path.join(homedir(), input.slice(2));
  }
  return input;
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertInsideOutputRoot(outputRoot, candidate, label) {
  if (!isInside(outputRoot, candidate)) {
    throw new Error(`${label} is outside the submission output root.`);
  }
}

async function assertNotSymlink(target, label) {
  try {
    const metadata = await lstat(target);
    if (metadata.isSymbolicLink()) {
      throw new Error(`${label} must not be a symbolic link.`);
    }
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return;
    throw error;
  }
}

function productionBaseUrl() {
  const rawUrl = DEFAULT_BASE_URL;
  const url = new URL(rawUrl);
  if (url.href !== `${DEFAULT_BASE_URL}/` || url.protocol !== "https:") {
    throw new Error("Final recording must use the exact ModelDuel production origin.");
  }
  return url;
}

function validatedBuildMarker(rawMarker) {
  if (rawMarker === undefined || rawMarker === "") return null;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(rawMarker)) {
    throw new Error(
      "MODELDUEL_BUILD_ID must contain 1-64 ASCII letters, numbers, underscores, or hyphens.",
    );
  }
  return rawMarker;
}

function parseClock(value) {
  const match = /^(\d+):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid timecode endpoint: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

function stripOuterSmartQuotes(text) {
  if (!text.startsWith("“") || !text.endsWith("”")) {
    throw new Error("Every approved narration cell must use outer smart quotes.");
  }
  const spoken = text.slice(1, -1);
  if (!spoken.trim()) throw new Error("Approved narration must not be empty.");
  return spoken;
}

function splitTableRow(line) {
  if (!line.startsWith("|") || !line.endsWith("|")) return null;
  return line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

async function parseApprovedTimeline() {
  const markdown = await readFile(SOURCE_DOCUMENT, "utf8");
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line === TIMELINE_HEADING);
  if (headingIndex < 0) throw new Error(`Missing ${TIMELINE_HEADING}.`);

  const tableLines = [];
  let tableStarted = false;
  for (const line of lines.slice(headingIndex + 1)) {
    if (line.startsWith("|")) {
      tableStarted = true;
      tableLines.push(line);
    } else if (tableStarted) {
      break;
    }
  }
  if (tableLines.length !== 12) {
    throw new Error("The approved timeline must contain one header, one separator, and 10 rows.");
  }
  const header = splitTableRow(tableLines[0]);
  if (JSON.stringify(header) !== JSON.stringify(["Time", "Shot", "Exact narration"])) {
    throw new Error("The approved timeline table header changed.");
  }
  const separator = splitTableRow(tableLines[1]);
  if (!separator || separator.length !== 3 || separator.some((cell) => !/^:?-{3,}:?$/.test(cell))) {
    throw new Error("The approved timeline table separator is invalid.");
  }

  const rows = tableLines.slice(2).map((line, index) => {
    const cells = splitTableRow(line);
    if (!cells || cells.length !== 3) {
      throw new Error(`Timeline row ${index + 1} must contain exactly three cells.`);
    }
    if (cells[0] !== EXPECTED_TIMECODES[index]) {
      throw new Error(`Timeline row ${index + 1} timecode changed from the approved value.`);
    }
    const endpoints = cells[0].split("–");
    if (endpoints.length !== 2) throw new Error(`Timeline row ${index + 1} is malformed.`);
    const startSeconds = parseClock(endpoints[0]);
    const endSeconds = parseClock(endpoints[1]);
    return Object.freeze({
      index: index + 1,
      timecode: cells[0],
      startSeconds,
      endSeconds,
      durationSeconds: endSeconds - startSeconds,
      shot: cells[1],
      markdownNarration: cells[2],
      spokenNarration: stripOuterSmartQuotes(cells[2]),
    });
  });

  if (rows[0].startSeconds !== 0 || rows.at(-1).endSeconds !== TOTAL_DURATION_SECONDS) {
    throw new Error("The approved timeline must span exactly 0:00 through 2:45.");
  }
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index].durationSeconds <= 0) throw new Error("Timeline durations must be positive.");
    if (index > 0 && rows[index - 1].endSeconds !== rows[index].startSeconds) {
      throw new Error("The approved timeline must be contiguous and monotonic.");
    }
  }
  const duration = rows.reduce((sum, row) => sum + row.durationSeconds, 0);
  if (duration !== TOTAL_DURATION_SECONDS) {
    throw new Error(`Approved timeline duration is ${duration}, expected 165 seconds.`);
  }

  return Object.freeze({ markdown, rows: Object.freeze(rows) });
}

function formatSrtTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

function buildSrt(rows) {
  return `${rows
    .map(
      (row) =>
        `${row.index}\n${formatSrtTime(row.startSeconds)} --> ${formatSrtTime(row.endSeconds)}\n${row.spokenNarration}`,
    )
    .join("\n\n")}\n`;
}

function locatorFor(page, selector) {
  switch (selector.kind) {
    case "role":
      return page.getByRole(selector.role, {
        name: selector.name,
        exact: selector.exact ?? true,
      });
    case "text":
      return page.getByText(selector.text, { exact: selector.exact });
    case "label":
      return page.getByLabel(selector.text, { exact: selector.exact ?? true });
    case "testId":
      return page.getByTestId(selector.value);
    default:
      throw new Error("Unsupported selector contract.");
  }
}

function validateSelectorContracts() {
  const requiredKeys = [
    "heroHeading",
    "verifiedButton",
    "interpretationHeading",
    "authoredBadge",
    "makePrediction",
    "initialPrediction",
    "lockPrediction",
    "sealedHeading",
    "revealEvidence",
    "verifiedObservation",
    "reviseButton",
    "revisionText",
    "submitRevision",
    "transferHeading",
    "correctTransfer",
    "submitTransfer",
    "trace",
    "handoff",
    "newAttempt",
  ];
  if (JSON.stringify(Object.keys(SELECTORS)) !== JSON.stringify(requiredKeys)) {
    throw new Error("Stable selector inventory changed.");
  }
  for (const [name, selector] of Object.entries(SELECTORS)) {
    if (!selector || typeof selector !== "object" || typeof selector.kind !== "string") {
      throw new Error(`Selector ${name} is invalid.`);
    }
    if (selector.kind === "role" && (!selector.role || !selector.name)) {
      throw new Error(`Role selector ${name} is incomplete.`);
    }
    if (selector.kind === "label" && !selector.text) {
      throw new Error(`Label selector ${name} is incomplete.`);
    }
    if (selector.kind === "testId" && !selector.value) {
      throw new Error(`Test-id selector ${name} is incomplete.`);
    }
  }
}

function sanitizedChildEnvironment() {
  const sensitiveName = /(?:^|_)(?:API_KEY|TOKEN|SECRET|PASSWORD|COOKIE|CREDENTIALS?)(?:$|_)/i;
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([name, value]) =>
        value !== undefined &&
        name !== "MODELDUEL_ALLOW_PAID_TTS" &&
        !sensitiveName.test(name),
    ),
  );
}

async function runProcess(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? REPOSITORY_ROOT,
      env: options.env ?? sanitizedChildEnvironment(),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-1_000_000);
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-1_000_000);
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const detail = stderr.trim().split(/\r?\n/).slice(-8).join("\n");
        reject(
          new Error(
            `${path.basename(command)} failed with code ${code ?? "null"}${signal ? ` (${signal})` : ""}.${detail ? `\n${detail}` : ""}`,
          ),
        );
      }
    });
  });
}

async function validateTools() {
  const ffmpeg = process.env.FFMPEG_BIN || "ffmpeg";
  const ffprobe = process.env.FFPROBE_BIN || "ffprobe";
  const [
    { stdout: ffmpegVersion },
    { stdout: ffprobeVersion },
    { stdout: encoders },
    { stdout: filters },
    { stdout: formats },
    { stdout: devices },
    { stdout: mp4Help },
  ] = await Promise.all([
    runProcess(ffmpeg, ["-version"]),
    runProcess(ffprobe, ["-version"]),
    runProcess(ffmpeg, ["-hide_banner", "-encoders"]),
    runProcess(ffmpeg, ["-hide_banner", "-filters"]),
    runProcess(ffmpeg, ["-hide_banner", "-formats"]),
    runProcess(ffmpeg, ["-hide_banner", "-devices"]),
    runProcess(ffmpeg, ["-hide_banner", "-h", "muxer=mp4"]),
  ]);
  for (const [name, versionOutput] of [
    ["ffmpeg", ffmpegVersion],
    ["ffprobe", ffprobeVersion],
  ]) {
    const match = new RegExp(`^${name} version (\\d+)\\.`, "m").exec(versionOutput);
    if (!match || Number(match[1]) < 8) {
      throw new Error(`${name} 8 or newer is required.`);
    }
  }
  for (const encoder of ["libx264", "aac", "mov_text", "pcm_s16le", "png"]) {
    if (!new RegExp(`\\b${encoder}\\b`).test(encoders)) {
      throw new Error(`ffmpeg is missing the ${encoder} encoder.`);
    }
  }
  const requiredFilters = [
    "aresample",
    "atempo",
    "adelay",
    "amix",
    "anullsrc",
    "apad",
    "atrim",
    "asetpts",
    "trim",
    "setpts",
    "scale",
    "pad",
    "fps",
    "tpad",
    "xstack",
  ];
  for (const filter of requiredFilters) {
    if (!new RegExp(`\\b${filter}\\b`).test(filters)) {
      throw new Error(`ffmpeg is missing the ${filter} filter.`);
    }
  }
  const formatCapabilities = new Map();
  for (const line of formats.split(/\r?\n/)) {
    const match = /^ ([D ])([E ])\s+(\S+)/.exec(line);
    if (!match) continue;
    for (const name of match[3].split(",")) {
      formatCapabilities.set(name, {
        demux: match[1] === "D",
        mux: match[2] === "E",
      });
    }
  }
  for (const [format, role] of [
    ["concat", "demux"],
    ["srt", "demux"],
    ["mp4", "mux"],
  ]) {
    if (!formatCapabilities.get(format)?.[role]) {
      throw new Error(`ffmpeg is missing the ${format} ${role}er.`);
    }
  }
  if (!/^ D\s+lavfi\s/m.test(devices)) {
    throw new Error("ffmpeg is missing the lavfi input device.");
  }
  if (!mp4Help.includes("faststart")) {
    throw new Error("ffmpeg's MP4 muxer does not expose faststart.");
  }
  const executablePath = chromium.executablePath();
  await access(executablePath, fsConstants.X_OK);
  return Object.freeze({
    ffmpeg,
    ffprobe,
    chromium: executablePath,
    versions: Object.freeze({
      ffmpeg: ffmpegVersion.split(/\r?\n/, 1)[0],
      ffprobe: ffprobeVersion.split(/\r?\n/, 1)[0],
    }),
  });
}

async function fullProbe(ffprobe, inputPath) {
  const { stdout } = await runProcess(ffprobe, [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    inputPath,
  ]);
  const result = JSON.parse(stdout);
  if (!result || !Array.isArray(result.streams) || !result.format) {
    throw new Error(`ffprobe returned an invalid result for ${path.basename(inputPath)}.`);
  }
  return result;
}

function mediaDuration(probe) {
  const duration = Number(probe.format.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("ffprobe did not report a positive media duration.");
  }
  return duration;
}

function atempoChain(factor) {
  if (!Number.isFinite(factor) || factor <= 0) throw new Error("Invalid TTS tempo factor.");
  const values = [];
  let remaining = factor;
  while (remaining > 2) {
    values.push(2);
    remaining /= 2;
  }
  while (remaining < 0.5) {
    values.push(0.5);
    remaining /= 0.5;
  }
  values.push(remaining);
  return values.map((value) => `atempo=${value.toFixed(8)}`).join(",");
}

function concatPath(inputPath) {
  if (/[\x00-\x1F\x7F]/.test(inputPath)) {
    throw new Error("Media paths must not contain control characters.");
  }
  return inputPath.replaceAll("'", "'\\''");
}

async function cachedNarrationSource(row, outputRoot, clientState) {
  if (row.spokenNarration.length > 4096) {
    throw new Error(`Narration row ${row.index} exceeds the Speech API character limit.`);
  }
  const cacheDescriptor = JSON.stringify({
    model: TTS_MODEL,
    voice: TTS_VOICE,
    input: row.spokenNarration,
  });
  const cacheKey = createHash("sha256").update(cacheDescriptor).digest("hex");
  const cacheDir = path.join(outputRoot, "narration-cache");
  const cachePath = path.join(cacheDir, `${cacheKey}.wav`);
  const lockPath = path.join(cacheDir, `.${cacheKey}.lock`);
  assertInsideOutputRoot(outputRoot, cacheDir, "Narration cache directory");
  assertInsideOutputRoot(outputRoot, cachePath, "Narration cache file");
  assertInsideOutputRoot(outputRoot, lockPath, "Narration cache lock");
  await mkdir(cacheDir, { recursive: true });
  await assertNotSymlink(cacheDir, "Narration cache directory");
  await assertNotSymlink(cachePath, "Narration cache file");

  try {
    await access(cachePath, fsConstants.R_OK);
    return Object.freeze({ cachePath, cacheHit: true, sha256: await hashFile(cachePath) });
  } catch (error) {
    if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
  }

  let lockHandle;
  try {
    lockHandle = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EEXIST") {
      throw new Error(
        `Narration row ${row.index} is already being generated. Wait for that recording to finish, then retry from cache.`,
      );
    }
    throw error;
  }

  try {
    try {
      await access(cachePath, fsConstants.R_OK);
      return Object.freeze({ cachePath, cacheHit: true, sha256: await hashFile(cachePath) });
    } catch (error) {
      if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
    }

    if (process.env.MODELDUEL_ALLOW_PAID_TTS !== "1") {
      throw new Error(
        "Narration cache is incomplete. Set MODELDUEL_ALLOW_PAID_TTS=1 for one explicitly approved Speech API generation run.",
      );
    }
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required to populate the approved narration cache.");
    }
    clientState.client ??= new OpenAI({
      apiKey,
      baseURL: OPENAI_API_BASE_URL,
      maxRetries: 0,
      timeout: 60_000,
    });
    const response = await clientState.client.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: row.spokenNarration,
      response_format: "wav",
    });
    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length < 44) {
      throw new Error(`Speech API row ${row.index} returned invalid WAV data.`);
    }
    const temporaryPath = path.join(cacheDir, `.pending-${cacheKey}-${randomUUID()}.wav`);
    assertInsideOutputRoot(outputRoot, temporaryPath, "Pending narration cache file");
    clientState.apiCalls += 1;
    try {
      await writeFile(temporaryPath, audio, { flag: "wx" });
      await rename(temporaryPath, cachePath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
    return Object.freeze({ cachePath, cacheHit: false, sha256: await hashFile(cachePath) });
  } finally {
    try {
      await lockHandle.close();
    } finally {
      await rm(lockPath, { force: true });
    }
  }
}

async function synthesizeNarration(timeline, tools, workDir, outputRoot) {
  const segmentDir = path.join(workDir, "tts-segments");
  await mkdir(segmentDir, { recursive: true });
  const segmentPaths = [];
  const segmentEvidence = [];
  const clientState = { client: null, apiCalls: 0 };

  for (const row of timeline.rows) {
    const stem = String(row.index).padStart(2, "0");
    const segmentPath = path.join(segmentDir, `${stem}.wav`);
    const source = await cachedNarrationSource(row, outputRoot, clientState);
    const sourcePath = source.cachePath;
    const sourceProbe = await fullProbe(tools.ffprobe, sourcePath);
    const sourceDuration = mediaDuration(sourceProbe);
    const speechWindow = row.durationSeconds - 0.15;
    if (speechWindow <= 0) throw new Error("A narration slot is too short for its lead-in.");
    const tempo = Math.max(1, sourceDuration / speechWindow);
    const voiceFilter = [
      "aresample=48000",
      atempoChain(tempo),
      "adelay=150:all=1",
    ].join(",");
    const slotDuration = row.durationSeconds.toFixed(3);
    await runProcess(tools.ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-t",
      slotDuration,
      "-i",
      "anullsrc=channel_layout=mono:sample_rate=48000",
      "-i",
      sourcePath,
      "-filter_complex",
      `[1:a]${voiceFilter}[voice];[0:a][voice]amix=inputs=2:duration=first:dropout_transition=0,atrim=duration=${slotDuration},asetpts=PTS-STARTPTS[out]`,
      "-map",
      "[out]",
      "-c:a",
      "pcm_s16le",
      "-ar",
      "48000",
      "-ac",
      "1",
      segmentPath,
    ]);
    const segmentProbe = await fullProbe(tools.ffprobe, segmentPath);
    const segmentDuration = mediaDuration(segmentProbe);
    if (Math.abs(segmentDuration - row.durationSeconds) > 0.03) {
      throw new Error(
        `Narration segment ${row.index} is ${segmentDuration.toFixed(6)} seconds; expected ${row.durationSeconds.toFixed(3)} seconds.`,
      );
    }
    segmentPaths.push(segmentPath);
    segmentEvidence.push({
      row: row.index,
      sourceDurationSeconds: Number(sourceDuration.toFixed(6)),
      sourceSha256: source.sha256,
      cacheHit: source.cacheHit,
      slotDurationSeconds: row.durationSeconds,
      tempo: Number(tempo.toFixed(8)),
      leadMilliseconds: 150,
    });
  }

  const concatListPath = path.join(workDir, "narration-concat.txt");
  await writeFile(
    concatListPath,
    `${segmentPaths.map((segmentPath) => `file '${concatPath(segmentPath)}'`).join("\n")}\n`,
    "utf8",
  );
  const narrationPath = path.join(workDir, "narration-165s.wav");
  await runProcess(tools.ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatListPath,
    "-filter:a",
    `apad=pad_dur=${TOTAL_DURATION_SECONDS},atrim=duration=${TOTAL_DURATION_SECONDS},asetpts=PTS-STARTPTS`,
    "-c:a",
    "pcm_s16le",
    "-ar",
    "48000",
    "-ac",
    "1",
    narrationPath,
  ]);
  const narrationProbe = await fullProbe(tools.ffprobe, narrationPath);
  if (Math.abs(mediaDuration(narrationProbe) - TOTAL_DURATION_SECONDS) > 0.03) {
    throw new Error("Concatenated narration is not exactly 165 seconds.");
  }
  return Object.freeze({
    narrationPath,
    segmentEvidence,
    ttsApiCalls: clientState.apiCalls,
    inputCharacters: timeline.rows.reduce(
      (total, row) => total + row.spokenNarration.length,
      0,
    ),
  });
}

function createAuditCounters() {
  const counters = {
    apiLedger: [],
    requestsTotal: 0,
    baseOriginRequests: 0,
    documentAndStaticRequests: 0,
    verifiedDemoRequests: 0,
    verifiedRevisionRequests: 0,
    transferRequests: 0,
    analyzeAttempts: 0,
    liveRevisionAttempts: 0,
    externalHttpAttempts: 0,
    blockedRequests: 0,
    requestFailures: 0,
    badHttpResponses: 0,
    pageErrors: 0,
    allowedConsoleMessages: 0,
    unexpectedConsoleMessages: 0,
  };
  Object.defineProperty(counters, "unexpectedConsoleSamples", {
    value: [],
    enumerable: false,
  });
  return counters;
}

function safeJsonBody(request) {
  try {
    return request.postDataJSON();
  } catch {
    return null;
  }
}

async function installFailClosedAudit(page, baseUrl, counters) {
  const baseOrigin = baseUrl.origin;
  await page.route("**/*", async (route) => {
    const request = route.request();
    counters.requestsTotal += 1;
    let url;
    try {
      url = new URL(request.url());
    } catch {
      counters.blockedRequests += 1;
      await route.abort("blockedbyclient");
      return;
    }
    if (url.protocol === "http:" || url.protocol === "https:") {
      if (url.origin !== baseOrigin) {
        counters.externalHttpAttempts += 1;
        counters.blockedRequests += 1;
        await route.abort("blockedbyclient");
        return;
      }
      counters.baseOriginRequests += 1;
      if (url.pathname === "/api/analyze") {
        counters.analyzeAttempts += 1;
        counters.blockedRequests += 1;
        await route.abort("blockedbyclient");
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        if (!new Set(["/api/demo", "/api/revision", "/api/transfer"]).has(url.pathname)) {
          counters.blockedRequests += 1;
          await route.abort("blockedbyclient");
          return;
        }
        let revisionMode = null;
        if (url.pathname === "/api/demo") counters.verifiedDemoRequests += 1;
        if (url.pathname === "/api/transfer") counters.transferRequests += 1;
        if (url.pathname === "/api/revision") {
          const body = safeJsonBody(request);
          if (!body || body.mode !== "verified-sample") {
            counters.liveRevisionAttempts += 1;
            counters.blockedRequests += 1;
            await route.abort("blockedbyclient");
            return;
          }
          revisionMode = body.mode;
          counters.verifiedRevisionRequests += 1;
        }
        counters.apiLedger.push({
          method: request.method(),
          pathname: url.pathname,
          revisionMode,
        });
      } else {
        counters.documentAndStaticRequests += 1;
      }
    }
    await route.continue();
  });

  page.on("requestfailed", () => {
    counters.requestFailures += 1;
  });
  page.on("response", (response) => {
    if (response.status() >= 400) counters.badHttpResponses += 1;
  });
  page.on("pageerror", () => {
    counters.pageErrors += 1;
  });
  page.on("console", (message) => {
    if (
      ALLOWED_CONSOLE_MESSAGES.includes(message.text()) ||
      ALLOWED_CONSOLE_PATTERNS.some((pattern) => pattern.test(message.text()))
    ) {
      counters.allowedConsoleMessages += 1;
    } else {
      counters.unexpectedConsoleMessages += 1;
      if (counters.unexpectedConsoleSamples.length < 5) {
        counters.unexpectedConsoleSamples.push(message.text().slice(0, 500));
      }
    }
  });
}

function assertAuditClean(counters) {
  const failures = {
    analyzeAttempts: counters.analyzeAttempts,
    liveRevisionAttempts: counters.liveRevisionAttempts,
    externalHttpAttempts: counters.externalHttpAttempts,
    blockedRequests: counters.blockedRequests,
    requestFailures: counters.requestFailures,
    badHttpResponses: counters.badHttpResponses,
    pageErrors: counters.pageErrors,
    unexpectedConsoleMessages: counters.unexpectedConsoleMessages,
  };
  const nonzero = Object.entries(failures).filter(([, value]) => value !== 0);
  if (nonzero.length > 0) {
    const consoleDetail = counters.unexpectedConsoleSamples.length
      ? `; console=${JSON.stringify(counters.unexpectedConsoleSamples)}`
      : "";
    throw new Error(
      `Recording audit failed: ${nonzero.map(([name, value]) => `${name}=${value}`).join(", ")}${consoleDetail}`,
    );
  }
  if (
    JSON.stringify(counters.apiLedger) !== JSON.stringify(EXPECTED_API_LEDGER) ||
    counters.verifiedDemoRequests !== 1 ||
    counters.verifiedRevisionRequests !== 1 ||
    counters.transferRequests !== 1
  ) {
    throw new Error("Recording did not complete the exact verified sample route sequence.");
  }
}

function elapsedSeconds(startNanoseconds) {
  return Number(process.hrtime.bigint() - startNanoseconds) / 1e9;
}

async function waitUntilDeadline(startNanoseconds, deadlineSeconds, label, timingEvidence) {
  while (true) {
    const elapsed = elapsedSeconds(startNanoseconds);
    const remaining = deadlineSeconds - elapsed;
    if (remaining <= 0) {
      if (elapsed > deadlineSeconds + 1) {
        throw new Error(
          `Recording transition ${label} began ${(elapsed - deadlineSeconds).toFixed(3)} seconds late.`,
        );
      }
      timingEvidence.push({
        label,
        deadlineSeconds,
        beganAtSeconds: Number(elapsed.toFixed(6)),
      });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(remaining * 1000, 250)));
  }
}

async function runScheduledTransition(
  startNanoseconds,
  deadlineSeconds,
  label,
  timingEvidence,
  action,
  leadSeconds = 0,
) {
  const scheduledStartSeconds = deadlineSeconds - leadSeconds;
  await waitUntilDeadline(
    startNanoseconds,
    scheduledStartSeconds,
    label,
    timingEvidence,
  );
  const transitionEvidence = timingEvidence.at(-1);
  transitionEvidence.scheduledStartSeconds = scheduledStartSeconds;
  transitionEvidence.deadlineSeconds = deadlineSeconds;
  transitionEvidence.leadSeconds = leadSeconds;
  await action();
  const settled = elapsedSeconds(startNanoseconds);
  if (settled > deadlineSeconds + 1) {
    throw new Error(
      `Recording transition ${label} settled ${(settled - deadlineSeconds).toFixed(3)} seconds late.`,
    );
  }
  timingEvidence.at(-1).settledAtSeconds = Number(settled.toFixed(6));
}

async function showOverlay(page, mode, content) {
  await page.evaluate(
    ({ overlayMode, overlayContent }) => {
      document.getElementById("modelduel-recording-overlay")?.remove();
      const overlay = document.createElement("section");
      overlay.id = "modelduel-recording-overlay";
      overlay.setAttribute("aria-label", overlayContent.title);
      const full = overlayMode === "full";
      Object.assign(overlay.style, {
        position: "fixed",
        zIndex: "2147483647",
        inset: full ? "0" : "auto 34px 34px auto",
        width: full ? "auto" : "620px",
        maxWidth: full ? "none" : "calc(100vw - 68px)",
        padding: full ? "86px 110px" : "24px 28px",
        display: "flex",
        flexDirection: "column",
        justifyContent: full ? "center" : "flex-start",
        gap: full ? "22px" : "12px",
        border: full ? "none" : "1px solid rgba(87,226,242,.55)",
        borderRadius: full ? "0" : "18px",
        color: "#eef5ff",
        background: full
          ? "radial-gradient(circle at 82% 16%, #19345e 0, #071126 46%, #030712 100%)"
          : "rgba(5,13,31,.96)",
        boxShadow: "0 24px 80px rgba(0,0,0,.48)",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      });
      const badge = document.createElement("p");
      badge.textContent = overlayContent.badge;
      Object.assign(badge.style, {
        margin: "0",
        color: "#75e9f4",
        fontSize: full ? "20px" : "15px",
        fontWeight: "800",
        letterSpacing: ".045em",
        textTransform: "uppercase",
      });
      const heading = document.createElement("h2");
      heading.textContent = overlayContent.title;
      Object.assign(heading.style, {
        margin: "0",
        maxWidth: "1300px",
        fontSize: full ? "54px" : "28px",
        lineHeight: "1.08",
      });
      const list = document.createElement("ul");
      Object.assign(list.style, {
        margin: "0",
        padding: "0",
        display: "grid",
        gridTemplateColumns: full && overlayContent.columns === 2 ? "1fr 1fr" : "1fr",
        gap: full ? "15px 42px" : "8px",
        listStyle: "none",
        fontSize: full ? "25px" : "17px",
        lineHeight: "1.42",
      });
      for (const itemText of overlayContent.items) {
        const item = document.createElement("li");
        item.textContent = itemText;
        item.style.padding = full ? "16px 18px" : "4px 0";
        item.style.borderLeft = "3px solid rgba(87,226,242,.58)";
        item.style.paddingLeft = "16px";
        list.append(item);
      }
      overlay.append(badge, heading, list);
      document.body.append(overlay);
    },
    { overlayMode: mode, overlayContent: content },
  );
}

async function removeOverlay(page) {
  await page.evaluate(() => {
    document.getElementById("modelduel-recording-overlay")?.remove();
  });
}

async function showNarrationDisclosure(page) {
  await page.evaluate((disclosure) => {
    document.getElementById("modelduel-narration-disclosure")?.remove();
    const badge = document.createElement("p");
    badge.id = "modelduel-narration-disclosure";
    badge.textContent = disclosure;
    badge.setAttribute("aria-label", disclosure);
    Object.assign(badge.style, {
      position: "fixed",
      zIndex: "2147483646",
      top: "16px",
      right: "18px",
      margin: "0",
      padding: "8px 12px",
      border: "1px solid rgba(117,233,244,.55)",
      borderRadius: "999px",
      color: "#dffbff",
      background: "rgba(3,7,18,.92)",
      boxShadow: "0 10px 28px rgba(0,0,0,.38)",
      pointerEvents: "none",
      font: "700 13px/1.2 Inter, ui-sans-serif, system-ui, sans-serif",
      letterSpacing: ".025em",
    });
    document.body.append(badge);
  }, TTS_DISCLOSURE);
}

const CONFIGURED_LIVE_OVERLAY = Object.freeze({
  badge: "Configured live path — not executed in this recording",
  title: "Bounded AI input; deterministic scientific truth",
  items: Object.freeze([
    "GPT-5.6 Terra: text or vision input → schema-constrained learner model",
    "Validated tools: validate_world_spec → simulate_world → compare_predictions → select_discriminating_case",
    "GPT-5.6 Luna: bounded revision feedback; never transfer grading",
  ]),
});

const ARCHITECTURE_OVERLAY = Object.freeze({
  badge: "Configured live path — not executed in this recording",
  title: "ModelDuel trust boundary",
  columns: 2,
  items: Object.freeze([
    "Browser: learner text and optional sketch",
    "Validated server routes with exact-true live attestation",
    "GPT-5.6 Terra: bounded structured learner model",
    "validate_world_spec → simulate_world → compare_predictions → select_discriminating_case",
    "Application-owned WorldSpecs, cases, simulation constants, physical evidence, and Three.js rendering",
    "GPT-5.6 Luna: bounded revision feedback",
    "Server-protected transfer answer and deterministic grading",
    "store: false; no Zero Data Retention claim",
  ]),
});

const CODEX_OVERLAY = Object.freeze({
  badge: "Codex build evidence",
  title: "Build ModelDuel as a verified-first, fail-closed evidence-led science experience.",
  columns: 2,
  items: Object.freeze([
    "Plan → implement → test → review → harden → deploy",
    "State machine → routes → deterministic simulations → 3D and 2D evidence → encrypted transfer boundary",
    `Representative commits: ${REPRESENTATIVE_COMMITS.join(" · ")}`,
    `Final main gate: ${BUILD_EVIDENCE.nodeTests} Node · ${BUILD_EVIDENCE.workerdTests} workerd · ${BUILD_EVIDENCE.chromiumTests} Chromium`,
    `Codex Security: ${BUILD_EVIDENCE.securityReviewedSources}/96 sources reviewed · ${BUILD_EVIDENCE.reportableSecurityFindings} reportable findings`,
    "Next.js · OpenNext · Wrangler: pass · dependency audit: clean",
  ]),
});

async function recordVerifiedJourney(
  baseUrl,
  { workDir = null, recordVideo = false, timed = false } = {},
) {
  const counters = createAuditCounters();
  const timingEvidence = [];
  let browser;
  let context;
  let video;
  let rawVideoPath;
  let preRollSeconds;

  try {
    browser = await chromium.launch({
      headless: true,
      env: sanitizedChildEnvironment(),
    });
    const contextOptions = {
      viewport: { width: RECORDING_WIDTH, height: RECORDING_HEIGHT },
      deviceScaleFactor: 1,
      colorScheme: "dark",
      reducedMotion: "reduce",
      serviceWorkers: "block",
    };
    if (recordVideo) {
      if (!workDir) throw new Error("Video recording requires an owned work directory.");
      contextOptions.recordVideo = {
        dir: path.join(workDir, "playwright-video"),
        size: { width: RECORDING_WIDTH, height: RECORDING_HEIGHT },
      };
    }
    context = await browser.newContext(contextOptions);
    const pageCreatedAt = process.hrtime.bigint();
    const page = await context.newPage();
    video = recordVideo ? page.video() : null;
    await installFailClosedAudit(page, baseUrl, counters);
    await page.goto(baseUrl.href, { waitUntil: "networkidle", timeout: 30_000 });
    await locatorFor(page, SELECTORS.heroHeading).waitFor({ state: "visible" });
    await locatorFor(page, SELECTORS.verifiedButton).waitFor({ state: "visible" });
    await showNarrationDisclosure(page);
    const recordingStart = process.hrtime.bigint();
    preRollSeconds = Number(recordingStart - pageCreatedAt) / 1e9;

    const schedule = async (
      deadlineSeconds,
      label,
      action = async () => undefined,
      leadSeconds = 0,
    ) => {
      if (timed) {
        await runScheduledTransition(
          recordingStart,
          deadlineSeconds,
          label,
          timingEvidence,
          action,
          leadSeconds,
        );
      } else {
        const began = elapsedSeconds(recordingStart);
        await action();
        timingEvidence.push({
          label,
          deadlineSeconds,
          probeBeganAtSeconds: Number(began.toFixed(6)),
          probeSettledAtSeconds: Number(elapsedSeconds(recordingStart).toFixed(6)),
        });
      }
    };

    await schedule(13, "hero-hold");
    await schedule(17, "load-verified-sample", async () => {
      await locatorFor(page, SELECTORS.verifiedButton).click();
      await locatorFor(page, SELECTORS.interpretationHeading).waitFor({ state: "visible" });
      await locatorFor(page, SELECTORS.authoredBadge).waitFor({ state: "visible" });
    });
    await schedule(34, "show-configured-live-overlay", async () => {
      await showOverlay(page, "small", CONFIGURED_LIVE_OVERLAY);
    });
    await schedule(49.5, "hide-configured-live-overlay", async () => {
      await removeOverlay(page);
    });
    await schedule(51, "choose-initial-prediction", async () => {
      await locatorFor(page, SELECTORS.makePrediction).click();
      await locatorFor(page, SELECTORS.initialPrediction).check();
    });
    await schedule(58, "lock-initial-prediction", async () => {
      await locatorFor(page, SELECTORS.lockPrediction).click();
      await locatorFor(page, SELECTORS.sealedHeading).waitFor({ state: "visible" });
    });
    await schedule(64, "reveal-two-world-evidence", async () => {
      await locatorFor(page, SELECTORS.revealEvidence).click();
      await page.locator(".world-viewport canvas").first().waitFor({ state: "visible" });
      if ((await page.locator(".world-viewport canvas").count()) !== 2) {
        throw new Error("The verified Moon evidence must render exactly two canvases.");
      }
      await locatorFor(page, SELECTORS.verifiedObservation).waitFor({ state: "visible" });
    }, 0.75);
    await schedule(72, "rotate-scientific-world", async () => {
      const scientificCanvas = page.locator(".world-viewport canvas").nth(1);
      const box = await scientificCanvas.boundingBox();
      if (!box) throw new Error("Scientific canvas is not draggable.");
      await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.68, box.y + box.height * 0.5, {
        steps: 18,
      });
      await page.mouse.up();
    });
    await schedule(88, "enter-revision", async () => {
      await locatorFor(page, SELECTORS.reviseButton).click();
      await locatorFor(page, SELECTORS.revisionText).fill(FULL_SCORE_REVISION);
    });
    await schedule(97, "submit-verified-revision", async () => {
      await locatorFor(page, SELECTORS.submitRevision).click();
      await locatorFor(page, SELECTORS.transferHeading).waitFor({ state: "visible" });
    });
    await schedule(108, "choose-transfer-answer", async () => {
      await locatorFor(page, SELECTORS.correctTransfer).check();
    });
    await schedule(113, "submit-transfer-answer", async () => {
      await locatorFor(page, SELECTORS.submitTransfer).click();
      await locatorFor(page, SELECTORS.trace).waitFor({ state: "visible" });
    });
    await schedule(120, "show-learner-controlled-handoff", async () => {
      const handoff = locatorFor(page, SELECTORS.handoff);
      await handoff.waitFor({ state: "visible" });
      await handoff.evaluate((element) => element.scrollIntoView({ block: "center" }));
    });
    await schedule(128, "show-architecture", async () => {
      await showOverlay(page, "full", ARCHITECTURE_OVERLAY);
    });
    await schedule(150, "show-codex-evidence", async () => {
      await showOverlay(page, "full", CODEX_OVERLAY);
    });
    await schedule(162, "return-to-hero", async () => {
      await removeOverlay(page);
      await locatorFor(page, SELECTORS.newAttempt).click();
      await locatorFor(page, SELECTORS.heroHeading).waitFor({ state: "visible" });
    });
    await schedule(TOTAL_DURATION_SECONDS, "recording-complete");
    assertAuditClean(counters);
  } finally {
    if (context) await context.close().catch(() => undefined);
    if (video) rawVideoPath = await video.path().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
  }
  if (recordVideo && (!rawVideoPath || !Number.isFinite(preRollSeconds))) {
    throw new Error("Playwright did not produce a usable recording.");
  }
  return Object.freeze({
    rawVideoPath: rawVideoPath ?? null,
    preRollSeconds,
    counters,
    timingEvidence: Object.freeze(timingEvidence),
  });
}

async function hashFile(inputPath) {
  const handle = await open(inputPath, "r");
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    await handle.close();
  }
  return hash.digest("hex");
}

async function topLevelAtomOffsets(mp4Path) {
  const handle = await open(mp4Path, "r");
  const metadata = await handle.stat();
  let offset = 0;
  let moov = null;
  let mdat = null;
  const header = Buffer.alloc(16);
  try {
    while (offset + 8 <= metadata.size) {
      const { bytesRead } = await handle.read(header, 0, 16, offset);
      if (bytesRead < 8) break;
      let atomSize = header.readUInt32BE(0);
      const atomType = header.toString("ascii", 4, 8);
      let headerSize = 8;
      if (atomSize === 1) {
        if (bytesRead < 16) throw new Error("Truncated extended MP4 atom.");
        const extended = header.readBigUInt64BE(8);
        if (extended > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new Error("MP4 atom is too large to validate safely.");
        }
        atomSize = Number(extended);
        headerSize = 16;
      } else if (atomSize === 0) {
        atomSize = metadata.size - offset;
      }
      if (atomSize < headerSize || offset + atomSize > metadata.size) {
        throw new Error("Invalid top-level MP4 atom size.");
      }
      if (atomType === "moov" && moov === null) moov = offset;
      if (atomType === "mdat" && mdat === null) mdat = offset;
      offset += atomSize;
    }
  } finally {
    await handle.close();
  }
  if (moov === null || mdat === null) throw new Error("MP4 is missing moov or mdat.");
  return { moov, mdat };
}

async function encodeSubmissionVideo(
  tools,
  rawVideoPath,
  preRollSeconds,
  narrationPath,
  srtPath,
  outputPath,
) {
  const videoFilter = [
    `trim=start=${preRollSeconds.toFixed(6)}`,
    "setpts=PTS-STARTPTS",
    `scale=${RECORDING_WIDTH}:${RECORDING_HEIGHT}:force_original_aspect_ratio=decrease`,
    `pad=${RECORDING_WIDTH}:${RECORDING_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black`,
    "fps=30",
    `tpad=stop_mode=clone:stop_duration=${TOTAL_DURATION_SECONDS}`,
    `trim=duration=${TOTAL_DURATION_SECONDS}`,
    "setpts=PTS-STARTPTS",
  ].join(",");
  await runProcess(tools.ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    rawVideoPath,
    "-i",
    narrationPath,
    "-i",
    srtPath,
    "-filter_complex",
    `[0:v]${videoFilter}[v];[1:a]apad=pad_dur=${TOTAL_DURATION_SECONDS},atrim=duration=${TOTAL_DURATION_SECONDS},asetpts=PTS-STARTPTS[a]`,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-map",
    "2:0",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-profile:v",
    "high",
    "-level:v",
    "4.1",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-c:s",
    "mov_text",
    "-map_metadata",
    "-1",
    "-map_chapters",
    "-1",
    "-metadata:s:s:0",
    "language=eng",
    "-movflags",
    "+faststart",
    "-t",
    String(TOTAL_DURATION_SECONDS),
    outputPath,
  ]);
}

async function validateFinalMp4(tools, videoPath) {
  const probe = await fullProbe(tools.ffprobe, videoPath);
  const duration = mediaDuration(probe);
  if (duration < 164.95 || duration > 165.05) {
    throw new Error(`Final duration ${duration} is outside 164.95–165.05 seconds.`);
  }
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  const audio = probe.streams.find((stream) => stream.codec_type === "audio");
  const subtitle = probe.streams.find((stream) => stream.codec_type === "subtitle");
  if (
    !video ||
    video.codec_name !== "h264" ||
    video.width !== RECORDING_WIDTH ||
    video.height !== RECORDING_HEIGHT ||
    video.pix_fmt !== "yuv420p" ||
    video.profile !== "High" ||
    video.level !== 41 ||
    !new Set(["30/1", "60/2"]).has(video.avg_frame_rate)
  ) {
    throw new Error("Final video stream does not match H.264 High 4.1 1600x900/30 yuv420p.");
  }
  if (!audio || audio.codec_name !== "aac" || Number(audio.sample_rate) !== 48_000) {
    throw new Error("Final audio stream does not match AAC 48 kHz.");
  }
  if (
    !subtitle ||
    subtitle.codec_name !== "mov_text" ||
    subtitle.tags?.language !== "eng"
  ) {
    throw new Error("Final MP4 is missing the English mov_text subtitle stream.");
  }
  const allowedFormatTags = new Set([
    "major_brand",
    "minor_version",
    "compatible_brands",
    "encoder",
  ]);
  const allowedStreamTags = new Set([
    "language",
    "handler_name",
    "vendor_id",
    "encoder",
  ]);
  const unexpectedFormatTags = Object.keys(probe.format.tags ?? {}).filter(
    (tag) => !allowedFormatTags.has(tag),
  );
  const unexpectedStreamTags = probe.streams.flatMap((stream, index) =>
    Object.keys(stream.tags ?? {})
      .filter((tag) => !allowedStreamTags.has(tag))
      .map((tag) => `${index}:${tag}`),
  );
  if (unexpectedFormatTags.length > 0 || unexpectedStreamTags.length > 0) {
    throw new Error(
      `Final MP4 contains unexpected metadata tags: ${[
        ...unexpectedFormatTags,
        ...unexpectedStreamTags,
      ].join(", ")}`,
    );
  }
  const atoms = await topLevelAtomOffsets(videoPath);
  if (atoms.moov >= atoms.mdat) throw new Error("MP4 moov atom is not before mdat.");
  return Object.freeze({
    durationSeconds: Number(duration.toFixed(6)),
    video: {
      codec: video.codec_name,
      profile: video.profile,
      level: video.level,
      width: video.width,
      height: video.height,
      pixelFormat: video.pix_fmt,
      frameRate: video.avg_frame_rate,
    },
    audio: { codec: audio.codec_name, sampleRate: Number(audio.sample_rate) },
    subtitle: { codec: subtitle.codec_name, language: subtitle.tags.language },
    fastStart: true,
  });
}

async function generateContactSheet(tools, videoPath, outputPath, workDir) {
  const framePaths = [];
  for (const [index, timestamp] of CONTACT_SHEET_TIMESTAMPS.entries()) {
    const framePath = path.join(workDir, `contact-${String(index + 1).padStart(2, "0")}.png`);
    await runProcess(tools.ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      String(timestamp),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-vf",
      "scale=400:225",
      framePath,
    ]);
    framePaths.push(framePath);
  }
  const layout = CONTACT_SHEET_TIMESTAMPS.map((_, index) => {
    const column = index % 5;
    const row = Math.floor(index / 5);
    return `${column * 400}_${row * 225}`;
  }).join("|");
  await runProcess(tools.ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    ...framePaths.flatMap((framePath) => ["-i", framePath]),
    "-filter_complex",
    `xstack=inputs=10:layout=${layout}:fill=0x030712`,
    "-frames:v",
    "1",
    outputPath,
  ]);
  const probe = await fullProbe(tools.ffprobe, outputPath);
  const image = probe.streams.find((stream) => stream.codec_type === "video");
  if (!image || image.width !== 2000 || image.height !== 450) {
    throw new Error("Contact sheet must be exactly 2000x450 pixels.");
  }
  return Object.freeze({
    timestampsSeconds: CONTACT_SHEET_TIMESTAMPS,
    width: image.width,
    height: image.height,
  });
}

async function gitCommit() {
  const { stdout } = await runProcess("git", ["rev-parse", "HEAD"]);
  const commit = stdout.trim();
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Could not resolve a full Git commit.");
  return commit;
}

async function snapshotRepositoryProvenance(timeline) {
  const { stdout: status } = await runProcess("git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (status.trim()) {
    throw new Error(
      "Full recording requires a clean committed worktree so the manifest identifies the code that actually ran.",
    );
  }
  return Object.freeze({
    repositoryCommit: await gitCommit(),
    generatorSourceSha256: await hashFile(fileURLToPath(import.meta.url)),
    sourceDocumentSha256: createHash("sha256").update(timeline.markdown).digest("hex"),
    narrationTableSha256: createHash("sha256")
      .update(
        JSON.stringify(
          timeline.rows.map((row) => ({
            timecode: row.timecode,
            shot: row.shot,
            narration: row.markdownNarration,
          })),
        ),
      )
      .digest("hex"),
  });
}

async function assertRepositoryProvenanceUnchanged(expected, timeline) {
  const current = await snapshotRepositoryProvenance(timeline);
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new Error("Repository provenance changed while the submission video was recording.");
  }
}

async function prepareOutputRoot() {
  const requested = path.resolve(expandHome(DEFAULT_OUTPUT_ROOT));
  if (isInside(REPOSITORY_ROOT, requested)) {
    throw new Error("Submission output root must remain outside the repository.");
  }
  await mkdir(path.dirname(requested), { recursive: true });
  let rootExists = true;
  try {
    await lstat(requested);
  } catch (error) {
    if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
    rootExists = false;
  }
  if (!rootExists) await mkdir(requested);
  await assertNotSymlink(requested, "Submission output root");
  const outputRoot = await realpath(requested);
  if (outputRoot !== requested) {
    throw new Error("Submission output root must not resolve through symbolic links.");
  }

  const rootMarkerPath = path.join(outputRoot, OUTPUT_ROOT_MARKER);
  const expectedRootMarker = {
    schemaVersion: "1.0",
    project: "ModelDuel",
    purpose: "submission-video-artifacts",
    managedRoot: outputRoot,
  };
  let rootMarker;
  try {
    rootMarker = JSON.parse(await readFile(rootMarkerPath, "utf8"));
  } catch (error) {
    if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
    const entries = await readdir(outputRoot);
    if (entries.length > 0) {
      throw new Error(
        "Submission output root already contains unowned files; move them before recording.",
      );
    }
    await writeFile(rootMarkerPath, `${JSON.stringify(expectedRootMarker, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    rootMarker = expectedRootMarker;
  }
  if (JSON.stringify(rootMarker) !== JSON.stringify(expectedRootMarker)) {
    throw new Error("Submission output root ownership marker is invalid.");
  }

  const runsDir = path.join(outputRoot, "runs");
  await mkdir(runsDir, { recursive: true });
  await assertNotSymlink(runsDir, "Submission runs directory");
  const runId = `${new Date().toISOString().replaceAll(/[^0-9TZ]/g, "")}-${randomUUID()}`;
  const ownershipToken = randomUUID();
  const stagingDir = path.join(outputRoot, `.staging-${runId}`);
  const workDir = path.join(stagingDir, "work");
  const bundleDir = path.join(stagingDir, "bundle");
  for (const [label, candidate] of [
    ["Staging directory", stagingDir],
    ["Work directory", workDir],
    ["Bundle directory", bundleDir],
  ]) {
    assertInsideOutputRoot(outputRoot, candidate, label);
  }
  await mkdir(stagingDir);
  const output = {
    outputRoot,
    runsDir,
    runId,
    ownershipToken,
    stagingDir,
    workDir,
    bundleDir,
  };
  let markerWritten = false;
  try {
    await writeFile(
      path.join(stagingDir, RUN_MARKER),
      `${JSON.stringify({ runId, ownershipToken }, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    markerWritten = true;
    await mkdir(workDir);
    await mkdir(bundleDir);
    return Object.freeze(output);
  } catch (setupError) {
    try {
      if (markerWritten) {
        await cleanupOwnedStaging(output);
      } else {
        await assertNotSymlink(stagingDir, "Staging directory");
        if ((await readdir(stagingDir)).length === 0) {
          await rm(stagingDir, { recursive: false, force: false });
        }
      }
    } catch (cleanupError) {
      throw new AggregateError(
        [setupError, cleanupError],
        "Submission staging setup and owned cleanup both failed.",
      );
    }
    throw setupError;
  }
}

async function cleanupOwnedStaging(output) {
  assertInsideOutputRoot(output.outputRoot, output.stagingDir, "Staging directory");
  const marker = JSON.parse(
    await readFile(path.join(output.stagingDir, RUN_MARKER), "utf8"),
  );
  if (
    marker.runId !== output.runId ||
    marker.ownershipToken !== output.ownershipToken
  ) {
    throw new Error("Refusing to remove a staging directory without its ownership token.");
  }
  await rm(output.stagingDir, { recursive: true, force: false });
}

async function publishBundle(output) {
  const destination = path.join(output.runsDir, output.runId);
  assertInsideOutputRoot(output.outputRoot, destination, "Published run directory");
  await assertNotSymlink(destination, "Published run directory");
  const pointer = {
    schemaVersion: "1.0",
    runId: output.runId,
    relativePath: path.relative(output.outputRoot, destination),
  };
  const pointerTemp = path.join(output.outputRoot, `.latest-${output.runId}.json`);
  const pointerPath = path.join(output.outputRoot, "latest.json");
  let destinationPublished = false;
  try {
    await writeFile(pointerTemp, `${JSON.stringify(pointer, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(output.bundleDir, destination);
    destinationPublished = true;
    await rename(pointerTemp, pointerPath);
    return Object.freeze({ destination, pointerPath });
  } catch (error) {
    if (destinationPublished) {
      await rm(destination, { recursive: true, force: false });
    }
    throw error;
  } finally {
    await rm(pointerTemp, { force: true });
  }
}

async function main() {
  const argumentsResult = parseArguments(process.argv.slice(2));
  validateSelectorContracts();
  const timeline = await parseApprovedTimeline();
  const baseUrl = productionBaseUrl();
  const buildUrl = baseUrl.href;
  const buildMarker = validatedBuildMarker(process.env.MODELDUEL_BUILD_ID);

  if (argumentsResult.validateContractsOnly) {
    process.stdout.write(
      `${JSON.stringify(
        {
          valid: true,
          mode: "portable-contract-validation",
          timeline: {
            heading: TIMELINE_HEADING,
            rows: timeline.rows.length,
            start: timeline.rows[0].timecode.split("–")[0],
            end: timeline.rows.at(-1).timecode.split("–")[1],
            durationSeconds: TOTAL_DURATION_SECONDS,
          },
          selectors: Object.keys(SELECTORS),
          expectedApiLedger: EXPECTED_API_LEDGER,
          buildEvidence: BUILD_EVIDENCE,
          narration: {
            model: TTS_MODEL,
            voice: TTS_VOICE,
            disclosure: TTS_DISCLOSURE,
            paidGenerationRequiresExplicitOptIn: true,
          },
          productionOrigin: baseUrl.origin,
          externalToolsRequired: false,
          networkRequests: 0,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  const tools = await validateTools();

  if (argumentsResult.validateOnly) {
    process.stdout.write(
      `${JSON.stringify(
        {
          valid: true,
          timeline: {
            heading: TIMELINE_HEADING,
            rows: timeline.rows.length,
            start: timeline.rows[0].timecode.split("–")[0],
            end: timeline.rows.at(-1).timecode.split("–")[1],
            durationSeconds: TOTAL_DURATION_SECONDS,
          },
          tools: {
            speechModel: TTS_MODEL,
            speechVoice: TTS_VOICE,
            ffmpeg: tools.versions.ffmpeg,
            ffprobe: tools.versions.ffprobe,
            chromium: true,
          },
          selectors: Object.keys(SELECTORS),
          baseOrigin: baseUrl.origin,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  if (argumentsResult.probeOnly) {
    const probe = await recordVerifiedJourney(baseUrl, {
      recordVideo: false,
      timed: false,
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          valid: true,
          mode: "verified-production-probe",
          productionOrigin: baseUrl.origin,
          apiLedger: probe.counters.apiLedger,
          counters: { ...probe.counters, apiLedger: undefined },
          transitionCount: probe.timingEvidence.length,
          artifactsCreated: false,
          paidApiCalls: 0,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  const provenance = await snapshotRepositoryProvenance(timeline);
  const output = await prepareOutputRoot();
  try {
    const workVideo = path.join(output.bundleDir, FINAL_FILENAMES.video);
    const workSrt = path.join(output.bundleDir, FINAL_FILENAMES.subtitles);
    const workContactSheet = path.join(output.bundleDir, FINAL_FILENAMES.contactSheet);
    const workManifest = path.join(output.bundleDir, FINAL_FILENAMES.manifest);
    for (const candidate of [workVideo, workSrt, workContactSheet, workManifest]) {
      assertInsideOutputRoot(output.outputRoot, candidate, "Work artifact");
    }

    const srt = buildSrt(timeline.rows);
    await writeFile(workSrt, srt, "utf8");
    const narration = await synthesizeNarration(
      timeline,
      tools,
      output.workDir,
      output.outputRoot,
    );
    const recording = await recordVerifiedJourney(baseUrl, {
      workDir: output.workDir,
      recordVideo: true,
      timed: true,
    });
    await encodeSubmissionVideo(
      tools,
      recording.rawVideoPath,
      recording.preRollSeconds,
      narration.narrationPath,
      workSrt,
      workVideo,
    );
    const mediaValidation = await validateFinalMp4(tools, workVideo);
    const contactSheetValidation = await generateContactSheet(
      tools,
      workVideo,
      workContactSheet,
      output.workDir,
    );

    await assertRepositoryProvenanceUnchanged(provenance, timeline);
    const hashes = {
      [FINAL_FILENAMES.video]: await hashFile(workVideo),
      [FINAL_FILENAMES.subtitles]: await hashFile(workSrt),
      [FINAL_FILENAMES.contactSheet]: await hashFile(workContactSheet),
    };
    const manifest = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      provenance: {
        repositoryCommit: provenance.repositoryCommit,
        generatorSourceSha256: provenance.generatorSourceSha256,
        narrationSource: "docs/DEVPOST_SUBMISSION.md#245-demo-narration-and-shot-list",
        sourceDocumentSha256: provenance.sourceDocumentSha256,
        narrationTableSha256: provenance.narrationTableSha256,
        recordingUrl: baseUrl.href,
        buildUrl,
        buildMarker,
        verifiedOnly: true,
      },
      timeline: {
        rows: timeline.rows.length,
        durationSeconds: TOTAL_DURATION_SECONDS,
        timecodes: timeline.rows.map((row) => row.timecode),
      },
      buildEvidence: BUILD_EVIDENCE,
      narration: {
        model: TTS_MODEL,
        voice: TTS_VOICE,
        disclosure: TTS_DISCLOSURE,
        disclosureVisibleThroughoutVideo: true,
        inputCharacters: narration.inputCharacters,
        speechApiCallsThisRun: narration.ttsApiCalls,
        leadMillisecondsPerRow: 150,
        segments: narration.segmentEvidence,
      },
      media: mediaValidation,
      contactSheet: contactSheetValidation,
      requestAudit: { ...recording.counters },
      transitionTiming: recording.timingEvidence,
      privacy: {
        cookiesRecorded: false,
        requestPayloadsRecorded: false,
        responsePayloadsRecorded: false,
        liveAnalysisExecuted: false,
        liveRevisionExecuted: false,
      },
      artifacts: Object.fromEntries(
        Object.entries(hashes).map(([filename, sha256]) => [filename, { sha256 }]),
      ),
    };
    await writeFile(workManifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const publication = await publishBundle(output);
    process.stdout.write(
      `${JSON.stringify(
        {
          runId: output.runId,
          video: path.join(publication.destination, FINAL_FILENAMES.video),
          subtitles: path.join(publication.destination, FINAL_FILENAMES.subtitles),
          contactSheet: path.join(publication.destination, FINAL_FILENAMES.contactSheet),
          manifest: path.join(publication.destination, FINAL_FILENAMES.manifest),
          latestPointer: publication.pointerPath,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await cleanupOwnedStaging(output);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown recording failure.";
  process.stderr.write(`Submission video generation failed: ${message}\n`);
  process.exitCode = 1;
});
