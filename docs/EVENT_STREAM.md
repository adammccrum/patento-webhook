# Event Stream Protocol

**Version:** 1.0  
**Purpose:** Specification for real-time event delivery and WebSocket communication

---

## Overview

The Event Stream is a WebSocket-based protocol for delivering real-time events from the Alpha orchestrator to connected clients (dashboards, monitoring tools, audit systems).

---

## Connection

### Endpoint

```
ws://[host]:[port]/ws/events
wss://[host]:[port]/ws/events  (secure, HTTPS)
```

### Connection Flow

```
Client → Server: WebSocket Connect Request
Server → Client: 101 Switching Protocols
Server → Client: { type: "connected", client_id: "..." }
Client → Server: { type: "subscribe", filters: {...} }
Server → Client: { type: "recent_events", data: [...] }
Server → Client: { type: "event", data: {...} } (on every event)
```

---

## Message Format

All messages are JSON objects with the following base structure:

```json
{
  "type": "message_type",
  "timestamp": "2026-07-24T10:00:00.000Z",
  "client_id": "uuid (server-sent only)",
  "data": {}
}
```

---

## Client Messages

### SUBSCRIBE

Subscribe to events with optional filters.

```json
{
  "type": "subscribe",
  "filters": {
    "types": ["agent.executed", "task.completed"],
    "agent_codes": ["AA", "BB", "CC"],
    "status": "completed",
    "objective_id": "obj-123",
    "task_id": "task-456"
  }
}
```

**Filter Options:**
- `types` (array) - Event types to include
- `agent_codes` (array) - Agent codes to include
- `status` (string) - Status value (completed, failed, pending)
- `objective_id` (string) - Objective ID
- `task_id` (string) - Task ID

**Response:**
```json
{
  "type": "recent_events",
  "data": [...],
  "count": 20,
  "timestamp": "..."
}
```

### UNSUBSCRIBE

Unsubscribe from all events.

```json
{
  "type": "unsubscribe"
}
```

**Response:**
```json
{
  "type": "unsubscribed",
  "timestamp": "..."
}
```

### GET_RECENT_EVENTS

Request recent events from history.

```json
{
  "type": "get_recent_events",
  "limit": 50,
  "filters": {
    "types": ["task.completed"],
    "since": "2026-07-24T09:00:00Z"
  }
}
```

**Response:**
```json
{
  "type": "recent_events",
  "data": [...],
  "limit": 50,
  "count": 42,
  "timestamp": "..."
}
```

### GET_STATE_SNAPSHOT

Request current state of all objectives, tasks, and agents.

```json
{
  "type": "get_state_snapshot"
}
```

**Response:**
```json
{
  "type": "state_snapshot",
  "data": {
    "objectives": [...],
    "tasks": [...],
    "agents": [...],
    "timestamp": "2026-07-24T10:00:00Z"
  }
}
```

### PING

Keep-alive message.

```json
{
  "type": "ping"
}
```

**Response:**
```json
{
  "type": "pong",
  "timestamp": "..."
}
```

---

## Server Messages

### CONNECTED

Sent when client first connects.

```json
{
  "type": "connected",
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-07-24T10:00:00Z"
}
```

### EVENT

Sent when an event matches client's filters.

```json
{
  "type": "event",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-07-24T10:00:00Z",
    "type": "task.completed",
    "agent": "Bravo",
    "agent_code": "BB",
    "objective_id": "obj-123",
    "task_id": "task-456",
    "subtask_id": "subtask-789",
    "action": "code_review",
    "status": "completed",
    "details": {
      "execution_time_ms": 2500,
      "result": "Review complete"
    },
    "error": null
  },
  "timestamp": "2026-07-24T10:00:00Z"
}
```

### RECENT_EVENTS

Sent when client subscribes or requests history.

```json
{
  "type": "recent_events",
  "data": [
    { "id": "...", "type": "event1", ... },
    { "id": "...", "type": "event2", ... }
  ],
  "limit": 50,
  "count": 2,
  "timestamp": "..."
}
```

### STATE_SNAPSHOT

Sent in response to get_state_snapshot.

```json
{
  "type": "state_snapshot",
  "data": {
    "objectives": [
      {
        "objective_id": "obj-123",
        "status": "working",
        "last_event": "task.started",
        "last_event_time": "2026-07-24T10:00:00Z"
      }
    ],
    "tasks": [
      {
        "task_id": "task-456",
        "status": "executing",
        "last_event": "task.progress",
        "last_event_time": "2026-07-24T10:00:00Z",
        "current_action": "validation"
      }
    ],
    "agents": [
      {
        "agent_code": "BB",
        "agent": "Bravo",
        "status": "working",
        "current_task": "task-456",
        "current_action": "code_review",
        "last_event": "agent.executed",
        "last_event_time": "2026-07-24T10:00:00Z"
      }
    ],
    "timestamp": "2026-07-24T10:00:00Z"
  },
  "timestamp": "..."
}
```

