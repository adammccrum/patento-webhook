# LAO Academy + IrisKey.ai Multi-Agent System
## Core Architecture Specification

**Version:** 1.0  
**Status:** Active  
**Last Updated:** 2026-07-24

---

## Design Principles

1. **No Hardcoded Providers** - All external services accessed through adapters
2. **Plugin Architecture** - Components enabled/disabled via configuration
3. **Automatic Discovery** - Alpha discovers available providers at runtime
4. **Modular Adapters** - Every provider is replaceable without touching business logic
5. **Local-First** - Prefer self-hosted open-source, fall back gracefully
6. **Provider Agnostic** - Business logic never references specific providers

---

## System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        User/API Layer                            │
│                  (HTTP, CLI, WebSocket)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                   Authorization & Audit                          │
│          (IrisKey Identity, Permissions, Audit Events)          │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                  Alpha Orchestrator                              │
│    (Task Routing, Agent Delegation, State Management)           │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│              Specialist Agents (26 NATO)                         │
│     Each Agent Uses Task-Specific Provider Adapters             │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│           Provider Registry & Discovery                          │
│    (Dynamically loads available components at startup)          │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│         Pluggable Provider Adapters                              │
│  ┌────────────────────┬────────────────────┬─────────────────┐  │
│  │  Voice Providers   │  Media Providers   │ Other Providers │  │
│  │  ┌──────────────┐  │  ┌──────────────┐  │                 │  │
│  │  │ Voicebox     │  │  │ ComfyUI      │  │ And adapters    │  │
│  │  │ Piper        │  │  │ Stable Diff  │  │ for each        │  │
│  │  │ Kokoro TTS   │  │  │ FLUX         │  │ component in    │  │
│  │  │ Whisper.cpp  │  │  │ CogVideoX    │  │ the registry    │  │
│  │  │ Google Cloud │  │  │ RunPod cloud │  │                 │  │
│  │  │ AWS Polly    │  │  │ OpenAI API   │  │                 │  │
│  │  └──────────────┘  │  └──────────────┘  │                 │  │
│  └────────────────────┴────────────────────┴─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│          Infrastructure & External Services                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Ollama   │  │ IrisKey  │  │ LAO API  │  │ Database │       │
│  │ vLLM    │  │ Identity │  │ Publish  │  │ Storage  │       │
│  │ Docker   │  │ Biometric│  │ Courses  │  │ Audit    │       │
│  │ Cluster  │  └──────────┘  └──────────┘  └──────────┘       │
│  └──────────┘                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Alpha Orchestrator
- Entry point for all user requests
- Receives objectives, breaks into tasks
- Manages task queue and execution
- Delegates to specialist agents
- Aggregates results
- Enforces state consistency

**Key Responsibilities:**
- Task parsing and validation
- Agent capability matching
- Execution orchestration
- Result aggregation
- Error handling and recovery

### 2. Provider Registry
- Dynamic discovery of available providers
- Capability matching (which provider can do what)
- Health monitoring of available providers
- Version tracking and compatibility checks
- Configuration-driven enablement/disablement

**Registry Entry Structure:**
```json
{
  "id": "voicebox-provider",
  "category": "voice",
  "name": "Voicebox",
  "type": "text-to-speech",
  "version": "1.0.0",
  "github": "url",
  "license": "Apache-2.0",
  "docker_support": true,
  "api_available": true,
  "local_support": true,
  "cloud_support": true,
  "gpu_required": false,
  "capabilities": ["text-to-speech", "speech-recognition"],
  "status": "healthy",
  "health_check_url": "http://localhost:8000/health",
  "last_tested": "2026-07-24T10:00:00Z"
}
```

### 3. Provider Adapters
- Normalize provider APIs to common interfaces
- Handle provider-specific configuration
- Manage fallback chains
- Cost tracking and limiting
- Error handling and retries

**Adapter Pattern:**
```
ProviderAdapter (Interface)
├── VoiceAdapter
│   ├── VoiceboxAdapter
│   ├── GoogleCloudAdapter
│   ├── AwsPollyAdapter
│   └── PiperAdapter
├── MediaAdapter
│   ├── ComfyUIAdapter
│   ├── StabilityAIAdapter
│   ├── OpenAIAdapter
│   └── LocalDiffusionAdapter
├── AgentFrameworkAdapter
│   ├── CrewAIAdapter
│   ├── AutoGenAdapter
│   └── LangGraphAdapter
└── ... (for each provider category)
```

### 4. Specialist Agents (26 NATO Phonetic)
Each agent:
- Receives delegated tasks from Alpha
- Uses available provider adapters
- Never hardcodes provider selection
- Reports status and progress
- Handles failures gracefully

