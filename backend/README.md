# AI Workflow Builder backend

The backend accepts a natural-language prompt, obtains a structured candidate through a provider-agnostic AI boundary, validates it, and returns a safe workflow contract. It targets Python 3.12 and uses FastAPI, Pydantic, `httpx`, and `uv`.

Run these commands from the repository root.

## Install

```powershell
uv sync --project backend --locked
```

Dependencies are synchronized from `backend/uv.lock`.

## Environment

```powershell
Copy-Item backend/.env.example backend/.env
```

The safe example contains:

```env
AI_PROVIDER=openai_compatible
AI_API_KEY=
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=openai/gpt-oss-20b
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=6000
AI_REASONING_EFFORT=low
AI_TIMEOUT_SECONDS=30
FRONTEND_URL=http://localhost:5173
```

Groq is shown only as an OpenAI-compatible example endpoint. `AI_API_KEY` belongs only in the ignored local `backend/.env`; never commit it. A real key is required only for optional manual generation, not health checks or automated tests.

## Run

```powershell
uv run --project backend uvicorn app.main:app --reload
```

The API normally listens on `http://localhost:8000`.

## Health check

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/health
```

`GET /api/v1/health` returns `{ "status": "ok" }` without creating or calling an AI provider.

Workflow generation uses `POST /api/v1/workflows/generate` with a JSON body such as:

```json
{
  "prompt": "Create a lead qualification workflow."
}
```

## Test, lint, and compile

```powershell
uv run --project backend pytest
uv run --project backend ruff check backend
uv run --project backend python -m compileall -q backend/app
```

Tests use mocked HTTP, fake providers, and dependency overrides. They require no `AI_API_KEY` and make no live provider request.

## Provider architecture

`WorkflowGenerationService` depends on the vendor-independent `AIProvider` protocol. The implemented `OpenAICompatibleProvider` uses `httpx` and environment configuration; no provider SDK is installed. Candidate output is untrusted and must pass strict Pydantic validation plus graph validation. Invalid structured output gets at most one correction attempt. Credential, rate-limit, timeout, connection, and other provider failures are not retried and are mapped to controlled API responses.

See the [architecture](../docs/architecture/version-1.md) and [workflow specification](../docs/specifications/version-1-workflow.md) for details.
