# GIF制作 Project Reference

## Project Discovery

Do not assume an absolute path. Resolve the project with `scripts/find_project.py` from the skill directory. It checks `GIF_MAKER_PROJECT`, the requested start directory and its parents, then a small set of home-directory candidates.

## Tech Stack

- React + TypeScript + Vite
- Canvas rendering
- Browser-native image/video decoding
- `gifenc` for client-side GIF encoding
- Chinese UI

## Main Files

- `src/App.tsx`: app state, mode orchestration, preview loop, export flow, reset, step routing.
- `src/types.ts`: shared settings and defaults.
- `src/styles.css`: app shell, stage, transport, layout, shared visual styles.
- `src/components/`: upload panels, settings panels, mode switch, export panel, component CSS.
- `src/lib/gifEncoder.ts`: GIF encoding abstraction.
- `src/lib/motion.ts`: single-image sizing, transforms, and draw logic.
- `src/lib/slideshow.ts`: slideshow duration/count helpers.
- `src/lib/slideshowRenderer.ts`: multi-image slideshow frame drawing.
- `src/lib/videoFile.ts`: video validation/loading/object URL lifecycle.
- `src/lib/videoFrames.ts`: video clip normalization, frame count, seek, and contain drawing.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm test -- src/lib/videoFrames.test.ts
```

## Behavioral Model

### Single Image

- Upload one JPG/PNG/WebP.
- Apply a motion preset and global settings.
- Draw frame via `drawFrame`.
- Export via `encodeGif`.

### Multi Image

- Upload 2-10 images.
- Sort, delete, append.
- Use global hold duration, transition duration, transition, FPS, aspect ratio, output width, loop.
- Draw via `drawSlideshowFrame`.
- Export via `encodeGifFrames`.

### Video

- Upload one MP4/WebM/MOV decoded by native browser video.
- Select start/end using timeline or numeric inputs.
- `playbackSpeed` controls real fast/slow playback.
- `fps` controls smoothness.
- Preview uses native video playback plus Canvas drawing.
- Export seeks source video frames using `start + frame / fps * playbackSpeed`.
- Frame budget uses `ceil(((end - start) / playbackSpeed) * fps)`.

## Design Notes

- The interface uses a dark cinematic layout with teal accents.
- Mode selection is in the header; workflow is a vertical left rail; function area is left/middle; realtime canvas is right.
- Global output settings are shown below the realtime canvas when appropriate.
- The realtime canvas window can stay fixed while the actual canvas is contained inside it.

## Documentation Map

- `docs/01-Product-Requirements.md`: scope and non-goals.
- `docs/02-Product-Design.md`: user flow and product rules.
- `docs/03-UI-Design.md`: layout and interaction contract.
- `docs/04-TechSpec.md`: architecture and module boundaries.
- `docs/05-Data-and-Asset-Spec.md`: fields, limits, defaults, derived rules.
- `docs/06-API-Contract.md`: local/browser contract and failure handling.
- `docs/07-Stage-Plan.md`: current stage plan.
- `docs/08-Stage-Implementation-Log.md`: implementation history.
- `docs/09-Test-and-Acceptance.md`: verification checklist.
- `docs/13-Changelog.md`: observable changes.
