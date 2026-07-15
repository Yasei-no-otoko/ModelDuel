import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import { MAX_SKETCH_BYTES } from "../../../lib/modelduel/input";
import { SketchImageError, validateSketchImage } from "./image";

function dataUrl(mimeType: "image/png" | "image/jpeg" | "image/webp", bytes: Buffer) {
  return {
    mimeType,
    dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
  };
}

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP_HEADER = Buffer.from("RIFF\u0000\u0000\u0000\u0000WEBP", "binary");

describe("validateSketchImage", () => {
  it.each([
    ["image/png", PNG_HEADER],
    ["image/jpeg", JPEG_HEADER],
    ["image/webp", WEBP_HEADER],
  ] as const)("accepts canonical %s magic bytes", (mimeType, bytes) => {
    const image = validateSketchImage(dataUrl(mimeType, bytes));
    expect(image.mimeType).toBe(mimeType);
    expect(image.byteLength).toBe(bytes.length);
  });

  it("accepts exactly three MiB", () => {
    const bytes = Buffer.alloc(MAX_SKETCH_BYTES);
    PNG_HEADER.copy(bytes);
    expect(validateSketchImage(dataUrl("image/png", bytes)).byteLength).toBe(
      MAX_SKETCH_BYTES,
    );
  });

  it("rejects a decoded image over three MiB", () => {
    const bytes = Buffer.alloc(MAX_SKETCH_BYTES + 1);
    PNG_HEADER.copy(bytes);
    try {
      validateSketchImage(dataUrl("image/png", bytes));
    } catch (error) {
      expect(error).toBeInstanceOf(SketchImageError);
      if (!(error instanceof SketchImageError)) {
        throw error;
      }
      expect(error.code).toBe("PAYLOAD_TOO_LARGE");
      return;
    }
    throw new Error("Expected PAYLOAD_TOO_LARGE");
  });

  it.each([
    "https://example.com/sketch.png",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/png;base64,%2F9j%2F",
    "data:image/png;base64,iVBOR w0KGgo=",
    "data:image/png;base64,iVBOR\nw0KGgo=",
  ])("rejects a non-local or non-exact data URL", (invalid) => {
    expect(() =>
      validateSketchImage({ mimeType: "image/png", dataUrl: invalid }),
    ).toThrow(SketchImageError);
  });

  it("rejects non-canonical base64 and MIME disagreement", () => {
    expect(() =>
      validateSketchImage({
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,AB==",
      }),
    ).toThrow(SketchImageError);
    expect(() =>
      validateSketchImage({
        mimeType: "image/png",
        dataUrl: dataUrl("image/jpeg", JPEG_HEADER).dataUrl,
      }),
    ).toThrow(SketchImageError);
  });

  it("rejects valid base64 with the wrong magic bytes", () => {
    expect(() =>
      validateSketchImage(dataUrl("image/png", JPEG_HEADER)),
    ).toThrow(SketchImageError);
  });
});
