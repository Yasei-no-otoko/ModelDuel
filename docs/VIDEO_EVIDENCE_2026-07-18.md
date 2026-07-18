# Final local submission-video evidence — 2026-07-18 JST

This is the current validated upload candidate. It has not been uploaded or
published; YouTube visibility and the final URL remain user-owned actions.

## Artifact identity

- Run ID: `20260718T042832207Z-e605b8e2-e4df-4308-8d70-9a630a0c6942`
- External run directory: `~/.gstack/projects/DevPostOpenAI/submission/runs/20260718T042832207Z-e605b8e2-e4df-4308-8d70-9a630a0c6942/`
- Generator commit: `5cfdb260b6f22988093ec74569b25572269fce2b`
- Production implementation merge: `3d65845`
- Recorded origin: `https://modelduel.yasei.workers.dev/`
- Cloudflare build marker: `cc6bc7c5-13e6-463d-a8d6-533267a2d468`
- `latest.json` points to this run.

The immediately preceding run `20260718T042206963Z-c6e9fb6c-06fd-4388-b5d3-e9ad2d6b624b`
must not be uploaded: visual review found that its Codex overlay still showed the
historical 332/34 gate. The generator was corrected and committed before this
replacement was recorded.

## Media and visual validation

- Duration: exactly **165.000 seconds**
- Video: H.264 High, 1600×900, 30 fps, yuv420p
- Audio: AAC, 48 kHz
- Subtitles: embedded English `mov_text` plus sidecar SRT
- Fast start: enabled
- Full video, audio, and subtitle decode: pass
- Contact sheet: 10/10 checkpoints reviewed at the original 2000×450 resolution
- Codex overlay: **344 Node / 7 workerd / 36 Chromium**, plus **25-file security delta / 0 reportable findings**
- 123-second frame: teacher summary, learner-controlled handoff, preview, and confirmation-disabled copy/download controls are visible and legible
- AI-voice disclosure remains visible throughout

Artifact SHA-256:

- `modelduel-submission.mp4`: `66b3d4eb47948f031c6d76466de8de3d1312bf202be0518c990107e65936f671`
- `modelduel-submission.srt`: `f1aa3967c0e88db4aaeaead7d8c0adbececba953535473e0b67946f9bf2bcad4`
- `modelduel-contact-sheet.png`: `81e529ba234d327d684370ed3d9280d1434731f8d653ac1297a04549a4c083ab`
- `modelduel-submission-manifest.json`: `3b51bafd8caa03c391af226a1e3f62e4185a05a192f3287abf46e11c0276e8f8`

The manifest hashes match the three publishable artifacts. Its source and
generator hashes match commit `5cfdb26`.

## Request, privacy, and cost audit

The application ledger is exactly:

1. `GET /api/demo`
2. verified-sample `POST /api/revision`
3. `POST /api/transfer`

Analyze attempts, live-revision attempts, external HTTP attempts, blocked or
failed requests, bad HTTP responses, page errors, and unexpected console
messages are all zero. No cookies, request payloads, or response payloads were
recorded.

Narration uses disclosed OpenAI `tts-1` / `nova`. All 10 approved segments were
cache hits and `speechApiCallsThisRun` is **0**. Paid generation opt-in was
explicitly absent, so this recording made no new Speech, Terra, or Luna call.
The narration table and SRT are unchanged from the reverse-transcription QA
recorded in the [2026-07-17 evidence](VIDEO_EVIDENCE_2026-07-17.md).

## Remaining external gates

- Publish or authorize a judge-accessible repository and replace `{{REPOSITORY_URL}}`.
- User-owned manual gate: upload this exact MP4, choose public/embed visibility,
  verify playback while logged out, and replace `{{VIDEO_URL}}`.
- Run `/feedback` in the primary Codex build task and replace
  `{{CODEX_FEEDBACK_SESSION_ID}}`.
- Complete the final Devpost form review and submit before the deadline.
