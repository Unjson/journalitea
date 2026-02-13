# Journalitea Copilot Instructions

## App Summary
Journalitea is a cross-platform personal tea journal built with Vue 3 + TypeScript. It lets users catalog teas, track tasting metadata (type, origin, seller, year, notes), rate teas, and analyze collection stats (price/weight, distributions, aromas). It includes a tea timer and localization support via CSV-backed translations.

The project targets:
- Desktop: Electron (`dist-electron/` + root web app)
- Mobile: Capacitor (Android currently in active use, iOS scaffolded)

Storage is SQLite-based with platform-specific implementations behind a shared bridge API.

## Architecture Notes
- Frontend app: `src/` (Vue SFCs, router, view pages, reusable components)
- Domain models/helpers: `src/models/`
- Service layer: `src/services/` (database access, platform bridge, i18n parser)
- Electron runtime: `dist-electron/src/` and TS sources mirroring service contracts
- Android native project: `android/`

## Working Conventions
- Prefer minimal, targeted edits; avoid broad refactors unless requested.
- Keep i18n keys in sync with `src/services/i18n/translations.csv`.
- Reuse existing components (charts, dialogs, rating, footer filters) before adding new ones.
- Preserve current UI style conventions (Tailwind utility classes + existing component patterns).
- For data logic, prefer shared model/service utilities over duplicating calculations in views.

## Validation Checklist for Changes
1. Type-check/lint if impacted by TS or template changes.
2. Verify view behavior in both desktop and Capacitor contexts when platform-specific code changes.
3. Confirm translations exist for new user-facing strings (EN/DE rows).
4. For Android build-related edits, validate Gradle sync/build still succeeds.
