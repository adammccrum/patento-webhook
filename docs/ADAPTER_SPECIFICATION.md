# Provider Adapter Specification

**Version:** 1.0  
**Purpose:** Define standard interfaces for all provider adapters  
**Status:** Active

---

## Core Principle

All external services are accessed through adapters. Business logic never calls providers directly.

Each adapter normalizes a provider's API to a common interface:
- Same method names across all implementations
- Same parameter and response formats
- Same error handling
- Same health checking

Swapping providers = changing one configuration line + restarting.

---

## Base Adapter Interface

Every provider adapter must extend `ProviderAdapter`:

```javascript
// src/providers/adapter-base.js

class ProviderAdapter {
  constructor(config) {
    this.config = config;
    this.id = config.id;
    this.name = config.name;
    this.category = config.category;
    this.capabilities = config.capabilities || [];
    this.enabled = config.enabled !== false;
    this.health = 'unknown';
    this.last_checked = null;
    this.cost_tracker = { total: 0, calls: 0 };
  }

  // REQUIRED: Check if adapter can handle a capability
  async canHandle(capability) {
    return this.capabilities.includes(capability);
  }

  // REQUIRED: Health check
  async healthCheck() {
    throw new Error('healthCheck() must be implemented');
  }

  // REQUIRED: Get provider metadata
  async getMetadata() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      capabilities: this.capabilities,
      enabled: this.enabled,
      health: this.health,
      cost: this.cost_tracker
    };
  }

  // RECOMMENDED: Track costs
  async trackCost(operation, units, costPerUnit) {
    const cost = units * costPerUnit;
    this.cost_tracker.total += cost;
    this.cost_tracker.calls += 1;
    return cost;
  }

  // RECOMMENDED: Log usage
  async logUsage(operation, params, result) {
    logger.info({
      provider: this.id,
      operation,
      params,
      result: result?.success || false,
      cost: result?.cost || 0
    });
  }
}

module.exports = ProviderAdapter;
```

---

## Category-Specific Interfaces

### Voice Adapter

```javascript
// src/providers/adapters/voice/voice-adapter-base.js

class VoiceAdapter extends ProviderAdapter {
  constructor(config) {
    super(config);
    this.category = 'voice';
  }

  // Text-to-Speech (if supported)
  async textToSpeech(text, options = {}) {
    // options: { language, voice, speed, pitch, rate }
    throw new Error('textToSpeech() not implemented');
  }

  // Speech-to-Text (if supported)
  async speechToText(audioBuffer, options = {}) {
    // options: { language, format }
    throw new Error('speechToText() not implemented');
  }

  // List available voices
  async getAvailableVoices() {
    throw new Error('getAvailableVoices() not implemented');
  }

  // Voice cloning (if supported)
  async cloneVoice(referenceAudio, name, options = {}) {
    throw new Error('cloneVoice() not implemented');
  }
}

module.exports = VoiceAdapter;
```

### Media Adapter

```javascript
// src/providers/adapters/media/media-adapter-base.js

class MediaAdapter extends ProviderAdapter {
  constructor(config) {
    super(config);
    this.category = 'media';
  }

  // Text-to-Image (if supported)
  async textToImage(prompt, options = {}) {
    // options: { width, height, steps, quality, negativePrompt }
    throw new Error('textToImage() not implemented');
  }

  // Image-to-Image (if supported)
  async imageToImage(imageBuffer, prompt, options = {}) {
    throw new Error('imageToImage() not implemented');
  }

  // Image-to-Video (if supported)
  async imageToVideo(imageBuffer, options = {}) {
    // options: { duration, fps, motion }
    throw new Error('imageToVideo() not implemented');
  }

  // Text-to-Video (if supported)
  async textToVideo(prompt, options = {}) {
    throw new Error('textToVideo() not implemented');
  }

  // Get supported quality levels
  async getSupportedQualityLevels() {
    return ['standard', 'high', 'premium'];
  }

  // Estimate cost before operation
  async estimateCost(operation, params) {
    return { operation, estimated_cost: 0 };
  }
}

module.exports = MediaAdapter;
```

### Agent Framework Adapter

