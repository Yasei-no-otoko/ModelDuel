# Final Evidence Lens submission-video evidence — 2026-07-19 JST

This is the current validated upload candidate. It has not been uploaded or published; YouTube visibility and the final URL remain user-owned actions.

## Artifact identity

- Run ID: `20260719T092408557Z-fec2df68-b1ea-4ea6-9b0a-fb97131df4b5`
- External run directory: `~/.gstack/projects/DevPostOpenAI/submission/runs/20260719T092408557Z-fec2df68-b1ea-4ea6-9b0a-fb97131df4b5/`
- Generator commit: `96b93d4253ea545a125de20a0782a6435c24dffe`
- Production implementation merge: `96b93d4`
- Recorded origin: `https://modelduel.yasei.workers.dev/`
- Cloudflare version: `cd38e435-7875-4125-bfbb-c7f5a4d092d0`
- `latest.json` points to this run.

## Media and visual validation

- Duration: exactly **165.000 seconds**
- Video: H.264 High, 1600×900, 30 fps, yuv420p
- Audio: AAC, 48 kHz
- Subtitles: embedded English `mov_text` plus sidecar SRT
- Fast start and full video, audio, and subtitle decode: **Pass**
- Contact sheet: 10/10 checkpoints reviewed at 2000×450
- Codex overlay: **363 Node / 7 workerd / 43 Chromium**, plus **96/96 security-scan sources / 0 reportable findings**
- The animated first-view 3D comparison, full ModelDuel logo, typography, verified-first capture, prediction, observation, revision, transfer, trust boundary, architecture, and final evidence frames are visible and legible
- AI-voice disclosure remains visible throughout

Artifact SHA-256:

- `modelduel-submission.mp4`: `90f11d7789c16a4d0e7b41bc61be0abc25c7935e2a24b5c4e8fdd83780ffc068`
- `modelduel-submission.srt`: `f1aa3967c0e88db4aaeaead7d8c0adbececba953535473e0b67946f9bf2bcad4`
- `modelduel-contact-sheet.png`: `6851bf1fe9538cb29a115bc28fb46c4312b5c0965f77201653ebb50780e81ed3`
- `modelduel-submission-manifest.json`: `65c5c73c82fef31f9af93995bbec23fc1accece6a9a93986f6affb729f17061f`

The manifest hashes match the three publishable media artifacts. Its repository commit and generator-source hash identify the exact committed recorder used for this run.

## Request, privacy, and cost audit

The application ledger is exactly:

1. `GET /api/demo`
2. verified-sample `POST /api/revision`
3. `POST /api/transfer`

All three API responses succeeded. Analyze attempts, live-revision attempts, external HTTP attempts, blocked or failed requests, bad HTTP responses, page errors, and unexpected console messages are all zero. No cookies, request payloads, or response payloads were recorded.

Narration uses disclosed OpenAI `tts-1` / `nova`. All 10 approved segments were cache hits and `speechApiCallsThisRun` is **0**. Paid generation opt-in was absent, so this recording made no new Speech, Terra, or Luna call. The earlier dated Terra/Luna production canary remains integration evidence; it was not repeated for this presentation-only release.

## Publication status and remaining gates

- Public judge-accessible repository verified: https://github.com/Yasei-no-otoko/ModelDuel
- Ubuntu Chromium/Firefox/WebKit CI verified on main merge `96b93d4`: [run `29681260428`](https://github.com/Yasei-no-otoko/ModelDuel/actions/runs/29681260428) completed successfully with **127 passed / 2 intentional skips**.
- Codex Feedback Session ID recorded: `019f648c-0eb8-7b60-ad84-28ce35bbac4b` (official feedback upload for the primary build task).
- User-owned manual gate: upload this exact MP4, choose public/embed visibility, verify playback while logged out, and replace `{{VIDEO_URL}}`.
- Complete the final Devpost form review and submit before **July 21, 2026 at 5:00 PM PDT / July 22, 2026 at 9:00 AM JST**.
