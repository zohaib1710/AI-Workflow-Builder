# Active Implementation Plan

## Plan metadata

- Status: ACTIVE
- Version: Version 2
- Plan type: implementation roadmap only
- Created: 2026-09-18
- Version 1 baseline commit: `8dc8c57 docs(repo): document and verify version one`

## Objective

Turn the completed Version 1 prompt-to-workflow viewer into an in-memory, full-screen visual workflow editor. Version 2 supports manual editing and provider-agnostic natural-language iteration while preserving the coordinate-free semantic `Workflow` contract, safe validation, stable node identity, and user-owned canvas layout.

## Scope

Version 2 includes:

- A full-viewport editor shell with a centered initial composer and bottom-centered iteration composer.
- Standard flowchart shapes, a compact floating toolbar, node/edge selection, node movement, node and edge creation/deletion, property inspectors, connection labels, and free-standing text annotations.
- A frontend editor draft that may temporarily violate graph rules, visible validation feedback, in-memory undo/redo, and an explicit Auto Arrange command.
- A separate provider-agnostic workflow-edit backend contract that returns a full revised semantic workflow.
- Stable-ID reconciliation that preserves manual positions and shape overrides for retained nodes and deterministically places new nodes.
- A collapsible insights surface, responsive editor constraints, focused automated coverage, and Version 2 documentation.

## Exclusions

Do not add authentication, user accounts, database persistence, saved projects, server-side history, shared links, real-time collaboration, multi-user cursors, workflow execution, automation-platform deployment, integration credentials, provider-selection UI, streaming generation, exports, BPMN import/export, swimlanes, groups/containers, advanced styling, a plugin marketplace, Docker, deployment automation, or CI/CD. Refresh continues to clear all workflow/editor state.

## Repository observations

- Version 1 is complete at commit `8dc8c57`; the worktree was clean when this plan was created.
- `frontend/src/App.tsx` currently owns prompt, loading, error, and generated result state. It must be decomposed before editor behavior grows.
- The frontend `Workflow` type and backend Pydantic `Workflow` model are coordinate-free. React Flow nodes are currently derived view objects, and Dagre supplies all positions.
- The Version 1 canvas deliberately disables dragging, selection, connections, focus, and deletion. Version 2 must enable only mode-specific editing behavior.
- The backend already has a reusable `AIProvider`, `OpenAICompatibleProvider`, provider factory, strict workflow schema, graph validator, safe exception mapping, and one-correction retry pattern.
- Current tests cover 48 frontend cases and 100 backend cases with mocked boundaries. No new end-to-end framework or live provider testing is needed.
- Current dependencies are sufficient. Prefer no new runtime state or rendering dependency; update lock files only if an implementation checkpoint proves one is necessary.

## Assumptions and dependencies

- Version 2 builds on the existing ten semantic node types and does not change their backend meaning.
- Browser support includes `crypto.randomUUID`; an editor ID helper will isolate generation for deterministic tests.
- React Flow remains the interaction/canvas library and Dagre remains the full-layout engine.
- AI editing requires a graph-valid current semantic workflow. Manual editing remains available without a provider key.
- The backend API remains under `/api/v1` for compatibility; Version 2 adds a capability, not a breaking semantic schema version.
- Every implementation session executes only the first incomplete checkpoint and preserves passing V1 behavior.

## Architecture decisions

### Semantic model and editor presentation

The backend and API continue to use coordinate-free `Workflow`. The frontend owns a separate editor model:

```typescript
type FlowchartShape =
  | "terminator"
  | "process"
  | "decision"
  | "input-output"
  | "database"
  | "document"
  | "delay"
  | "predefined-process"
  | "manual-operation"

type CanvasNodePresentation = {
  nodeId: string
  shape: FlowchartShape
  position: { x: number; y: number }
}

type CanvasAnnotation = {
  id: string
  text: string
  position: { x: number; y: number }
}
```

The editor snapshot contains the semantic draft workflow, node-presentation records, and annotations. Selection, active tool, async request state, composer text, drawer state, and viewport are transient UI state and are not part of semantic data or history snapshots.

### Draft validation model

Use draft-state editing (Model B). Manual actions must keep data structurally well formed—unique generated IDs, nonblank required node fields, and existing endpoints for newly created edges—but may temporarily create graph-invalid states such as disconnected nodes or a decision with one branch. A pure frontend validator mirrors the backend graph rules and produces small user-facing issues. AI iteration is disabled until the draft is graph-valid; the backend independently revalidates the submitted current workflow. Auto Arrange may run on a structurally well-formed draft even when graph issues remain. No draft is sent to execution, persistence, or export because those capabilities are excluded.

### State management and history

Use built-in React `useReducer` plus split state/dispatch contexts; do not add Redux or Zustand. The editor surface is cohesive enough for a reducer, and history needs explicit domain transactions rather than generic store middleware. React Flow keeps local drag-preview nodes for smooth pointer movement, then dispatches one position transaction on drag stop. Inspector forms keep local input drafts and commit one transaction on apply or blur.

History stores at most 100 editor snapshots, clears redo after a new recorded action, and excludes viewport, selection, tool changes, request status, and prompt typing. Node move, add/delete, field/shape changes, edge changes, annotation changes, AI edits, and Auto Arrange each create one history entry.

### Shape system

Implement all nine listed shapes in Version 2 using authored, fixed SVG geometry inside custom React Flow nodes with an HTML text overlay and safe React text rendering. Do not accept generated SVG or HTML. A shared shape registry owns geometry, sizing, accessible labels, default semantic mappings, and handle locations. Semantic type and visual shape remain independent: initial/default shapes derive from semantic type, while inspector shape changes modify presentation only. Semantic type is read-only in the Version 2 node inspector; AI edits or creation presets establish semantic type.

Default mappings are: `start` and `end` to terminator, `trigger` to terminator, `action` to process, `decision` to decision, `api` to input-output, `database` to database, `wait` to delay, `approval` to decision, and `notification` to document. Predefined-process and manual-operation remain available creation/shape choices without adding semantic node types. Changing any default shape later updates presentation only.

### AI edit strategy and identity