```javascript
// src/providers/adapters/agents/agent-adapter-base.js

class AgentAdapter extends ProviderAdapter {
  constructor(config) {
    super(config);
    this.category = 'agents';
  }

  // Create an agent
  async createAgent(name, role, tools, config = {}) {
    throw new Error('createAgent() not implemented');
  }

  // Execute an agent task
  async executeTask(agentId, task, context = {}) {
    // Returns { success, result, cost }
    throw new Error('executeTask() not implemented');
  }

  // Get agent status
  async getAgentStatus(agentId) {
    return { id: agentId, status: 'idle', last_task: null };
  }

  // Add tool to agent
  async addTool(agentId, tool) {
    throw new Error('addTool() not implemented');
  }

  // Stream responses (if supported)
  async *streamTask(agentId, task, context = {}) {
    throw new Error('streamTask() not implemented');
  }
}

module.exports = AgentAdapter;
```

### Document Adapter

```javascript
// src/providers/adapters/documents/document-adapter-base.js

class DocumentAdapter extends ProviderAdapter {
  constructor(config) {
    super(config);
    this.category = 'documents';
  }

  // Parse document
  async parseDocument(fileBuffer, options = {}) {
    // Returns { text, metadata, structure }
    throw new Error('parseDocument() not implemented');
  }

  // Extract from URL
  async extractFromUrl(url, options = {}) {
    throw new Error('extractFromUrl() not implemented');
  }

  // Generate embeddings
  async generateEmbeddings(text) {
    throw new Error('generateEmbeddings() not implemented');
  }

  // Semantic search
  async semanticSearch(query, documents, topK = 5) {
    throw new Error('semanticSearch() not implemented');
  }
}

module.exports = DocumentAdapter;
```

### Vision Adapter

```javascript
// src/providers/adapters/vision/vision-adapter-base.js

class VisionAdapter extends ProviderAdapter {
  constructor(config) {
    super(config);
    this.category = 'vision';
  }

  // Object detection
  async detectObjects(imageBuffer, options = {}) {
    throw new Error('detectObjects() not implemented');
  }

  // Image segmentation
  async segmentImage(imageBuffer, options = {}) {
    throw new Error('segmentImage() not implemented');
  }

  // Pose estimation
  async estimatePose(imageBuffer, options = {}) {
    throw new Error('estimatePose() not implemented');
  }

  // Image classification
  async classifyImage(imageBuffer, options = {}) {
    throw new Error('classifyImage() not implemented');
  }
}

module.exports = VisionAdapter;
```

---

## Adapter Implementation Example

### Voicebox TTS Adapter

```javascript
// src/providers/adapters/voice/voicebox-adapter.js

const VoiceAdapter = require('./voice-adapter-base');
const axios = require('axios');

class VoiceboxAdapter extends VoiceAdapter {
  constructor(config) {
    super(config);
    this.apiUrl = config.api_url || 'http://localhost:8000';
    this.model = config.model || 'voicebox-v1';
  }

  async healthCheck() {
    try {
      const response = await axios.get(`${this.apiUrl}/health`);
      this.health = response.status === 200 ? 'healthy' : 'degraded';
      this.last_checked = new Date().toISOString();
      return this.health;
    } catch (error) {
      this.health = 'unhealthy';
      this.last_error = error.message;
      this.last_checked = new Date().toISOString();
      return this.health;
    }
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
        speed: options.speed || 1.0,
        pitch: options.pitch || 1.0,
        format: 'mp3'
      });

      // Track cost (Voicebox is free, but we still track calls)
      await this.trackCost('textToSpeech', text.length, 0);

      return {
        success: true,
        audioBuffer: Buffer.from(response.data),
        format: 'mp3',
        duration_ms: response.headers['x-duration-ms'],
        cost: 0
      };
    } catch (error) {
      this.last_error = error.message;
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
        formData,
        { headers: formData.getHeaders() }
      );

      await this.trackCost('speechToText', audioBuffer.length, 0);

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

  async getAvailableVoices() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/voices`);
      return response.data.voices || [];
    } catch (error) {
      return ['default'];
    }
  }
}

module.exports = VoiceboxAdapter;
```

---

## Adapter Registry Integration

Adapters are discovered and loaded by the Provider Registry:

```javascript
// src/providers/registry.js

class ProviderRegistry {
  constructor(config) {
    this.adapters = new Map();
    this.config = config;
  }

  // Load adapter
  async loadAdapter(providerId, AdapterClass, config) {
    const adapter = new AdapterClass(config);
    
    // Health check
    const health = await adapter.healthCheck();
    
    if (health !== 'healthy' && !config.allow_degraded) {
      logger.warn(`Provider ${providerId} is not healthy, skipping`);
      return null;
    }

    this.adapters.set(providerId, adapter);
    logger.info(`Loaded adapter: ${providerId}`);
    return adapter;
  }

