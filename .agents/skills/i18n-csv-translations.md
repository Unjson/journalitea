---
title: CSV-based i18n Workflow
description: Use for adding or updating UI text keys and keeping EN/DE translation rows in sync.
---

# Skill: CSV-based i18n Workflow

## Use When
- Adding/changing user-visible text
- Creating new labels, tab names, button text, or validation strings

## Core Files
- `src/services/i18n/translations.csv`
- `src/services/i18n/index.ts`
- `src/services/i18n/csvParser.ts` (+ node variant)

## Project Patterns
- Translation keys are semicolon-separated CSV rows: `key;en;de`
- Components use `useI18n()` and `t('key')`

## Implementation Guidance
- Add keys once and provide at least EN/DE values.
- Reuse existing key naming style (`stats.*`, `settings.*`, `detail.*`, etc.).
- Keep wording concise and consistent with adjacent strings.

## Pitfalls
- Avoid hard-coded UI strings in Vue templates.
- Don’t add duplicate keys with slight naming variants.