`POST /api/v1/workflows/edit` accepts `{ instruction, workflow }`, where `instruction` is a trimmed nonblank string of at most 2,000 characters and `workflow` is the current semantic workflow. It returns `{ workflow, generation }` using a dedicated `EditWorkflowResponse`. `WorkflowEditService` requests a full revised workflow rather than patch operations because the existing schema, validation, correction retry, and provider boundary already secure complete candidates. The edit prompt requires unchanged and modified nodes to retain IDs, deleted IDs to disappear, and new nodes to receive unique IDs.

The frontend reconciles by exact ID only; it never guesses identity from titles. Retained IDs keep positions and shape overrides, deleted IDs lose presentation records, and new IDs receive deterministic local placement. If both old and new workflows are nonempty and share no node IDs, treat the response as unstable identity, keep the current editor state unchanged, and show a controlled retry message. Partial churn is accepted: unmatched old nodes are removals and unmatched new nodes are additions.

### Position reconciliation and Auto Arrange

Initial generation lays out every node with Dagre. AI edits do not run full Dagre. Each new node is placed after the first positioned predecessor at a fixed horizontal offset; otherwise before the first positioned successor; otherwise near the current canvas center. Multiple or colliding new nodes move down a fixed grid step in semantic node order until clear. Existing positions and shape overrides are never changed by reconciliation.

Auto Arrange is the only post-generation command that intentionally runs Dagre across the entire semantic draft and replaces every workflow-node position. It preserves shape overrides and annotations. The action is a single undoable history transaction.

### Manual interactions

- The node inspector edits title, description, application, and visual shape; semantic type is displayed read-only. Delete cascades incident semantic edges and removes the node presentation.
- The connector tool enables handle dragging; select mode does not create connections. A decision-source connection requests a branch label before commit. The edge inspector edits label and deletes the selected edge.
- The text tool adds presentation-only annotations at the next canvas click. Annotation text and movement are undoable and are never sent to the backend or AI.
- During an AI edit, semantic/manual mutation controls are disabled, while pan and zoom remain available. Failure preserves the current workflow and all presentation state.

### Toolbar and responsive behavior

The left floating toolbar contains: New/close, AI-focus, Select, Add shape, Connect, Text, Auto Arrange, Undo, and Redo. There is no separate generic line or arrow tool; semantic connections cover that need. Tool buttons are small components with labels/tooltips and keyboard-accessible pressed/disabled state.

Tool effects are explicit:

| Tool | Purpose and mode | State affected |
| --- | --- | --- |
| New/close | Confirm and reset the in-memory editor | Semantic, presentation, history |
| AI-focus | Focus the composer; does not alter the graph | Transient UI only |
| Select | Select and move one node, edge, or annotation | Selection; presentation on move |
| Add shape | Choose a semantic preset and place one node | Semantic and presentation |
| Connect | Enable source-handle to target-handle edge creation | Semantic |
| Text | Place and edit one annotation | Presentation only |
| Auto Arrange | Replace all workflow-node positions through Dagre | Presentation only |
| Undo/Redo | Traverse recorded editor snapshots | Semantic and/or presentation |

The canvas fills `100dvh`. The initial composer is centered above the empty canvas; after generation the same component switches to iteration mode at bottom-center. Toolbar, composer, inspectors, insights, and React Flow controls use explicit non-overlapping layers. At widths below 768px, generation/iteration and canvas navigation remain available, but manual drag/create/connect/property editing is disabled with a concise notice; Version 2 does not attempt a touch-optimized diagram editor.

### V1 compatibility and intentional changes

Preserve provider isolation, strict semantic schema, backend graph validation, safe error envelopes, bounded invalid-output retry, safe text rendering, typed frontend API boundaries, Dagre, React Flow, and insights. Intentional changes are an editable canvas in supported modes, movable nodes, editable semantic drafts and edges, full-screen layout, standard flowchart shapes, and the adaptive prompt composer.

## Ordered implementation checkpoints

### V2 Checkpoint 1: Establish editor domain, validation, and state architecture

- Status: COMPLETE
- Purpose: Create the typed semantic-draft/presentation boundary and reducer foundation before changing the UI.
- Dependencies/prerequisites: Clean, passing Version 1 baseline; no V2 checkpoint.
- Files to create: `frontend/src/editor/types.ts`, `frontend/src/editor/ids.ts`, `frontend/src/editor/validation.ts`, `frontend/src/editor/presentation.ts`, `frontend/src/editor/editorReducer.ts`, `frontend/src/editor/EditorContext.tsx`, `frontend/src/test/editor-validation.test.ts`, `frontend/src/test/editor-state.test.ts`.
- Files to modify: `frontend/src/lib/layout.ts` only if a position-only Dagre helper is required; preserve existing exports and tests.
- Implementation instructions: Define `FlowchartShape`, `CanvasNodePresentation`, `CanvasAnnotation`, `EditorSnapshot`, selection/tool unions, async state, and reducer actions. Keep `Workflow` unchanged and coordinate-free. Add default semantic-to-shape mappings, safe ID generation, initial Dagre presentation creation, pure frontend graph issue detection, and a 100-entry snapshot history mechanism with explicit record/skip transactions. Keep viewport and transient UI out of snapshots. Do not add an external state package or editor UI.
- Required tests: Semantic-to-presentation mapping; all V1 graph issue categories; no mutation; ID collision avoidance; recorded versus skipped actions; undo/redo branching; 100-entry cap; semantic data never receives positions/shapes/annotations.
- Validation commands: `npm.cmd run test --prefix frontend -- --run src/test/editor-validation.test.ts src/test/editor-state.test.ts src/test/layout.test.ts`; `npm.cmd run build --prefix frontend`; `git diff --check`.
- Acceptance criteria:
  - [x] Semantic workflow and canvas presentation types are separate and coordinate-free at the API boundary.
  - [x] Draft validation reports safe deterministic issues without blocking temporary graph-invalid states.
  - [x] Reducer history records only editor snapshot transactions and excludes transient state.
  - [x] No dependency, backend, UI behavior, persistence, or V1 contract changes are introduced.
- Commit message: `refactor(frontend): establish editor state architecture`
- Stop conditions: Stop if the design requires coordinates in `Workflow`, a state library, backend changes, or weakening V1 schema validation.

### V2 Checkpoint 2: Build the full-screen editor shell and adaptive composer

