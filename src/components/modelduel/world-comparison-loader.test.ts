import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const loaderSource = readFileSync(
  fileURLToPath(new URL("./world-comparison-loader.tsx", import.meta.url)),
  "utf8",
);
const experienceSource = readFileSync(
  fileURLToPath(new URL("./ModelDuelExperience.tsx", import.meta.url)),
  "utf8",
);

describe("WorldComparison split boundary", () => {
  it("keeps the named comparison export behind a client-only dynamic loader", () => {
    expect(loaderSource).toContain('import("./WorldComparison")');
    expect(loaderSource).toContain("module.WorldComparison");
    expect(loaderSource).toContain("ssr: false");
    expect(experienceSource).not.toContain(
      'import { WorldComparison } from "./WorldComparison"',
    );
    expect(experienceSource).toContain(
      "void loadWorldComparison().catch(() => undefined)",
    );
  });

  it("provides an accessible, layout-stable loading contract", () => {
    expect(loaderSource).toContain('className="world-comparison-loading"');
    expect(loaderSource).toContain('role="status"');
    expect(loaderSource).toContain('aria-live="polite"');
    expect(loaderSource).toContain(
      'aria-label="Loading interactive evidence comparison"',
    );
  });
});
