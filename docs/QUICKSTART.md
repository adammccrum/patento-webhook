# Quick Start Guide

**Get the foundation running in 30 minutes**

---

## Prerequisites

- Node.js 18+
- npm or yarn
- Git

---

## Step 1: Initialize Project (5 min)

```bash
# You're already in the repo
cd /home/user/patento-webhook

# Create directory structure
mkdir -p src/{core,providers,agents,authorization,config,utils}
mkdir -p tests/{unit,integration}
```

---

## Step 2: Install Dependencies (5 min)

```bash
npm install express axios uuid dotenv pino pino-pretty joi
npm install --save-dev jest nodemon
```

---

## Step 3: Create Configuration Files (5 min)

Create `.env`:
```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

Create `src/utils/logger.js`:
```javascript
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

module.exports = logger;
```

---

## Step 4: Create Core Foundation (10 min)

Copy the Phase 1 code from IMPLEMENTATION_GUIDE.md:

- `src/providers/adapter-base.js`
- `src/providers/registry.js`
- `src/core/alpha-orchestrator.js`
- `src/index.js`

---

## Step 5: Test It (5 min)

```bash
npm start
```

You should see:
```
[INFO] Provider Registry initialized
[INFO] Server listening on port 3000
```

Test the API:
```bash
curl http://localhost:3000/health
# Should return: {"status":"healthy","timestamp":"2026-07-24T..."}

curl http://localhost:3000/status
# Should return orchestrator and provider status
```

---

## Step 6: Add First Provider - Voicebox (5 min)

Create `src/providers/adapters/voice/voicebox-adapter.js`:
```javascript
const ProviderAdapter = require('../../adapter-base');

class VoiceboxAdapter extends ProviderAdapter {
  constructor(config) {
    super(config);
    this.name = 'Voicebox';
    this.category = 'voice';
    this.capabilities = ['text-to-speech'];
    this.apiUrl = config.apiUrl || 'http://localhost:8000';
  }

  async healthCheck() {
    this.health = 'healthy'; // For now, assume healthy
    this.lastChecked = new Date().toISOString();
    return this.health;
  }

  async textToSpeech(text, options = {}) {
    // Stub - will implement when Voicebox is running
    return {
      success: true,
      audioBuffer: Buffer.from('mock-audio'),
      format: 'mp3',
      cost: 0
    };
  }
}

module.exports = VoiceboxAdapter;
```

Create `src/agents/echo.js`:
```javascript
const BaseAgent = require('./base-agent');

class EchoAgent extends BaseAgent {
  constructor(registry, config = {}) {
    super('Echo', 'EE', config);
    this.registry = registry;
  }

  async execute(task, context) {
    this.status = 'processing';
    
    if (task.type === 'text-to-speech') {
      const adapter = await this.registry.getAdapter('voice', 'text-to-speech');
      const result = await adapter.textToSpeech(task.text, task.options);
      this.completedCount++;
      return { success: true, ...result };
    }

    throw new Error(`Unknown task: ${task.type}`);
  }

  async getCapabilities() {
    return ['text-to-speech', 'speech-to-text'];
  }
}

module.exports = EchoAgent;
```

Update `src/index.js` to register adapters:
```javascript
// Add to main() function, after registry initialization:

const VoiceboxAdapter = require('./providers/adapters/voice/voicebox-adapter');
const EchoAgent = require('./agents/echo');

// Register adapters
await registry.registerAdapter(
  'voicebox',
  VoiceboxAdapter,
  { enabled: true }
);

// Register agents
const echo = new EchoAgent(registry);
alpha.registerAgent('EE', echo);
```

---

## You Now Have:

✅ Provider Registry - discovers and manages adapters  
✅ Base Adapter Interface - normalizes provider APIs  
✅ Provider Health Checking - automatic availability monitoring  
✅ Alpha Orchestrator - task routing foundation  
✅ First Specialist Agent (Echo) - voice operations  
✅ First Provider Adapter (Voicebox) - pluggable voice provider  
✅ HTTP API - REST endpoints for orchestration  

---

## What's NOT Included Yet:

❌ Authorization & Audit  
❌ Multi-agent coordination  
❌ Media generation  
❌ Course workflows  
❌ Persistence/Database  
❌ WebSocket updates  

---

## Next: Test with Real Provider

When you have Voicebox running locally:

```bash
VOICEBOX_API_URL=http://localhost:8000 npm start
```

Then call Echo via API:

```bash
curl -X POST http://localhost:3000/echo \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text-to-speech",
    "text": "Hello world",
    "options": {"language": "en"}
  }'
```

---

## Common Issues

**Port 3000 already in use:**
```bash
PORT=3001 npm start
```

**Cannot find module:**
```bash
npm install  # Make sure all dependencies installed
```

**Provider not registering:**
```bash
LOG_LEVEL=debug npm start  # See what's happening
```

---

## Key Concepts in This Foundation

1. **Provider Registry** - Central hub for discovering capabilities
2. **Adapter Pattern** - Normalizes different providers to same interface
3. **Agent Architecture** - Specialist agents delegate via orchestrator
4. **Health Checking** - Automatic provider availability monitoring
5. **Cost Tracking** - Every operation tracked for billing/auditing
6. **Graceful Fallback** - Try next provider if one fails
7. **Configuration-Driven** - No hardcoded provider names

---

## Next Steps

1. ✅ Get foundation running
2. 🔧 Install Voicebox locally (Docker is easiest)
3. 🧪 Test Echo agent with real Voicebox
4. ➕ Add media generation (ComfyUI adapter)
5. 🔐 Add authorization system
6. 📊 Add more agents as needed

---

## Reference Docs

- `docs/ARCHITECTURE.md` - System design overview
- `docs/PROVIDER_REGISTRY.md` - Available providers
- `docs/ADAPTER_SPECIFICATION.md` - How to create adapters
- `docs/AGENT_SYSTEM.md` - Agent framework
- `docs/IMPLEMENTATION_GUIDE.md` - Detailed implementation steps

---

**You're ready to build.** Start small, test each piece, add providers on-demand.