- Status: COMPLETE
- Purpose: Replace the document-style page with the full-viewport editor while retaining V1 generation behavior.
- Dependencies/prerequisites: V2 Checkpoint 1 complete.
- Files to create: `frontend/src/components/editor/EditorShell.tsx`, `frontend/src/components/editor/WorkflowPromptComposer.tsx`, `frontend/src/components/editor/WorkflowEditorCanvas.tsx`, `frontend/src/components/editor/EditorHeader.tsx`, `frontend/src/test/editor-shell.test.tsx`.
- Files to modify: `frontend/src/App.tsx`, `frontend/src/components/WorkflowCanvas.tsx`, `frontend/src/editor/EditorContext.tsx`, `frontend/src/index.css`, `frontend/src/test/app.test.tsx`, `frontend/src/test/setup.ts` only for a genuinely required shared browser mock.
- Implementation instructions: Mount `EditorContext`, make a near-black canvas fill the complete `100dvh` viewport without gutters, and preserve typed V1 generation through `generateWorkflow`. With no workflow, show the same dark floating composer centered with the generation placeholder. After success, adopt the semantic workflow, create initial Dagre presentation, keep the canvas visible, and move that composer to a bottom-center iteration position with the edit placeholder; iteration submission remains disabled until the backend capability exists. Use compact floating product/title/New controls rather than a page-width header. Retain dark-styled React Flow navigation and the responsive notice without adding a toolbar, inspector, routing, or manual editing.
- Required tests: Initial centered state; generation request and successful transition; failed generation remains centered; composer reuse rather than duplicate forms; generated canvas remains safe and navigation-only; under-768 manual-editing notice contract.
- Validation commands: `npm.cmd run test --prefix frontend -- --run src/test/editor-shell.test.tsx src/test/app.test.tsx src/test/api-client.test.ts`; `npm.cmd run build --prefix frontend`; `git diff --check`.
- Acceptance criteria:
  - [x] Empty and generated states occupy the full viewport with correct composer positions.
  - [x] Existing generation, loading, error, duplicate prevention, and Clear/New behavior remain safe.
  - [x] Generated semantic data and presentation state enter the editor through one reducer boundary.
  - [x] No AI edit call, manual mutation, persistence, or routing is implemented.
- Commit message: `feat(frontend): add full-screen workflow editor shell`
- Stop conditions: Stop if V1 generation regresses, the composer is duplicated, canvas overlays conflict materially, or the shell requires unrelated navigation.

### V2 Checkpoint 3: Render standard flowchart shapes

- Status: COMPLETE
- Purpose: Replace automation-card nodes with a safe, extensible standard flowchart visual system.
- Dependencies/prerequisites: V2 Checkpoints 1-2 complete.
- Files to create: `frontend/src/components/editor/nodes/FlowchartNode.tsx`, `frontend/src/components/editor/nodes/shapeRegistry.ts`, `frontend/src/components/editor/nodes/shapeGeometry.tsx`, `frontend/src/test/flowchart-nodes.test.tsx`.
- Files to modify: `frontend/src/components/editor/WorkflowEditorCanvas.tsx`, `frontend/src/index.css`, `frontend/src/test/workflow-canvas.test.tsx` as needed to retire V1 card expectations without duplicating coverage.
- Implementation instructions: Implement authored SVG backgrounds with safe HTML text overlays and generous hit areas for terminator, process, decision, input-output, database, document, delay, predefined-process, and manual-operation shapes. Register one React Flow node renderer whose data includes semantic text plus presentation shape. Provide defaults for all ten semantic types while allowing shape override independent of semantic type. Include accessible names, selection styling hooks, and source/target handle locations; do not enable mutation yet or inject generated markup.
- Required tests: Every shape renders; every semantic type has a default shape; semantic type and selected shape can differ; titles/descriptions/applications render as text; handle rules for start/end/regular nodes; unsupported shapes fail safely.
- Validation commands: `npm.cmd run test --prefix frontend -- --run src/test/flowchart-nodes.test.tsx src/test/workflow-canvas.test.tsx src/test/editor-shell.test.tsx`; `npm.cmd run build --prefix frontend`; `git diff --check`.
- Acceptance criteria:
  - [x] All nine required flowchart shapes use authored safe geometry and readable labels.
  - [x] Visual shape is presentation state and never changes semantic type or API data.
  - [x] V1 custom-card appearance is removed from the active editor canvas.
  - [x] Navigation and safe plain-text rendering remain intact.
- Commit message: `feat(frontend): render standard flowchart shapes`
- Stop conditions: Stop if shapes require unsafe SVG/HTML injection, semantic schema changes, or an unnecessary graphics dependency.

### V2 Checkpoint 4: Add selection, node movement, and node inspection

- Status: COMPLETE
- Purpose: Enable controlled selection and editing of existing workflow nodes without coupling React Flow objects to domain state.
- Dependencies/prerequisites: V2 Checkpoints 1-3 complete.
- Files to create: `frontend/src/components/editor/NodeInspector.tsx`, `frontend/src/components/editor/InspectorPanel.tsx`, `frontend/src/test/node-editing.test.tsx`.
- Files to modify: `frontend/src/components/editor/WorkflowEditorCanvas.tsx`, `frontend/src/editor/editorReducer.ts`, `frontend/src/editor/types.ts`, `frontend/src/index.css`.
- Implementation instructions: Enable single-node selection and node dragging only in Select mode and only at widths of at least 768px. Keep smooth drag previews local to the canvas and commit the final position once on drag stop. Show a compact inspector for title, description, application, shape, read-only semantic type, and a reserved delete action completed in Checkpoint 5. Enforce nonblank title/description locally; normalize optional application; commit semantic fields and shape changes as separate undoable transactions. Lock mutation controls during generation/edit requests while leaving pan/zoom usable.
- Required tests: Single selection and clear selection; drag commits presentation only once; semantic workflow receives no coordinates; inspector edits semantic fields; shape edit changes presentation only; invalid blank required fields do not commit; mobile/manual and loading locks.
- Validation commands: `npm.cmd run test --prefix frontend -- --run src/test/node-editing.test.tsx src/test/editor-state.test.ts src/test/flowchart-nodes.test.tsx`; `npm.cmd run build --prefix frontend`; `git diff --check`.
- Acceptance criteria:
  - [x] Existing nodes are selectable and movable only in the intended mode and viewport.
  - [x] Manual positions survive rerenders and semantic field edits.
  - [x] Inspector editing preserves safe text rendering and leaves semantic type fixed.
  - [x] Viewport movement and transient drag frames do not pollute undo history.