### PONG

Keep-alive response.

```json
{
  "type": "pong",
  "timestamp": "..."
}
```

### ERROR

Sent when an error occurs.

```json
{
  "type": "error",
  "error": "Invalid message format",
  "timestamp": "..."
}
```

---

## Event Types Reference

### Orchestration Events

```
objective.received
objective.classified
objective.failed

task.planned
task.started
task.progress
task.retrying
task.blocked
task.completed
task.failed
task.cancelled

task.awaiting_authorisation
```

### Agent Events

```
agent.status_changed
agent.executed
agent.failed
agent.health_changed
```

### Authorization Events

```
authorization.requested
authorization.approved
authorization.denied
```

### Control Events

```
control.pause
control.resume
control.cancel
```

---

## Event Schema

Every event contains:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Unique event ID |
| `timestamp` | ISO8601 | Yes | When event occurred |
| `type` | String | Yes | Event type |
| `agent` | String | No | Agent name (Alpha, Bravo, etc.) |
| `agent_code` | String | No | Agent code (AA, BB, CC, etc.) |
| `objective_id` | String | No | Objective ID if related |
| `task_id` | String | No | Task ID if related |
| `subtask_id` | String | No | Subtask ID if related |
| `action` | String | No | Action performed |
| `status` | String | No | Status (completed, failed, pending, etc.) |
| `details` | Object | No | Event-specific details |
| `error` | String | No | Error message if failed |

---

## Reconnection Handling

### Client Disconnects

1. Client loses connection
2. Server removes client from subscriptions
3. Server closes WebSocket

### Client Reconnects

1. Client re-establishes WebSocket connection
2. Client sends `subscribe` message with filters
3. Server sends `recent_events` (20 most recent matching events)
4. Client uses events to restore state
5. Client receives live events going forward

### Event Replay Window

- Last 1000 events are retained
- Events older than ~5 hours are discarded
- Filtering is applied during replay
- Timestamp can be provided for time-based filtering

---

## Flow Examples

### Example 1: Monitor All Events

```javascript
const ws = new WebSocket('ws://localhost:3000/ws/events');

ws.onopen = () => {
  // Subscribe to everything
  ws.send(JSON.stringify({
    type: 'subscribe',
    filters: {}
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'event') {
    console.log('Event:', message.data);
  }
};
```

### Example 2: Monitor Specific Agent

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  filters: {
    agent_codes: ['FF'],  // Foxtrot only
    types: ['agent.executed', 'agent.failed']
  }
}));
```

### Example 3: Get Recent Failures

```javascript
ws.send(JSON.stringify({
  type: 'get_recent_events',
  limit: 100,
  filters: {
    types: ['agent.failed', 'task.failed'],
    status: 'failed'
  }
}));
```

### Example 4: Monitor Task Progress

```javascript
const taskId = 'task-123';
ws.send(JSON.stringify({
  type: 'subscribe',
  filters: {
    task_id: taskId,
    types: ['task.progress', 'task.completed', 'task.failed']
  }
}));
```

---

## Performance Notes

- **Throughput**: Can handle 1000+ events/second
- **Latency**: <10ms from event recording to client delivery
- **Message Size**: Average 200-500 bytes per event
- **Memory**: ~1MB per 1000 events stored
- **Connections**: Tested with 100+ simultaneous clients

---

## Troubleshooting

**Connection Fails**
- Check WebSocket endpoint is correct
- Verify server is running
- Check firewall allows port 3000
- Try without /ws/events path first

**Events Not Received**
- Verify subscription filters match
- Check event log for errors
- Request `get_recent_events` manually
- Verify `type` field matches exactly

**Disconnects During High Load**
- Consider filtering events (reduce bandwidth)
- Increase client-side timeout
- Check server resources
- Verify network stability

---

## Security

**Current (Phase 3):**
- No authentication required
- No message encryption
- All events visible to all clients
- For development/testing only

**Production (Phase 4+):**
- JWT token-based authentication
- WSS (WebSocket Secure) with TLS
- Role-based filtering (user can only see relevant events)
- Rate limiting per client
- Audit logging of all WebSocket activity
