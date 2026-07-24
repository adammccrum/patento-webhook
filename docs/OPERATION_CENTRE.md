# Operation Centre - Real-Time Dashboard

**Version:** 1.0  
**Status:** Phase 3 Implementation  
**Purpose:** Provide live observability and control for the multi-agent orchestration system

---

## Overview

The Operation Centre is a real-time web dashboard that displays:

- **Central Orchestrator** - Alpha (AA) as the executive coordinator
- **All 26 NATO Agents** - With live status, current tasks, and health indicators
- **Task Execution** - Dependency graphs and execution flow
- **Event Feed** - Real-time stream of all system events
- **Authorization Requests** - Approval interface for high-impact actions
- **System Health** - Operational status of all services
- **User Controls** - Pause, resume, and cancel objectives

---

## Architecture

### Backend Components

**1. Event Aggregator** (`src/operation-centre/event-aggregator.js`)
- Collects events from Alpha orchestrator
- Maintains event history (last 1000 events)
- Tracks current state of objectives, tasks, and agents
- Supports event filtering and replay

**2. Event Stream** (`src/operation-centre/event-stream.js`)
- WebSocket server for real-time client connections
- Handles subscriptions with optional filters
- Supports event replay on client reconnection
- Broadcasts state snapshots

**3. Operation Centre** (`src/operation-centre/operation-centre.js`)
- Main service coordinating all dashboard features
- Manages authorization requests and approvals
- Handles control actions (pause, resume, cancel)
- Provides dashboard state snapshots

### Frontend Components

**Dashboard** (`public/index.html`)
- Single-page application
- Tab-based navigation (Overview, Agents, Tasks, Events, Authorizations, Health)
- Responsive design for desktop and tablet

**JavaScript Client** (`public/js/app.js`)
- WebSocket connection management
- Event subscription and filtering
- Real-time UI updates
- Reconnection with event replay

**Styling** (`public/css/style.css`)
- Professional, operational design
- No excessive animation or decoration
- Clear status indicators and badges
- Responsive grid layouts

### API Routes

All dashboard endpoints are prefixed with `/api/dashboard`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Complete dashboard state |
| `/agents` | GET | All agents with status |
| `/agents/:code` | GET | Specific agent details |
| `/objectives` | GET | Current objectives |
| `/tasks` | GET | Current tasks |
| `/events` | GET | Recent events (filterable) |
| `/authorizations` | GET | Pending authorizations |
| `/authorizations/:id/approve` | POST | Approve authorization |
| `/authorizations/:id/deny` | POST | Deny authorization |
| `/objectives/:id/pause` | POST | Pause objective |
| `/objectives/:id/resume` | POST | Resume objective |
| `/objectives/:id/cancel` | POST | Cancel objective |
| `/health` | GET | System health status |
| `/connections` | GET | WebSocket connection info |

---

## WebSocket Protocol

**Connection URL:** `ws://localhost:3000/ws/events`

### Client → Server Messages

**Subscribe to Events**
```json
{
  "type": "subscribe",
  "filters": {
    "types": ["agent.executed", "task.completed"],
    "agent_codes": ["CC", "DD"],
    "status": "completed"
  }
}
```

**Unsubscribe**
```json
{
  "type": "unsubscribe"
}
```

**Get Recent Events**
```json
{
  "type": "get_recent_events",
  "limit": 50,
  "filters": { "types": ["objective.received"] }
}
```

**Get State Snapshot**
```json
{
  "type": "get_state_snapshot"
}
```

**Keep-Alive Ping**
```json
{
  "type": "ping"
}
```

### Server → Client Messages

**Connected**
```json
{
  "type": "connected",
  "client_id": "uuid",
  "timestamp": "2026-07-24T10:00:00Z"
}
```

**Event**
```json
{
  "type": "event",
  "data": {
    "id": "uuid",
    "timestamp": "2026-07-24T10:00:00Z",
    "type": "task.completed",
    "agent": "Bravo",
    "agent_code": "BB",
    "task_id": "task-123",
    "action": "code_review",
    "status": "completed"
  }
}
```

**Recent Events**
```json
{
  "type": "recent_events",
  "data": [/* array of events */],
  "count": 20,
  "timestamp": "2026-07-24T10:00:00Z"
}
```

**State Snapshot**
```json
{
  "type": "state_snapshot",
  "data": {
    "objectives": [/* array of objective states */],
    "tasks": [/* array of task states */],
    "agents": [/* array of agent states */],
    "timestamp": "2026-07-24T10:00:00Z"
  }
}
```

---

## Event Types

### Orchestration Events

| Event Type | Source | Meaning |
|------------|--------|---------|
| `objective.received` | Alpha | User submitted an objective |
| `objective.classified` | Alpha | Objective type determined |
| `task.planned` | Alpha | Task plan created |
| `task.delegated` | Alpha | Task assigned to agent |
| `task.started` | Executor | Task execution began |
| `task.progress` | Executor | Progress update |
| `task.awaiting_authorisation` | Alpha | Awaiting approval for high-impact action |
| `task.retrying` | Executor | Retrying after failure |
| `task.blocked` | Executor | Task blocked by dependencies |
| `task.completed` | Executor | Task finished successfully |
| `task.failed` | Executor | Task failed |
| `task.cancelled` | Alpha | Task cancelled by user |