- Commit message: `feat(frontend): enable node selection and editing`
- Stop conditions: Stop if dragging mutates semantic data, every pointer move creates history, multi-selection is required, or text-field keys trigger canvas deletion.

### V2 Checkpoint 5: Add node creation, deletion, toolbar, and validation feedback

- Status: COMPLETE
- Purpose: Complete the core node lifecycle and expose it through a compact, mode-aware left toolbar.
- Dependencies/prerequisites: V2 Checkpoints 1-4 complete.
- Files to create: `frontend/src/components/editor/EditorToolbar.tsx`, `frontend/src/components/editor/EditorToolButton.tsx`, `frontend/src/components/editor/ShapeMenu.tsx`, `frontend/src/components/editor/ValidationIndicator.tsx`, `frontend/src/test/node-tools.test.tsx`.
- Files to modify: `frontend/src/components/editor/EditorShell.tsx`, `frontend/src/components/editor/WorkflowEditorCanvas.tsx`, `frontend/src/components/editor/NodeInspector.tsx`, `frontend/src/editor/editorReducer.ts`, `frontend/src/editor/ids.ts`, `frontend/src/index.css`.
- Implementation instructions: Add Select and Add-shape modes plus semantic creation presets for start, end, trigger, action/process, decision/approval, API/input-output, database, notification/document, wait/delay, predefined process, and manual operation. On the next canvas click, create a node with a collision-safe ID, chosen semantic type/shape, title `New step`, description `Describe this step.`, and `application: null`. Permit the resulting disconnected draft and display concise graph issues. Implement node deletion as one transaction that removes incident edges, presentation, and selection; allow an empty draft. Complete the inspector delete action. Toolbar New/close resets only after confirmation when state exists.
- Required tests: Preset-to-semantic/shape mapping; deterministic placement; valid default fields; disconnected issue; node deletion cascade; deleting the last node; toolbar pressed/disabled accessibility; AI-invalid draft disables iteration without blocking manual repair.
- Validation commands: `npm.cmd run test --prefix frontend -- --run src/test/node-tools.test.tsx src/test/node-editing.test.tsx src/test/editor-validation.test.ts src/test/editor-state.test.ts`; `npm.cmd run build --prefix frontend`; `git diff --check`.
- Acceptance criteria:
  - [x] Users can add and delete nodes without introducing schema-invalid field values.
  - [x] Temporarily graph-invalid drafts remain editable and show compact actionable issues.
  - [x] Node deletion cleans semantic edges and presentation records atomically.
  - [x] Toolbar scope remains bounded; no line, styling, group, or multi-select tools appear.
- Commit message: `feat(frontend): add node creation and validation tools`
- Stop conditions: Stop if creation needs backend coordinates, invalid drafts reach the AI endpoint, or deletion leaves dangling references.

### V2 Checkpoint 6: Add editable connections and edge inspection

- Status: COMPLETE
- Purpose: Support controlled edge creation, labelling, selection, and deletion with graph feedback.
- Dependencies/prerequisites: V2 Checkpoints 1-5 complete.
- Files to create: `frontend/src/components/editor/EdgeInspector.tsx`, `frontend/src/components/editor/ConnectionLabelDialog.tsx`, `frontend/src/test/edge-editing.test.tsx`.
- Files to modify: `frontend/src/components/editor/EditorToolbar.tsx`, `frontend/src/components/editor/WorkflowEditorCanvas.tsx`, `frontend/src/components/editor/InspectorPanel.tsx`, `frontend/src/editor/editorReducer.ts`, `frontend/src/editor/validation.ts`, `frontend/src/index.css`.
- Implementation instructions: Add Connect mode and enable handle dragging only in that mode. Reject missing endpoints, duplicate IDs, and self-connections before commit. Request a nonblank label before committing an outgoing decision edge; non-decision labels default to `null` and remain editable. Support single-edge selection, label changes, and deletion through the edge inspector. Blank labels normalize to `null`, allowing the validator to flag an existing decision edge if edited invalid. Every edge action is one history transaction; default React Flow deletion remains disabled outside explicit commands.
- Required tests: Mode-gated connection creation; safe edge ID generation; self-edge rejection; decision label prompt; non-decision optional label; edge selection/label edit/delete; validation issue updates; no dangling endpoints.
- Validation commands: `npm.cmd run test --prefix frontend -- --run src/test/edge-editing.test.tsx src/test/editor-validation.test.ts src/test/editor-state.test.ts src/test/workflow-canvas.test.tsx`; `npm.cmd run build --prefix frontend`; `git diff --check`.
- Acceptance criteria:
  - [x] Users can create, label, select, edit, and delete semantic connections deliberately.
  - [x] Decision-branch requirements are enforced at creation and visible during later draft edits.
  - [x] React Flow cannot mutate edges outside the reducer transaction boundary.
  - [x] No provider, persistence, multi-edge selection, or generic drawing tool is added.
- Commit message: `feat(frontend): add editable workflow connections`
- Stop conditions: Stop if connection creation bypasses semantic state, creates dangling edges, or enables unrestricted React Flow mutation.

### V2 Checkpoint 7: Add annotations, keyboard interactions, and remaining toolbar behavior

