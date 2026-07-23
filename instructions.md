# Project Instructions

## 1. Project purpose

AI Workflow Builder converts natural-language prompts into visual workflow diagrams for visualization and design. It must not execute workflows unless a future version explicitly introduces execution.

## 2. Technology direction

The frontend direction is React, TypeScript, Vite, Tailwind CSS, React Flow, and Dagre. The backend direction is Python, FastAPI, Pydantic, and `uv`. Groq is the initial AI provider and may only be called from the backend.

## 3. Version-based development

Development proceeds one version at a time. Future-version functionality must not be implemented early. PostgreSQL is planned for a later version and must not be added before persistence is required.

## 4. Planner responsibilities

Read the required project files, inspect the repository, define one small active plan, and specify validation and a proposed Conventional Commit title for every checkpoint. Planners must not implement code.

## 5. Implementer responsibilities

Execute only the first incomplete checkpoint. Keep changes within scope, run its required validation, update `context.md` after successful work, mark the checkpoint complete, and prepare `.codex/commit-message.txt`.

## 6. Checkpoint sizing

Each checkpoint should deliver one coherent, independently verifiable change with explicit files, validation, acceptance criteria, and stop conditions. Stop when the checkpoint is complete or escalation is required.

## 7. Implementation-plan requirements

The active plan must state its objective, scope, exclusions, observations, assumptions, dependencies, ordered checkpoints, final validation, risks, escalation conditions, and cleanup. Every checkpoint needs a proposed commit title.

## 8. Escalation conditions

Escalate when requirements conflict, required information or access is missing, validation cannot pass for an external reason, or the requested work would expand version or scope boundaries. Do not silently guess on material decisions.

## 9. General code-quality rules

Prefer simple, maintainable code; preserve existing behavior; avoid unrelated edits; validate proportionally; document decisions that affect architecture. Treat all AI output as untrusted data.

## 10. Frontend rules

Use the planned React/TypeScript/Vite/Tailwind CSS/React Flow/Dagre stack. Keep visualization and design concerns separate from execution. AI-generated HTML must never be rendered directly; sanitize or represent untrusted content safely.

## 11. Backend rules

Use the planned Python/FastAPI/Pydantic/`uv` stack. Keep provider calls server-side, validate inputs and outputs, and treat AI responses as untrusted data. Groq must only be called from the backend.

## 12. Testing rules

Every checkpoint must define and pass appropriate validation before completion. Add or update tests with behavior changes, and do not claim validation that was not run.

## 13. Context-maintenance rules

Keep `context.md` accurate and concise. After successful implementation, record completed work, current state, validation, and the next action without erasing useful history.

## 14. Commit policy

Use Conventional Commit titles in the format `type(scope): concise imperative summary`. Allowed types are `chore`, `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `ci`, and `perf`. Planners define one title per checkpoint; implementers write the final prepared message to `.codex/commit-message.txt`. Do not include model names or credit usage.

## 15. Plan lifecycle

Plans are disposable working documents. After all checkpoints pass, run final validation, update context, prepare the commit message, commit the completed work when explicitly authorized, archive only plans with important lasting architectural decisions, and reset the active plan to its empty template.

## 16. Secret-management rules

Never commit API keys or secrets. Use environment variables and keep `.env.example` safe and non-secret. Never expose credentials in logs, tests, prompts, or generated artifacts.

## 17. Required final response format

Report: files created; files modified; validation commands run; validation result; whether Git is initialized; proposed commit message; and any blocker. Be precise and do not claim unperformed work.
