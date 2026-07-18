# UI/UX Pro Max integration reference

Last verified: 2026-07-19

Skill release: `ui-ux-pro-max-cli@2.11.0`

Official source: <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill>
License: MIT

## Installation scope

UI/UX Pro Max is intentionally installed once, globally for Codex:

- CLI: `/opt/homebrew/bin/uipro`
- Main skill: `~/.codex/skills/ui-ux-pro-max/`
- Bundled sibling skills: `banner-design`, `brand`, `design-system`, `design`,
  `slides`, and `ui-styling`

Do not add a project-local `.codex/skills/` copy. A second copy makes skill
precedence and updates ambiguous. The global installation is developer-machine
tooling, not an application dependency, deploy artifact, or lockfile entry.

The upstream README explicitly supports Codex CLI. Codex Desktop discovery must
be verified after the host reloads; it is not claimed solely from the upstream
compatibility list. This task verified the installed search script directly.

The npm tarball SHA-512 matched the registry integrity value. The package has no
`preinstall`, `install`, or `postinstall` script.

## Role and precedence

UI/UX Pro Max is a local design-research catalog. Its recommendations are inputs,
not instructions that override this repository.

Priority order:

1. Product safety, privacy, accessibility, evaluation, and Cloudflare contracts
2. `AGENTS.md`, existing tests, and verified submission evidence
3. ModelDuel's implemented interaction model and learner/teacher copy
4. The approved ModelDuel design system in `DESIGN.md`
5. UI/UX Pro Max search results

The generated base skill includes React Native-oriented examples, and its
heuristic output can recommend SaaS pricing, competitive tables, Tailwind,
shadcn/ui, or remote font imports. Those are not automatically applicable.

ModelDuel is a Next.js App Router, React, and Three.js educational experience
with a seven-step evidence flow. Preserve its API-free verified sample,
live-use boundary, scenario constraints, accessible 3D fallback, security
headers, and teacher-handoff privacy boundary.

## Safe use

Use the main search skill for non-mutating research:

```bash
python3 ~/.codex/skills/ui-ux-pro-max/scripts/search.py \
  "astronomy science education evidence comparison" \
  --design-system -p ModelDuel -f markdown
```

Treat palette, typography, density, motion, and layout suggestions as candidates
to test against the real application. Use `--stack nextjs`, `--stack react`, or
`--stack threejs` when relevant. Do not use generic React Native guidance for
this web application.

## Prohibited without a separate decision

- `--persist`, `--force`, or generated `design-system/` writes
- a second project-local installation
- `uipro update`
- Tailwind, shadcn/ui, icon-library, animation, or other dependency installs
- `ui-styling/scripts/shadcn_add.py`, which can execute package-manager commands
- `tailwind_config_gen.py`, which can write configuration
- Google Font `<link>` or `@import` additions

`--persist` would create a competing source of truth beside `DESIGN.md`.
Production CSP restricts fonts to `self` and `data:`. Fonts may be bundled with
`next/font`, but must not be fetched from a third-party origin at runtime.

## Update procedure

Do not use `uipro update` for this global-only installation. The command has no
`--global` flag and can create an unintended project-local `.codex/skills/` tree.

After source review and explicit approval, update manually:

```bash
npm install -g ui-ux-pro-max-cli@<reviewed-version>
uipro init --ai codex --global --force
uipro --version
```

The second command overwrites the global UI/UX Pro Max skill set. It must not run
as an unattended update.

## SDK compatibility snapshot

| Package | Pinned | Checked current source | Decision |
| --- | ---: | ---: | --- |
| `next` | 16.2.10 | 16.2.10 | Keep |
| `react`, `react-dom` | 19.2.7 | 19.2.7 | Keep |
| `three` | 0.185.1 | 0.185.1 | Keep |
| `@react-three/fiber` | 9.6.1 | 9.6.1 | Keep |
| `@playwright/test` | 1.61.1 | 1.61.1 | Keep |
| `@axe-core/playwright` | 4.12.1 | 4.12.1 | Keep |
| `@opennextjs/cloudflare` | 1.20.1 | 1.20.1 | Keep |
| `wrangler` | 4.112.0 | 4.112.0 | Keep |
| `@cloudflare/vitest-pool-workers` | 0.18.6 | 0.18.6 | Keep |
| `zod` | 4.4.3 | 4.4.3 | Keep |
| `typescript` | 6.0.3 | npm `latest` is 7.0.2 | Do not change in UI work |
| `openai` | 6.47.0 | 6.48.0 | Separate backend-only review |

TypeScript has conflicting current-source signals: npm labels `7.0.2` as latest,
while the GitHub latest-release endpoint resolves `v6.0.3`. Treat this as a
release-source discrepancy, not an upgrade instruction. The validated ModelDuel
gate uses TypeScript 6.0.3.

The OpenAI 6.48.0 minor release is outside this frontend-only change. Review it
separately against `docs/OPENAI_SDK_REFERENCE.md`.

Official references:

- <https://nextjs.org/docs/app/getting-started/installation>
- <https://react.dev/blog/2025/10/01/react-19-2>
- <https://r3f.docs.pmnd.rs/getting-started/introduction>
- <https://playwright.dev/docs/release-notes>
- <https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/>
- <https://opennext.js.org/cloudflare/get-started>
- <https://github.com/openai/openai-node/releases/tag/v6.48.0>

## Runtime guardrails

Cloudflare's supported Next.js route is Workers plus OpenNext. Do not add
`export const runtime = "edge"` to UI code. Preserve
`initOpenNextCloudflareForDev()` in `next.config.ts`, run the full local gate,
and verify the OpenNext/Workers build separately from `next build`.
