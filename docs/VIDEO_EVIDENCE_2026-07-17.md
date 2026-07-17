# Final local submission-video evidence — 2026-07-17 JST

This record covers the locally validated public-video candidate. It is not a public upload and does not replace the remaining Devpost link, repository-access, feedback-ID, or form-submission gates.

## Artifact identity

- Run ID: `20260717T055235573Z-cdf0526d-d779-42c8-8c53-18eb67f9cda8`
- External run directory: `~/.gstack/projects/DevPostOpenAI/submission/runs/20260717T055235573Z-cdf0526d-d779-42c8-8c53-18eb67f9cda8/`
- Generator commit: `f13a2e5e3e56c633c1f5d49acd52dd1202a3ca0c`
- Recorded production origin: `https://modelduel.yasei.workers.dev/`
- Recorded deployment build marker: `La258MjHHcPyAMa5k13Uz`
- Journey: verified-only; no live Terra analysis or live Luna revision executed

## Media validation

- Duration: exactly **165 seconds**
- Video: H.264 High, 1600×900, 30 fps, yuv420p
- Audio: AAC, 48 kHz
- Subtitles: embedded English `mov_text` plus the sidecar SRT
- Fast start: `moov` precedes `mdat`
- Full FFmpeg decode: pass with no reported errors
- Contact sheet: 10/10 timeline checkpoints reviewed; AI-voice disclosure remained visible

Artifact SHA-256:

- `modelduel-submission.mp4`: `75f7245501949b58685ebd72d0d8684a1a7fae46bfafbe1c71e0ad688bd025e8`
- `modelduel-submission.srt`: `f1aa3967c0e88db4aaeaead7d8c0adbececba953535473e0b67946f9bf2bcad4`
- `modelduel-contact-sheet.png`: `8b75682cf86ff85e8017ddb7e5f190f1db27c66464c2e36b388c6f8f4b87b769`

The manifest hashes matched the files. Its generator and full submission-document hashes also matched commit `f13a2e5` at validation time.

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
- Final successful recording: 10/10 cache hits, `speechApiCallsThisRun: 0`, and no API key or paid opt-in present
- Reverse-transcription QA: one `whisper-1` request, 165 seconds, maximum **$0.0165**, SDK retries disabled
- Transcription result: 411 expected words, 412 transcribed words, word edit distance 13, word error rate **3.163%**
- Maximum combined narration and transcription QA cost: **$0.057225**

Pricing and endpoint references: [OpenAI TTS-1](https://developers.openai.com/api/docs/models/tts-1) and [OpenAI Whisper](https://developers.openai.com/api/docs/models/whisper-1).

The failed first recording published no run; it stopped only after the narration disclosure intercepted the final reset click. Commit `f13a2e5` made the disclosure non-interactive, and the successful cache-only rerun recorded that commit. The two earlier macOS System Voice runs were manifest-checked as Samantha drafts and removed after this OpenAI TTS candidate passed all media checks.

## Browser gate context

The local candidate passed Chromium and WebKit with 69 tests and one intentional non-Chromium axe skip. The Chromium axe journey passed capture, evidence, and trace states. The pinned Playwright Firefox browser could not launch even for an empty page on this macOS host because of `RenderCompositorSWGL failed mapping default framebuffer, no dt`; therefore the Ubuntu CI three-engine job remains a required release gate and Firefox is not claimed as locally passed.

## Remaining external gates

- Publish or authorize a judge-accessible repository and replace `{{REPOSITORY_URL}}`.
- Upload this exact MP4 to a public/embed-enabled host and replace `{{VIDEO_URL}}`.
- Run `/feedback` in the primary Codex build thread and replace `{{CODEX_FEEDBACK_SESSION_ID}}`.
- Verify repository, video, and production links while logged out.
- Complete the current official rules/form review and submit before the deadline.

## Post-merge production deployment

After the video candidate was recorded and validated, the submission-quality branch was merged to `main` as `ed433b460e46d02eff272a7e1364bd2f107f1173` and deployed with the documented OpenNext Cloudflare command.

- Cloudflare Worker Version ID: `858c32e8-121f-42bd-b1f4-f422402671a3`
- Production URL: `https://modelduel.yasei.workers.dev`
- Post-deploy HTTP status: 200
- Production BUILD_ID: `La258MjHHcPyAMa5k13Uz`
- Upload: 8,277.51 KiB raw / 1,619.90 KiB gzip; 18 asset entries, 3 changed assets uploaded
- Worker startup time reported by Wrangler: 27 ms
- Remote secret-name inventory retained `OPENAI_API_KEY` and `MODELDUEL_EVALUATION_SECRET`; values were never read or recorded
- Security response included CSP, HSTS, `X-Content-Type-Options: nosniff`, strict-origin referrer policy, and the restricted permissions policy
- Free verified-production probe: exact three-request API ledger, 16 transitions, zero analyze/live-revision attempts, zero external HTTP attempts, zero request failures, zero bad responses, zero page errors, and zero paid API calls

This deployment occurred after the recording. It adds the accessible 3D-canvas role and the hardened submission tooling/CI; it does not change the recorded visual story or execute a second paid Terra/Luna canary.
