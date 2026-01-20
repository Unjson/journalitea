# Minimal  (Vite)

A tiny, no-frills starter to run Vue 3 inside Electron using Vite. It compiles Vue SFCs with Vite and launches Electron to load the built files. No packager, no builder — just the essentials.

## Features
- Vue 3 SFCs compiled by Vite
- Electron main process (CommonJS)
- One command to develop: Vite build (watch) + Electron
- Works without extra tooling or complex configs

## Getting Started

Install dependencies:
```bash
npm install
```

Start development (build in watch mode + launch Electron):
```bash
npm start
```

What happens under the hood:
- Vite builds to `dist/` and keeps watching for changes
- Electron loads the built `dist/index.html` (no dev server/HMR)

## Project Structure
```
.
├─ index.js            # Electron main process (loads dist/index.html)
├─ index.html          # Vite entry HTML (references /src/main.{js,ts})
├─ src/
│  ├─ App.vue
│  └─ main.{js,ts}
├─ vite.config.{js,ts} # Vite config with @vitejs/plugin-vue
├─ package.json
└─ README.md
```

## How It Works
- Vite compiles Vue files into `dist/`
- Electron starts and loads `dist/index.html` via `loadFile(...)`
- The npm script:
  - `vite build` once to ensure `dist/` exists
  - `vite build -w` to watch for changes
  - `electron .` to run the app

## Using Node.js APIs in the Renderer

You have two common options:

1) Easiest (insecure, for quick experiments)
- Enable `nodeIntegration: true` and `contextIsolation: false` in `BrowserWindow` webPreferences.
- Then you can directly `import fs from 'fs'` or `require('fs')` in Vue components.

2) Recommended (secure)
- Keep `contextIsolation: true`, `nodeIntegration: false`
- Use a `preload.js` with `contextBridge.exposeInMainWorld(...)` to safely expose limited APIs.

Note: If you switch to loading a Vite dev server with `win.loadURL('http://localhost:5173')`, the browser environment cannot import Node built-ins (like `fs`). In that case, use a preload script or `window.require` (only works when Node integration is enabled).
