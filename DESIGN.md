# Design System — ModelDuel

## Product Context

- **What this is:** An evidence-led astronomy learning experience that turns a
  learner's current explanation into a model that can be tested beside the
  scientific model under the same conditions.
- **Who it's for:** Middle-school learners, teachers, judges, and adults or
  authorized learners testing the optional live GPT path.
- **Space/industry:** Interactive science education, scientific visualization,
  and formative assessment.
- **Project type:** A single-journey responsive web application with deterministic
  3D evidence and an accessible 2D fallback.
- **Memorable thing:** This feels like a scientific instrument that lets evidence
  judge two explanations, not an AI tutor that declares an answer.

## Aesthetic Direction

- **Direction:** Evidence Lab, a scientific editorial instrument.
- **Decoration level:** Intentional. Orbital paths, registration marks, and
  observation lines may reinforce the method. Decorative blobs, aurora gradients,
  glass effects, and generic space wallpaper are prohibited.
- **Mood:** Curious, exact, and humane. The interface should feel trustworthy to a
  teacher while remaining legible and inviting to a 13-year-old learner.
- **References:** PhET for constrained exploration, NASA Eyes for 3D wayfinding,
  and Brilliant for one-action-per-step pacing. ModelDuel must keep its own
  prediction-before-evidence identity rather than copy their visual styles.

## Brand Mark

- **Concept:** Two opposing model arcs share one central observation point. The
  mark can also read as two lunar phases around a piece of evidence.
- **Prohibited:** A single letter `M`, chat bubbles, sparkles, generic brains,
  magic wands, robot heads, or gradient app-icon tiles.
- **Construction:** Inline SVG with a fixed view box, semantic amber/cyan strokes,
  square line caps, and a distinct mint evidence point. The visible wordmark
  remains beside the symbol.
- **Use:** Full mark plus wordmark in navigation. Symbol-only use is limited to
  favicon and compact metadata contexts.

## Typography

- **Display/Hero:** Barlow Condensed, 600–800. Its narrow scientific-poster voice
  preserves impact without the inflated, bubbly AI-landing-page look.
- **Body/UI:** Atkinson Hyperlegible Next, variable 400–800. It prioritizes letter
  recognition and long-form readability for learners.
- **Data/Tables:** IBM Plex Mono, 500–600, with tabular numbers for measurements,
  receipts, cases, and model labels.
- **Loading:** Use `next/font/google` so font files are bundled and served from the
  application origin. Do not add runtime Google Font requests.
- **Scale:** 12, 14, 16, 18, 22, 28, 40, and fluid 56–88px. Body text is never
  below 16px on mobile.

## Color

- **Approach:** Restrained and semantic. Color distinguishes roles and state; it
  does not decorate every container.
- **Canvas:** `#060A12`
- **Surface:** `#0B1321`
- **Raised surface:** `#101C2E`
- **Primary text:** `#F4F2E9`
- **Secondary text:** `#A9B6C8`
- **Evidence cyan:** `#55DCEB` for interactive focus and the scientific model
- **Verified mint:** `#68E4B2` for shared physical observation and success
- **Learner amber:** `#F2B765` for the learner model and unresolved predictions
- **Error coral:** `#FF7B7B`
- **Border:** `#26354C`
- **Prohibited:** Purple/violet gradients, cyan-to-purple CTAs, and color-only
  distinctions between learner, scientific, and verified evidence.

## Spacing

- **Base unit:** 4px.
- **Density:** Comfortable for Capture and Revision; compact for paired evidence
  and Trace.
- **Scale:** 2xs 4, xs 8, sm 12, md 16, lg 24, xl 32, 2xl 48, 3xl 64, 4xl 96.
- **Touch:** Every primary interactive target is at least 44×44px with an 8px gap.

## Layout

- **Approach:** Hybrid. Capture uses an editorial split at wide widths; subsequent
  steps use a disciplined instrument grid. Mobile always follows the learning
  sequence in document order.
- **Grid:** 4 columns at 375px, 8 at 768px, and 12 from 1024px.
- **Max content width:** 1240px for the journey, 72 characters for long copy.
- **Border radius:** 3px for data/evidence, 6px for fields and buttons, 10px only
  for major workflow regions. Pills are reserved for true status labels.
- **Surfaces:** Prefer rules, spacing, and tonal steps over nested rounded cards.

## Motion

- **Approach:** Minimal-functional.
- **Easing:** Enter `cubic-bezier(.16, 1, .3, 1)`, exit `ease-in`, movement
  `ease-in-out`.
- **Duration:** Micro 80–120ms, short 160–220ms, medium 240–320ms.
- **Meaning:** Motion may reveal evidence, preserve spatial continuity, or confirm
  a locked prediction. It must not decorate idle content.
- **Accessibility:** `prefers-reduced-motion` removes nonessential transitions and
  all repeating animation.

## Content and Interaction

- Keep one primary action per step.
- Preserve prediction locking before evidence reveal.
- Keep physical observation visually and semantically separate from both model
  claims.
- Use short, concrete learner-facing sentences. Privacy and retention disclosures
  remain complete but may use progressive disclosure where policy permits.
- Never label verified authored content as a live AI result.
- Maintain keyboard order, semantic headings, visible focus, local error recovery,
  and the complete no-WebGL journey.

## Scientific visualization

- The Capture stage uses one lightweight, deterministic Three.js comparison: the
  learner claim and scientific model converge on a shared half-lit Moon
  observation. It explains the product method instead of serving as decoration.
- The hero and evidence scenes share the same warm learner, cyan science, and mint
  observation vocabulary. Shadow cones and light rays appear only when they
  encode a model relationship.
- All geometry and materials are application code. There are no remote models,
  textures, image hosts, runtime generation calls, or paid requests in the visual
  layer.
- Evidence canvases use demand rendering. The Capture hero uses a lightweight
  continuous loop only while it is mounted and motion is allowed; reduced-motion
  switches it back to demand rendering at DPR 1. Every view keeps bounded DPR,
  native controls, and a semantic fallback that preserves the complete comparison.

## Safe Choices

- Persistent seven-step progress and a single primary action per stage.
- High-contrast dark canvas that supports the existing Three.js worlds.
- Server-owned evidence and source labels remain visible in the interface.

## Deliberate Risks

- The split-model symbol replaces the familiar letter tile. It costs immediate
  alphabet recognition but makes the product method ownable.
- Warm off-white, amber, cyan, and mint replace the common blue-purple AI palette.
  It is less conventionally futuristic and more like a real lab instrument.
- Sharper radii and editorial rules reduce friendliness-by-default. Readable type,
  generous touch targets, and plain-language copy keep the experience humane.

## Decisions Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-07-19 | Adopt Evidence Lab | Makes the prediction/evidence method the visual identity and removes remaining AI-era SaaS conventions. |
| 2026-07-19 | Replace the `M` tile with opposing model arcs | The old mark identified only the first letter; the new mark explains the product at a glance. |
| 2026-07-19 | Remove purple gradients | Purple gradients were the strongest remaining AI-slop signal and carried no scientific meaning. |
| 2026-07-19 | Use self-hosted Atkinson, Barlow, and IBM Plex typography | Improves cross-platform consistency, learner legibility, and data distinction without runtime third-party font requests. |
| 2026-07-19 | Replace the observatory plate with a live model comparison | Makes the product method legible in the first viewport while keeping the visual layer deterministic and API-free. |
| 2026-07-19 | Promote the animated 3D comparison above supporting copy | Keeps the complete 3D panel in the 1600×900 first view and the full scene viewport visible at 1280×720 and 768×1024. |
