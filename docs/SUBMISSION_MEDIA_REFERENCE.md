# Submission media and browser reference

Primary-source review completed on **2026-07-17 JST**. Implementation and release evidence must still pass the repository gates before public submission.

## Narration rights and disclosure

- The current macOS Tahoe license permits System Voices for personal, non-commercial projects and expressly excludes recording, publishing, redistribution, and public sharing. A macOS `say`/Samantha draft therefore must not be uploaded as the public hackathon video.
- OpenAI's Speech API supports generated narration. ModelDuel uses `tts-1` with the built-in `nova` voice because `tts-1` remains a listed Speech endpoint model and has a published price of **$15 per 1M input characters**.
- OpenAI requires a clear disclosure that a TTS voice is AI-generated rather than human. The recorder displays `AI-generated narration · OpenAI TTS` throughout the final video and records the disclosure in its manifest.
- Only the already-public narration table is submitted to the Speech API. Cache keys include the model, voice, and exact narration, allowing later video retries without another paid request.

Primary sources:

- [Apple macOS Tahoe 26 Software License Agreement](https://www.apple.com.cn/legal/sla/docs/macOSTahoe.pdf), section 2F, pages 2–3.
- [OpenAI Text to speech guide](https://developers.openai.com/api/docs/guides/text-to-speech).
- [OpenAI TTS-1 model and pricing](https://developers.openai.com/api/docs/models/tts-1).
- [OpenAI API output ownership help](https://help.openai.com/en/articles/5008634).

This is an engineering rights check, not legal advice. Any additional music, font embedding, stock media, or third-party footage requires a separate review.

## Cross-browser and accessibility gates

- Playwright's supported project configuration runs the functional suite against Chromium, Firefox, and WebKit. CI installs all three matching browser binaries for the pinned Playwright version.
- Playwright's official accessibility guidance uses `@axe-core/playwright`. ModelDuel performs one deterministic Chromium axe scan of the capture, evidence, and final trace states for automatically detectable WCAG 2.0, 2.1, and 2.2 A/AA violations; the functional journeys still run in all three engines.
- Automated accessibility checks cover only a subset of accessibility problems; keyboard, responsive, contrast, semantic, and manual visual checks remain required.

Local candidate evidence on **2026-07-17 JST**: Chromium and WebKit completed the functional suite with **69 passed and 1 intentional axe skip**; the Chromium axe journey passed all three states. The bundled Firefox 151 browser could not start even for an empty page on this macOS host, failing before app navigation with `RenderCompositorSWGL failed mapping default framebuffer, no dt`. Mozilla tracks the same graphics failure in [Bug 1961194](https://bugzilla.mozilla.org/show_bug.cgi?id=1961194). This is a host-level exception, not a Firefox product pass: the Ubuntu CI job still installs and must run the pinned Chromium, Firefox, and WebKit builds before public release.

Primary sources:

- [Playwright browser projects](https://playwright.dev/docs/browsers#run-tests-on-different-browsers).
- [Playwright CI guide](https://playwright.dev/docs/ci).
- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing).