- Status: COMPLETE
- Purpose: Finish the bounded manual editor toolset without mixing annotations into workflow semantics.
- Dependencies/prerequisites: V2 Checkpoints 1-6 complete.
- Files to create: `frontend/src/components/editor/nodes/AnnotationNode.tsx`, `frontend/src/components/editor/AnnotationInspector.tsx`, `frontend/src/hooks/useEditorShortcuts.ts`, `frontend/src/test/annotations-shortcuts.test.tsx`.
- Files to modify: `frontend/src/components/editor/EditorToolbar.tsx`, `frontend/src/components/editor/WorkflowEditorCanvas.tsx`, `frontend/src/components/editor/InspectorPanel.tsx`, `frontend/src/editor/editorReducer.ts`, `frontend/src/index.css`.
- Implementation instructions: Add Text mode: the next canvas click creates a presentation-only annotation with a safe ID, `Text` default, and clicked position. Render annotations as a distinct React Flow view-node type, selectable/movable only in Select mode, editable/deletable through its inspector, and absent from semantic workflow/API payloads. Add AI-focus, New/close, and Escape behaviors. Implement Delete/Backspace for selected editable elements and Ctrl/Cmd+Z plus Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y dispatch hooks, but do nothing when an input, textarea, select, or contenteditable element owns focus. Undo/redo buttons may remain disabled until Checkpoint 12 exposes final history controls.
- Required tests: Annotation create/edit/move/delete and API exclusion; Escape selection/tool reset; guarded deletion while typing; shortcut dispatch; New confirmation; toolbar keyboard labels and disabled states.
- Validation commands: `npm.cmd run test --prefix frontend -- --run src/test/annotations-shortcuts.test.tsx src/test/node-tools.test.tsx src/test/edge-editing.test.tsx`; `npm.cmd run build --prefix frontend`; `git diff --check`.
- Acceptance criteria:
  - [x] Annotations remain presentation-only and safely rendered.
  - [x] Core keyboard actions work without intercepting text editing.
  - [x] The toolbar contains only the planned V2 tools and is keyboard accessible.
  - [x] No annotation, selection, viewport, or tool state is sent to the backend.
- Commit message: `feat(frontend): add annotations and editor shortcuts`
- Stop conditions: Stop if annotations become semantic nodes, shortcuts delete while typing, or scope expands to freehand drawing or advanced styling.

### V2 Checkpoint 8: Implement provider-agnostic workflow edit schemas and service

- Status: COMPLETE
- Purpose: Add a safe backend service that revises a validated semantic workflow from a natural-language instruction.
- Dependencies/prerequisites: Version 1 backend contracts remain passing; frontend V2 checkpoints do not block this backend work.
- Files to create: `backend/app/schemas/workflow_edit.py`, `backend/app/prompts/workflow_edit.py`, `backend/app/services/workflow_candidates.py`, `backend/app/services/workflow_edit.py`, `backend/tests/test_workflow_edit_schemas.py`, `backend/tests/test_workflow_edit_service.py`.
- Files to modify: `backend/app/services/workflow_generation.py`, `backend/tests/test_generation_service.py` only as needed to reuse shared candidate parsing/feedback without behavior change.
- Implementation instructions: Define strict `EditWorkflowRequest` (`instruction`, `workflow`) and `EditWorkflowResponse` (`workflow`, `generation`) models; cap and normalize instruction like the generation prompt. Extract reusable candidate JSON/Pydantic/graph validation helpers while preserving generation exports and retry behavior. `WorkflowEditService` validates the current graph before any provider call, depends only on `AIProvider`, sends the current workflow serialized by API aliases plus the instruction, and requests a full revised `Workflow`. The prompt must preserve IDs for retained/modified nodes, allocate unique IDs for additions, omit deletions, return no coordinates/presentation/annotations/HTML/code/secrets, and preserve all required fields. Retry exactly once only for invalid candidate content. Define separate safe input-invalid and revised-output-invalid exceptions; provider errors pass through unchanged and are never retried.
- Required tests: Strict request/response fields; normalized instruction; invalid current graph causes zero provider calls; full-workflow prompt includes current semantics and identity rules; valid revision; malformed/schema-invalid/graph-invalid correction once; second invalid response stops at two calls; provider failures are not retried; no presentation fields or secret leakage.
- Validation commands: `uv run --project backend pytest backend/tests/test_workflow_edit_schemas.py backend/tests/test_workflow_edit_service.py backend/tests/test_generation_service.py`; `uv run --project backend ruff check backend`; `uv run --project backend python -m compileall -q backend/app`; `git diff --check`.
- Acceptance criteria:
  - [x] Editing uses a dedicated service over the existing provider abstraction and returns a full validated workflow.
  - [x] Current and revised workflows both pass strict semantic and graph validation at the correct boundaries.
  - [x] Identity-preservation instructions are explicit, and provider failures remain non-retryable.
  - [x] Existing generation behavior, provider transport, API routes, and frontend remain unchanged.
- Commit message: `feat(backend): add provider-agnostic workflow editing`
- Stop conditions: Stop if patches are required, the service becomes vendor-specific, current invalid input reaches the provider, or retries exceed one correction.

### V2 Checkpoint 9: Expose the workflow edit API and typed frontend client

- Status: COMPLETE
- Purpose: Publish the edit service through a thin safe route and establish the frontend contract without wiring editor UI.
- Dependencies/prerequisites: V2 Checkpoint 8 complete; Version 1 route/client tests passing.
- Files to create: `backend/tests/test_workflow_edit_routes.py`, `frontend/src/test/edit-api-client.test.ts`.
- Files to modify: `backend/app/api/routes/workflows.py`, `backend/app/api/errors.py`, `backend/app/schemas/workflow_edit.py`, `frontend/src/types/workflow.ts`, `frontend/src/api/client.ts`, `backend/tests/test_error_mapping.py`, `frontend/src/test/api-client.test.ts` only when shared helpers move.
- Implementation instructions: Register `POST /api/v1/workflows/edit` with dependency-injected `WorkflowEditService`. Return the revised workflow plus configured model and non-negative duration metadata. Map invalid submitted workflow/instruction to safe 422 responses, invalid revised candidates after correction to controlled 502, and reuse all existing provider handlers. Add typed `editWorkflow({ instruction, workflow })` with the same 30-second abort, safe error mappings, no retry, and strict success-shape validation as generation; refactor shared client parsing only when it reduces duplication. Send exactly semantic fields—never presentation, annotations, selection, viewport, or provider data.
- Required tests: Request validation before service call; valid response metadata; dependency override; each new error mapping; no leakage; exact frontend body and URL; timeout/network/non-JSON/malformed-success behavior; one fetch only; generation route/client regressions.
- Validation commands: `uv run --project backend pytest backend/tests/test_workflow_edit_routes.py backend/tests/test_error_mapping.py backend/tests/test_workflow_routes.py`; `npm.cmd run test --prefix frontend -- --run src/test/edit-api-client.test.ts src/test/api-client.test.ts`; `uv run --project backend ruff check backend`; `npm.cmd run build --prefix frontend`; `git diff --check`.
- Acceptance criteria:
  - [x] The edit endpoint is thin, provider-agnostic, strictly typed, and safely mapped.
  - [x] The frontend client posts only instruction plus the semantic workflow and validates the complete response.
  - [x] Edit failures never expose provider internals or trigger frontend retry.
  - [x] Existing generation and health contracts remain unchanged.
