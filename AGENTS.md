# Agent Entry Point

Every coding agent must read these files in order:

1. `instructions.md`
2. `context.md`
3. `implementation-plan.md`

`instructions.md` contains permanent project rules. `context.md` contains the current project state. `implementation-plan.md` contains the active disposable plan.

The repository and passing tests are the implementation source of truth. Planner agents may create or replace the implementation plan but must not implement code. Implementer agents must execute only the first incomplete checkpoint, update `context.md` after successful work, mark completed checkpoints in `implementation-plan.md`, and prepare `.codex/commit-message.txt`.

A checkpoint is not complete until its required validation passes. Avoid unrelated changes and scope expansion.
