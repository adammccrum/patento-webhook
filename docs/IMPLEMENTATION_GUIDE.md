# Implementation Guide

**Version:** 1.0  
**Purpose:** Step-by-step guide to building the modular agent system  
**Status:** Active

---

## Core Principle: Progressive Buildout

Build only what you need. Providers are added as requirements emerge, not installed upfront.

```
Phase 1: Foundation (Week 1)
├─ Provider Registry system
├─ Base Adapter interface
├─ Alpha Orchestrator stub
└─ Basic HTTP server

Phase 2: First Adapters (Week 2)
├─ Voice Adapter (local Voicebox)
├─ Echo Agent (voice operations)
├─ Test with real provider

Phase 3: Media Generation (Week 2-3)
├─ Media Adapter interface
├─ ComfyUI Adapter (local)
├─ Foxtrot Agent
└─ Test media generation

Phase 4: Orchestration & Coordination (Week 3)
├─ Alpha task routing
├─ Multi-agent workflows
├─ State management

Phase 5: Authorization & Audit (Week 4)
├─ IrisKey integration
├─ Permission checker
├─ Audit logging

Phase 6: Additional Agents & Providers (Week 4+)
├─ Specialist agents as needed
├─ Provider adapters on-demand
└─ Graceful fallbacks
```

**No provider is installed until actively used.**

---

## Phase 1: Foundation

### 1.1 Project Structure

```bash
mkdir -p src/{core,providers,agents,authorization,config,utils}
mkdir -p docs tests config/providers
```

### 1.2 Package Configuration

```javascript
// package.json
{
  "name": "lao-iriskey-multi-agent",
  "version": "0.1.0",
  "description": "Modular multi-agent system for LAO Academy + IrisKey",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.3.4",
    "uuid": "^9.0.0",
    "dotenv": "^16.0.3",
    "pino": "^8.10.0",
    "pino-pretty": "^10.0.0",
    "joi": "^17.9.2",
    "ws": "^8.13.0",
    "body-parser": "^1.20.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0"
  },
  "devDependencies": {
    "jest": "^29.5.0",
    "nodemon": "^2.0.20",
    "eslint": "^8.40.0"
  }
}
```

### 1.3 Provider Registry

```javascript
// src/providers/registry.js

const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class ProviderRegistry {
  constructor(config = {}) {
    this.adapters = new Map();
    this.metadata = new Map();
    this.config = config;
    this.healthCheckInterval = config.healthCheckInterval || 60000; // 1 min
  }

  async loadRegistry() {
    // Load provider definitions from docs/PROVIDER_REGISTRY.md
    logger.info('Provider Registry initialized');
  }

  async registerAdapter(providerId, AdapterClass, config) {
    try {
      const adapter = new AdapterClass(config);
      
      // Health check
      const health = await adapter.healthCheck();
      
      this.adapters.set(providerId, adapter);
      this.metadata.set(providerId, {
        id: providerId,
        name: adapter.name,
        category: adapter.category,
        capabilities: adapter.capabilities,
        health: health,
        enabled: config.enabled !== false
      });

      logger.info(`Registered adapter: ${providerId} (${adapter.name})`);
      return adapter;
    } catch (error) {
      logger.error(`Failed to register adapter ${providerId}: ${error.message}`);
      throw error;
    }
  }

  async getAdapter(category, capability) {
    // Find adapter that supports capability in category
    const candidates = Array.from(this.adapters.values())
      .filter(a => a.category === category && a.capabilities.includes(capability))
      .filter(a => a.enabled !== false)
      .sort((a, b) => {
        // Prefer healthy adapters
        if (a.health !== b.health) {
          return (a.health === 'healthy' ? 0 : 1) - (b.health === 'healthy' ? 0 : 1);
        }
        // Then prefer free providers
        return (a.cost_tracker?.total || 0) - (b.cost_tracker?.total || 0);
      });

    if (candidates.length === 0) {
      throw new Error(
        `No adapter available for ${category}/${capability}`
      );
    }

    return candidates[0];
  }

  async tryAdapters(category, capability, operation, ...args) {
    const candidates = Array.from(this.adapters.values())
      .filter(a => a.category === category && a.capabilities.includes(capability))
      .filter(a => a.enabled !== false);

    for (const adapter of candidates) {
      try {
        const result = await adapter[operation](...args);
        return { adapter: adapter.id, result };
      } catch (error) {
        logger.warn(
          `Adapter ${adapter.id} failed for ${category}/${capability}: ${error.message}`
        );
        continue;
      }
    }

    throw new Error(
      `All ${candidates.length} adapters failed for ${category}/${capability}`
    );
  }

  async startHealthChecks() {
    // Periodically check provider health
    setInterval(async () => {
      for (const [id, adapter] of this.adapters.entries()) {
        try {
          const health = await adapter.healthCheck();
          this.metadata.get(id).health = health;
        } catch (error) {
          this.metadata.get(id).health = 'unhealthy';
        }
      }
    }, this.healthCheckInterval);
  }

  async getStatus() {
    return Array.from(this.metadata.values());
  }
}

module.exports = ProviderRegistry;
```

