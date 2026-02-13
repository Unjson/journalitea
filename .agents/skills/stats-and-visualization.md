---
title: Stats + Visualization Components
description: Use for stats calculations, chart integrations, and no-data handling on the Stats page.
---

# Skill: Stats + Visualization Components

## Use When
- Editing `src/views/Stats.vue`
- Working with `PieChart`, `BarChart`, aroma/rating displays, summary metrics

## Core Files
- `src/views/Stats.vue`
- `src/models/teaStats.ts`
- `src/components/charts/*.vue`
- `src/components/AromaStats.vue`

## Project Patterns
- Keep numeric/business calculations in model helpers (`teaStats.ts`)
- Keep view layer focused on loading, selecting year/tab, and rendering
- Prefer computed properties for aggregates derived from loaded records

## Implementation Guidance
- Handle empty datasets with clear no-data states.
- Ensure unit/currency conversions use shared utilities.
- Reuse existing controls (`RecordYearFooter`, tabs, chart components).

## Pitfalls
- Don’t duplicate conversion logic already implemented in `teaStats` helpers.
- Avoid chart-only assumptions when values can be null/undefined.