  // Get adapter for capability
  async getAdapter(capability, category) {
    const candidates = Array.from(this.adapters.values())
      .filter(a => a.enabled && a.category === category)
      .filter(a => a.capabilities.includes(capability));

    if (candidates.length === 0) {
      throw new Error(`No adapter available for ${category}:${capability}`);
    }

    // Return first healthy adapter
    for (const adapter of candidates) {
      if (adapter.health === 'healthy') {
        return adapter;
      }
    }

    // Return first degraded if no healthy
    return candidates[0];
  }

  // Try adapters in order (fallback chain)
  async tryAdapters(capability, category, operation, ...args) {
    const candidates = Array.from(this.adapters.values())
      .filter(a => a.enabled && a.category === category)
      .filter(a => a.capabilities.includes(capability))
      .sort((a, b) => {
        // Healthy first, then by cost
        if (a.health !== b.health) {
          return (a.health === 'healthy' ? 0 : 1) - 
                 (b.health === 'healthy' ? 0 : 1);
        }
        return (a.cost_tracker?.total || 0) - (b.cost_tracker?.total || 0);
      });

    for (const adapter of candidates) {
      try {
        const result = await adapter[operation](...args);
        return { adapter_id: adapter.id, result };
      } catch (error) {
        logger.warn(`Adapter ${adapter.id} failed: ${error.message}`);
        continue;
      }
    }

    throw new Error(`All ${candidates.length} adapters failed for ${category}:${capability}`);
  }
}

module.exports = ProviderRegistry;
```

---

## Error Handling in Adapters

All adapters must implement consistent error handling:

```javascript
// Standard error responses
const ErrorCodes = {
  UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  TIMEOUT: 'PROVIDER_TIMEOUT',
  INVALID_INPUT: 'INVALID_INPUT',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

class AdapterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

module.exports = { AdapterError, ErrorCodes };
```

---

## Configuration Format

Adapters are configured via environment variables or config files:

```yaml
# config/providers.yaml

voice:
  primary: voicebox
  fallback: [piper, google-cloud]
  voicebox:
    enabled: true
    api_url: http://localhost:8000
  piper:
    enabled: true
    model_path: /models/piper
  google-cloud:
    enabled: false
    api_key: ${GOOGLE_CLOUD_API_KEY}

media:
  primary: comfyui
  fallback: [stability-ai, openai]
  comfyui:
    enabled: true
    api_url: http://localhost:8188
  stability-ai:
    enabled: true
    api_key: ${STABILITY_API_KEY}
    cost_per_image: 0.03
  openai:
    enabled: false
    api_key: ${OPENAI_API_KEY}

agents:
  primary: crewai
  fallback: [autogen, langgraph]
  crewai:
    enabled: true
  autogen:
    enabled: false
```

---

## Best Practices

1. **Always implement health check** - Return quickly
2. **Log adapter selection** - For audit trail
3. **Track costs** - Even for free providers (for volume tracking)
4. **Implement timeout** - Set reasonable defaults, allow override
5. **Handle partial failures** - Graceful degradation is better than crash
6. **Normalize responses** - Same format across all adapters
7. **Cache provider metadata** - Don't hit health endpoints on every request
8. **Test with mocks** - Create mock adapters for testing

---

## Testing Adapters

```javascript
// Example mock adapter for testing

class MockVoiceAdapter extends VoiceAdapter {
  constructor(config) {
    super(config);
    this.capabilities = ['text-to-speech', 'speech-to-text'];
  }

  async healthCheck() {
    this.health = 'healthy';
    return 'healthy';
  }

  async textToSpeech(text, options) {
    return {
      success: true,
      audioBuffer: Buffer.from('mock-audio-data'),
      format: 'mp3',
      duration_ms: 1000,
      cost: 0
    };
  }

  async speechToText(audioBuffer, options) {
    return {
      success: true,
      text: 'mock transcribed text',
      confidence: 0.95,
      cost: 0
    };
  }

  async getAvailableVoices() {
    return ['mock-voice-1', 'mock-voice-2'];
  }
}

// Use in tests
const adapter = new MockVoiceAdapter({ id: 'mock', name: 'Mock' });
```

---

## Summary

- **Base Interface**: All adapters extend `ProviderAdapter`
- **Category Interfaces**: Voice, Media, Agents, Documents, Vision
- **No Hardcoding**: Business logic uses adapters, not providers
- **Pluggable**: Enable/disable via config
- **Fallback Chains**: Try adapters in priority order
- **Cost Tracking**: Every call tracked
- **Health Monitoring**: Continuous health checks
- **Testable**: Easy to mock and test

Adding a new provider = one adapter file.  
Swapping providers = one config change.