### 1.4 Base Adapter Interface

```javascript
// src/providers/adapter-base.js

const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');

class ProviderAdapter {
  constructor(config = {}) {
    this.id = config.id || uuid();
    this.name = config.name || 'Unknown';
    this.category = config.category;
    this.capabilities = config.capabilities || [];
    this.enabled = config.enabled !== false;
    this.health = 'unknown';
    this.lastChecked = null;
    this.costTracker = { total: 0, calls: 0 };
    this.config = config;
  }

  async canHandle(capability) {
    return this.capabilities.includes(capability);
  }

  async healthCheck() {
    this.health = 'healthy';
    this.lastChecked = new Date().toISOString();
    return this.health;
  }

  async getMetadata() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      capabilities: this.capabilities,
      enabled: this.enabled,
      health: this.health,
      lastChecked: this.lastChecked,
      cost: this.costTracker
    };
  }

  async trackCost(operation, units, costPerUnit) {
    const cost = units * costPerUnit;
    this.costTracker.total += cost;
    this.costTracker.calls += 1;
    
    logger.debug({
      adapter: this.id,
      operation,
      units,
      cost,
      totalCost: this.costTracker.total
    });

    return cost;
  }
}

module.exports = ProviderAdapter;
```

### 1.5 Alpha Orchestrator Stub

```javascript
// src/core/alpha-orchestrator.js

const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');

class AlphaOrchestrator {
  constructor(config = {}) {
    this.name = 'Alpha';
    this.code = 'AA';
    this.config = config;
    this.agents = new Map();
    this.taskQueue = [];
    this.executingTasks = new Map();
  }

  registerAgent(code, agent) {
    this.agents.set(code, agent);
    logger.info(`Alpha registered agent: ${agent.name} (${code})`);
  }

  async receiveObjective(objective) {
    logger.info(`Alpha received objective: ${objective.description}`);

    const taskId = uuid();
    const context = {
      id: taskId,
      objective: objective,
      created_at: new Date().toISOString(),
      status: 'received'
    };

    // For now, just log
    logger.info(`Alpha queued task ${taskId}`);

    return { task_id: taskId, status: 'queued' };
  }

  async getStatus() {
    return {
      agent: this.name,
      code: this.code,
      status: 'ready',
      agents_registered: this.agents.size,
      tasks_queued: this.taskQueue.length,
      tasks_executing: this.executingTasks.size
    };
  }
}

module.exports = AlphaOrchestrator;
```

### 1.6 Main Entry Point

```javascript
// src/index.js

require('dotenv').config();
const express = require('express');
const logger = require('./utils/logger');
const ProviderRegistry = require('./providers/registry');
const AlphaOrchestrator = require('./core/alpha-orchestrator');

const PORT = process.env.PORT || 3000;

async function main() {
  const app = express();

  // Middleware
  app.use(express.json());

  // Initialize Registry
  const registry = new ProviderRegistry();
  await registry.loadRegistry();
  await registry.startHealthChecks();

  // Initialize Alpha
  const alpha = new AlphaOrchestrator();

  // Routes
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  app.get('/status', async (req, res) => {
    const alphaStatus = await alpha.getStatus();
    const providers = await registry.getStatus();
    res.json({
      orchestrator: alphaStatus,
      providers: providers
    });
  });

  app.post('/objectives', async (req, res) => {
    try {
      const result = await alpha.receiveObjective(req.body);
      res.json(result);
    } catch (error) {
      logger.error(`Error processing objective: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });

  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
  });
}

