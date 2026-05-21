# AG-UI: How the Frontend and Backend Communicate

## The Core Idea

When a user sends a message to Grad Paddy, the frontend does **not** wait for a single JSON response. Instead it opens a streaming HTTP connection and receives a live sequence of typed events — one for every meaningful thing the agent does: starting, calling a tool, writing text word-by-word, finishing. This is the AG-UI protocol.

Think of it like watching a terminal. Instead of "here is the final answer", the backend narrates everything in real time: "I am starting… I am calling Google Search… here is the first word… here is the next word… I am done."

---

## Two Sides of AG-UI

### Frontend — `@ag-ui/client`

The frontend uses `HttpAgent` from `@ag-ui/client`. This class knows how to:
- Format and POST a `RunAgentInput` payload to the backend
- Parse the incoming SSE (Server-Sent Events) stream
- Expose the event stream as an **RxJS Observable** so the UI can `.subscribe()` to it

File: `frontend/lib/ag-ui.ts`

```ts
export async function createChatAgent(messages, threadId) {
  const token = await auth.currentUser.getIdToken();
  return new HttpAgent({
    url: `${BASE}/chat`,                        // → POST to backend /chat
    headers: { Authorization: `Bearer ${token}` },
    threadId,                                   // session ID — same UUID throughout
    initialMessages: messages,                  // full conversation history
    initialState: {},
  });
}
```

### Backend — `ag_ui_adk`

The backend uses `ADKAgent` from `ag_ui_adk`. This is a bridge layer that:
- Receives the `RunAgentInput` from `HttpAgent`
- Feeds the messages into Google ADK's `Runner`
- Translates every ADK event into an AG-UI typed event
- Streams those events back to the frontend as SSE

File: `backend/src/api/chat.py`

```python
add_adk_fastapi_endpoint(router, build_chat_agent(), path="/chat")
```

This single line registers the entire streaming endpoint. Under the hood it:
1. Accepts `POST /api/chat`
2. Verifies the Firebase token
3. Starts the ADK agent run
4. Streams AG-UI events back until the run finishes

---

## A Complete Example: "Find me NLP professors at MIT"

Here is exactly what happens, step by step, when a user types that message and presses send.

---

### Step 1 — User presses send

`frontend/app/chat/page.tsx → send()`

```ts
function send() {
  const text = input.trim();
  const id = crypto.randomUUID();
  setStream(p => [...p, { type: "user", id, content: text, timestamp: new Date() }]);
  setInput("");
  sendToBackend(text, id);
}
```

The message bubble appears immediately in the UI. No waiting.

---

### Step 2 — Session is created (first message only)

`frontend/app/chat/page.tsx → sendToBackend()`

Because this is the first message of a new chat, `activeSessionId` is null. The frontend first calls the sessions REST API:

```
POST /api/sessions/
Body: { "first_message": "Find me NLP professors at MIT" }
Authorization: Bearer <firebase-token>
```

The backend creates a Firestore document:
```
users/{userId}/sessions/{uuid7}  →  { id, title: "Find me NLP professors at MIT", created_at, updated_at }
```

The session ID (a UUID7) is returned. From this point on, `threadId` is set to that session ID. It appears in the sidebar.

---

### Step 3 — AG-UI stream opens

```ts
const agent = await createChatAgent(agMessages.current, threadId.current);

agent.run({
  messages: agMessages.current,  // [{ id, role: "user", content: "Find me NLP professors at MIT" }]
  threadId: threadId.current,    // the session UUID from step 2
  runId: crypto.randomUUID(),    // unique ID for this specific run
  tools: [],
  context: [],
  state: {},
  forwardedProps: {},
}).subscribe({
  next: (event) => handleEvent(event, phaseId),
  complete: () => { setLocalRunning(false); checkHITL(); },
});
```

This sends:
```
POST /api/chat
Authorization: Bearer <firebase-token>
Content-Type: application/json

{
  "messages": [{ "id": "...", "role": "user", "content": "Find me NLP professors at MIT" }],
  "threadId": "0194f3a2-...",
  "runId": "7c8b1d4e-...",
  "tools": [],
  "context": [],
  "state": {},
  "forwardedProps": {}
}
```

