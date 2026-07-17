import { describe, expect, it } from "vitest";

import { handleAnalyzeRequest } from "./route";

function invalidAnalyzeRequest(cookie?: string): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie === undefined ? {} : { Cookie: cookie }),
    },
    body: JSON.stringify({}),
  });
}

describe("analyze route safety identifier cookie", () => {
  it("persists the server-minted cookie on safe errors and reuses it", async () => {
    const firstResponse = await handleAnalyzeRequest(invalidAnalyzeRequest());
    expect(firstResponse.status).toBe(400);
    const setCookie = firstResponse.headers.get("set-cookie");
    expect(setCookie).toMatch(
      /^__Host-modelduel-safety-v1=mds1_[a-f0-9]{32}; Path=\/; HttpOnly; Secure; SameSite=Strict$/,
    );

    const cookiePair = setCookie?.split(";", 1)[0];
    expect(cookiePair).toBeTruthy();
    const secondResponse = await handleAnalyzeRequest(
      invalidAnalyzeRequest(cookiePair),
    );
    expect(secondResponse.status).toBe(400);
    expect(secondResponse.headers.has("set-cookie")).toBe(false);
  });
});