### Agent Events

| Event Type | Meaning |
|------------|---------|
| `agent.status_changed` | Agent state changed (idle → working → completed, etc.) |
| `agent.executed` | Agent completed a subtask |
| `agent.failed` | Agent subtask failed |
| `agent.health_changed` | Agent health status changed |

### Authorization Events

| Event Type | Meaning |
|------------|---------|
| `authorization.requested` | High-impact action needs approval |
| `authorization.approved` | Approval granted |
| `authorization.denied` | Approval denied |

### Control Events

| Event Type | Meaning |
|------------|---------|
| `control.pause` | Objective paused |
| `control.resume` | Objective resumed |
| `control.cancel` | Objective cancelled |

---

## Authorization Requests

Authorization requests are created for high-impact actions:

- **publish** - Publishing courses or content
- **delete** - Removing data
- **export** - Exporting user data
- **voice_clone** - Cloning voices
- **system_config** - Changing system configuration
- **generate_video** - Generating high-resolution videos

Each request includes:

- **Action** - What is being requested
- **Agent** - Which agent is requesting
- **Reason** - Why the action is needed
- **Risk Level** - high, medium, or low
- **Approval Buttons** - Approve or Deny actions

---

## Phase 3 Mocking

The Operation Centre is fully implemented but uses mock implementations for:

1. **Agent Execution** - All agents are mocked (not actually running)
2. **Authorization** - No real approval workflow (auto-approvable in UI)
3. **Providers** - No external providers activated
4. **Task Execution** - Simulated with mock results
5. **State Persistence** - In-memory only (cleared on restart)

These are intentional limitations of Phase 3. Phase 4 will integrate real agent execution.

---

## Security Considerations

**Current (Phase 3):**

- Mock authorization system for UI testing
- No authentication/authorization checks
- In-memory event storage (no persistence)
- All dashboards show same data
- Labeled as "Development" in UI

**Production (Phase 4+):**

- Real IrisKey biometric verification
- Role-based access control (RBAC)
- Persistent audit trail
- User-specific dashboard views
- Full authorization workflow

---

## Performance

**Event History**: 1000 most recent events stored in memory
**Connected Clients**: Unlimited WebSocket connections
**Event Broadcast**: Milliseconds (in-process)
**Dashboard Load**: Full state snapshot < 100ms
**Event Refresh**: Near real-time (milliseconds)

---

## Usage Examples

### Access Dashboard

```bash
# Start server (Phase 3 with Operation Centre)
npm start

# Open browser
http://localhost:3000
```

### Subscribe to Agent Events

```javascript
// From dashboard console or custom client
ws.send(JSON.stringify({
  type: "subscribe",
  filters: {
    types: ["agent.executed", "agent.failed"],
    agent_codes: ["CC", "DD", "FF"]
  }
}));
```

### Approve Authorization

```bash
POST /api/dashboard/authorizations/req-123/approve
{
  "approver_id": "system"
}
```

### Pause Objective

```bash
POST /api/dashboard/objectives/obj-123/pause
{
  "user_id": "user@example.com"
}
```

---

## Files Created

| File | Purpose |
|------|---------|
| `src/operation-centre/operation-centre.js` | Main service |
| `src/operation-centre/event-aggregator.js` | Event collection |
| `src/operation-centre/event-stream.js` | WebSocket management |
| `src/api/routes/dashboard.js` | Dashboard API |
| `public/index.html` | Dashboard UI |
| `public/css/style.css` | Dashboard styling |
| `public/js/app.js` | Client-side JavaScript |
| `tests/integration/operation-centre.test.js` | Test suite |
| `docs/OPERATION_CENTRE.md` | This file |

---

## Troubleshooting

**WebSocket Won't Connect:**
- Check server is running: `curl http://localhost:3000/health`
- Check port 3000 is not blocked
- Browser console should show connection attempts

**Events Not Updating:**
- Check WebSocket connection status in UI header
- Verify subscription filters match event types
- Try "Get Recent Events" to reload manually

**Authorization Not Appearing:**
- Alpha must have recorded an `ACTION_ESCALATED` event
- Check event log for any errors
- Verify authorization request was created

**Agent Status Not Updating:**
- Agents are mocked in Phase 3
- Status changes only when events are recorded
- Run an objective to generate events

---

## Next Steps (Phase 4)

- [ ] Real agent execution with actual provider integration
- [ ] Persistent audit trail with database
- [ ] User authentication and authorization
- [ ] Biometric verification via IrisKey
- [ ] Real-time metrics and performance monitoring
- [ ] Export audit trails and reports
- [ ] Multi-user dashboard support
- [ ] Mobile app for on-the-go monitoring
