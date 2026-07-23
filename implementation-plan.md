# Active Implementation Plan

## Plan metadata

- Status: ACTIVE
- Version: Version 1
- Planner model: Codex planning agent
- Created: 2026-07-23
- Last updated: 2026-07-23

## Objective

Enable an internal user to enter a natural-language prompt and receive an automatically arranged, read-only visual workflow diagram in the browser. The flow is React frontend → FastAPI backend → Groq → validated workflow JSON → Dagre layout → React Flow visualization. Generated workflows exist only in browser memory and disappear on refresh.

## Scope

Version 1 includes React/TypeScript/Vite/Tailwind CSS, `@xyflow/react`, Dagre, Python 3.12/FastAPI/Pydantic/Pydantic Settings/`uv`, the Groq Python SDK, prompt submission, structured workflow generation, backend validation with one controlled invalid-output retry, workflow metadata and insights, loading/error states, a read-only React Flow canvas with custom nodes, labelled decision branches, left-to-right layout, zoom, pan, minimap, fit-to-view, grid background, backend and frontend tests, and local-development documentation.

## Exclusions

Do not implement:

- Authentication
- User accounts
- PostgreSQL
- Workflow persistence
- Workflow saving
- Manual node editing
- Drag-and-drop editing
- Node creation or deletion
- Connection editing
- AI refinement chat
- Workflow versions
- Workflow sharing
- Public links
- JSON export
- JSON import
- PNG export
- PDF export
- SVG export
- Workflow execution
- Integration credentials
- Folders
- Search
- Collaboration
- Comments
- Admin pages
- Docker
- Cloud deployment
- CI/CD
- Redis
- Background workers

Do not add functionality from a future version. Do not commit `.env`, API keys, `node_modules`, Python virtual environments, or `.codex/commit-message.txt`.

## Repository observations

- The repository already contains control documentation and placeholder `frontend/`, `backend/`, and `docs/` folders.
- `context.md` records repository preparation and no application implementation.
- The latest commit is `acfcf8b - create documented frontend, backend and project documentation placeholders`.
- The working tree was clean at inspection time.
- No application source, package manifest, lock file, installed dependency directory, or virtual environment exists.
- Git is initialized; Git commands require `-c safe.directory=D:/AI-Workflow-Builder` in this environment because of an ownership warning.

## Architecture decisions

1. The frontend owns prompt state, request lifecycle, in-memory workflow state, layout calculation, and rendering. It must never receive or read `GROQ_API_KEY`.
2. The backend owns configuration, prompt validation, Groq calls, structured-output parsing, domain validation, retry policy, and API error mapping. Route functions remain thin and call services.
3. Groq is isolated behind a provider/service interface so automated tests mock it and the route is independent of SDK details.
4. The AI returns domain workflow JSON only: it must not generate React Flow positions, HTML, executable code, or credentials. Dagre calculates positions after generation.
5. Pydantic models are the boundary contract. The validator enforces supported node types, unique IDs, valid references, structural graph rules, and non-empty human-readable fields.
6. The canvas is read-only: disable node dragging, connection creation, selection-based editing, node deletion, and mutation controls while retaining navigation controls.
7. The browser uses a single main page with prompt and result sections. API errors are presented as controlled user-facing messages, while sensitive provider details stay server-side.

## Workflow schema

The canonical workflow object contains exactly these conceptual fields: `title`, `description`, `nodes`, `edges`, `assumptions`, `missingRequirements`, and `suggestions`.

Each node contains `id`, `type`, `title`, `description`, and `application`. `type` is an enum restricted exactly to `start`, `end`, `trigger`, `action`, `decision`, `api`, `database`, `wait`, `approval`, and `notification`. `application` may be an empty string when unspecified, but `id`, `title`, and `description` are required non-empty strings.

Each edge contains `id`, `source`, `target`, and `label`; IDs are unique, source and target must reference existing nodes, and `label` may be empty except that decision branch labels must be retained and displayed.

The validator must reject empty prompts, prompts over the configured limit, invalid JSON, missing title or description, an empty node list, duplicate node IDs or edge IDs, unsupported node types, missing-node edge references, start nodes with incoming edges, end nodes with outgoing edges, decision nodes with fewer than two outgoing edges, completely disconnected workflows, and empty node titles. It should also reject malformed graph data with a stable validation error response.