main().catch(error => {
  logger.error(`Failed to start: ${error.message}`);
  process.exit(1);
});
```

### 1.7 Utilities

```javascript
// src/utils/logger.js

const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

module.exports = logger;
```

---

## Phase 2: First Provider - Voicebox

Once Phase 1 foundation is solid, add your first real provider.

### 2.1 Voicebox Adapter

```javascript
// src/providers/adapters/voice/voicebox-adapter.js

const ProviderAdapter = require('../../adapter-base');
const axios = require('axios');
const logger = require('../../../utils/logger');

class VoiceboxAdapter extends ProviderAdapter {
  constructor(config) {
    super(config);
    this.name = 'Voicebox';
    this.category = 'voice';
    this.capabilities = ['text-to-speech', 'speech-to-text'];
    this.apiUrl = config.apiUrl || 'http://localhost:8000';
  }

  async healthCheck() {
    try {
      const response = await axios.get(`${this.apiUrl}/health`, {
        timeout: 5000
      });
      this.health = response.status === 200 ? 'healthy' : 'degraded';
    } catch (error) {
      this.health = 'unhealthy';
      logger.warn(`Voicebox health check failed: ${error.message}`);
    }
    this.lastChecked = new Date().toISOString();
    return this.health;
  }

  async textToSpeech(text, options = {}) {
    if (this.health !== 'healthy') {
      throw new Error('Voicebox is not healthy');
    }

    try {
      const response = await axios.post(`${this.apiUrl}/api/tts`, {
        text,
        voice: options.voice || 'default',
        language: options.language || 'en',
        speed: options.speed || 1.0
      });

      await this.trackCost('textToSpeech', text.length, 0); // Free

      return {
        success: true,
        audioBuffer: Buffer.from(response.data),
        format: 'mp3',
        cost: 0
      };
    } catch (error) {
      throw new Error(`Voicebox TTS failed: ${error.message}`);
    }
  }

  async speechToText(audioBuffer, options = {}) {
    if (this.health !== 'healthy') {
      throw new Error('Voicebox is not healthy');
    }

    try {
      const formData = new FormData();
      formData.append('audio', new Blob([audioBuffer]));
      formData.append('language', options.language || 'en');

      const response = await axios.post(
        `${this.apiUrl}/api/stt`,
        formData
      );

      await this.trackCost('speechToText', audioBuffer.length, 0); // Free

      return {
        success: true,
        text: response.data.text,
        confidence: response.data.confidence,
        cost: 0
      };
    } catch (error) {
      throw new Error(`Voicebox STT failed: ${error.message}`);
    }
  }
}

module.exports = VoiceboxAdapter;
```

### 2.2 Echo Agent

```javascript
// src/agents/base-agent.js

const logger = require('../utils/logger');

class BaseAgent {
  constructor(name, code, config = {}) {
    this.name = name;
    this.code = code;
    this.config = config;
    this.status = 'idle';
    this.currentTask = null;
    this.completedCount = 0;
    this.failedCount = 0;
  }

  async execute(task, context) {
    throw new Error(`${this.name}.execute() must be implemented`);
  }

  async getCapabilities() {
    return [];
  }

  async getStatus() {
    return {
      agent: this.name,
      code: this.code,
      status: this.status,
      completed: this.completedCount,
      failed: this.failedCount
    };
  }
}

module.exports = BaseAgent;
```

```javascript
// src/agents/echo.js

const BaseAgent = require('./base-agent');
const logger = require('../utils/logger');

class EchoAgent extends BaseAgent {
  constructor(registry, config = {}) {
    super('Echo', 'EE', config);
    this.registry = registry;
  }

