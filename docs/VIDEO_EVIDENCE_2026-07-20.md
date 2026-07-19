# Final analytical 3D submission-video evidence — 2026-07-20 JST

This is the current validated upload candidate. It has not been uploaded or published; YouTube visibility and the final URL remain user-owned actions.

## Artifact identity

- Run ID: `20260719T161844609Z-1c1d0be9-1d97-4a0e-8a4e-967a27d9e9dd`
- External run directory: `~/.gstack/projects/DevPostOpenAI/submission/runs/20260719T161844609Z-1c1d0be9-1d97-4a0e-8a4e-967a27d9e9dd/`
- Recorder and narration commit: `761b68d66414be87ece295f0a58a6a6ff33844db`
- Recorded production runtime: analytical Three.js implementation through merge `40a276e`
- Recorded origin: `https://modelduel.yasei.workers.dev/`
- Active Cloudflare version at recording: `5fe05dc0-7085-400f-bf0c-bddb9c9017f9`
- `latest.json` points to this immutable run.

The Cloudflare version was independently observed at 100% traffic before recording. The manifest's `buildMarker` records that version as provenance metadata; it is not treated as cryptographic deployment attestation. The production probe and the exact recorded request ledger below are the runtime evidence.

## Media and visual validation

- Duration: exactly **165.000 seconds** / **4,950 frames**
- Video: H.264 High level 4.1, 1600×900, 30 fps, yuv420p
- Audio: AAC-LC mono, 48 kHz
- Subtitles: embedded English `mov_text` plus sidecar SRT
- Fast start and full video/audio decode: **Pass**
- Embedded subtitle decode: **Pass**; text and timecodes match the sidecar SRT, with only FFmpeg's trailing blank line differing
- Contact sheet: 10/10 checkpoints reviewed at 2000×450
- Additional frame review: hero focus states; Moon evidence overview; scientific Earth-side, Plane, and reset Overview views; trust-boundary architecture; Codex evidence; final hero
- Codex overlay: **363 Node / 7 workerd / 46 Chromium**, plus **96/96 security-scan sources / 0 reportable findings**
- The analytical first-view 3D comparison, complete ModelDuel logo, typography, verified-first capture, prediction, two-world observation, named scientific views, revision, transfer, trust boundary, Codex evidence, and final hero are visible and legible
- AI-voice disclosure remains visible throughout

Artifact SHA-256:

- `modelduel-submission.mp4`: `1be00da88719eab34cf44ab55f7551b788c89e2fb1721aa6415f5a187d2c57d0`
- `modelduel-submission.srt`: `f1aa3967c0e88db4aaeaead7d8c0adbececba953535473e0b67946f9bf2bcad4`
- `modelduel-contact-sheet.png`: `7ee0db8e0d2d99401519b6d1151d7630b839989a989a3ec0e180b4ce9c5bd35a`
- `modelduel-submission-manifest.json`: `8f76e28630f3863f13ecbf6355753a0c8e347548bcf1219fc3edc6b181c06b5a`

The manifest hashes match the three publishable media artifacts. Its repository commit, generator-source hash, source-document hash, and narration-table hash identify the exact committed recorder and approved script used for this run.

## Request, privacy, and cost audit

The application ledger is exactly:

1. `GET /api/demo`
2. verified-sample `POST /api/revision`
3. `POST /api/transfer`

All three API responses succeeded. The run observed 22 same-origin requests: 19 document/static requests and the three API requests above. Analyze attempts, live-revision attempts, external HTTP attempts, blocked or failed requests, bad HTTP responses, page errors, and unexpected console messages are all zero. No cookies, request payloads, or response payloads were recorded.

Narration uses disclosed OpenAI `tts-1` / `nova`. All 10 approved segments were cache hits and `speechApiCallsThisRun` is **0**. Paid generation opt-in was explicitly removed, so a cache miss would have stopped the run rather than call the Speech API. This recording made no new Speech, Terra, or Luna call. The earlier dated Terra/Luna production canary remains integration evidence; it was not repeated for this presentation-only release.

## Source and CI validation

- Recorder preflight: narration contract, FFmpeg/FFprobe capabilities, Chromium availability, and the production probe all passed before recording.
- Recording commit CI: [run `29694422606`](https://github.com/Yasei-no-otoko/ModelDuel/actions/runs/29694422606) succeeded on `761b68d` with **363/363 unit tests across 37 files**, submission-video contract validation, production build, Cloudflare Worker build/typecheck, Wrangler bundle validation, clean production dependency audit, and Ubuntu Chromium/Firefox/WebKit **134 passed / 4 intentional skips**.
- The recording completed all 22 scheduled UI transitions. The two-world evidence transition began early at 63.252 seconds and settled at 64.439 seconds; the named scientific `Earth-side view` at 72 seconds, `Plane view` at 79 seconds, and reset `Case overview` at 85 seconds all settled within their scheduled marks.
- Public judge-accessible repository verified: https://github.com/Yasei-no-otoko/ModelDuel
- Codex Feedback Session ID recorded: `019f648c-0eb8-7b60-ad84-28ce35bbac4b` (official feedback upload for the primary build task).

## Publication status and remaining gates

- User-owned manual gate: upload this exact MP4 to YouTube as **Public** (not Unlisted or Private), verify playback while logged out, and replace `{{VIDEO_URL}}`.
- Complete the final Devpost form review and submit before **July 21, 2026 at 5:00 PM PDT / July 22, 2026 at 9:00 AM JST**.
