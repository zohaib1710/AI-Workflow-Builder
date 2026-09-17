# Version 1 architecture

## Architecture overview

Version 1 is a two-application local system. The browser owns prompt and display state; FastAPI owns provider access, validation, retry policy, and safe API errors.

```text
React frontend
    -> FastAPI API
    -> WorkflowGenerationService
    -> AIProvider
    -> OpenAICompatibleProvider
    -> configured provider endpoint

untrusted candidate result
    -> JSON and Pydantic Workflow validation
    -> graph validation
    -> API response
    -> Dagre layout
    -> React Flow rendering
```

## Frontend

React and TypeScript implement one page with prompt, loading, error, result, and insight states. `src/api/client.ts` is the only HTTP boundary and reads only `VITE_API_BASE_URL`. Successful responses receive runtime shape checks before entering application state.

The result remains in React memory. It is lost on refresh and is never written to local or remote persistence. The Clear action removes the prompt, result, and current error.

## Backend

FastAPI exposes `GET /api/v1/health` and `POST /api/v1/workflows/generate`. Pydantic Settings loads backend-only AI configuration and the allowed frontend origin. The generation route delegates to `WorkflowGenerationService`; it does not parse provider output or implement retries itself.

## AI provider boundary

`AIProvider` is a vendor-independent protocol for structured candidate generation. Version 1 implements one `OpenAICompatibleProvider` adapter using `httpx`. Provider name, key, compatible base URL, model, temperature, token limit, and timeout are environment-driven. Groq is the initial example configuration through its OpenAI-compatible endpoint, not a service-layer dependency. No provider SDK or future provider adapter is implemented.

## Generation sequence

1. The frontend trims and submits a prompt to FastAPI.
2. Pydantic validates the request before generation.
3. The service requests JSON matching the generated Workflow schema through `AIProvider`.
4. The returned candidate is parsed and validated as untrusted data.
5. Graph validation checks identifiers, references, boundary-node rules, decision branches, and connectivity.
6. Invalid candidate structure gets exactly one correction request; provider failures are never retried.
7. FastAPI returns the validated workflow plus model and duration metadata.
8. The frontend validates the response shape, computes Dagre positions, and renders the read-only React Flow canvas and insights.

## Validation layers

- The prompt is a strict, non-blank string of at most 5,000 characters.
- The Pydantic workflow model rejects missing, incorrectly typed, and unknown fields.
- Domain graph validation rejects duplicate IDs, missing references, self-references, invalid start/end connections, invalid decision fan-out or labels, and disconnected multi-node graphs.
- The frontend validates response structure and supported node types again before display.

## Error handling

The backend maps request, configuration, credential, rate-limit, timeout, connection, provider API, provider-response, invalid-candidate, and unexpected failures to stable safe responses. It does not expose raw provider output or exception details. The frontend converts these and browser network/timeout failures to controlled user-facing messages. There is no frontend automatic retry.

## Layout and rendering

Dagre receives coordinate-free workflow nodes and edges and calculates deterministic left-to-right positions in the view layer. React Flow uses explicit custom renderers for all ten supported types. Navigation remains enabled through pan, zoom, fit view, controls, a grid, and a MiniMap. Editing, dragging, connecting, deletion, and selection-based mutation are disabled.

Generated titles, descriptions, application names, edge labels, assumptions, missing requirements, and suggestions are rendered as text rather than injected HTML.

## Security boundaries

- AI credentials and compatible provider URLs stay in backend configuration.
- The frontend receives no provider credentials and calls only the backend API.
- Real `.env` files and generated environments are ignored by Git.
- Provider output is untrusted until schema and graph validation succeed.
- CORS permits only the configured `FRONTEND_URL`.
- Automated tests mock HTTP or use fake providers and require neither a live provider nor a real key.

## Testing strategy

Backend tests cover strict schemas, graph rules, provider transport mapping, bounded retry behavior, safe API errors, routes, and health. Frontend tests cover API normalization, prompt lifecycle, App integration, safe result rendering, custom nodes, read-only canvas settings, and Dagre layout. Provider HTTP and the frontend API boundary are mocked; automated suites run offline.

## Deliberate Version 1 exclusions

Version 1 deliberately excludes authentication, accounts, database persistence, saving, history, versioning, execution, editing, manual positioning, export, sharing, collaboration, background workers, Redis, Docker, deployment automation, CI/CD, provider-selection UI, and streaming generation.
