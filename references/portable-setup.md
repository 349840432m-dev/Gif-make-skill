# Portable Setup

## Required Pieces

The skill is self-contained. Install the complete `gif-maker` directory under `$CODEX_HOME/skills/` or `~/.codex/skills/`. If no CineGIF checkout exists, initialize one from the verified bundled template.

## Prerequisites

- Codex with local skills support.
- Python 3.9+ for project discovery and environment checks.
- Node.js `^20.19.0` or `>=22.12.0` and npm for the application.
- A browser supporting Canvas, Blob URLs, and native video decoding.

## First Run

Create the application from the skill directory, then install and verify it:

```bash
python3 scripts/init_project.py --destination "$HOME/CineGIF"
cd "$HOME/CineGIF"
npm ci
npm run typecheck
npm run build
npm run dev
```

If the repository is elsewhere, configure it before invoking the skill:

```bash
export GIF_MAKER_PROJECT="/path/to/GIF制作"
```

PowerShell:

```powershell
$env:GIF_MAKER_PROJECT = "C:\path\to\GIF制作"
```

## Failure Boundaries

- Project not found: initialize the bundled template in a new or empty directory.
- Template checksum mismatch: stop; reinstall the skill from its original distribution source. The checksum detects corruption but does not replace distribution trust.
- Node.js/npm missing or too old: report the detected version and stop before dependency installation.
- Project fingerprint mismatch: do not edit; request the correct CineGIF repository.
- Dependencies missing: run `npm ci` from the located repository after user approval when network access is required.
