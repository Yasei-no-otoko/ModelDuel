# Final local submission-video evidence — 2026-07-18 JST

This is the current validated upload candidate. It has not been uploaded or published; YouTube visibility and the final URL remain user-owned actions.

## Artifact identity

- Run ID: `20260718T123124345Z-7df28d60-4670-4e1b-acd7-b04f2c41d9c2`
- External run directory: `~/.gstack/projects/DevPostOpenAI/submission/runs/20260718T123124345Z-7df28d60-4670-4e1b-acd7-b04f2c41d9c2/`
- Generator commit: `42647ed3356fbca16390a87c568e9141bba4131d`
- Production implementation merge: `e5e7b03`
- Recorded origin: `https://modelduel.yasei.workers.dev/`
- Cloudflare version: `37596678-0018-4415-b9bd-5671d67068bb` at 100% traffic
- `latest.json` points to this run.

## Media and visual validation

- Duration: exactly **165.000 seconds**
- Video: H.264 High, 1600×900, 30 fps, yuv420p
- Audio: AAC, 48 kHz
- Subtitles: embedded English `mov_text` plus sidecar SRT
- Fast start: enabled
- Full video, audio, and subtitle decode: pass
- Contact sheet: 10/10 checkpoints reviewed at the original 2000×450 resolution
- Codex overlay: **356 Node / 7 workerd / 38 Chromium**, plus **96/96 security-scan sources / 0 reportable findings**
- 123-second frame: authored teacher cue, learner-controlled handoff, preview, and confirmation-disabled copy/download controls are visible and legible
- 130-second architecture frame and 156-second Codex evidence frame: visible and legible at 1600×900
- AI-voice disclosure remains visible throughout

Artifact SHA-256:

- `modelduel-submission.mp4`: `b1591af102515c500cadf973e75f87efc276bbf1a928cf36ba9a24e51f0c826b`
- `modelduel-submission.srt`: `f1aa3967c0e88db4aaeaead7d8c0adbececba953535473e0b67946f9bf2bcad4`
- `modelduel-contact-sheet.png`: `2e5e190bca1b575b67aaadc17bbb6283d3f7d42c396acbc07ff7eeb2e2da7323`
- `modelduel-submission-manifest.json`: `8dc301e1756e462c08634f66ff95921f23de0061dcad8c6dfe3d594bd4288f77`

The manifest hashes match the three publishable media artifacts. Its repository commit and generator-source hash match commit `42647ed`.

## Request, privacy, and cost audit

The application ledger is exactly:

1. `GET /api/demo`
2. verified-sample `POST /api/revision`
3. `POST /api/transfer`

All three API responses succeeded. Analyze attempts, live-revision attempts, external HTTP attempts, blocked or failed requests, bad HTTP responses, page errors, and unexpected console messages are all zero. No cookies, request payloads, or response payloads were recorded.

Narration uses disclosed OpenAI `tts-1` / `nova`. All 10 approved segments were cache hits and `speechApiCallsThisRun` is **0**. Paid generation opt-in was absent, so this recording made no new Speech, Terra, or Luna call.

Separately, only after the merged local, Cloudflare dry-run, deployed binding, header, and free-ledger gates passed, the final production version received one paid live workflow with zero HTTP or SDK retries. Terra analysis returned HTTP 200 in **18.363 seconds**, source `live`, model `gpt-5.6-terra`, and the exact four-tool ledger. The same session then made one Luna revision request, which returned HTTP 200 in **3.477 seconds**, source `gpt-5.6`, model `gpt-5.6-luna`, conceptual change `revised`, and score `1`. No further paid canary was run. Raw learner data, feedback, cookies, capabilities, secrets, and identifiers were not retained in this evidence.

## Remaining external gates

- Public judge-accessible repository: https://github.com/Yasei-no-otoko/ModelDuel
- User-owned manual gate: upload this exact MP4, choose public/embed visibility, verify playback while logged out, and replace `{{VIDEO_URL}}`.
- Codex Feedback Session ID: `019f648c-0eb8-7b60-ad84-28ce35bbac4b` (official feedback upload for the primary build task).
- Complete Ubuntu three-engine CI or retain the documented local Firefox host-graphics exception without claiming a pass.
- Complete the final Devpost form review and submit before the deadline.
