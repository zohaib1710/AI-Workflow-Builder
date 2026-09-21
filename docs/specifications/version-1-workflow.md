# Version 1 workflow specification

## Purpose

Version 1 converts one natural-language business-process prompt into a validated workflow for read-only browser visualization. It does not save, edit, or execute the workflow.

## Prompt request contract

`POST /api/v1/workflows/generate` accepts JSON with exactly one field:

```json
{
  "prompt": "Create a lead qualification workflow."
}
```

`prompt` must be a string, is trimmed, must not be blank, and is limited to 2,000 characters. Unknown request fields are rejected.

## Workflow response contract

A successful response contains a `workflow` object and `generation` metadata:

```json
{
  "workflow": {
    "title": "Lead qualification workflow",
    "description": "Qualifies and routes incoming leads.",
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

The illustrative empty node list above shows field shape only; an actual validated workflow must contain at least one node.

## Supported node types

Exactly ten node types are supported:

- `start`
- `end`
- `trigger`
- `action`
- `decision`
- `api`
- `database`
- `wait`
- `approval`
- `notification`

## Node schema

Each node has:

- `id`: unique, non-empty string
- `type`: one of the supported node types
- `title`: non-empty string
- `description`: non-empty string
- `application`: `null` or a non-empty string naming the relevant application

Coordinates, execution data, persistence identifiers, and unknown fields are rejected.

## Edge schema

Each edge has:

- `id`: unique, non-empty string
- `source`: ID of an existing node
- `target`: ID of an existing node
- `label`: `null` or a non-empty string

Labels on outgoing decision branches are required and are preserved in the visual diagram.

## Workflow schema

`title` and `description` are required non-empty strings. `nodes` contains at least one node. `edges` is required, and a workflow with multiple nodes must contain edges. `assumptions`, `missingRequirements`, and `suggestions` are required string arrays whose entries cannot be blank. Unknown fields are rejected.

## Generation metadata

`generation.model` identifies the configured backend model. `generation.durationMs` is a non-negative integer measured by the API route. Provider credentials and raw provider payloads are never returned.

## Validation rules

The backend parses candidate content as JSON, validates the strict Pydantic schema, and then validates graph relationships. Candidate output is never trusted directly. A schema- or graph-invalid candidate receives one bounded correction attempt; a second invalid candidate becomes a controlled error. Provider failures are not retried.

## Graph validation rules

- Node IDs and edge IDs must be unique.
- Every edge source and target must reference an existing node.
- Self-referencing edges are rejected.
- A `start` node cannot have incoming edges.
- An `end` node cannot have outgoing edges.
- A `decision` node needs at least two outgoing edges.
- Every outgoing decision edge needs a meaningful label.
- A multi-node workflow must be connected when edge direction is ignored for the connectivity check.
- A single-node workflow may have no edges.

## Error behavior

Request validation failures and generation/provider failures use a stable JSON envelope containing a safe `detail` plus an `errors` array with `code`, `message`, and optional `field`. Provider responses, credentials, headers, and tracebacks are not exposed. The frontend maps backend, network, timeout, non-JSON, and malformed-success failures to controlled messages and performs no automatic retry.

## Read-only frontend behavior

The frontend renders workflow text as plain React text. Dagre calculates left-to-right positions, and React Flow provides pan, zoom, fit view, a grid, controls, and a MiniMap. Nodes cannot be dragged for editing, connections cannot be created, and nodes or edges cannot be selected for editing or deleted. Metadata and insights are also read-only.

The current result exists only in browser memory. Refreshing clears it. **Clear** removes the prompt, result, and current error, and no workflow is saved automatically.

## Version 1 exclusions

Version 1 has no authentication, user accounts, database persistence, saving, history, versioning, execution, node or edge editing, manual positioning, export, sharing, collaboration, background workers, Redis, Docker, deployment automation, CI/CD, provider-selection UI, or streaming generation.
