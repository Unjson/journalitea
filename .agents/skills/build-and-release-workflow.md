---
title: Build, Packaging, and Mobile Run Workflow
description: Use for npm scripts, Electron packaging, Android Gradle workflow, and release/versioning changes.
---

# Skill: Build, Packaging, and Mobile Run Workflow

## Use When
- Modifying build scripts, Android config, Electron packaging, or release behavior

## Core Files
- `package.json` scripts and `build` config
- `vite.config.ts`, `tsconfig*.json`
- `android/` Gradle files
- `scripts/copyAssets.mjs`
- `patches/` for patched package behavior

## Project Patterns
- Desktop build: `npm run build` then Electron packaging commands
- Android run: `npx cap run android` (with Gradle build under `android/`)
- Package patching via `patch-package` on postinstall (mostly used for Capacitor packages)

## Implementation Guidance
- Keep script changes explicit and reproducible.
- For versioning, keep Android `versionName` aligned with root `package.json` version. 
	- This should be handled by a script already
- Validate Gradle/electron commands after changing build-related files.

## Pitfalls
- Avoid coupling platform-specific steps into generic scripts unless intended.
- Don’t remove existing patch-package flow without migration.