The connection stays open. The backend starts streaming.

---

### Step 4 — Backend runs the agent

`backend/src/api/chat.py → ADKAgent → Google ADK Runner → root_agent`

The `ADKAgent` puts the user message into the ADK session and calls `Runner.run_async()`. The `root_agent` (Gemini 3.1 Pro) reads the message and decides what to do.

Its instruction says:
> "When the user's intent is clear, call the planner agent. Call the research agent when you need to verify or provide options."

It decides to delegate to both `planner` and `researcher`.

---

### Step 5 — Events stream back, one by one

The backend sends each event as a line in the SSE stream. Here is the actual sequence for this query:

```
event: RUN_STARTED
data: { "type": "RUN_STARTED", "runId": "7c8b1d4e-..." }

event: STEP_STARTED
data: { "type": "STEP_STARTED", "stepName": "planner" }

event: TOOL_CALL_START
data: { "type": "TOOL_CALL_START", "toolCallId": "tc-001", "toolCallName": "google_search" }

event: TOOL_CALL_END
data: { "type": "TOOL_CALL_END", "toolCallId": "tc-001" }

event: TOOL_CALL_START
data: { "type": "TOOL_CALL_START", "toolCallId": "tc-002", "toolCallName": "url_context" }

event: TOOL_CALL_END
data: { "type": "TOOL_CALL_END", "toolCallId": "tc-002" }

event: STEP_FINISHED
data: { "type": "STEP_FINISHED", "stepName": "planner" }

event: STEP_STARTED
data: { "type": "STEP_STARTED", "stepName": "researcher" }

event: TOOL_CALL_START
data: { "type": "TOOL_CALL_START", "toolCallId": "tc-003", "toolCallName": "google_search" }

event: TOOL_CALL_END
data: { "type": "TOOL_CALL_END", "toolCallId": "tc-003" }

event: STEP_FINISHED
data: { "type": "STEP_FINISHED", "stepName": "researcher" }

event: TEXT_MESSAGE_START
data: { "type": "TEXT_MESSAGE_START", "messageId": "msg-abc" }

event: TEXT_MESSAGE_CONTENT
data: { "type": "TEXT_MESSAGE_CONTENT", "messageId": "msg-abc", "delta": "Here" }

event: TEXT_MESSAGE_CONTENT
data: { "type": "TEXT_MESSAGE_CONTENT", "messageId": "msg-abc", "delta": " are" }

event: TEXT_MESSAGE_CONTENT
data: { "type": "TEXT_MESSAGE_CONTENT", "messageId": "msg-abc", "delta": " some NLP" }

... (more deltas) ...

event: TEXT_MESSAGE_END
data: { "type": "TEXT_MESSAGE_END", "messageId": "msg-abc" }

event: RUN_FINISHED
data: { "type": "RUN_FINISHED", "runId": "7c8b1d4e-..." }
```

---

### Step 6 — Frontend reacts to each event

`frontend/app/chat/page.tsx → handleEvent()`

Every event immediately updates the UI:

| Event received | What the UI does |
|---|---|
| `RUN_STARTED` | Shows a collapsible "Agent · Processing" card (orange header) |
| `STEP_STARTED` (planner) | Adds a sub-phase row inside the card: "planner — running" |
| `TOOL_CALL_START` (google_search) | Adds a step row: 🔍 "google search — In progress" |
| `TOOL_CALL_END` | Marks step row as ✅ Done |
| `STEP_FINISHED` | Marks planner row as Done |
| `STEP_STARTED` (researcher) | New sub-phase row: "researcher — running" |
| `TEXT_MESSAGE_START` | Creates empty agent bubble in the chat |
| `TEXT_MESSAGE_CONTENT` x N | Appends each `delta` to the bubble. Text streams in word by word |
| `TEXT_MESSAGE_END` | Saves the complete message to `agMessages` ref |
| `RUN_FINISHED` | Collapses the agent card to Done, unblocks input |