- Commit message: `feat(api): expose workflow editing endpoint`
- Stop conditions: Stop if the route performs prompting/validation/retry itself, presentation leaks into the request, or tests require network credentials.

### V2 Checkpoint 10: Reconcile canvas presentation across semantic revisions

- Status: COMPLETE
- Purpose: Preserve user-owned layout and shape choices when a full revised workflow arrives.
- Dependencies/prerequisites: V2 Checkpoint 1 presentation types and V2 Checkpoint 9 response types complete.
- Files to create: `frontend/src/editor/reconcileWorkflow.ts`, `frontend/src/test/reconcile-workflow.test.ts`.
- Files to modify: `frontend/src/editor/types.ts`, `frontend/src/editor/presentation.ts`.
- Implementation instructions: Implement a pure reconciliation function receiving previous workflow, previous presentation map, revised workflow, and a canvas-center fallback. Retain exact-ID records unchanged; remove records for deleted IDs; place new nodes in revised semantic order after the first retained predecessor, otherwise before the first retained successor, otherwise near the supplied center. Use fixed horizontal/vertical spacing and deterministic downward collision resolution. Assign new nodes their semantic default shape. Return a typed identity-instability result rather than presentation when both workflows contain nodes but share zero IDs. Do not use title/type heuristics, mutate inputs, run full Dagre, or alter annotations.
- Required tests: Unchanged and modified same-ID nodes retain positions/shapes; deletion removes presentation; new predecessor/successor/center placement; multiple-new-node collision avoidance; deterministic output; input immutability; annotations unaffected by caller transaction; zero-overlap identity instability; partial ID churn accepted.
- Validation commands: `npm.cmd run test --prefix frontend -- --run src/test/reconcile-workflow.test.ts src/test/editor-state.test.ts src/test/layout.test.ts`; `npm.cmd run build --prefix frontend`; `git diff --check`.
- Acceptance criteria:
  - [x] Existing manual positions and shape overrides survive ordinary AI revisions.
  - [x] New nodes receive deterministic local positions without moving retained nodes.
  - [x] Removed nodes lose presentation and excessive identity churn is surfaced safely.
  - [x] Reconciliation remains a pure module independent of React components and network code.
- Commit message: `feat(frontend): preserve canvas state across workflow edits`
- Stop conditions: Stop if reconciliation requires coordinates from the backend, heuristic identity remapping, automatic full Dagre, or mutation of previous state.

### V2 Checkpoint 11: Integrate prompt-based AI workflow iteration

- Status: COMPLETE
- Purpose: Turn the generated-state composer into a safe natural-language editor using the new API and reconciliation boundary.
- Dependencies/prerequisites: V2 Checkpoints 9-10 complete; editor shell and reducer complete.
- Files to create: `frontend/src/test/ai-iteration.test.tsx`.
- Files to modify: `frontend/src/App.tsx`, `frontend/src/components/editor/WorkflowPromptComposer.tsx`, `frontend/src/components/editor/EditorShell.tsx`, `frontend/src/components/editor/EditorToolbar.tsx`, `frontend/src/editor/editorReducer.ts`, `frontend/src/api/client.ts` only if integration exposes a contract defect, `frontend/src/index.css`.
- Implementation instructions: In existing-workflow mode, submit the trimmed composer value through `editWorkflow` with only the current semantic draft. Require a nonempty graph-valid draft; otherwise focus validation feedback instead of calling the API. Keep the workflow visible while editing, show an accessible editing status, prevent duplicate requests, and disable all semantic/manual mutation tools while retaining pan/zoom. On success, reconcile presentation, update insights from the revised workflow, clear the instruction, and commit the whole semantic/presentation change as one history transaction. On provider, validation, malformed-response, or identity-instability failure, keep workflow, presentation, annotations, and history unchanged and display one controlled message. Initial generation behavior remains separate.
- Required tests: Exact edit call; bottom composer mode; loading lock with navigation retained; duplicate prevention; successful semantic/insight update; positions and shape overrides preserved; new/deleted nodes reconciled; invalid draft makes zero calls; safe provider failure and identity instability preserve prior editor state; no annotation/presentation leakage.
- Validation commands: `npm.cmd run test --prefix frontend -- --run src/test/ai-iteration.test.tsx src/test/editor-shell.test.tsx src/test/reconcile-workflow.test.ts src/test/edit-api-client.test.ts`; `npm.cmd run build --prefix frontend`; `git diff --check`.
- Acceptance criteria:
  - [x] Natural-language instructions revise the visible workflow through the backend edit contract.
  - [x] Failed edits never destroy or partially replace current editor state.
  - [x] Manual layout and shape choices survive successful edits by stable ID.
  - [x] AI-edit loading behavior is deterministic, accessible, and mutation-safe.
- Commit message: `feat(frontend): add AI workflow iteration`
- Stop conditions: Stop if invalid drafts reach the backend, manual state is cleared on failure, duplicate submissions occur, or provider details enter frontend code.

### V2 Checkpoint 12: Add explicit Auto Arrange and complete undo/redo