## API contracts

### `GET /api/v1/health`

Return HTTP 200 with a small stable JSON object such as `{ "status": "ok" }`. It must not call Groq.

### `POST /api/v1/workflows/generate`

Request:

```json
{ "prompt": "Create a lead qualification workflow." }
```

Successful response HTTP 200:

```json
{
  "workflow": {
    "title": "Lead Qualification Workflow",
    "description": "Qualifies and routes new leads.",
    "nodes": [],
    "edges": [],
    "assumptions": [],
    "missingRequirements": [],
    "suggestions": []
  },
  "generation": {
    "model": "configured-model-name",
    "durationMs": 0
  }
}
```

Use a stable error envelope with a user-safe `code` and `message`, and optional field details, for request validation, provider failure, timeout, rate limit, invalid credentials, and invalid structured output. Return 4xx for invalid input and 5xx/controlled provider errors for backend/provider failures. Retry exactly once only when Groq returns parseable-but-domain-invalid or otherwise invalid structured output; do not retry invalid credentials, rate limits, timeouts, or general API failures.

## Frontend component structure

The planned frontend structure is:

- `frontend/package.json`, `frontend/package-lock.json`, `frontend/tsconfig*.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`
- `frontend/src/types/workflow.ts` for API/domain types and the exact node-type union
- `frontend/src/api/client.ts` for the typed health/generation HTTP calls and normalized errors
- `frontend/src/components/Header.tsx`
- `frontend/src/components/PromptPanel.tsx` for textarea, example prompt, count, Generate, Clear, loading, and error UI
- `frontend/src/components/WorkflowResult.tsx` for title, description, canvas, and insight panels
- `frontend/src/components/WorkflowCanvas.tsx` for read-only React Flow, controls, minimap, grid, custom node registry, and edge labels
- `frontend/src/components/nodes/WorkflowNode.tsx` and `frontend/src/components/nodes/nodeTypes.ts` for safe custom node rendering
- `frontend/src/components/InsightPanel.tsx`
- `frontend/src/lib/layout.ts` for Dagre left-to-right conversion from domain nodes/edges to React Flow nodes/edges
- `frontend/src/lib/constants.ts` for limits and example text
- `frontend/src/test/` for component and layout tests

The page must show product name/description, prompt textarea, Generate Workflow, Clear, example prompt, character count, loading state, errors, workflow title/description, canvas, assumptions, missing requirements, and suggestions. The canvas must expose zoom, pan, minimap, fit-to-view, background grid, custom visual nodes, and labelled decision branches.

## Backend module structure

The planned backend structure is:

- `backend/pyproject.toml`, `backend/uv.lock`, `backend/.env.example`
- `backend/app/main.py` for application creation and router registration
- `backend/app/config.py` for Pydantic Settings and safe environment configuration
- `backend/app/api/routes/health.py` and `backend/app/api/routes/workflows.py` for thin route handlers
- `backend/app/api/errors.py` for stable error mapping
- `backend/app/schemas/workflow.py` for request, response, node, edge, generation, and error models
- `backend/app/domain/validation.py` for graph/domain validation
- `backend/app/services/workflow_generation.py` for orchestration and one-retry policy
- `backend/app/services/groq_provider.py` for the isolated Groq SDK adapter
- `backend/app/prompts/workflow_generation.py` for the constrained system/user prompt and schema instructions
- `backend/tests/` for route, schema, validation, service, and provider-mocking tests

The app must configure CORS only for `FRONTEND_URL`, use request/response Pydantic models, avoid logging secrets or full sensitive prompts, and keep all Groq access in the backend service.

## Environment variables

Create safe examples only. Backend `backend/.env.example`:

```env
GROQ_API_KEY=
GROQ_MODEL=
GROQ_TEMPERATURE=0.2
GROQ_MAX_TOKENS=8000
FRONTEND_URL=http://localhost:5173
```

