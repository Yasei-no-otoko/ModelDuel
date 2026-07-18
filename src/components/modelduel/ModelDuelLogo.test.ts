import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ModelDuelLogo } from "./ModelDuelLogo";

describe("ModelDuelLogo", () => {
  it("encodes two model paths and one evidence point without a letter tile", () => {
    const markup = renderToStaticMarkup(
      createElement(ModelDuelLogo, { className: "test-mark" }),
    );

    expect(markup).toContain('class="test-mark"');
    expect(markup).toContain("logo-orbit-learner");
    expect(markup).toContain("logo-orbit-science");
    expect(markup).toContain("logo-evidence-point");
    expect(markup).not.toMatch(/>\s*M\s*</);
  });
});
