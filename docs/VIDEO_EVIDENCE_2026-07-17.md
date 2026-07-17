# Final local submission-video evidence — 2026-07-17 JST

This record covers the locally validated public-video candidate. It is not a public upload and does not replace the remaining Devpost link, repository-access, feedback-ID, or form-submission gates.

## Artifact identity

- Run ID: `20260717T063651969Z-89b9c70a-c828-4443-b2be-3a81dc13f7fb`
- External run directory: `~/.gstack/projects/DevPostOpenAI/submission/runs/20260717T063651969Z-89b9c70a-c828-4443-b2be-3a81dc13f7fb/`
- Generator commit: `61863582a56a7a3d9e0bf5c6fad4a9130a7c81be`
- Recorded production origin: `https://modelduel.yasei.workers.dev/`
- Manifest build marker: `null`; an immediate post-record production fetch returned build ID `nkFYXp8co99asrn8bVd1U`, which corresponds to generator commit `6186358`
- Journey: verified-only; no live Terra analysis or live Luna revision executed

## Media validation

- Duration: exactly **165 seconds**
- Video: H.264 High, 1600×900, 30 fps, yuv420p
- Audio: AAC, 48 kHz
- Subtitles: embedded English `mov_text` plus the sidecar SRT
- Fast start: `moov` precedes `mdat`
- Full FFmpeg decode: pass with no reported errors
- Contact sheet: 10/10 timeline checkpoints reviewed; AI-voice disclosure remained visible
- Teacher-handoff frame: the 123-second frame was separately extracted and reviewed because the fixed 10-frame contact sheet jumps from transfer to architecture. It clearly shows the three-part teacher summary, learner-controlled handoff, plain-text preview, and confirmation-disabled controls.

Artifact SHA-256:

- `modelduel-submission.mp4`: `ac5d3866ceb08fcb283c96362b84733114e634c46de750019abff5e0c7e5d974`
- `modelduel-submission.srt`: `f1aa3967c0e88db4aaeaead7d8c0adbececba953535473e0b67946f9bf2bcad4`
- `modelduel-contact-sheet.png`: `ab4a1eb14cfcf4cbcfee7ee170e11a48f15fbb6d0c71123e95ea740eddfac379`
- `modelduel-submission-manifest.json`: `ff4d2a73658bd4a654d930376d3b80f20dbb00b8353f4121d6bed9a7a76fd46b`

The manifest hashes matched the files. Its generator and full submission-document hashes also matched merge `6186358` at validation time.

## Request and privacy audit

The captured application ledger was exactly:

1. `GET /api/demo`
2. verified-sample `POST /api/revision`
3. `POST /api/transfer`

Recorded counters were zero for analyze attempts, live-revision attempts, external HTTP attempts, blocked requests, failed requests, bad HTTP responses, page errors, and unexpected console messages. The bundle records no cookies, request payloads, or response payloads.

## Narration quality and cost guard

- Voice: OpenAI `tts-1` / `nova`
- Visible disclosure: `AI-generated narration · OpenAI TTS`
- Approved input: 2,715 characters across 10 public narration rows
- Initial cache population: 10 Speech API requests, SDK retries disabled
- Maximum TTS cost at the verified price: **$0.040725**
- Latest successful recording: 10/10 cache hits, `speechApiCallsThisRun: 0`, and an explicitly blank API key with no paid opt-in
- Reverse-transcription QA: one `whisper-1` request, 165 seconds, maximum **$0.0165**, SDK retries disabled
- Transcription result for the unchanged narration/SRT: 411 expected words, 412 transcribed words, word edit distance 13, word error rate **3.163%**
- Maximum combined narration and transcription QA cost: **$0.057225**

Pricing and endpoint references: [OpenAI TTS-1](https://developers.openai.com/api/docs/models/tts-1) and [OpenAI Whisper](https://developers.openai.com/api/docs/models/whisper-1).

No new transcription or Speech API request was made for the handoff recording. Its narration table, SRT hash, and all 10 cached source-audio hashes are unchanged, so the prior reverse-transcription QA remains applicable. The earlier failed recording published no run; commit `f13a2e5` made the disclosure non-interactive. The two macOS System Voice drafts were removed after the OpenAI TTS candidate passed media checks.

## Browser gate context

The local candidate passed Chromium and WebKit with 69 tests and one intentional non-Chromium axe skip. The Chromium axe journey passed capture, evidence, and trace states. The pinned Playwright Firefox browser could not launch even for an empty page on this macOS host because of `RenderCompositorSWGL failed mapping default framebuffer, no dt`; therefore the Ubuntu CI three-engine job remains a required release gate and Firefox is not claimed as locally passed.

## Remaining external gates

- Publish or authorize a judge-accessible repository and replace `{{REPOSITORY_URL}}`.
- Upload this exact MP4 to a public/embed-enabled host and replace `{{VIDEO_URL}}`.
- Run `/feedback` in the primary Codex build thread and replace `{{CODEX_FEEDBACK_SESSION_ID}}`.
- Verify repository, video, and production links while logged out.
- Complete the current official rules/form review and submit before the deadline.

## Post-merge production deployment

The teacher-handoff implementation was merged to `main` as `61863582a56a7a3d9e0bf5c6fad4a9130a7c81be` and deployed with the documented OpenNext Cloudflare command before this video was recorded.

- Cloudflare Worker Version ID: `e400d0d7-3fb1-47be-8872-ef9caeefb5d9`
- Production URL: `https://modelduel.yasei.workers.dev`
- Post-deploy HTTP status: 200
- Production BUILD_ID: `nkFYXp8co99asrn8bVd1U`
- Upload: 8,286.05 KiB raw / 1,621.89 KiB gzip; 18 asset entries, 3 changed assets uploaded
- Worker startup time reported by Wrangler: 35 ms
- Remote secret-name inventory retained `OPENAI_API_KEY` and `MODELDUEL_EVALUATION_SECRET`; values were never read or recorded
- Security response included CSP, HSTS, `X-Content-Type-Options: nosniff`, strict-origin referrer policy, and the restricted permissions policy
- Free verified-production probe: exact `GET /api/demo` → verified `POST /api/revision` → `POST /api/transfer` ledger, all HTTP 200; teacher summary and handoff visible; copy and download disabled before confirmation; boundary text present; internal metadata absent; zero failed requests, console errors, or paid API calls

Remote secret-name inventory retained `OPENAI_API_KEY` and `MODELDUEL_EVALUATION_SECRET` after deployment. The adapter emitted a local-secret warning because values were intentionally not read into the shell; Wrangler retained the already configured remote secrets. This deployment did not execute a second paid Terra/Luna canary.
