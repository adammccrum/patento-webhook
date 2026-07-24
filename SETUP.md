# Setup Guide

## Phase 1: Multi-Agent Foundation

This guide covers the Phase 1 implementation of the LAO Academy + IrisKey.ai multi-agent orchestration system.

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Verify configuration files exist:**
```bash
ls -la config/
# Should show: agents.yaml, providers.yaml
```

### Running the Application

1. **Start the server (development mode):**
```bash
npm start
```

You should see:
```
[INFO] Server listening on port 3000
```

2. **Alternatively, use development mode with auto-reload:**
```bash
npm run dev
```

### Testing the System

1. **Health check:**
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-07-24T..."
}
```

2. **Get system status:**
```bash
curl http://localhost:3000/status
```

Shows:
- Orchestrator status
- All 26 agents
- All providers

3. **List all agents:**
```bash
curl http://localhost:3000/agents
```

4. **Get specific agent:**
```bash
curl http://localhost:3000/agents/AA
```

5. **List all providers:**
```bash
curl http://localhost:3000/providers
```

6. **Submit an objective (stub):**
```bash
curl -X POST http://localhost:3000/objectives \
  -H "Content-Type: application/json" \
  -d '{"description": "Create a test course"}'
```

### Running Tests

1. **Run all tests:**
```bash
npm test
```

2. **Run tests with coverage:**
```bash
npm run test:coverage
```

Expected coverage:
- Lines: ≥80%
- Functions: ≥75%
- Branches: ≥70%
- Statements: ≥80%

3. **Run tests in watch mode:**
```bash
npm run test:watch
```

4. **Run specific test file:**
```bash
npm test -- tests/unit/agent-registry.test.js
```

### Running Linter

```bash
npm run lint
```

To auto-fix issues:
```bash
npm run lint:fix
```

### Configuration

#### Environment Variables

Edit `.env` to configure:
```
NODE_ENV=development        # development or production
PORT=3000                   # HTTP port
LOG_LEVEL=info             # debug, info, warn, error
VOICEBOX_API_URL=...       # When voice provider is enabled
COMFYUI_API_URL=...        # When media provider is enabled
```

#### Agent Configuration

Agents are defined in `config/agents.yaml`:
- All 26 NATO phonetic agents
- Each with 14 required fields
- All enabled by default

#### Provider Configuration

Providers are defined in `config/providers.yaml`:
- 30+ open-source and commercial providers
- All DISABLED by default
- Enable only when needed

### What's Implemented (Phase 1)

✅ **Agent System**
- Agent registry with all 26 NATO agents
- Agent status tracking
- Agent capability discovery
- Configurable from YAML

✅ **Provider System**
- Provider registry with 30+ providers
- Provider definitions (not instantiated)
- Health check framework
- Cost tracking structure

✅ **HTTP Server**
- Express.js server on port 3000
- REST API endpoints
- Request logging
- Error handling

✅ **Testing**
- Unit tests (5 test files)
- Integration tests (1 test file)
- ≥80% code coverage
- Jest configuration

✅ **Configuration**
- YAML-based agent definitions
- YAML-based provider definitions
- Environment variable support
- Configuration validation

### What's NOT Implemented Yet (Phase 2+)

❌ **Provider Activation**
- Voicebox adapter
- Media generation adapters
- Other provider adapters

❌ **Agent Implementation**
- Echo agent (voice operations)
- Foxtrot agent (media generation)
- Other specialist agents

❌ **Authorization & Audit**
- IrisKey integration
- Audit logging implementation
- Permission checking

❌ **Multi-Agent Coordination**
- Task routing to agents
- Agent-to-agent communication
- Workflow execution

### Troubleshooting

**Port already in use:**
```bash
PORT=3001 npm start
```

**Cannot find module:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Tests failing:**
```bash
npm test -- --verbose
```

**Configuration not loading:**
```bash
LOG_LEVEL=debug npm start
```

### Next Steps (Phase 2)

1. Install and enable first provider (Voicebox)
2. Create Voicebox adapter
3. Implement Echo agent (voice operations)
4. Test voice provider activation
5. Add health checks

See `/docs/IMPLEMENTATION_GUIDE.md` for detailed Phase 2 instructions.

### Documentation

- `/docs/ARCHITECTURE.md` - System design
- `/docs/AGENT_SYSTEM.md` - Agent definitions
- `/docs/PROVIDER_REGISTRY.md` - Available providers
- `/docs/ADAPTER_SPECIFICATION.md` - How to create adapters
- `/docs/IMPLEMENTATION_GUIDE.md` - Phase-by-phase guide
- `PHASE_1_CHECKLIST.md` - Implementation progress