- Status: COMPLETE
- Purpose: Give users intentional full-layout control and expose reliable history across all editor transactions.
- Dependencies/prerequisites: V2 Checkpoints 1-11 complete so all recordable action types exist.
- Files to create: `frontend/src/test/history-auto-arrange.test.tsx`.
- Files to modify: `frontend/src/lib/layout.ts`, `frontend/src/editor/presentation.ts`, `frontend/src/editor/editorReducer.ts`, `frontend/src/components/editor/EditorToolbar.tsx`, `frontend/src/hooks/useEditorShortcuts.ts`, `frontend/src/components/editor/WorkflowEditorCanvas.tsx` only if viewport fit integration is required.
- Implementation instructions: Implement Auto Arrange by running Dagre over all current semantic nodes/edges and replacing workflow-node positions only; preserve shape overrides and annotations, then fit view once. Permit structurally safe graph-invalid drafts supported by Dagre and handle empty/single-node drafts deterministically. Expose reducer undo/redo through toolbar and existing shortcuts, with accurate disabled state. Confirm every manual semantic/presentation action, AI edit, and Auto Arrange is one history entry; drag preview, selection, active tool, prompt typing, request state, drawer state, and pan/zoom remain unrecorded. Undo/redo restores snapshot data and clears incompatible current selection.
- Required tests: Auto Arrange overrides manual positions but preserves shapes/annotations/semantics; one undo restores pre-arrange layout; redo reapplies it; each action category round-trips; AI edit is one step; drag is one step; new action clears redo; history cap; empty/single/draft-invalid behavior; viewport is absent from history.
- Validation commands: `npm.cmd run test --prefix frontend -- --run src/test/history-auto-arrange.test.tsx src/test/editor-state.test.ts src/test/layout.test.ts src/test/node-editing.test.tsx src/test/edge-editing.test.tsx src/test/annotations-shortcuts.test.tsx src/test/ai-iteration.test.tsx`; `npm.cmd run build --prefix frontend`; `git diff --check`.
- Acceptance criteria:
  - [x] Auto Arrange is explicit, undoable, and the only post-generation full-layout operation.
  - [x] Undo/redo covers every required editor mutation without recording viewport or transient UI.
  - [x] Toolbar and keyboard history controls remain synchronized and input-focus safe.
  - [x] Manual positions are otherwise preserved across editing and AI iteration.
- Commit message: `feat(frontend): add auto arrange and edit history`
- Stop conditions: Stop if Auto Arrange runs implicitly, annotations/shapes are lost, viewport enters history, or one drag produces many undo steps.

### V2 Checkpoint 13: Add insights drawer, responsive polish, and lean editor coverage

- Status: COMPLETE
- Purpose: Keep the canvas dominant, make insights accessible, and close only genuine cross-feature coverage gaps.
- Dependencies/prerequisites: V2 Checkpoints 1-12 complete.
- Files to create: `frontend/src/components/editor/InsightsDrawer.tsx`, `frontend/src/test/editor-integration.test.tsx` only if existing focused suites do not already cover the full critical flow.
- Files to modify: `frontend/src/components/InsightPanel.tsx`, `frontend/src/components/editor/EditorShell.tsx`, `frontend/src/components/editor/EditorHeader.tsx`, `frontend/src/index.css`, and existing frontend tests only where an audited gap exists.
- Implementation instructions: Move assumptions, missing requirements, and suggestions into a floating/collapsible read-only drawer that does not permanently consume canvas width and preserves category order/empty states. Finalize layer spacing, focus management, status/error announcements, compact labels/tooltips, inspector overflow, and the under-768 navigation/AI-only limitation. Audit all V2 acceptance criteria before adding integration cases; prefer existing pure/component tests and one compact flow covering generation, manual edit, AI iteration, undo, and Auto Arrange. Do not add snapshot-heavy tests, an E2E framework, or unrelated visual features.
- Required tests: Drawer open/close and safe text; canvas remains available; mobile mutation controls disabled while generation/iteration/navigation remain; focus/accessible naming; only audited integration gaps; complete frontend regression suite.
- Validation commands: `npm.cmd run test --prefix frontend -- --run`; `npm.cmd run build --prefix frontend`; `git diff --check`.
- Acceptance criteria:
  - [x] Insights remain accessible and read-only without displacing the primary canvas.
  - [x] Desktop editor layers do not obscure core controls, composer, inspector, or React Flow navigation.
  - [x] Narrow screens clearly expose the intended AI/navigation-only limitation.
  - [x] Lean frontend coverage proves the critical V2 flow without duplicate or unstable tests.
- Commit message: `feat(frontend): polish workflow editor experience`
- Stop conditions: Stop if polish expands into theming/design-system work, insights become editable, or tests depend on live services or third-party DOM internals.

### V2 Generation Correction: Fit core workflows within the Groq token budget

- Status: COMPLETE
- Purpose: Eliminate the observed structured-output truncation path while retaining `openai/gpt-oss-20b` under the account's 8,000 TPM limit.
- Implementation: Remove assumptions, missing requirements, suggestions, and all Insights UI from the backend workflow schema, generation/edit prompts, frontend contract, editor, and tests. Send `max_completion_tokens=6000`, `reasoning_effort=low`, and `include_reasoning=false`; retain strict JSON Schema output and the existing model.
- Required validation: backend schema/generation/edit/provider/route regressions; complete backend and frontend suites; frontend build; Ruff; Python compilation; `git diff --check`.
- Acceptance criteria:
  - [x] Workflow responses contain only title, description, nodes, and edges.
  - [x] No active prompt, schema, type, validator, control, drawer, renderer, or style references the removed insights feature.
  - [x] Groq requests use the current completion-token parameter and low reasoning within the free-plan TPM ceiling.
  - [x] Focused backend tests (95), complete backend tests (128), complete frontend tests (179), build, lint, compilation, and diff checks pass.
- Commit message: `fix(workflow): fit generation within Groq token budget`
- Stop conditions: Stop if the fix requires a model change, exceeds the 8,000 TPM limit, weakens strict workflow validation, or introduces immediate automatic retry within the same rate-limit window.

### V2 Performance Correction: Optimize node dragging

- Status: INCOMPLETE (implementation and automated validation complete; manual browser verification pending)
- Purpose: Remove application-level work from high-frequency node and annotation drag previews while preserving editor history and synchronization.
- Files modified: `frontend/src/components/editor/WorkflowEditorCanvas.tsx`, custom editor node renderers, editor drag styles, and the existing canvas/editing regression suites.
- Implementation: React Flow now owns live movement through `defaultNodes`; editor presentation synchronizes back through the React Flow instance only when editor state changes, and drag stop remains the sole undoable position commit. Custom nodes and static shape geometry are memoized, reusable React Flow options are stable, and active drag temporarily suppresses node shadows with a scoped compositor hint.
- Required validation: focused node/annotation/canvas/history/editor suites; complete frontend suite; frontend production build; `git diff --check`; manual browser drag verification.
- Acceptance criteria:
  - [x] Pointer-move events do not update React component or editor history state.
  - [x] Drag stop records exactly one position transaction and no-op repeats remain history-neutral.
  - [x] External editor changes continue to synchronize workflow nodes and annotations into React Flow.
  - [x] Existing creation, selection, connection, Auto Arrange, undo/redo, async locks, and responsive locks remain covered.
  - [x] Focused regressions (73 tests), complete frontend suite (182 tests), production build, and `git diff --check` pass.
  - [ ] Subjective smoothness is confirmed in a real browser with a representative multi-node workflow.