### 5. Authorization & Audit
- Verifies user identity via IrisKey
- Checks permissions and policies
- Gates high-impact operations
- Records immutable audit trail
- Enforces cost/rate limits

---

## Data Flow: Example Course Creation

```
1. User → HTTP POST /courses/create
           with course spec
           
2. Alpha → Parse request, verify auth
           Break into subtasks

3. Charlie Agent → Ask researchers
                   Use CrewAI/LangGraph if available
                   Falls back to Claude API

4. Delta Agent → Request document generation
               Uses available LLM adapters
               Produces structured script

5. Echo Agent → Convert script to narration
              Discovers voice providers (Voicebox, Piper, Google)
              Selects best available
              Returns audio files

6. Foxtrot Agent → Generate course visuals
                 Discovers media providers (ComfyUI, Stable Diff, etc.)
                 Creates images and videos
                 Returns media assets

7. Papa Agent → Validate content
              Check factual accuracy
              Verify media quality

8. Uniform Agent → Compliance check
                  Check disclosures
                  Verify legal requirements

9. Tango Agent → Orchestrate publishing
               Assemble course package
               Call LAO API
               Publish course

10. Audit System → Record all events
                  Agent actions
                  Provider calls
                  Cost tracking
                  Authorization decisions

11. Alpha → Aggregate results
          Return to user
          Update operation centre state
```

---

## Configuration System

### Environment-Based
```
ENABLE_VOICE=true
VOICE_PROVIDERS=voicebox,piper,google-cloud
VOICE_PRIMARY=voicebox
VOICE_FALLBACK_1=piper
VOICE_FALLBACK_2=google-cloud

ENABLE_MEDIA=true
MEDIA_PROVIDERS=comfyui,stability-ai,openai
MEDIA_PRIMARY=comfyui
MEDIA_FALLBACK_1=stability-ai

ENABLE_AGENTS=true
AGENT_FRAMEWORK=crewai,autogen,langgraph

IRISKEY_ENABLED=true
IRISKEY_API_URL=https://api.iriskey.ai
```

### Registry File-Based
```
/config/providers.yaml
/config/agents.yaml
/config/permissions.yaml
/config/workflows.yaml
```

---

## Key Design Decisions

### Provider Discovery
- **Startup:** Read configuration, probe for available providers
- **Health Checks:** Periodically verify provider connectivity
- **Fallback:** If primary provider unavailable, try next in chain
- **Failure:** Log, alert, gracefully degrade

### Cost Management
- **Tracking:** Every provider call tracked with cost
- **Limiting:** Per-agent and per-operation cost limits
- **Estimation:** Pre-request cost estimates for user approval
- **Reporting:** Audit events include cost per action

### Provider Swapping
- **No Restart:** Providers can be enabled/disabled without restart
- **Graceful:** In-flight requests complete with current provider
- **Testing:** Easy to test with mock providers
- **Scaling:** Use cheap local providers for development, premium cloud for production

### Error Handling
- **Retries:** Exponential backoff for transient failures
- **Fallback:** Try next provider in chain
- **Timeout:** Configurable per provider type
- **Circuit Breaker:** Disable unhealthy providers

---

## Success Criteria

✅ No provider name in any business logic file  
✅ All providers accessed through adapters  
✅ Adding a new provider requires only one new adapter file  
✅ Providers can be enabled/disabled without code changes  
✅ Health checks verify provider availability at startup  
✅ Fallback chains work automatically  
✅ Cost tracked for every external API call  
✅ Audit trail includes provider used for each action  
✅ Tests pass with different provider combinations  

---

## File Structure

```
src/
├── core/
│   ├── alpha-orchestrator.js      # Task routing, delegation
│   ├── task-executor.js           # Execution engine
│   └── state-manager.js           # State tracking
├── providers/
│   ├── registry.js                # Provider discovery and health
│   ├── adapter-base.js            # Base adapter interface
│   └── [provider-adapters]/
│       ├── voice/
│       ├── media/
│       ├── agents/
│       ├── documents/
│       └── vision/
├── agents/
│   ├── base-agent.js              # Agent interface
│   └── [nato-agents]/              # Alpha, Bravo, Charlie, etc.
├── authorization/
│   ├── iriskey-client.js
│   ├── permission-checker.js
│   └── audit-logger.js
├── config/
│   ├── providers.yaml
│   ├── agents.yaml
│   ├── permissions.yaml
│   └── env-loader.js
└── utils/
    ├── logger.js
    ├── error-handler.js
    └── cost-tracker.js
```

---

## Next Steps

1. Create provider registry system
2. Implement base adapter interface
3. Build Alpha orchestrator
4. Create specialist agents (on-demand)
5. Implement authorization & audit
6. Add provider adapters (as needed)
7. Build operation centre UI
8. Deploy and test

**No provider installation until explicitly configured and required.**
