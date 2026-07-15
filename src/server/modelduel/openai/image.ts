import { Buffer } from "node:buffer";

import type { AnalyzeSketch } from "../../../lib/modelduel/input";
import { MAX_SKETCH_BYTES } from "../../../lib/modelduel/input";

const DATA_URL_PATTERN =
  /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export type ValidatedSketchImage = Readonly<{
  mimeType: AnalyzeSketch["mimeType"];
  dataUrl: string;
  byteLength: number;
}>;

export class SketchImageError extends Error {
  readonly code: "INVALID_REQUEST" | "PAYLOAD_TOO_LARGE";

  constructor(code: "INVALID_REQUEST" | "PAYLOAD_TOO_LARGE" = "INVALID_REQUEST") {
    super(code);
    this.name = "SketchImageError";
    this.code = code;
  }
}

function hasMagicBytes(mimeType: AnalyzeSketch["mimeType"], bytes: Buffer): boolean {
  if (mimeType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
    );
  }
  if (mimeType === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  return (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export function validateSketchImage(sketch: AnalyzeSketch): ValidatedSketchImage {
  const match = DATA_URL_PATTERN.exec(sketch.dataUrl);
  if (!match || match[1] !== sketch.mimeType) {
    throw new SketchImageError();
  }

  const encoded = match[2];
  if (encoded.length % 4 !== 0) {
    throw new SketchImageError();
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(encoded, "base64");
  } catch {
    throw new SketchImageError();
  }
  if (bytes.toString("base64") !== encoded) {
    throw new SketchImageError();
  }
  if (bytes.length > MAX_SKETCH_BYTES) {
    throw new SketchImageError("PAYLOAD_TOO_LARGE");
  }
  if (!hasMagicBytes(sketch.mimeType, bytes)) {
    throw new SketchImageError();
  }

  return {
    mimeType: sketch.mimeType,
    dataUrl: sketch.dataUrl,
    byteLength: bytes.length,
  };
}
