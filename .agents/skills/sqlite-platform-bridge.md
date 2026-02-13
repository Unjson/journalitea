---
title: SQLite + Platform Bridge Data Flow
description: Use for database queries, settings persistence, and Electron/Capacitor bridge contract changes.
---

# Skill: SQLite + Platform Bridge Data Flow

## Use When
- Changing persistence, record queries, settings, import/export, or DB-backed views

## Core Files
- `src/services/platformBridge.ts`
- `src/services/database.ts`
- `src/services/databaseQueries.ts`
- `src/services/capacitorDatabase.ts`
- Electron counterparts in `dist-electron/src/services/`

## Project Patterns
- UI calls bridge methods (e.g. `platformBridge.invoke('db:listRecords', ...)`)
- Bridge abstracts Electron vs Capacitor implementation differences
- Query logic centralized in service/query modules

## Implementation Guidance
- Add data operations at the service/query layer, not directly in views.
- Keep IPC/bridge method names consistent across desktop and mobile.
- Preserve response shape contracts (`intVal`, `strVal`, arrays, etc.).
- Handle null/empty responses defensively in UI code.

## Pitfalls
- Avoid platform-specific branching inside view components when bridge can abstract it.
- Don’t duplicate SQL/query logic in multiple files.
