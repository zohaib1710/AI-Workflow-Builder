# AI Workflow Builder

AI Workflow Builder turns a natural-language business-process description into a validated visual workflow diagram. The provider-agnostic backend generates core workflow metadata, nodes, and edges, and the frontend renders them with React Flow.

It designs and visualizes workflows; it does not execute or save them.

## Architecture

The React frontend sends a prompt to FastAPI. `WorkflowGenerationService` calls the configured `AIProvider`, validates the untrusted candidate with Pydantic and graph rules, and returns a safe workflow response. The browser then computes layout and renders the result in memory.

See the [Version 1 architecture](docs/architecture/version-1.md) and [workflow specification](docs/specifications/version-1-workflow.md) for the detailed boundaries and contracts.

## Project structure

- `frontend/` — React, TypeScript, Vite, Tailwind CSS, React Flow, and Dagre
- `backend/` — Python 3.12, FastAPI, Pydantic, `httpx`, and `uv`
- `docs/` — architecture and workflow-contract documentation

## Prerequisites

- Git
- Node.js with npm
- Python 3.12
- [`uv`](https://docs.astral.sh/uv/)

## Quick start

From the repository root, install the locked dependencies:

```powershell
npm.cmd ci --prefix frontend
uv sync --project backend --locked
```

Create local environment files:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

For manual workflow generation, set a valid `AI_API_KEY` in `backend/.env`. The health endpoint and automated tests do not require a provider key. Never put provider credentials in the frontend environment.

Start the backend in one terminal:

```powershell
uv run --project backend uvicorn app.main:app --reload
```

Start the frontend in another:

```powershell
npm.cmd run dev --prefix frontend
```

The API is available at `http://localhost:8000` and Vite normally serves the UI at `http://localhost:5173`.

## Health and generation

Check the backend without provider credentials:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/health
```

The expected response is `{ "status": "ok" }`.

The frontend submits `{ "prompt": "..." }` to `POST /api/v1/workflows/generate`. An optional manual smoke test is to add a valid backend-only provider key, start both applications, submit one prompt, and confirm that the validated workflow renders.

## Testing

```powershell
npm.cmd run test --prefix frontend -- --run
npm.cmd run build --prefix frontend
uv run --project backend pytest
uv run --project backend ruff check backend
uv run --project backend python -m compileall -q backend/app
```

Frontend tests mock the API boundary, and backend tests mock or fake provider behavior. Automated validation requires neither a live AI provider nor a real key. The committed `package-lock.json` and `uv.lock` make dependency installation reproducible.

## Version 1 limitations

Version 1 has no authentication, accounts, database persistence, saving, history, versioning, workflow execution, node or edge editing, manual positioning, export, sharing, collaboration, background workers, Redis, Docker, deployment automation, CI/CD, provider-selection UI, or streaming generation.

Generated state exists only in browser memory. Refreshing clears the result, and **Clear** removes the prompt, result, and current error. The canvas remains navigable with pan, zoom, fit view, and a MiniMap, but its workflow content is read-only.

## Security notes

Provider credentials stay on the backend. Real `.env` files are ignored, generated values are rendered as plain text, and provider output must pass schema and graph validation before it reaches the visualization.