  async execute(task, context) {
    this.status = 'processing';
    this.currentTask = task;

    try {
      logger.info(`Echo executing task: ${task.type}`);

      if (task.type === 'text-to-speech') {
        return await this.textToSpeech(task.text, task.options);
      } else if (task.type === 'speech-to-text') {
        return await this.speechToText(task.audio, task.options);
      } else {
        throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error) {
      this.failedCount++;
      logger.error(`Echo failed: ${error.message}`);
      throw error;
    } finally {
      this.status = 'idle';
      this.currentTask = null;
    }
  }

  async textToSpeech(text, options = {}) {
    logger.info('Echo: Selecting voice provider...');

    // Get best adapter for voice capability
    const adapter = await this.registry.getAdapter('voice', 'text-to-speech');

    logger.info(`Echo: Using ${adapter.name} for TTS`);

    const result = await adapter.textToSpeech(text, options);
    this.completedCount++;

    return {
      success: true,
      type: 'audio',
      audioBuffer: result.audioBuffer,
      format: result.format,
      provider: adapter.id,
      cost: result.cost
    };
  }

  async speechToText(audioBuffer, options = {}) {
    logger.info('Echo: Selecting speech-to-text provider...');

    const adapter = await this.registry.getAdapter('voice', 'speech-to-text');

    logger.info(`Echo: Using ${adapter.name} for STT`);

    const result = await adapter.speechToText(audioBuffer, options);
    this.completedCount++;

    return {
      success: true,
      type: 'text',
      text: result.text,
      provider: adapter.id,
      confidence: result.confidence,
      cost: result.cost
    };
  }

  async getCapabilities() {
    return ['text-to-speech', 'speech-to-text'];
  }
}

module.exports = EchoAgent;
```

### 2.3 Configuration

```yaml
# config/providers.yaml

providers:
  voice:
    primary: voicebox
    fallback:
      - piper
      - google-cloud
    
    voicebox:
      enabled: true
      adapter: VoiceboxAdapter
      config:
        apiUrl: http://localhost:8000
    
    piper:
      enabled: false
      adapter: PiperAdapter
      config:
        modelPath: /models/piper
    
    google-cloud:
      enabled: false
      adapter: GoogleCloudAdapter
      config:
        apiKey: ${GOOGLE_CLOUD_API_KEY}
```

---

## Phase 3: Second Provider - Media Generation

Once voice is working, add media generation.

### 3.1 Media Adapter Interface

```javascript
// src/providers/adapters/media/media-adapter-base.js

const ProviderAdapter = require('../../adapter-base');

class MediaAdapter extends ProviderAdapter {
  constructor(config) {
    super(config);
    this.category = 'media';
  }

  async textToImage(prompt, options = {}) {
    throw new Error(`${this.name} does not support text-to-image`);
  }

  async imageToVideo(imageBuffer, options = {}) {
    throw new Error(`${this.name} does not support image-to-video`);
  }
}

module.exports = MediaAdapter;
```

### 3.2 ComfyUI Adapter (Local)

```javascript
// src/providers/adapters/media/comfyui-adapter.js

const MediaAdapter = require('./media-adapter-base');
const axios = require('axios');
const logger = require('../../../utils/logger');

class ComfyUIAdapter extends MediaAdapter {
  constructor(config) {
    super(config);
    this.name = 'ComfyUI';
    this.capabilities = ['text-to-image', 'image-variation'];
    this.apiUrl = config.apiUrl || 'http://localhost:8188';
  }