---

### Step 7 — HITL check

After `RUN_FINISHED`, the frontend automatically calls:

```
GET /api/hitl/sessions/{sessionId}/pending
```

If the agent left a pending action that needs user approval (e.g., "Add this professor to your shortlist?"), the response contains a HITL record and an approval card appears in the chat. The input is blocked until the user clicks Approve or Reject.

If approved:
```
POST /api/hitl/{hitlId}/resolve
Body: { "approved": true }
```

---

### Step 8 — Next message in the same session

When the user sends a second message, the flow skips session creation (step 2) and goes straight to step 3. The `messages` array now contains **both** the user message AND the assistant reply from the previous turn, so the agent has full context.

If the user leaves and comes back, the frontend calls:
```
GET /api/sessions/{sessionId}/messages
```
and rebuilds `agMessages` from those stored records before starting a new agent run.

---

## Why Messages Are Always Sent in Full

The ADK `InMemorySessionService` keeps session state only in RAM. When the Cloud Run container restarts, that state is gone. The frontend's `agMessages` ref (rebuilt from Firestore on session load) is the authoritative conversation history. Sending the full `messages` array on every run means the agent always has context, regardless of backend restarts.

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND                                                       │
│                                                                 │
│  ChatPage                                                       │
│    ├── send()                                                   │
│    ├── sendToBackend()                                          │
│    │     ├── POST /api/sessions/  (first message only)         │
│    │     ├── createChatAgent()  →  HttpAgent                   │
│    │     └── agent.run().subscribe(handleEvent)                │
│    └── handleEvent()                                           │
│          ├── RUN_STARTED      → add phase card                 │
│          ├── STEP_STARTED     → add sub-phase row              │
│          ├── TOOL_CALL_START  → add step row (running)         │
│          ├── TOOL_CALL_END    → mark step done                 │
│          ├── STEP_FINISHED    → mark sub-phase done            │
│          ├── TEXT_MESSAGE_*   → stream text into bubble        │
│          └── RUN_FINISHED     → mark phase done, checkHITL()  │
└─────────────────┬───────────────────────────────────────────────┘
                  │  POST /api/chat  (SSE stream)
                  │  Authorization: Bearer <firebase-token>
┌─────────────────▼───────────────────────────────────────────────┐
│  BACKEND                                                        │
│                                                                 │
│  FastAPI /chat  (add_adk_fastapi_endpoint)                      │
│    ├── verify Firebase token                                    │
│    ├── ADKAgent.run(RunAgentInput)                              │
│    │     └── ADK Runner → root_agent (Gemini 3.1 Pro)          │
│    │           ├── planner (Gemini 2.5 Flash)                  │
│    │           │     ├── google_search_agent                   │
│    │           │     └── url_context_agent                     │
│    │           └── researcher (Gemini 2.5 Flash)               │
│    │                 ├── google_search_agent                   │
│    │                 └── url_context_agent                     │
│    └── translate ADK events → AG-UI events → SSE stream        │
│                                                                 │
│  Firestore (separate, via REST API)                             │
│    ├── users/{uid}/sessions/{sessionId}                        │
│    ├── users/{uid}/sessions/{sessionId}/messages               │
│    └── users/{uid}/hitl/{hitlId}                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

| File | Role |
|---|---|
| `frontend/lib/ag-ui.ts` | Creates `HttpAgent`, exports AG-UI types |
| `frontend/lib/api.ts` | REST calls: sessions, HITL, users, shortlist, tracker, drafts |
| `frontend/app/chat/page.tsx` | `sendToBackend()`, `handleEvent()`, all UI state |
| `backend/src/api/chat.py` | Registers `/chat` SSE endpoint via `add_adk_fastapi_endpoint` |
| `backend/src/agents/root.py` | Multi-agent tree: root → planner, researcher, search/url agents |
| `backend/src/api/sessions.py` | REST CRUD for sessions and messages |
| `backend/src/api/hitl.py` | REST endpoints for HITL pending check and resolve |
