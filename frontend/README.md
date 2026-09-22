# AI Workflow Builder frontend

The frontend collects a workflow prompt and displays the validated response as a read-only visual diagram with metadata and insights. It uses React, TypeScript, Vite, Tailwind CSS, React Flow, Dagre, Vitest, and Testing Library.

Run these commands from the repository root.

## Install

```powershell
npm.cmd ci --prefix frontend
```

Dependencies are installed from `frontend/package-lock.json`.

## Environment

```powershell
Copy-Item frontend/.env.example frontend/.env
```

The only frontend setting is:

```env
VITE_API_BASE_URL=/api/v1
```

Provider endpoints, API keys, and other AI credentials must remain backend-only.
During development, Vite forwards `/api/v1` to the backend on `127.0.0.1:8000`. The browser therefore calls the frontend origin, including when opened through a tunnel from another device. Restart Vite after changing its environment file. Do not set the browser API URL to `localhost` for cross-device testing.
The proxy applies to the Vite development server only; a production host needs its own `/api/v1` reverse proxy. A public testing tunnel also makes these unauthenticated API routes publicly reachable, so stop the tunnel when testing ends. For each new tunnel hostname, allow that exact host through Vite rather than allowing all hosts.

## Run

```powershell
npm.cmd run dev --prefix frontend
```

Vite normally serves the application at `http://localhost:5173`.

## Test and build

```powershell
npm.cmd run test --prefix frontend -- --run
npm.cmd run build --prefix frontend
```

The tests run in jsdom and mock the frontend API boundary or `fetch`; they do not require FastAPI or an AI provider to be running.

## Main source areas

- `src/App.tsx` owns prompt, loading, error, and in-memory result state.
- `src/api/client.ts` calls the backend and normalizes unsafe failures into controlled messages.
- `src/components/` renders the prompt form, result, insights, and read-only React Flow canvas.
- `src/components/nodes/` defines the ten supported custom node visuals.
- `src/lib/layout.ts` computes deterministic left-to-right Dagre positions.
- `src/test/` covers the application flow, API boundary, rendering, layout, and canvas controls.

## State and interaction model

Generated workflows are held only in browser memory; refreshing the page clears them. **Clear** removes the prompt, result, and current error. Nodes cannot be dragged for editing, connections cannot be created, and nodes, edges, metadata, and insights cannot be changed or deleted. Pan, zoom, fit view, and the MiniMap remain available for navigation.
