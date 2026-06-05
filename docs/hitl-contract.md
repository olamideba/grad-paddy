# Human-in-the-Loop (HITL) Contract

This document defines the contract between the frontend and backend for
interrupt-style human-in-the-loop: the agent can pause mid-run, ask the human a
question, and resume the same turn once the human answers.

It fits the existing transport — AG-UI events over the streaming `agent.run()`
subscription, plus a REST side-channel for durable HITL state.

## 1. Run lifecycle

A run is a state machine. The new state is **interrupted** — a run can pause
awaiting a human instead of only completing or erroring.

```
running ──emit HITL_REQUIRED──▶ interrupted (awaiting_human)
   ▲                                   │
   │                              user resolves
   │                                   │
   └────────── resume (run #2) ◀───────┘

interrupted ──resume──▶ running ──▶ completed | error
```

The frontend must distinguish a pause from a completion and keep the gate open
until the human responds.

## 2. Stream events (forward channel, AG-UI)

The backend emits a dedicated event immediately before suspending, then closes
the run with an interrupted status.

### HITL_REQUIRED — the pause signal

```json
{
  "type": "HITL_REQUIRED",
  "hitlId": "string",
  "sessionId": "string",
  "runId": "string",
  "kind": "approval" | "choice" | "input",
  "title": "string",
  "description": "string",
  "payload": {},
  "options": [{ "id": "string", "label": "string" }],
  "schema": {},
  "expiresAt": "ISO 8601"
}
```

### RUN_FINISHED — carries a status

```json
{
  "type": "RUN_FINISHED",
  "runId": "string",
  "status": "completed" | "interrupted" | "error"
}
```

**Frontend behavior:**

- On `HITL_REQUIRED`: render the gate for `hitlId`, block message input.
- On `RUN_FINISHED { status: "interrupted" }`: keep the gate; do not mark the turn done.
- On `RUN_FINISHED { status: "completed" | "error" }`: normal end-of-turn.

## 3. The HITL object (REST + restore)

```ts
interface HITLItem {
  id: string;
  session_id: string;
  run_id: string;
  kind: "approval" | "choice" | "input";
  title: string;
  description: string;
  payload: Record<string, unknown>;
  options?: { id: string; label: string }[];
  schema?: JSONSchema;
  status: "pending" | "approved" | "rejected" | "resolved" | "expired";
  response: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
  expires_at: string | null;
}
```

## 4. REST endpoints

```
GET  /api/hitl/sessions/{sessionId}/pending  →  HITLItem | null
POST /api/hitl/{hitlId}/resolve
     body: { decision: "approved" | "rejected", response?: Record<string, unknown> }
     →  HITLItem
```

Resolve is idempotent: resolving an already-resolved `hitlId` returns the
existing record. It never re-executes.

## 5. Resume — continue the same turn

Resolve only records the decision. To continue the agent's turn, the frontend
re-invokes `run()` with the same `threadId`, a new `runId`, unchanged message
history, and a resume marker in `forwardedProps`:

```ts
agent.run({
  threadId,
  runId: "<new uuid>",
  messages: "<unchanged history>",
  forwardedProps: {
    resume: { hitlId, decision, response }
  },
  tools: [], context: [], state: {},
});
```

**Backend behavior when `forwardedProps.resume` is present:**

- Rehydrate the suspended agent state correlated by `hitlId` / `threadId`.
- Continue the same turn — stream `RUN_STARTED` → further tool/text events →
  `RUN_FINISHED { status: "completed" }`, or another `HITL_REQUIRED` if it needs to ask again.
- Do not start a fresh turn.

Resume is idempotent per `hitlId`: a duplicate resume for an already-continued
HITL no-ops.

## 6. HITL kinds

| kind | UI control | resolve body |
|------|------------|--------------|
| approval | Approve / Reject buttons | `{ decision: "approved" }` or `{ decision: "rejected" }` |
| choice | Pick one of options | `{ decision: "approved", response: { optionId } }` |
| input | Form rendered from schema | `{ decision: "approved", response: { ...fields } }` |

## 7. Invariants

- One pending HITL per session at a time.
- `hitlId` is the single correlation key across stream, resolve, resume, and restore.
- Restore on reload via `GET /api/hitl/sessions/{sessionId}/pending`.
- No optimistic resolution — gate flips only after resolve returns 200.
- Expiry — when `expires_at` passes, backend marks expired; frontend unblocks input.
- Input gating — while HITL is pending, new user messages are blocked or queued.

## 8. Implementation notes (Grad Paddy)

- **Suspension**: `request_hitl` is a `LongRunningFunctionTool`. The ADK session
  pauses at the tool-call checkpoint keyed by `threadId`. The HITL Firestore
  record stores `tool_call_id` for resume correlation.
- **Resume**: `PersistentChatAgent` reads `forwardedProps.resume`, injects a
  `ToolMessage` with the human decision, and delegates to `ag_ui_adk` HITL resume.
- **Agent tool**: `request_hitl` — use from `governance_agent` or `operations_agent`
  before irreversible writes.