- Commit message: `perf(frontend): optimize workflow node dragging`
- Stop conditions: Stop if smoothing requires semantic model changes, a new state dependency, many history writes per drag, or removal of resting node visuals.

### V2 Checkpoint 14: Document and perform final Version 2 verification

- Status: INCOMPLETE
- Purpose: Make the completed editor reproducible for developers and verify the bounded Version 2 feature set end to end without live providers.
- Dependencies/prerequisites: V2 Checkpoints 1-13 complete and individually validated.
- Files to create: `docs/architecture/version-2.md`, `docs/specifications/version-2-editor.md`.
- Files to modify: `README.md`, `frontend/README.md`, `backend/README.md`, `docs/architecture/version-1.md` and `docs/specifications/version-1-workflow.md` only for clearly labelled supersession links, `context.md`, `implementation-plan.md`, `.codex/commit-message.txt`.
- Implementation instructions: Document setup, full-screen modes, semantic-versus-presentation architecture, draft validation, manual tools, shape mappings, AI edit API/full-workflow strategy, identity/layout preservation, Auto Arrange, history, the core-only workflow contract, annotations, responsive limitations, safe errors/security, in-memory behavior, and explicit exclusions. Document the 6,000-token/low-reasoning Groq configuration and the removal of insights. Do not imply persistence, collaboration, execution, or production deployment. Audit dependencies and commands against manifests, run locked installs and all tests/build/lint/compile checks once, verify ignored secrets/environments and tracked locks, and perform no real provider request. Mark Version 2 complete only after validation.
- Required tests: No new tests unless final verification exposes a real uncovered defect; rely on the completed focused suites and mocked boundaries.
- Validation commands: `npm.cmd ci --prefix frontend`; `npm.cmd run test --prefix frontend -- --run`; `npm.cmd run build --prefix frontend`; `uv sync --project backend --locked`; `uv run --project backend pytest`; `uv run --project backend ruff check backend`; `uv run --project backend python -m compileall -q backend/app`; `git -c safe.directory=D:/AI-Workflow-Builder diff --check`; `git -c safe.directory=D:/AI-Workflow-Builder check-ignore backend/.env frontend/.env .codex/commit-message.txt frontend/node_modules backend/.venv`; `git -c safe.directory=D:/AI-Workflow-Builder status --short`.
- Acceptance criteria:
  - [ ] Version 2 documentation matches implemented editor behavior and API contracts.
  - [ ] Locked frontend/backend setup, all automated tests, frontend build, Ruff, and compilation pass without a real provider key or request.
  - [ ] Semantic/presentation separation, stable-ID reconciliation, explicit Auto Arrange, history, safe rendering, and V1 regressions are verified.
  - [ ] Lock files remain tracked; secrets/generated environments remain ignored; excluded architecture remains absent.
  - [ ] `context.md` and this plan record Version 2 complete only after all checks pass.
- Commit message: `docs(repo): document and verify version two`
- Stop conditions: Stop if verification needs a live provider, exposes a secret, finds an unresolved editor/data-loss defect, or requires an excluded capability.

## Final Version 2 validation

After all checkpoint commits, verify from a clean worktree:

1. Install exactly from `frontend/package-lock.json` and `backend/uv.lock`.
2. Run the complete frontend and backend suites, frontend production build, Ruff, and Python compilation.
3. Confirm initial generation, centered-to-bottom composer transition, manual node/edge/annotation editing, draft issues, AI iteration, layout reconciliation, Auto Arrange, undo/redo, the absence of insights, and responsive limitations through automated mocked coverage.
4. Confirm the semantic API payload contains no coordinates, shapes, annotations, selection, viewport, history, or provider details.
5. Confirm an AI edit failure or identity-instability response preserves the current editor snapshot.
6. Confirm no authentication, persistence, collaboration, execution, export, Docker, deployment, or CI artifacts were introduced.
7. Verify tracked locks and ignored secrets/environments, then run `git diff --check` and inspect `git status --short`.

An optional manual provider smoke test may be documented but is not required for completion and must never be automated with a real credential.

## Risks

- Draft-state rules duplicated in TypeScript and Python can drift. Keep the frontend issue codes aligned with backend tests and treat backend validation as authoritative at the API boundary.
- React Flow controlled dragging can create excessive renders or history entries. Keep drag previews local and commit only on drag stop.
- Authored SVG shapes can produce poor hit areas or label overflow. Use common wrappers, fixed tested dimensions, and safe text constraints rather than per-shape interaction logic.
- AI providers may ignore stable-ID instructions. Exact-ID reconciliation plus zero-overlap rejection prevents silent wholesale layout loss, but partial ID churn may still place changed IDs as new nodes.
- Local new-node placement can overlap dense manual diagrams. Deterministic collision stepping and explicit Auto Arrange provide a bounded V2 solution; localized graph layout remains future work.
- Allowing graph-invalid drafts can confuse users. Keep structural data safe, show concise issues immediately, and disable AI iteration until valid.
- Context/reducer updates can rerender a large editor. Split read/dispatch contexts and keep high-frequency previews inside the canvas before considering a state dependency.

## Escalation conditions

Escalate before implementation if React Flow cannot support safe authored shapes and mode-gated handles without a new rendering architecture; if stable-ID preservation cannot be made safe without changing the semantic schema; if the edit provider cannot return the full strict workflow contract; if draft validation conflicts materially with backend graph rules; if a required dependency introduces an incompatible license or lockfile change; if automated validation requires a live key/network; or if the requested work expands into persistence, collaboration, execution, export, deployment, or another excluded feature.

## Plan completion and cleanup

Each implementer completes only the first incomplete checkpoint, runs its required validation, updates `context.md`, marks that checkpoint complete, and prepares the checkpoint commit message without committing unless authorized. After Checkpoint 14 passes, run final validation, record Version 2 complete, commit when authorized, and then reset or archive this disposable plan according to the permanent project instructions. Do not start Version 3 work from this plan.
