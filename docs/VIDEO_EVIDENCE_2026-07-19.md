# Final Evidence Lens submission-video evidence — 2026-07-19 JST

This is the current validated upload candidate. It has not been uploaded or published; YouTube visibility and the final URL remain user-owned actions.

## Artifact identity

- Run ID: `20260718T163348650Z-65f5ae63-ff52-4b7c-bae7-f02f2b0c44a2`
- External run directory: `~/.gstack/projects/DevPostOpenAI/submission/runs/20260718T163348650Z-65f5ae63-ff52-4b7c-bae7-f02f2b0c44a2/`
- Generator commit: `462fb9747ba80537310e42235978ce1ab8b409d3`
- Production implementation merge: `1649c4b`
- Recorded origin: `https://modelduel.yasei.workers.dev/`
- Cloudflare version: `857b32b6-7ae0-4eec-8be2-75421eaf77ba`
- `latest.json` points to this run.

## Media and visual validation

- Duration: exactly **165.000 seconds**
- Video: H.264 High, 1600×900, 30 fps, yuv420p
- Audio: AAC, 48 kHz
- Subtitles: embedded English `mov_text` plus sidecar SRT
- Fast start and full video, audio, and subtitle decode: **Pass**
- Contact sheet: 10/10 checkpoints reviewed at 2000×450
- Codex overlay: **360 Node / 7 workerd / 38 Chromium**, plus **96/96 security-scan sources / 0 reportable findings**
- Evidence Lens logo, typography, verified-first capture, prediction, observation, revision, transfer, trust boundary, architecture, and final evidence frames are visible and legible
- AI-voice disclosure remains visible throughout

Artifact SHA-256:

- `modelduel-submission.mp4`: `8c562a4e472f9e2191eb89c2c7d2b9406d4c1ad12a96e537db18bf862cb4982d`
- `modelduel-submission.srt`: `f1aa3967c0e88db4aaeaead7d8c0adbececba953535473e0b67946f9bf2bcad4`
- `modelduel-contact-sheet.png`: `3c84ee39de38b6591ff79d06f12b318c227b710c9ba5f1032b79ec9499405715`
- `modelduel-submission-manifest.json`: `e9dde9b922d3e9f238e07bdaf5a649925f54d49de175a6aee64e4a433aaa84d6`

The manifest hashes match the three publishable media artifacts. Its repository commit and generator-source hash identify the exact committed recorder used for this run.

## Request, privacy, and cost audit

The application ledger is exactly:

1. `GET /api/demo`
2. verified-sample `POST /api/revision`
3. `POST /api/transfer`

All three API responses succeeded. Analyze attempts, live-revision attempts, external HTTP attempts, blocked or failed requests, bad HTTP responses, page errors, and unexpected console messages are all zero. No cookies, request payloads, or response payloads were recorded.

Narration uses disclosed OpenAI `tts-1` / `nova`. All 10 approved segments were cache hits and `speechApiCallsThisRun` is **0**. Paid generation opt-in was absent, so this recording made no new Speech, Terra, or Luna call. The earlier dated Terra/Luna production canary remains integration evidence; it was not repeated for this presentation-only release.

## Remaining external gates

- Public judge-accessible repository: https://github.com/Yasei-no-otoko/ModelDuel
- User-owned manual gate: upload this exact MP4, choose public/embed visibility, verify playback while logged out, and replace `{{VIDEO_URL}}`.
- Codex Feedback Session ID: `019f648c-0eb8-7b60-ad84-28ce35bbac4b` (official feedback upload for the primary build task).
- Complete Ubuntu three-engine CI or retain the documented local Firefox host-graphics exception without claiming a pass.
- Complete the final Devpost form review and submit before **July 21, 2026 at 5:00 PM PDT / July 22, 2026 at 9:00 AM JST**.
