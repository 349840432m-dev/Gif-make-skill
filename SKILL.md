---
name: gif-maker
description: Create, install, locate, run, maintain, and extend the self-contained CineGIF/GIF制作 React app on any computer. Use when the user has only this skill and needs a new GIF制作 project, or asks to modify, debug, redesign, move, verify, document, or add features including single-image animation GIFs, multi-image slideshow GIFs, video-to-GIF, Chinese UI, timeline controls, playback speed, Canvas preview, GIF export quality, or download behavior.
---

# GIF Maker

## Purpose

Use this skill for the CineGIF project on macOS, Linux, or Windows. The app is a Chinese React + TypeScript + Vite GIF generator with three modes: single-image motion, multi-image slideshow, and video-to-GIF.

Read `references/project-reference.md` when you need exact project structure, commands, architecture, or module responsibilities.

## Working Rules

1. Locate the project without assuming a username or absolute path:
   ```bash
   python3 "$SKILL_DIR/scripts/find_project.py" --start "$PWD"
   ```
   Set `GIF_MAKER_PROJECT` when the project is outside the current directory tree. On Windows, use `py` instead of `python3` when needed.
2. If no project is found, initialize the bundled template into a new or empty directory:
   ```bash
   python3 "$SKILL_DIR/scripts/init_project.py" --destination "$HOME/CineGIF"
   ```
   Never initialize over a non-empty directory.
3. Run the environment check against the located or initialized project:
   ```bash
   python3 "$SKILL_DIR/scripts/check_environment.py" --start "/path/to/CineGIF"
   ```
4. Change to the project path, then inspect existing code before editing. Prefer `rg` and read the related component, style, library, and docs files.
5. Keep changes narrowly scoped. Do not redesign unrelated modes when fixing one mode.
6. Keep the UI Chinese unless the user explicitly asks otherwise.
7. Preserve local-only processing: do not upload user images/videos or add server dependencies for core GIF generation.
8. Use `apply_patch` for edits when working inside the project directory.
9. After code changes, run the relevant validation commands and report anything not run.

## Portable Setup

- Install this entire `gif-maker` directory under `$CODEX_HOME/skills/gif-maker` or `~/.codex/skills/gif-maker`.
- The skill bundles a verified project template under `assets/cinegif-template`; no separate source checkout is required.
- Require Python 3.9+ for bundled scripts and Node.js `^20.19.0` or `>=22.12.0` with npm for the app toolchain.
- After initialization, run `npm ci`, then `npm run build`. Network access may be required for the first dependency install.
- Run `scripts/sync_template.py` after intentional source updates. Existing manifest entries are the exact sync whitelist; pass `--include path` or `--exclude path` for intentional file-set changes. Then revalidate and repackage the skill.
- Run `python3 scripts/test_portability.py` after changing initialization or template integrity behavior.
- Read `references/portable-setup.md` when installing or diagnosing the skill on another computer.

## Common Workflows

### UI or layout changes

- Inspect `src/App.tsx`, `src/styles.css`, and mode-specific component CSS under `src/components/`.
- Match the existing dark cinematic visual language: teal/cyan accents, compact cards, rounded borders, and subdued text.
- For mode-specific controls, prefer local CSS under the relevant component stylesheet so single, multi, and video modes do not accidentally drift.
- Update `docs/03-UI-Design.md` and `docs/13-Changelog.md` when the layout or behavior meaning changes.

### GIF behavior or export changes

- Inspect `src/lib/gifEncoder.ts` plus the mode-specific renderer:
  - single-image motion: `src/lib/motion.ts`
  - multi-image slideshow: `src/lib/slideshowRenderer.ts`
  - video frames: `src/lib/videoFrames.ts`
- Keep preview behavior and export behavior aligned. If preview uses a timing or sizing rule, export should use the same rule unless there is a documented reason.
- For video speed, treat FPS as smoothness and `playbackSpeed` as real fast/slow playback.
- For output quality, distinguish spatial resolution from GIF palette limits. GIF remains 256-color limited.

### Video mode changes

- Upload and metadata flow lives in `src/components/VideoUploadPanel.tsx` and `src/lib/videoFile.ts`.
- Parameters and timeline UI live in `src/components/VideoSettingsPanel.tsx` and `src/components/video-mode.css`.
- Preview and export orchestration live in `src/App.tsx`.
- Video preview should play the native `HTMLVideoElement` and continuously draw to Canvas when playing.
- Export should seek frame-by-frame, draw with `drawVideoFrame`, and honor start/end/fps/playbackSpeed/loop.

### Documentation updates

For feature, behavior, or workflow changes, update only the relevant docs:

- `docs/03-UI-Design.md` for layout, component state, and interaction changes.
- `docs/04-TechSpec.md` for architecture or data-flow changes.
- `docs/05-Data-and-Asset-Spec.md` for fields, defaults, limits, or derived rules.
- `docs/08-Stage-Implementation-Log.md` for implementation notes when the stage changes materially.
- `docs/09-Test-and-Acceptance.md` for acceptance criteria.
- `docs/13-Changelog.md` for observable changes.

## Validation

Use the smallest reliable validation set for the change. Typical commands:

```bash
npm run typecheck
npm run lint
npm run build
```

For library behavior changes, run focused tests, for example:

```bash
npm test -- src/lib/videoFrames.test.ts
npm test -- src/lib/motion.test.ts
npm test -- src/lib/gifEncoder.test.ts
```

For visual or interaction bugs, also verify in the browser when feasible. If browser verification is not run, say so clearly.

## Current Known Capabilities

- Single image to animated GIF with six motion presets.
- Multi-image slideshow GIF with ordering, transition, timing, and export controls.
- Video-to-GIF with local video upload, clip timeline, start/end selection, playback speed, FPS, output width, aspect ratio, loop, Canvas preview, and GIF export.
- Reset/clear project state.
- Fixed preview window that contains the active canvas without clipping.

## Guardrails

- Do not introduce cloud upload, login, analytics, or server-side encoding unless explicitly requested.
- Do not add heavy dependencies such as `ffmpeg.wasm` without an explicit tradeoff discussion.
- Do not silently swallow video seek/export failures; surface recoverable Chinese error messages.
- Do not remove existing mode behavior while improving another mode.
