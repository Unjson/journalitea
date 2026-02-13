---
title: Vue 3 Composition + Routing
description: Use for Vue page/component state, computed logic, lifecycle hooks, and route navigation behavior.
---

# Skill: Vue 3 Composition + Routing in Journalitea

## Use When
- Editing any page in `src/views/`
- Adding/modifying reactive UI state, computed values, and lifecycle behavior
- Adjusting navigation, back behavior, or page titles

## Project Patterns
- Composition API with `<script setup lang="ts">`
- Route-level pages in `src/views/` and shared components in `src/components/`
- Mobile back handling and navigation state control in `src/App.vue` + `src/router.ts`

## Implementation Guidance
- Keep page-specific state inside the page SFC unless shared state is truly cross-page.
- Prefer `computed` for derived values (e.g. aggregate stats, filtered counts).
- Keep side effects in lifecycle hooks (`onMounted`, `onActivated`) and isolate async loaders.
- Reuse existing components before creating new ones.

## Pitfalls
- Avoid mutating derived state directly.
- Avoid introducing route assumptions that break Capacitor back-button handling.