Frontend `frontend/.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

The frontend may read only `VITE_API_BASE_URL`; the Groq key must never be included in frontend variables, source, responses, or logs.

## Dependencies

Frontend: React, React DOM, TypeScript, Vite, Tailwind CSS, `@xyflow/react`, Dagre-compatible package (`@dagrejs/dagre`), and a test stack using Vitest plus Testing Library. Backend: Python 3.12, FastAPI, Uvicorn, Pydantic, Pydantic Settings, `uv`, Groq Python SDK, HTTPX for tests, and pytest/pytest-asyncio as needed. Select current stable compatible versions at implementation time only where pinning is operationally necessary; use npm and `uv` to generate and commit `package-lock.json` and `uv.lock`. Never commit generated environments or secret files.

## Ordered implementation checkpoints

### Checkpoint 1: Scaffold frontend and backend applications

- Status: INCOMPLETE
- Purpose: Create minimal runnable React/Vite/Tailwind and Python/FastAPI/`uv` application boundaries without Version 1 behavior.
- Files to create: `frontend/package.json`, `frontend/package-lock.json`, `frontend/tsconfig*.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`, `backend/pyproject.toml`, `backend/uv.lock`, `backend/app/main.py`, `backend/app/__init__.py`, `backend/tests/__init__.py`.
- Files to modify: root `.gitignore` only if generated tooling requires a missing safe ignore; do not alter control docs.
- Implementation instructions: Use Vite’s React TypeScript structure and Tailwind’s current Vite integration. Create a minimal FastAPI app that starts and returns a temporary root response only; do not add generation, Groq, persistence, auth, or UI functionality. Generate lock files with npm and `uv` and keep all source inside the planned directories.
- Validation commands: `npm ci --prefix frontend`; `npm run build --prefix frontend`; `uv run --project backend python -c "from app.main import app; print(app.title)"`.
- Acceptance criteria: Both projects have standard manifests and lock files; frontend build succeeds; backend imports under Python 3.12; no database, Docker, deployment, or auth files exist.
- Commit message: `build(repo): scaffold version one applications`
- Stop conditions: Stop if scaffolding introduces unrelated directories, dependencies cannot be locked, or a generator proposes application features beyond the empty shells.

### Checkpoint 2: Add backend configuration and health endpoint

- Status: INCOMPLETE
- Purpose: Establish safe settings, CORS, app wiring, and the required health contract.
- Files to create: `backend/app/config.py`, `backend/app/api/__init__.py`, `backend/app/api/routes/__init__.py`, `backend/app/api/routes/health.py`, `backend/.env.example`, `backend/tests/test_health.py`.
- Files to modify: `backend/app/main.py`, `backend/pyproject.toml`, `backend/uv.lock`.
- Implementation instructions: Load the specified settings with Pydantic Settings, require no secret for health, allow CORS only from `FRONTEND_URL`, register `GET /api/v1/health`, and return `{ "status": "ok" }`. Do not expose configuration values or call Groq.
- Validation commands: `uv run --project backend pytest backend/tests/test_health.py`; `uv run --project backend python -c "from app.config import Settings; print(Settings.model_fields.keys())"`.
- Acceptance criteria: Health returns 200 with the stable JSON; settings names and defaults match the environment contract; no API key is printed or required for health; route functions stay thin.
- Commit message: `feat(backend): add configuration and health endpoint`
- Stop conditions: Stop if startup requires a real Groq key, CORS becomes permissive by default, or unrelated auth/persistence behavior appears.

### Checkpoint 3: Define workflow schemas and graph validation

- Status: INCOMPLETE
- Purpose: Create the single validated domain contract used by AI, API, and frontend.
- Files to create: `backend/app/schemas/workflow.py`, `backend/app/domain/__init__.py`, `backend/app/domain/validation.py`, `backend/tests/test_workflow_schemas.py`, `backend/tests/test_workflow_validation.py`.
- Files to modify: `backend/app/main.py` only if shared validation error handling must be registered.
- Implementation instructions: Define the exact workflow, node, edge, request, response, generation, error, and supported-node enum models. Enforce all listed input and graph rules, including disconnected graphs and decision fan-out. Keep coordinates out of the backend schema and preserve decision edge labels. Use deterministic, testable validation functions.
- Validation commands: `uv run --project backend pytest backend/tests/test_workflow_schemas.py backend/tests/test_workflow_validation.py`.
- Acceptance criteria: Valid representative workflows parse; each required invalid case is covered by a focused test; duplicate IDs/references/node types/structural rules fail with safe actionable errors; no coordinates or execution fields are accepted.
- Commit message: `feat(backend): define and validate workflow schema`
- Stop conditions: Stop if the schema adds unsupported node types, execution semantics, coordinates, persistence identifiers, or silently coerces invalid graph data.

### Checkpoint 4: Implement isolated Groq provider and structured generation

- Status: INCOMPLETE
- Purpose: Convert a prompt into constrained candidate workflow JSON behind a mockable provider boundary.
- Files to create: `backend/app/services/__init__.py`, `backend/app/services/groq_provider.py`, `backend/app/prompts/__init__.py`, `backend/app/prompts/workflow_generation.py`, `backend/tests/test_groq_provider.py`, `backend/tests/test_generation_service.py`.
- Files to modify: `backend/app/config.py`, `backend/app/services/workflow_generation.py`, `backend/pyproject.toml`, `backend/uv.lock`.
- Implementation instructions: Wrap the Groq SDK in a service with explicit model, temperature, token, timeout, credential, rate-limit, and API-error handling. Instruct the model to return only the schema fields, use exactly supported node types, never generate coordinates/HTML/code/credentials, and explain assumptions/missing requirements/suggestions. Parse JSON, validate it with domain validation, and retry exactly once for invalid structured output. Never retry credential, rate-limit, timeout, or general provider errors. Keep model output untrusted and do not log secrets.
- Validation commands: `uv run --project backend pytest backend/tests/test_groq_provider.py backend/tests/test_generation_service.py`.
- Acceptance criteria: Provider is the only Groq SDK boundary; mocked tests cover valid output, invalid JSON, invalid schema then successful retry, invalid schema after retry, credential, rate-limit, timeout, and API failures; retry count is never greater than one.
- Commit message: `feat(backend): add mockable Groq workflow generation`
- Stop conditions: Stop if a frontend module imports Groq, raw model output bypasses validation, retries can loop, or the provider requires a live credential in tests.

### Checkpoint 5: Expose the workflow generation API

- Status: INCOMPLETE
- Purpose: Provide the required POST endpoint with thin routing and stable request/error/response behavior.
- Files to create: `backend/app/api/errors.py`, `backend/app/api/routes/workflows.py`, `backend/tests/test_workflow_routes.py`.
- Files to modify: `backend/app/main.py`, `backend/app/services/workflow_generation.py`, `backend/app/schemas/workflow.py`.
- Implementation instructions: Add `POST /api/v1/workflows/generate`, validate prompt presence and configured length limit before service invocation, call the generation service, measure `durationMs`, return the configured model name, and map known failures to the stable error envelope. Keep route handlers orchestration-only and never expose provider internals or credentials.
- Validation commands: `uv run --project backend pytest backend/tests/test_workflow_routes.py backend/tests/test_health.py`.
- Acceptance criteria: Valid request returns the specified response shape; empty and oversized prompts are rejected without Groq calls; mocked valid generation succeeds; invalid output/provider errors map predictably; `durationMs` is non-negative; route code remains thin.
- Commit message: `feat(backend): expose workflow generation endpoint`
- Stop conditions: Stop if the endpoint persists data, accepts execution commands, reveals raw SDK errors/secrets, or calls Groq from route code.

### Checkpoint 6: Build frontend prompt page and API client

- Status: INCOMPLETE
- Purpose: Let an internal user enter a prompt, submit it to the backend, clear it, and hold a typed result in memory.
- Files to create: `frontend/src/types/workflow.ts`, `frontend/src/api/client.ts`, `frontend/src/components/Header.tsx`, `frontend/src/components/PromptPanel.tsx`, `frontend/src/lib/constants.ts`.
- Files to modify: `frontend/src/App.tsx`, `frontend/src/index.css`, `frontend/.env.example`, `frontend/package.json`, `frontend/package-lock.json`.
- Implementation instructions: Create one responsive main page with product header, prompt textarea, example prompt, character count and limit, Generate Workflow, Clear, loading state, and controlled error display. Use `VITE_API_BASE_URL` only, typed request/response models, and an in-memory result callback. Prevent duplicate submissions and clear both prompt/result/error as specified; do not add persistence or routing.
- Validation commands: `npm ci --prefix frontend`; `npm run build --prefix frontend`.
- Acceptance criteria: UI renders the required prompt controls; client posts exactly `{prompt}` to the configured API; response/error parsing is typed; Groq credentials are absent from frontend environment and source; refresh loses generated state.
- Commit message: `feat(frontend): add prompt generation page`
- Stop conditions: Stop if local storage, accounts, export, editing controls, or direct provider calls are introduced.

### Checkpoint 7: Add custom React Flow node rendering

- Status: INCOMPLETE
- Purpose: Render validated workflow nodes and labelled edges as a read-only visual canvas.
- Files to create: `frontend/src/components/WorkflowCanvas.tsx`, `frontend/src/components/nodes/WorkflowNode.tsx`, `frontend/src/components/nodes/nodeTypes.ts`.
- Files to modify: `frontend/src/components/WorkflowResult.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`.
- Implementation instructions: Map each supported domain node type to a distinct safe visual treatment, show title/description/application, use React Flow handles appropriate for the direction, and render edge labels. Configure the canvas as read-only by disabling dragging, connecting, editing, deletion, and mutation controls while retaining navigation. Add `MiniMap`, controls, fit behavior, and grid background, but do not calculate layout here.
- Validation commands: `npm run build --prefix frontend`; `npm run test --prefix frontend -- --run src/test/workflow-canvas.test.tsx`.
- Acceptance criteria: Every supported type renders through an explicit registry; decision branch labels are visible; canvas has required navigation affordances; no node/edge editing is possible; untrusted fields are rendered as text, never HTML.
- Commit message: `feat(frontend): render read-only workflow nodes`
- Stop conditions: Stop if unsupported node types are silently rendered as executable elements, arbitrary HTML is injected, or editing behavior is added.

### Checkpoint 8: Add Dagre left-to-right automatic layout

- Status: INCOMPLETE
- Purpose: Calculate stable React Flow positions from domain graph data after generation.
- Files to create: `frontend/src/lib/layout.ts`, `frontend/src/test/layout.test.ts`.
- Files to modify: `frontend/src/components/WorkflowCanvas.tsx`, `frontend/package.json`, `frontend/package-lock.json`.
- Implementation instructions: Build a Dagre graph with left-to-right direction, map domain nodes/edges without coordinates from the API, calculate positions in a pure function, and translate the result to React Flow nodes/edges. Preserve IDs, node data, edge labels, and graph order. Re-run layout when workflow changes and fit the view after nodes mount.
- Validation commands: `npm run test --prefix frontend -- --run src/test/layout.test.ts`; `npm run build --prefix frontend`.
- Acceptance criteria: Layout output contains a position for every node; it is deterministic for the same input; edges preserve source/target/labels; the AI payload contains no visual coordinates; disconnected input is rejected by backend rather than laid out as a valid workflow.
- Commit message: `feat(frontend): add Dagre workflow layout`
- Stop conditions: Stop if coordinates are requested from Groq, layout mutates domain data, or manual positioning/editing is introduced.

### Checkpoint 9: Add workflow metadata and insight panels

- Status: INCOMPLETE
- Purpose: Display the generated workflow’s title, description, assumptions, missing requirements, and suggestions beside the canvas.
- Files to create: `frontend/src/components/InsightPanel.tsx`.
- Files to modify: `frontend/src/components/WorkflowResult.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`.
- Implementation instructions: Render title and description as text, provide distinct sections for each insight array, handle empty arrays without fabricated content, and keep the result read-only. Preserve the single-page layout and avoid adding save/export/share actions.
- Validation commands: `npm run build --prefix frontend`; `npm run test --prefix frontend -- --run src/test/workflow-result.test.tsx`.
- Acceptance criteria: All required response fields are visibly represented; empty insight sections are handled consistently; metadata remains in browser memory; no persistence, export, or editing UI exists.
- Commit message: `feat(frontend): display workflow metadata and insights`
- Stop conditions: Stop if content is rendered as HTML, insights are invented client-side, or excluded actions appear.

### Checkpoint 10: Complete loading, error, and UX states

- Status: INCOMPLETE
- Purpose: Make generation behavior predictable for slow, invalid, and failed requests.
- Files to create: `frontend/src/test/prompt-panel.test.tsx`, `frontend/src/test/api-client.test.ts`.
- Files to modify: `frontend/src/App.tsx`, `frontend/src/components/PromptPanel.tsx`, `frontend/src/api/client.ts`, `frontend/src/index.css`.
- Implementation instructions: Show an accessible loading state and disable duplicate submission, preserve or clear prior results according to the request lifecycle, normalize backend errors into safe messages, handle network/timeout/non-JSON failures, and keep Clear deterministic. Do not expose stack traces, API keys, or raw provider responses.
- Validation commands: `npm run test --prefix frontend -- --run src/test/prompt-panel.test.tsx src/test/api-client.test.ts`; `npm run build --prefix frontend`.
- Acceptance criteria: Tests cover empty/oversized input, success, loading, clear, network failure, backend error, malformed response, and duplicate-submit prevention; users receive controlled messages; no secrets appear in rendered UI.
- Commit message: `fix(frontend): handle generation loading and errors`
- Stop conditions: Stop if errors expose provider internals, retries are duplicated in the frontend, or a stateful persistence mechanism is added.

### Checkpoint 11: Expand backend automated coverage

- Status: INCOMPLETE
- Purpose: Lock down all Version 1 backend validation and provider behavior before final integration.
- Files to create: `backend/tests/conftest.py`, `backend/tests/test_error_mapping.py`.
- Files to modify: `backend/tests/test_workflow_schemas.py`, `backend/tests/test_workflow_validation.py`, `backend/tests/test_groq_provider.py`, `backend/tests/test_generation_service.py`, `backend/tests/test_workflow_routes.py`.
- Implementation instructions: Add focused parametrized tests for every required invalid prompt, JSON, schema, graph, node, edge, credential, rate-limit, timeout, provider, retry, and route case. Mock every Groq call, assert call counts, assert no secret leakage, and test health independently. Keep tests deterministic and local.
- Validation commands: `uv run --project backend pytest`; `uv run --project backend ruff check backend`; `uv run --project backend python -m compileall -q backend/app`.
- Acceptance criteria: Full backend tests pass; all listed validation requirements have explicit coverage; Groq is never contacted by automated tests; lint and compilation pass; no persistence or excluded feature tests appear.
- Commit message: `test(backend): cover workflow generation behavior`
- Stop conditions: Stop if tests require network credentials, skip required cases, or reveal secrets in fixtures/output.

### Checkpoint 12: Add frontend automated coverage

- Status: INCOMPLETE
- Purpose: Verify the prompt flow, rendering, layout, read-only canvas, and controlled states in a browser-like test environment.
- Files to create: `frontend/src/test/setup.ts`, `frontend/src/test/app.test.tsx`, `frontend/src/test/workflow-canvas.test.tsx`, `frontend/src/test/workflow-result.test.tsx`.
- Files to modify: `frontend/vite.config.ts`, `frontend/package.json`, `frontend/package-lock.json`, and existing frontend test files as needed.
- Implementation instructions: Configure the test environment, mock the API boundary rather than Groq, test the main page controls and success/error/loading flows, verify all node types and decision labels, assert read-only settings, and test Dagre output through the public component behavior. Do not use snapshot-heavy tests or real network calls.
- Validation commands: `npm run test --prefix frontend -- --run`; `npm run build --prefix frontend`.
- Acceptance criteria: Frontend tests pass locally; required controls and result sections are covered; layout and custom nodes are covered; mocked failures render safely; no test depends on a live API or provider.
- Commit message: `test(frontend): cover workflow visualization flow`
- Stop conditions: Stop if tests require a live backend/Groq key, depend on unstable implementation details unnecessarily, or introduce excluded UI behavior.

### Checkpoint 13: Document local development and perform final verification

- Status: INCOMPLETE
- Purpose: Make Version 1 locally understandable and verify the complete bounded feature.
- Files to create: `docs/specifications/version-1-workflow.md`, `docs/architecture/version-1.md`, `frontend/.env.example`, `backend/.env.example` if not already created, and any focused test configuration documentation.
- Files to modify: `README.md`, `frontend/README.md`, `backend/README.md`, `context.md`.
- Implementation instructions: Document prerequisites (Node/npm, Python 3.12, `uv`), dependency installation from committed manifests/locks, safe env setup, frontend/backend start commands, health check, generation flow, test commands, read-only/in-memory behavior, and explicit Version 1 exclusions. Verify no secret or generated environment is documented as a committed file.
- Validation commands: `npm ci --prefix frontend`; `npm run test --prefix frontend -- --run`; `npm run build --prefix frontend`; `uv sync --project backend --locked`; `uv run --project backend pytest`; `uv run --project backend ruff check backend`; `git -c safe.directory=D:/AI-Workflow-Builder diff --check`; `git -c safe.directory=D:/AI-Workflow-Builder status --short`.
- Acceptance criteria: A clean checkout can follow the docs; both test suites and builds pass; health and mocked generation contracts are verified; lock files are committed while secrets, environments, and `.codex/commit-message.txt` are ignored; all exclusions remain absent; context records completed Version 1 work only after implementation validation.
- Commit message: `docs(repo): document and verify version one`
- Stop conditions: Stop if final validation needs a real secret/network provider, an excluded service, or any source/config change outside Version 1.

## Final Version 1 validation

Run from a clean working tree after all checkpoint commits, with Groq mocked for automated checks and a safe local key only for an optional manual smoke test:

1. `npm ci --prefix frontend` and `npm run test --prefix frontend -- --run`.
2. `npm run build --prefix frontend`.
3. `uv sync --project backend --locked` and `uv run --project backend pytest`.
4. `uv run --project backend ruff check backend` and `uv run --project backend python -m compileall -q backend`.
5. Start backend/frontend using documented commands; verify `GET /api/v1/health` and one manual generation only when a local key is intentionally supplied outside Git.
6. Confirm response validation, exactly one invalid-output retry, read-only canvas, Dagre left-to-right layout, controls, decision labels, insights, loading/error states, and refresh-cleared memory state.
7. Confirm no authentication, persistence/database, execution, export, sharing, deployment, Docker, CI/CD, Redis, worker, or credential-integration artifacts exist.
8. `git -c safe.directory=D:/AI-Workflow-Builder diff --check`; `git -c safe.directory=D:/AI-Workflow-Builder status --short`; `git -c safe.directory=D:/AI-Workflow-Builder check-ignore .env .codex/commit-message.txt node_modules frontend/node_modules backend/.venv`.

## Risks

- Groq structured output may vary by model; strict schema validation and one bounded retry reduce malformed results without creating retry loops.
- Graph rules such as decision fan-out and start/end direction can reject plausible but ambiguous workflows; clear validation messages and assumptions should guide the user.
- React Flow and Dagre dimensions can produce cramped layouts; use fixed measured node dimensions and fit-to-view, then address only observed Version 1 layout defects.
- Dependency APIs may change; use current compatible packages and committed npm/`uv` locks, without redesigning the architecture.
- Provider latency and rate limits can affect UX; surface controlled errors and loading state without adding background workers or persistence.
- User-provided and AI-generated text is untrusted; render text safely and never render AI-generated HTML directly.

## Escalation conditions

Escalate before implementation when a requirement needs an excluded feature, a provider behavior cannot support the exact contract, a dependency requires a materially different architecture, a live credential/network is required for automated validation, graph validity rules conflict, or a requested change would exceed the current checkpoint. Escalate rather than weakening validation, exposing secrets, adding persistence, or implementing future-version functionality.

## Plan completion and cleanup

After all checkpoints pass, run final validation, update `context.md` with the verified Version 1 state, prepare the final commit message without committing `.codex/commit-message.txt`, and commit only when explicitly authorized. Archive this plan only if it contains an important lasting architectural decision; otherwise reset `implementation-plan.md` to the repository’s empty template after the completed work is committed. Do not mark a checkpoint complete until its acceptance criteria and validation commands pass.