  async healthCheck() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/system/stats`, {
        timeout: 5000
      });
      this.health = 'healthy';
    } catch (error) {
      this.health = 'unhealthy';
    }
    this.lastChecked = new Date().toISOString();
    return this.health;
  }

  async textToImage(prompt, options = {}) {
    if (this.health !== 'healthy') {
      throw new Error('ComfyUI is not healthy');
    }

    try {
      // ComfyUI workflow execution
      const response = await axios.post(
        `${this.apiUrl}/api/generate`,
        {
          prompt: prompt,
          width: options.width || 1024,
          height: options.height || 1024,
          steps: options.steps || 20,
          model: options.model || 'sd-v1-5'
        }
      );

      await this.trackCost('textToImage', 1, 0); // Free local

      return {
        success: true,
        imageBuffer: Buffer.from(response.data.image, 'base64'),
        width: options.width || 1024,
        height: options.height || 1024,
        format: 'png',
        cost: 0
      };
    } catch (error) {
      throw new Error(`ComfyUI generation failed: ${error.message}`);
    }
  }
}

module.exports = ComfyUIAdapter;
```

---

## How to Add a New Provider

When you need a new provider:

1. **Create adapter file**:
   ```javascript
   // src/providers/adapters/[category]/[provider]-adapter.js
   class [Provider]Adapter extends [Category]Adapter {
     // Implement interface methods
   }
   ```

2. **Update configuration**:
   ```yaml
   # config/providers.yaml
   [provider]:
     enabled: false
     adapter: [Provider]Adapter
     config:
       # provider-specific config
   ```

3. **Register in startup**:
   ```javascript
   // src/index.js
   await registry.registerAdapter(
     'provider-id',
     [Provider]Adapter,
     providerConfig
   );
   ```

4. **Test**:
   ```bash
   npm test -- adapters/[provider]-adapter.test.js
   ```

5. **Enable when needed**:
   ```bash
   ENABLE_[PROVIDER]=true npm start
   ```

---

## Testing Strategy

### Unit Tests

Test each adapter in isolation:

```javascript
// tests/adapters/voicebox-adapter.test.js

const VoiceboxAdapter = require('../../src/providers/adapters/voice/voicebox-adapter');

describe('VoiceboxAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new VoiceboxAdapter({
      apiUrl: 'http://localhost:8000'
    });
  });

  test('should have voice capabilities', async () => {
    const caps = adapter.capabilities;
    expect(caps).toContain('text-to-speech');
    expect(caps).toContain('speech-to-text');
  });

  test('should track costs', async () => {
    await adapter.trackCost('test', 100, 0.01);
    expect(adapter.costTracker.total).toBe(1);
  });
});
```

### Integration Tests

Test agent + adapter together:

```javascript
// tests/integration/echo-voicebox.test.js

const EchoAgent = require('../../src/agents/echo');
const VoiceboxAdapter = require('../../src/providers/adapters/voice/voicebox-adapter');
const ProviderRegistry = require('../../src/providers/registry');

describe('Echo + Voicebox Integration', () => {
  let echo, registry;

  beforeEach(async () => {
    registry = new ProviderRegistry();
    await registry.registerAdapter(
      'voicebox',
      VoiceboxAdapter,
      { apiUrl: 'http://localhost:8000' }
    );

    echo = new EchoAgent(registry);
  });

  test('should generate speech from text', async () => {
    const result = await echo.execute(
      { type: 'text-to-speech', text: 'Hello world' },
      {}
    );

    expect(result.success).toBe(true);
    expect(result.audioBuffer).toBeDefined();
  });
});
```

---

## Deployment

### Docker Compose (Development)

```yaml
# docker-compose.yml

version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    depends_on:
      - voicebox
      - comfyui

  voicebox:
    image: voicebox:latest
    ports:
      - "8000:8000"
    volumes:
      - voicebox-models:/models

  comfyui:
    image: comfyui:latest
    ports:
      - "8188:8188"
    volumes:
      - comfyui-models:/models
      - comfyui-outputs:/outputs

volumes:
  voicebox-models:
  comfyui-models:
  comfyui-outputs:
```

### Environment Variables

```bash
# .env.development

NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Providers
ENABLE_VOICE=true
VOICE_PROVIDERS=voicebox
VOICEBOX_API_URL=http://voicebox:8000

ENABLE_MEDIA=false
MEDIA_PROVIDERS=comfyui

# Authorization (disabled for development)
ENABLE_IRISKEY=false
```

---

## Key Principles to Remember

1. **Progressive Enablement**: Only enable providers when needed
2. **Adapter Pattern**: All external calls through adapters
3. **Graceful Fallback**: Try next provider if one fails
4. **Cost Tracking**: Every call logged with cost
5. **Health Monitoring**: Periodic health checks
6. **No Hardcoding**: Configuration drives everything
7. **Easy Testing**: Mock adapters for tests
8. **Documentation**: Keep docs in sync with code

---

## Next Steps

1. Complete Phase 1 foundation
2. Test with Voicebox (Phase 2)
3. Add media generation (Phase 3)
4. Build orchestration (Phase 4)
5. Add authorization (Phase 5)
6. Extend with more agents as needed

Start small. Add providers as requirements emerge. Keep it simple.
