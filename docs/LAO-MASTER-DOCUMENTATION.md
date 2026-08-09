# LAO — Master Documentation

**Version:** 2.0 (consolidated)
**Status:** Active — supersedes the eight separate documents previously in `docs/`
**Last Updated:** 2026-08-09

---

## About this document

This is the single source of truth for LAO's architecture, specifications, implementation guidance, and competitive research. It replaces the following files, whose full history remains in git:

`ARCHITECTURE.md` · `PROVIDER_REGISTRY.md` · `ADAPTER_SPECIFICATION.md` · `AGENT_SYSTEM.md` · `AUTHORIZATION_AND_AUDIT.md` · `IMPLEMENTATION_GUIDE.md` · `QUICKSTART.md` · `INDEX.md` · `LAO-COMPETITIVE-ENGINEERING-INTELLIGENCE.md`

**Content from those documents is preserved verbatim.** Nothing was rewritten, summarised, or silently corrected during the merge. Where the source documents *contradicted each other*, both versions are retained as-is and every conflict is catalogued in **Part IX — Reconciliation Log**, with a recommended resolution awaiting ratification.

> ⚠️ **Read Part IX before writing any code against Parts I–VII.** Consolidation surfaced eleven substantive conflicts between the previously separate documents, including two incompatible definitions of the base adapter class and three incorrect licence records. Implementing from a single Part without checking Part IX will reproduce those defects.

### Reading paths

| If you are… | Read |
|---|---|
| New to LAO | Orientation → Part I → Part VIII §A |
| Building the foundation | Part I → Part III → Part VI → **Part IX** |
| Adding a provider | Part II → Part III → Part VI "How to Add a New Provider" → **Part IX §3** |
| Building an agent | Part IV → Part V → **Part IX §1** |
| Deciding what to build next | Part VIII (§A findings, §B value test, §C build-vs-borrow) |
| Assessing legal/licence risk | Part VIII §G → **Part IX §3** |

### Document lifecycles

The Parts do **not** change at the same rate. Treat them accordingly:

| Part | Type | Changes when |
|---|---|---|
| I–V | Specification | An architectural decision changes. Rare; requires review. |
| VI–VII | Tutorial | The build steps change. Follows the specs. |
| VIII | Living research | A licence changes, a measurement contradicts a finding, a new competitor appears. Expected to change often. |
| IX | Open defect log | Entries are added on discovery and removed only when resolved in the specs. |

---

## Table of contents

- **Orientation** — key principles, deployment models, what the foundation enables
- **[Part I — System Architecture](#part-i--system-architecture)** — design principles, layers, core components, data flow, configuration
- **[Part II — Provider Registry](#part-ii--provider-registry)** — registry schema and the full provider inventory (voice, media, agents, documents, vision, database, LLM)
- **[Part III — Adapter Specification](#part-iii--adapter-specification)** — base and category interfaces, implementation example, registry integration, error handling, testing
- **[Part IV — Agent System](#part-iv--agent-system)** — the 26 NATO agents, Alpha orchestrator, base agent, worked examples, communication pattern
- **[Part V — Authorization and Audit](#part-v--authorization-and-audit)** — authorization flow, IrisKey, permissions, audit events, storage, approval gates, cost tracking
- **[Part VI — Implementation Guide](#part-vi--implementation-guide)** — phased buildout, testing strategy, deployment
- **[Part VII — Quick Start](#part-vii--quick-start)** — the 30-minute path (see Part IX §4 before running)
- **[Part VIII — Competitive Engineering Intelligence](#part-viii--competitive-engineering-intelligence)** — 13 researched categories, verified licence posture, build-vs-borrow, original LAO IP, metrics
- **[Part IX — Reconciliation Log](#part-ix--reconciliation-log)** — every conflict consolidation exposed

---

## Orientation

### The five operating principles

**1. No hardcoded providers.** Every provider is reached through an adapter. Business logic never names a service.

```javascript
// ✅ GOOD: Via adapter
const adapter = await registry.getAdapter('voice', 'text-to-speech');
const audio = await adapter.textToSpeech(text);

// ❌ BAD: Direct provider reference
const audio = await voicebox.textToSpeech(text);
```

**2. Progressive enablement.** Install and enable providers only when needed; configuration decides what is active.

```yaml
# config/providers.yaml — control what's enabled
voice:
  voicebox: enabled: true
  piper: enabled: false
  google-cloud: enabled: false
```

**3. Adapter pattern.** All providers in a category implement one interface, so they are interchangeable.

```
VoiceAdapter interface:
├─ textToSpeech()
├─ speechToText()
├─ getAvailableVoices()
└─ cloneVoice()

All voice providers (Voicebox, Piper, Google, AWS) implement the same interface.
```

**4. Fallback chains.** When the primary provider is unavailable, the next is tried automatically.

```
Voice request:
1. Try Voicebox → healthy? Use it
2. Voicebox down? Try Piper
3. Piper down? Try Google Cloud
4. All down? Error
```

**5. Cost tracking.** Every external call is tracked for billing and audit.

```javascript
await adapter.trackCost('textToSpeech', text.length, costPerUnit);
// Logged to audit trail
// Checked against user limits
// Shown to user before approval
```

### Deployment models

**Development — local + Docker Compose**
```yaml
services:
  app: our system
  voicebox: local voice provider
  comfyui: local media provider
  postgres: audit logging
```

**Production — cloud + fallbacks**
```
Primary: Ollama (local LLM) + ComfyUI (local media)
Fallback: OpenRouter API + Stability AI API
Monitoring: Health checks every 60 sec
Audit: PostgreSQL with replication
```

**Hybrid — best of both**
```
Free tier operations: Local providers (Voicebox, ComfyUI)
High-quality operations: Cloud providers (Stability AI, OpenAI)
Cost control: Alpha selects provider based on:
  - User's monthly budget
  - Quality requirements
  - Time constraints
```

### What this foundation enables

✅ **Modular architecture** — add/remove components without rewriting
✅ **Provider flexibility** — swap providers via config, no code changes
✅ **Cost optimisation** — use free local providers, fall back to cloud
✅ **Graceful degradation** — if a provider is down, try the next automatically
✅ **Security & compliance** — authorization gates plus an immutable audit trail
✅ **Scalability** — agents can run in parallel, distributed
✅ **Testability** — mock providers for tests, real providers in production
✅ **Observability** — health checks, status dashboard, audit logs

---
## Part I — System Architecture

> Merged from `docs/ARCHITECTURE.md`. Content preserved verbatim.

### Core Architecture Specification

**Version:** 1.0  
**Status:** Active  
**Last Updated:** 2026-07-24

---

### Design Principles

1. **No Hardcoded Providers** - All external services accessed through adapters
2. **Plugin Architecture** - Components enabled/disabled via configuration
3. **Automatic Discovery** - Alpha discovers available providers at runtime
4. **Modular Adapters** - Every provider is replaceable without touching business logic
5. **Local-First** - Prefer self-hosted open-source, fall back gracefully
6. **Provider Agnostic** - Business logic never references specific providers

---

### System Layers

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

### Core Components

#### 1. Alpha Orchestrator
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

#### 2. Provider Registry
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

#### 3. Provider Adapters
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

#### 4. Specialist Agents (26 NATO Phonetic)
Each agent:
- Receives delegated tasks from Alpha
- Uses available provider adapters
- Never hardcodes provider selection
- Reports status and progress
- Handles failures gracefully

#### 5. Authorization & Audit
- Verifies user identity via IrisKey
- Checks permissions and policies
- Gates high-impact operations
- Records immutable audit trail
- Enforces cost/rate limits

---

### Data Flow: Example Course Creation

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

### Configuration System

#### Environment-Based
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

#### Registry File-Based
```
/config/providers.yaml
/config/agents.yaml
/config/permissions.yaml
/config/workflows.yaml
```

---

### Key Design Decisions

#### Provider Discovery
- **Startup:** Read configuration, probe for available providers
- **Health Checks:** Periodically verify provider connectivity
- **Fallback:** If primary provider unavailable, try next in chain
- **Failure:** Log, alert, gracefully degrade

#### Cost Management
- **Tracking:** Every provider call tracked with cost
- **Limiting:** Per-agent and per-operation cost limits
- **Estimation:** Pre-request cost estimates for user approval
- **Reporting:** Audit events include cost per action

#### Provider Swapping
- **No Restart:** Providers can be enabled/disabled without restart
- **Graceful:** In-flight requests complete with current provider
- **Testing:** Easy to test with mock providers
- **Scaling:** Use cheap local providers for development, premium cloud for production

#### Error Handling
- **Retries:** Exponential backoff for transient failures
- **Fallback:** Try next provider in chain
- **Timeout:** Configurable per provider type
- **Circuit Breaker:** Disable unhealthy providers

---

### Success Criteria

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

### File Structure

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

### Next Steps

1. Create provider registry system
2. Implement base adapter interface
3. Build Alpha orchestrator
4. Create specialist agents (on-demand)
5. Implement authorization & audit
6. Add provider adapters (as needed)
7. Build operation centre UI
8. Deploy and test

**No provider installation until explicitly configured and required.**


---

## Part II — Provider Registry

> Merged from `docs/PROVIDER_REGISTRY.md`. Content preserved verbatim.

**Version:** 1.0  
**Purpose:** Define all available open-source and commercial providers  
**Status:** Living document

---

### Registry Entry Schema

Every provider entry MUST include:

```json
{
  "id": "unique-provider-id",
  "category": "voice|media|agents|documents|vision|database|llm",
  "subcategory": "text-to-speech|speech-to-text|image-generation|...",
  "name": "Human-readable name",
  "version": "1.0.0",
  "github": "https://github.com/owner/repo",
  "license": "Apache-2.0|MIT|GPL|Commercial|Proprietary",
  "description": "What this provider does",
  
  "deployment": {
    "docker_support": true|false,
    "docker_image": "docker-image-name",
    "local_support": true|false,
    "cloud_support": true|false,
    "cloud_providers": ["aws", "gcp", "azure"],
    "gpu_required": true|false,
    "gpu_recommended": true|false,
    "min_vram_gb": 4,
    "cpu_cores_min": 2,
    "memory_min_gb": 8
  },
  
  "api": {
    "api_available": true|false,
    "api_type": "rest|grpc|websocket|openapi",
    "api_url_format": "http://localhost:8000/api",
    "authentication": "none|api-key|oauth|bearer",
    "rate_limits": "requests/min",
    "timeout_ms": 30000
  },
  
  "capabilities": ["capability1", "capability2"],
  "supported_languages": ["en", "es", "fr"],
  "quality_levels": ["standard", "high", "premium"],
  "performance": {
    "avg_response_time_ms": 1000,
    "throughput_rps": 10,
    "concurrent_requests": 5
  },
  
  "cost": {
    "type": "free|freemium|usage-based|subscription|commercial",
    "free_tier": true|false,
    "cost_per_unit": 0.01,
    "unit": "image|request|minute|month",
    "minimum_monthly": 0,
    "description": "Pricing details"
  },
  
  "setup": {
    "docker_compose_available": true|false,
    "installation_steps": "URL to setup guide",
    "required_env_vars": ["VAR1", "VAR2"],
    "optional_env_vars": ["VAR3"],
    "health_check_endpoint": "/health",
    "startup_time_seconds": 10
  },
  
  "status": {
    "enabled": true|false,
    "health": "healthy|degraded|unhealthy|unknown",
    "last_checked": "2026-07-24T10:00:00Z",
    "uptime_percent": 99.9,
    "last_error": null
  },
  
  "adapter": {
    "interface": "VoiceAdapter|MediaAdapter|AgentAdapter",
    "adapter_file": "src/providers/adapters/voice/voicebox-adapter.js",
    "implemented": true|false
  }
}
```

---

### Voice Providers

#### Voicebox (Open Source)
```yaml
id: voicebox
category: voice
subcategories:
  - text-to-speech
  - speech-to-text
name: Voicebox
version: Latest
github: https://github.com/voicebox/voicebox
license: Apache-2.0
deployment:
  docker_support: true
  local_support: true
  cloud_support: true
  gpu_required: false
capabilities:
  - text-to-speech
  - speech-to-text
  - voice-cloning
  - multilingual
cost:
  type: free
adapter:
  interface: VoiceAdapter
  adapter_file: src/providers/adapters/voice/voicebox-adapter.js
```

#### Piper (Open Source)
```yaml
id: piper
category: voice
subcategories:
  - text-to-speech
name: Piper TTS
version: Latest
github: https://github.com/rhasspy/piper
license: MIT
deployment:
  docker_support: true
  local_support: true
  cloud_support: false
  gpu_required: false
capabilities:
  - text-to-speech
  - fast-inference
  - lightweight
cost:
  type: free
```

#### Kokoro TTS (Open Source)
```yaml
id: kokoro-tts
category: voice
subcategories:
  - text-to-speech
name: Kokoro TTS
github: https://github.com/remsky/kokoro-tts
license: Apache-2.0
deployment:
  docker_support: true
  local_support: true
  gpu_required: false
capabilities:
  - text-to-speech
  - natural-sounding
  - fast
cost:
  type: free
```

#### Whisper.cpp (Open Source)
```yaml
id: whisper-cpp
category: voice
subcategories:
  - speech-to-text
name: Whisper.cpp
github: https://github.com/ggerganov/whisper.cpp
license: MIT
deployment:
  docker_support: true
  local_support: true
  gpu_required: false
capabilities:
  - speech-to-text
  - fast-inference
  - cpu-only
cost:
  type: free
```

#### Coqui TTS (Open Source)
```yaml
id: coqui-tts
category: voice
subcategories:
  - text-to-speech
  - voice-cloning
name: Coqui TTS
github: https://github.com/coqui-ai/tts
license: MPL-2.0
deployment:
  docker_support: true
  local_support: true
  gpu_required: false
capabilities:
  - text-to-speech
  - voice-cloning
  - multilingual
cost:
  type: free
```

#### Google Cloud TTS (Commercial)
```yaml
id: google-cloud-tts
category: voice
subcategories:
  - text-to-speech
  - speech-to-text
name: Google Cloud Text-to-Speech
deployment:
  cloud_support: true
  gpu_required: false
capabilities:
  - text-to-speech
  - high-quality-voices
  - many-languages
cost:
  type: usage-based
  cost_per_unit: 0.000004
  unit: character
  free_tier: true
  free_tier_limit: "1M chars/month"
```

#### AWS Polly (Commercial)
```yaml
id: aws-polly
category: voice
subcategories:
  - text-to-speech
  - speech-to-text
name: AWS Polly
deployment:
  cloud_support: true
cost:
  type: usage-based
  cost_per_unit: 0.000004
  unit: character
```

---

### Media Providers

#### ComfyUI (Open Source)
```yaml
id: comfyui
category: media
subcategories:
  - image-generation
  - image-to-video
  - video-generation
name: ComfyUI
github: https://github.com/comfyanonymous/ComfyUI
license: GPL-3.0
deployment:
  docker_support: true
  local_support: true
  cloud_support: true
  gpu_required: true
  min_vram_gb: 4
capabilities:
  - text-to-image
  - image-to-video
  - video-generation
  - node-based-workflow
cost:
  type: free
```

#### Stable Diffusion (Open Source)
```yaml
id: stable-diffusion
category: media
subcategories:
  - image-generation
name: Stable Diffusion
github: https://github.com/replicate/cog-stable-diffusion
license: OpenRAIL
deployment:
  docker_support: true
  local_support: true
  cloud_support: true
  gpu_required: true
  min_vram_gb: 6
capabilities:
  - text-to-image
  - image-variation
  - inpainting
cost:
  type: free
```

#### FLUX (Open Source)
```yaml
id: flux
category: media
subcategories:
  - image-generation
name: FLUX Text-to-Image
github: https://github.com/black-forest-labs/flux
license: FLUX_1_TERMS
deployment:
  docker_support: true
  local_support: true
  gpu_required: true
  min_vram_gb: 8
capabilities:
  - text-to-image
  - high-quality
  - realistic
cost:
  type: free
```

#### CogVideoX (Open Source)
```yaml
id: cogvideox
category: media
subcategories:
  - video-generation
  - image-to-video
name: CogVideoX Video Generation
github: https://github.com/THUDM/CogVideo
license: MIT
deployment:
  docker_support: true
  local_support: true
  gpu_required: true
  min_vram_gb: 12
capabilities:
  - text-to-video
  - image-to-video
  - video-generation
cost:
  type: free
```

#### Stability AI (Commercial)
```yaml
id: stability-ai
category: media
subcategories:
  - image-generation
name: Stability AI API
deployment:
  cloud_support: true
capabilities:
  - text-to-image
  - image-variation
  - upscaling
cost:
  type: usage-based
  cost_per_unit: 0.03
  unit: image
  free_tier: true
  free_tier_credits: 25
```

#### OpenAI DALL-E (Commercial)
```yaml
id: openai-dalle
category: media
subcategories:
  - image-generation
name: OpenAI DALL-E
deployment:
  cloud_support: true
capabilities:
  - text-to-image
  - image-editing
  - variations
cost:
  type: usage-based
  cost_per_unit: 0.020
  unit: image
```

---

### Agent Frameworks

#### CrewAI (Open Source)
```yaml
id: crewai
category: agents
subcategories:
  - multi-agent-orchestration
name: CrewAI
github: https://github.com/joaomdmoura/crewai
license: MIT
capabilities:
  - multi-agent-coordination
  - task-delegation
  - tool-integration
cost:
  type: free
deployment:
  local_support: true
  cloud_support: true
```

#### AutoGen (Open Source)
```yaml
id: autogen
category: agents
subcategories:
  - multi-agent-orchestration
name: AutoGen
github: https://github.com/microsoft/autogen
license: CC-BY-4.0
capabilities:
  - multi-agent-conversation
  - code-execution
  - human-in-loop
cost:
  type: free
```

#### LangGraph (Open Source)
```yaml
id: langgraph
category: agents
subcategories:
  - agent-workflows
  - state-management
name: LangGraph
github: https://github.com/langchain-ai/langgraph
license: MIT
capabilities:
  - workflow-orchestration
  - state-persistence
  - human-in-loop
cost:
  type: free
```

#### OpenHands (Open Source)
```yaml
id: openhands
category: agents
subcategories:
  - autonomous-coding
name: OpenHands
github: https://github.com/All-Hands-AI/OpenHands
license: MIT
capabilities:
  - code-generation
  - repository-browsing
  - autonomous-tasks
cost:
  type: free
```

---

### Document Providers

#### AnythingLLM (Open Source)
```yaml
id: anythingllm
category: documents
subcategories:
  - document-processing
  - rag
name: AnythingLLM
github: https://github.com/Mintplex-Labs/anything-llm
license: MIT
capabilities:
  - document-embedding
  - vector-search
  - rag-pipeline
cost:
  type: free
```

#### Docling (Open Source)
```yaml
id: docling
category: documents
subcategories:
  - document-extraction
  - parsing
name: Docling
github: https://github.com/DS4SD/docling
license: MIT
capabilities:
  - pdf-parsing
  - document-extraction
  - layout-understanding
cost:
  type: free
```

---

### Vision Providers

#### YOLO (Open Source)
```yaml
id: yolo
category: vision
subcategories:
  - object-detection
name: YOLO
github: https://github.com/ultralytics/ultralytics
license: AGPL-3.0
capabilities:
  - object-detection
  - segmentation
  - pose-estimation
cost:
  type: free
```

#### SAM2 (Open Source)
```yaml
id: sam2
category: vision
subcategories:
  - segmentation
name: Segment Anything Model 2
github: https://github.com/facebookresearch/sam2
license: Apache-2.0
capabilities:
  - image-segmentation
  - instance-segmentation
  - video-segmentation
cost:
  type: free
```

---

### Database Providers

#### PostgreSQL (Open Source)
```yaml
id: postgresql
category: database
subcategories:
  - relational
  - vector
name: PostgreSQL
deployment:
  docker_support: true
  local_support: true
capabilities:
  - relational-data
  - vector-embeddings (pgvector)
  - json-support
cost:
  type: free
```

#### Redis (Open Source)
```yaml
id: redis
category: database
subcategories:
  - cache
  - realtime
name: Redis
deployment:
  docker_support: true
  local_support: true
capabilities:
  - caching
  - real-time-data
  - message-queue
cost:
  type: free
```

#### ChromaDB (Open Source)
```yaml
id: chromadb
category: database
subcategories:
  - vector
name: ChromaDB
github: https://github.com/chroma-core/chroma
license: Apache-2.0
capabilities:
  - vector-embeddings
  - semantic-search
cost:
  type: free
```

#### Qdrant (Open Source)
```yaml
id: qdrant
category: database
subcategories:
  - vector
name: Qdrant
github: https://github.com/qdrant/qdrant
license: AGPL-3.0
capabilities:
  - vector-search
  - similarity-search
  - filtering
cost:
  type: free
deployment:
  docker_support: true
  local_support: true
  cloud_support: true
```

---

### LLM Providers

#### Ollama (Open Source)
```yaml
id: ollama
category: llm
subcategories:
  - local-inference
  - llm-serving
name: Ollama
github: https://github.com/ollama/ollama
license: MIT
deployment:
  docker_support: true
  local_support: true
  gpu_required: false
capabilities:
  - local-llm-inference
  - ollama-library
  - api-interface
cost:
  type: free
```

#### vLLM (Open Source)
```yaml
id: vllm
category: llm
subcategories:
  - inference-engine
  - llm-serving
name: vLLM
github: https://github.com/vllm-project/vllm
license: Apache-2.0
deployment:
  docker_support: true
  local_support: true
  gpu_required: true
capabilities:
  - high-throughput-serving
  - batching
  - quantization
cost:
  type: free
```

#### OpenRouter (Commercial)
```yaml
id: openrouter
category: llm
name: OpenRouter
deployment:
  cloud_support: true
capabilities:
  - access-multiple-models
  - fallback-routing
cost:
  type: usage-based
  free_tier: true
```

---

### Status Tracking

Each provider entry includes:
- `enabled`: Is this provider active in current environment?
- `health`: Current health status (healthy/degraded/unhealthy)
- `last_checked`: When was health last verified?
- `uptime_percent`: Rolling uptime percentage
- `last_error`: Last error encountered (for debugging)

---

### Usage Rules

1. **Always check `enabled` flag** before using provider
2. **Check health status** before critical operations
3. **Use adapter interface** - never call provider directly
4. **Track cost** for every external API call
5. **Implement fallback chains** - use next provider if primary fails
6. **Log provider selection** for audit trail
7. **Test with mock providers** during development
8. **Monitor provider health** continuously

---

### Adding New Providers

To add a new provider:

1. Create entry in this registry with full metadata
2. Implement adapter (extends `ProviderAdapter`)
3. Add health check endpoint
4. Add configuration for enabling/disabling
5. Test with mock data
6. Document in README

No changes to business logic needed.


---

## Part III — Adapter Specification

> Merged from `docs/ADAPTER_SPECIFICATION.md`. Content preserved verbatim.

**Version:** 1.0  
**Purpose:** Define standard interfaces for all provider adapters  
**Status:** Active

---

### Core Principle

All external services are accessed through adapters. Business logic never calls providers directly.

Each adapter normalizes a provider's API to a common interface:
- Same method names across all implementations
- Same parameter and response formats
- Same error handling
- Same health checking

Swapping providers = changing one configuration line + restarting.

---

### Base Adapter Interface

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

### Category-Specific Interfaces

#### Voice Adapter

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

#### Media Adapter

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

#### Agent Framework Adapter

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

#### Document Adapter

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

#### Vision Adapter

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

### Adapter Implementation Example

#### Voicebox TTS Adapter

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

### Adapter Registry Integration

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

### Error Handling in Adapters

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

### Configuration Format

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

### Best Practices

1. **Always implement health check** - Return quickly
2. **Log adapter selection** - For audit trail
3. **Track costs** - Even for free providers (for volume tracking)
4. **Implement timeout** - Set reasonable defaults, allow override
5. **Handle partial failures** - Graceful degradation is better than crash
6. **Normalize responses** - Same format across all adapters
7. **Cache provider metadata** - Don't hit health endpoints on every request
8. **Test with mocks** - Create mock adapters for testing

---

### Testing Adapters

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

### Summary

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


---

## Part IV — Agent System

> Merged from `docs/AGENT_SYSTEM.md`. Content preserved verbatim.

**Version:** 1.0  
**Purpose:** Define the 26-agent NATO phonetic system and orchestration  
**Status:** Active

---

### Overview

The system uses 26 specialist agents named after NATO phonetic alphabet:

| Code | Name | Role | Primary Capability |
|------|------|------|-------------------|
| AA | Alpha | Executive Orchestrator | Task routing, delegation, oversight |
| BB | Bravo | Software Engineering | Code generation, debugging, refactoring |
| CC | Charlie | Research & Intelligence | Information gathering, analysis |
| DD | Delta | Documents & Reports | Content generation, document assembly |
| EE | Echo | Voice & Audio | Speech synthesis, voice recognition |
| FF | Foxtrot | Image & Video Generation | Media creation, visual content |
| GG | Golf | Marketing & Social Media | Content promotion, social strategies |
| HH | Hotel | Website & Front-End | UI/UX, web development |
| II | India | Automation & Workflows | Process automation, workflow design |
| JJ | Juliet | Customer Support | Help desk, customer service |
| KK | Kilo | Sales & CRM | Sales processes, customer relations |
| LL | Lima | Finance, Grants & Funding | Financial analysis, funding strategies |
| MM | Mike | Cybersecurity | Security assessment, threat analysis |
| NN | November | DevOps & Infrastructure | Deployment, infrastructure management |
| OO | Oscar | Data & Analytics | Data analysis, dashboards, insights |
| PP | Papa | Testing & Quality Assurance | QA, testing, validation |
| QQ | Quebec | Knowledge Base & Memory | Documentation, knowledge management |
| RR | Romeo | APIs & Integrations | API design, service integration |
| SS | Sierra | IrisKey Biometrics & Identity | Identity verification, authorization |
| TT | Tango | LAO Academy Training | Course creation, training delivery |
| UU | Uniform | Compliance & Governance | Policy enforcement, compliance checks |
| VV | Victor | Computer Vision | Image analysis, visual intelligence |
| WW | Whiskey | Hardware & IoT | Device integration, hardware management |
| XX | X-ray | Experimental Projects | R&D, experimental features |
| YY | Yankee | Communications | Messaging, notifications, comms |
| ZZ | Zulu | Monitoring & System Health | Health checks, alerting, monitoring |

---

### Alpha: Executive Orchestrator

The system's primary agent. Entry point for all user requests.

```javascript
// src/agents/alpha-orchestrator.js

class AlphaOrchestrator extends BaseAgent {
  constructor(registry, config) {
    super('Alpha', 'AA', config);
    this.registry = registry;
    this.taskQueue = [];
    this.executingTasks = new Map();
  }

  async receiveObjective(objective) {
    // 1. Parse user objective
    // 2. Break into subtasks
    // 3. Create task graph
    // 4. Delegate to specialist agents
    // 5. Aggregate results
    // 6. Return to user
  }

  async delegateTask(agentCode, task, context) {
    // Get agent from registry
    const agent = this.registry.getAgent(agentCode);
    if (!agent) {
      throw new Error(`Agent ${agentCode} not found`);
    }

    // Create task envelope
    const taskEnvelope = {
      id: uuid(),
      agent_code: agentCode,
      task: task,
      context: context,
      created_at: new Date().toISOString(),
      status: 'pending'
    };

    // Add to queue
    this.taskQueue.push(taskEnvelope);

    // Execute (or queue if agent busy)
    return this.executeTask(taskEnvelope);
  }

  async executeTask(taskEnvelope) {
    const agent = this.registry.getAgent(taskEnvelope.agent_code);
    
    try {
      taskEnvelope.status = 'executing';
      this.executingTasks.set(taskEnvelope.id, taskEnvelope);

      const result = await agent.execute(
        taskEnvelope.task,
        taskEnvelope.context
      );

      taskEnvelope.status = 'completed';
      taskEnvelope.result = result;

      // Audit log
      await auditLog({
        timestamp: new Date().toISOString(),
        agent: 'Alpha',
        action: 'delegated_task',
        target_agent: taskEnvelope.agent_code,
        task_id: taskEnvelope.id,
        status: 'success'
      });

      return result;
    } catch (error) {
      taskEnvelope.status = 'failed';
      taskEnvelope.error = error.message;

      await auditLog({
        timestamp: new Date().toISOString(),
        agent: 'Alpha',
        action: 'delegated_task',
        target_agent: taskEnvelope.agent_code,
        task_id: taskEnvelope.id,
        status: 'failed',
        error: error.message
      });

      throw error;
    } finally {
      this.executingTasks.delete(taskEnvelope.id);
    }
  }

  async getStatus() {
    return {
      agent: 'Alpha',
      status: 'orchestrating',
      task_queue_length: this.taskQueue.length,
      executing_tasks: this.executingTasks.size,
      task_summary: Array.from(this.executingTasks.values()).map(t => ({
        id: t.id,
        agent: t.agent_code,
        task: t.task.description,
        started_at: t.created_at
      }))
    };
  }
}
```

---

### Base Agent Interface

All specialist agents extend this:

```javascript
// src/agents/base-agent.js

class BaseAgent {
  constructor(name, code, config) {
    this.name = name;      // e.g., "Echo"
    this.code = code;      // e.g., "EE"
    this.config = config;
    this.status = 'idle';
    this.currentTask = null;
    this.completed_count = 0;
    this.failed_count = 0;
    this.last_error = null;
  }

  // REQUIRED: Execute delegated task
  async execute(task, context) {
    throw new Error('execute() must be implemented');
  }

  // OPTIONAL: Get available capabilities
  async getCapabilities() {
    return [];
  }

  // OPTIONAL: Health check
  async healthCheck() {
    return {
      status: 'healthy',
      last_checked: new Date().toISOString()
    };
  }

  // OPTIONAL: Get current status
  async getStatus() {
    return {
      agent: this.name,
      code: this.code,
      status: this.status,
      current_task: this.currentTask,
      completed: this.completed_count,
      failed: this.failed_count,
      last_error: this.last_error
    };
  }

  // Utility: Report progress
  async reportProgress(progress) {
    await auditLog({
      timestamp: new Date().toISOString(),
      agent: this.name,
      action: 'progress',
      progress: progress
    });
  }

  // Utility: Report error
  async reportError(error) {
    this.last_error = error.message;
    this.failed_count += 1;
    await auditLog({
      timestamp: new Date().toISOString(),
      agent: this.name,
      action: 'error',
      error: error.message
    });
  }
}
```

---

### Echo Agent (Voice)

Example specialist agent implementation:

```javascript
// src/agents/echo-voice.js

const BaseAgent = require('./base-agent');

class EchoAgent extends BaseAgent {
  constructor(voiceRegistry, config) {
    super('Echo', 'EE', config);
    this.voiceRegistry = voiceRegistry;
  }

  async execute(task, context) {
    this.status = 'analyzing';
    this.currentTask = task;

    try {
      switch (task.type) {
        case 'text-to-speech':
          return await this.textToSpeech(task.text, task.options);
        case 'speech-to-text':
          return await this.speechToText(task.audio, task.options);
        case 'voice-clone':
          return await this.cloneVoice(task.reference, task.name);
        default:
          throw new Error(`Unknown voice task type: ${task.type}`);
      }
    } catch (error) {
      await this.reportError(error);
      throw error;
    } finally {
      this.status = 'idle';
      this.currentTask = null;
    }
  }

  async textToSpeech(text, options = {}) {
    this.reportProgress('Selecting voice provider...');

    // Get adapter for this capability
    const adapter = await this.voiceRegistry.getAdapter(
      'text-to-speech',
      'voice'
    );

    this.reportProgress(`Using ${adapter.id} for text-to-speech...`);

    // Call adapter (not provider directly!)
    const result = await adapter.textToSpeech(text, options);

    this.completed_count += 1;

    return {
      success: true,
      type: 'audio',
      audioBuffer: result.audioBuffer,
      format: result.format,
      provider: adapter.id,
      cost: result.cost || 0
    };
  }

  async speechToText(audioBuffer, options = {}) {
    this.reportProgress('Selecting speech recognition provider...');

    const adapter = await this.voiceRegistry.getAdapter(
      'speech-to-text',
      'voice'
    );

    this.reportProgress(`Using ${adapter.id} for speech-to-text...`);

    const result = await adapter.speechToText(audioBuffer, options);
    this.completed_count += 1;

    return {
      success: true,
      type: 'text',
      text: result.text,
      provider: adapter.id,
      confidence: result.confidence,
      cost: result.cost || 0
    };
  }

  async cloneVoice(referenceAudio, voiceName) {
    this.reportProgress('Voice cloning not yet implemented');
    throw new Error('Voice cloning requires compatible provider');
  }

  async getCapabilities() {
    return [
      'text-to-speech',
      'speech-to-text',
      'voice-selection',
      'audio-processing'
    ];
  }
}

module.exports = EchoAgent;
```

---

### Foxtrot Agent (Media)

Another example:

```javascript
// src/agents/foxtrot-media.js

const BaseAgent = require('./base-agent');

class FoxTrotAgent extends BaseAgent {
  constructor(mediaRegistry, config) {
    super('Foxtrot', 'FF', config);
    this.mediaRegistry = mediaRegistry;
  }

  async execute(task, context) {
    this.status = 'analyzing';
    this.currentTask = task;

    try {
      switch (task.type) {
        case 'text-to-image':
          return await this.textToImage(task.prompt, task.options);
        case 'image-to-video':
          return await this.imageToVideo(task.image, task.options);
        case 'text-to-video':
          return await this.textToVideo(task.prompt, task.options);
        default:
          throw new Error(`Unknown media task type: ${task.type}`);
      }
    } catch (error) {
      await this.reportError(error);
      throw error;
    } finally {
      this.status = 'idle';
      this.currentTask = null;
    }
  }

  async textToImage(prompt, options = {}) {
    this.reportProgress('Estimating cost...');

    // Find best adapter (prioritize local, fallback to cloud)
    const adapter = await this.mediaRegistry.getAdapter(
      'text-to-image',
      'media'
    );

    // Estimate cost if provider supports it
    if (adapter.estimateCost) {
      const estimate = await adapter.estimateCost('textToImage', { prompt });
      this.reportProgress(
        `Estimated cost: $${estimate.estimated_cost} using ${adapter.id}`
      );

      // Check if cost is acceptable (from context authorization)
      if (options.max_cost && estimate.estimated_cost > options.max_cost) {
        throw new Error(
          `Cost ${estimate.estimated_cost} exceeds limit ${options.max_cost}`
        );
      }
    }

    this.reportProgress(`Generating image with ${adapter.id}...`);

    const result = await adapter.textToImage(prompt, options);
    this.completed_count += 1;

    return {
      success: true,
      type: 'image',
      imageBuffer: result.imageBuffer,
      width: result.width,
      height: result.height,
      format: result.format,
      provider: adapter.id,
      cost: result.cost || 0
    };
  }

  async imageToVideo(imageBuffer, options = {}) {
    this.reportProgress('Selecting video generation provider...');

    const adapter = await this.mediaRegistry.getAdapter(
      'image-to-video',
      'media'
    );

    if (!adapter.imageToVideo) {
      throw new Error(
        `${adapter.id} does not support image-to-video generation`
      );
    }

    this.reportProgress(`Generating video with ${adapter.id}...`);

    const result = await adapter.imageToVideo(imageBuffer, options);
    this.completed_count += 1;

    return {
      success: true,
      type: 'video',
      videoBuffer: result.videoBuffer,
      duration_ms: result.duration_ms,
      fps: result.fps,
      format: result.format,
      provider: adapter.id,
      cost: result.cost || 0
    };
  }

  async textToVideo(prompt, options = {}) {
    this.reportProgress('Selecting video generation provider...');

    const adapter = await this.mediaRegistry.getAdapter(
      'text-to-video',
      'media'
    );

    if (!adapter.textToVideo) {
      throw new Error(`${adapter.id} does not support text-to-video`);
    }

    this.reportProgress(`Generating video with ${adapter.id}...`);

    const result = await adapter.textToVideo(prompt, options);
    this.completed_count += 1;

    return {
      success: true,
      type: 'video',
      videoBuffer: result.videoBuffer,
      duration_ms: result.duration_ms,
      fps: result.fps,
      provider: adapter.id,
      cost: result.cost || 0
    };
  }

  async getCapabilities() {
    return [
      'text-to-image',
      'image-to-image',
      'image-to-video',
      'text-to-video',
      'upscaling'
    ];
  }
}

module.exports = FoxTrotAgent;
```

---

### Agent Registry

Central registry of all agents:

```javascript
// src/agents/agent-registry.js

class AgentRegistry {
  constructor(config) {
    this.agents = new Map();
    this.config = config;
  }

  registerAgent(agent) {
    this.agents.set(agent.code, agent);
    logger.info(`Registered agent: ${agent.name} (${agent.code})`);
  }

  getAgent(code) {
    const agent = this.agents.get(code);
    if (!agent) {
      throw new Error(`Agent ${code} not registered`);
    }
    return agent;
  }

  getAgentsByCapability(capability) {
    const matching = [];
    for (const agent of this.agents.values()) {
      const caps = agent.getCapabilities?.() || [];
      if (caps.includes(capability)) {
        matching.push(agent);
      }
    }
    return matching;
  }

  async getStatus() {
    const status = {};
    for (const [code, agent] of this.agents.entries()) {
      status[code] = {
        name: agent.name,
        status: await agent.getStatus()
      };
    }
    return status;
  }

  async healthCheck() {
    const health = {};
    for (const [code, agent] of this.agents.entries()) {
      health[code] = await agent.healthCheck();
    }
    return health;
  }
}

module.exports = AgentRegistry;
```

---

### Agent Communication Pattern

Agents communicate through Alpha:

```
User Request
    ↓
Alpha receives objective
    ↓
Alpha breaks into tasks
    ↓
Alpha → delegates to Bravo → Bravo completes task
                → delegates to Charlie → Charlie completes task
                → delegates to Delta → Delta completes task
    ↓
Alpha aggregates results
    ↓
Return to user
```

Agents never call each other directly. All communication flows through Alpha.

---

### Agent Status States

Each agent can report its status:
- **idle** - Waiting for tasks
- **analyzing** - Understanding the task
- **processing** - Executing the task
- **waiting** - Blocked on external input/API
- **completed** - Task succeeded
- **failed** - Task failed
- **unavailable** - Agent cannot be reached

---

### Example: Course Creation Workflow

1. **User** → Alpha: Create course on "Machine Learning Basics"

2. **Alpha** → Charlie (CC): Research "Machine Learning Basics"
   - Charlie searches, gathers info
   - Returns structured research document

3. **Alpha** → Delta (DD): Write course script from research
   - Delta takes research, creates lesson plan
   - Returns structured script + lesson guide

4. **Alpha** → Echo (EE): Narrate the script
   - Echo narrates using voice provider
   - Returns audio files

5. **Alpha** → Foxtrot (FF): Create course visuals
   - Foxtrot generates images for each lesson
   - Returns image assets

6. **Alpha** → Papa (PP): Validate content
   - Papa checks accuracy, media quality
   - Returns validation report

7. **Alpha** → Uniform (UU): Check compliance
   - Uniform verifies legal requirements
   - Returns compliance report

8. **Alpha** → Tango (TT): Assemble and publish
   - Tango assembles course package
   - Publishes to LAO Academy
   - Returns published course link

9. **Alpha** → Golf (GG): Create promotional content
   - Golf generates social media posts
   - Returns marketing assets

10. **Alpha** aggregates all results
11. **Alpha** returns complete package to user

Each step can use different providers based on availability and cost.

---

### Integration Points

- **Alpha** uses **task-executor** to run tasks
- **Alpha** uses **provider-registry** to find adapters
- **Agents** use **adapters** to call providers
- **All actions** logged to **audit-system**
- **High-impact actions** gated by **authorization-system**

---

### Summary

- **26 Specialist Agents** organized by domain
- **Alpha Orchestrator** coordinates all work
- **Agents never hardcode providers** - use adapters
- **Agents report status** for monitoring
- **All communication through Alpha** - no peer-to-peer
- **Scalable**: Add new agents without changing existing ones
- **Pluggable**: Replace agents or providers without code changes


---

## Part V — Authorization and Audit

> Merged from `docs/AUTHORIZATION_AND_AUDIT.md`. Content preserved verbatim.

**Version:** 1.0  
**Purpose:** Define identity verification, permission checking, and immutable audit trails  
**Status:** Active

---

### Overview

Every action in the system must be:
1. **Verified** - User identity confirmed via IrisKey
2. **Authorized** - User has permission for the action
3. **Audited** - Action recorded immutably
4. **Gated** - High-impact actions may require explicit approval

---

### Authorization Flow

```
User Request
    ↓
┌─────────────────────────────────────┐
│ 1. Identity Verification (IrisKey)  │  Check user is who they claim
├─────────────────────────────────────┤
│ 2. Agent Authorization              │  Check if agent can act
├─────────────────────────────────────┤
│ 3. Permission Check                 │  Check user has permission for action
├─────────────────────────────────────┤
│ 4. Policy Evaluation                │  Check constraints & policies
├─────────────────────────────────────┤
│ 5. Cost Estimation                  │  Estimate cost, check limits
├─────────────────────────────────────┤
│ 6. Explicit Approval (if needed)    │  For high-impact actions
├─────────────────────────────────────┤
│ 7. Execution                        │  Perform the action
├─────────────────────────────────────┤
│ 8. Audit Event Recording            │  Immutable log
└─────────────────────────────────────┘
    ↓
Return Result or Error
```

---

### IrisKey Integration

Sierra agent handles identity verification via IrisKey biometric system:

```javascript
// src/authorization/iriskey-client.js

class IrisKeyClient {
  constructor(config) {
    this.apiUrl = config.iriskey_api_url;
    this.apiKey = config.iriskey_api_key;
  }

  async verifyIdentity(userId, biometricData) {
    // Call IrisKey API to verify biometric
    const response = await axios.post(
      `${this.apiUrl}/verify`,
      {
        user_id: userId,
        biometric: biometricData
      },
      {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      }
    );

    if (!response.data.verified) {
      throw new AuthorizationError(
        'IDENTITY_VERIFICATION_FAILED',
        'Biometric verification failed'
      );
    }

    return {
      user_id: userId,
      verified_at: new Date().toISOString(),
      verification_method: 'iris-biometric',
      confidence: response.data.confidence
    };
  }

  async getUserPermissions(userId) {
    // Get user's permission set from IrisKey
    const response = await axios.get(
      `${this.apiUrl}/users/${userId}/permissions`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      }
    );

    return response.data.permissions || [];
  }

  async hasPermission(userId, permission) {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission) || 
           permissions.includes('*'); // '*' = admin
  }
}

module.exports = IrisKeyClient;
```

---

### Permission System

Permissions are hierarchical and role-based:

```yaml
# config/permissions.yaml

roles:
  admin:
    permissions:
      - "*"  # All permissions

  operator:
    permissions:
      - "courses:create"
      - "courses:edit"
      - "courses:publish"
      - "media:generate:image"
      - "media:generate:video"
      - "voice:generate"

  viewer:
    permissions:
      - "courses:read"
      - "media:read"
      - "voice:listen"

permissions:
  courses:create:
    label: "Create courses"
    category: "content"
    high_impact: true
    requires_approval: true
    cost_estimate: true

  courses:publish:
    label: "Publish courses to LAO"
    category: "content"
    high_impact: true
    requires_approval: true
    audit_required: true

  media:generate:image:
    label: "Generate images"
    category: "media"
    high_impact: false
    requires_approval: false
    cost_estimate: true
    rate_limit: "1000/hour"

  voice:generate:
    label: "Generate voice narration"
    category: "audio"
    high_impact: false
    requires_approval: false
    cost_estimate: true
```

---

### Permission Checker

```javascript
// src/authorization/permission-checker.js

class PermissionChecker {
  constructor(irisKeyClient, policiesConfig) {
    this.irisKey = irisKeyClient;
    this.policies = policiesConfig;
  }

  async checkPermission(userId, action, context = {}) {
    // 1. Verify identity
    if (!context.verified_identity) {
      throw new AuthorizationError(
        'IDENTITY_NOT_VERIFIED',
        'User identity must be verified first'
      );
    }

    // 2. Check if user has permission
    const hasPermission = await this.irisKey.hasPermission(userId, action);
    if (!hasPermission) {
      await this.logDeniedAction(userId, action, 'PERMISSION_DENIED');
      throw new AuthorizationError(
        'PERMISSION_DENIED',
        `User ${userId} does not have permission for ${action}`
      );
    }

    // 3. Check policy constraints
    const policy = this.policies[action];
    if (policy) {
      this.checkPolicyConstraints(policy, context);
    }

    // 4. Check rate limits
    if (policy?.rate_limit) {
      await this.checkRateLimit(userId, action, policy.rate_limit);
    }

    // 5. Cost estimation
    if (policy?.cost_estimate && context.estimate_cost) {
      const cost = await this.estimateCost(action, context);
      if (cost > context.max_cost) {
        throw new AuthorizationError(
          'COST_EXCEEDED',
          `Estimated cost $${cost} exceeds limit $${context.max_cost}`
        );
      }
      context.estimated_cost = cost;
    }

    return {
      authorized: true,
      user_id: userId,
      action: action,
      policy: policy,
      cost: context.estimated_cost || 0
    };
  }

  checkPolicyConstraints(policy, context) {
    // Check if action is allowed in current context
    // E.g., time-based restrictions, rate limits, resource constraints

    if (policy.time_windows) {
      const now = new Date();
      const allowed = policy.time_windows.some(window => {
        const [start, end] = window.split('-');
        // Check if current time is in window
      });
      if (!allowed) {
        throw new AuthorizationError(
          'OUTSIDE_TIME_WINDOW',
          `Action not allowed at this time`
        );
      }
    }

    if (policy.max_concurrent && context.current_concurrent >= policy.max_concurrent) {
      throw new AuthorizationError(
        'CONCURRENT_LIMIT_EXCEEDED',
        `Maximum concurrent operations (${policy.max_concurrent}) reached`
      );
    }
  }

  async checkRateLimit(userId, action, limit) {
    // Parse limit: "1000/hour", "10/minute", etc.
    const [count, period] = limit.split('/');
    const periodMs = this.parsePeriod(period);

    // Get recent action count for user
    const recentCount = await this.getRecentActionCount(userId, action, periodMs);

    if (recentCount >= parseInt(count)) {
      throw new AuthorizationError(
        'RATE_LIMIT_EXCEEDED',
        `Rate limit exceeded: ${count} per ${period}`
      );
    }
  }

  async estimateCost(action, context) {
    // Estimate cost based on action and parameters
    // This will vary by provider

    if (action.includes('media:generate:image')) {
      return 0.03; // $0.03 per image (Stability AI estimate)
    }

    if (action.includes('voice:generate')) {
      return 0; // Free (local Voicebox)
    }

    return 0; // Default free
  }

  async logDeniedAction(userId, action, reason) {
    await auditLog({
      timestamp: new Date().toISOString(),
      event_type: 'authorization_denied',
      user_id: userId,
      action: action,
      reason: reason
    });
  }
}

module.exports = PermissionChecker;
```

---

### Audit System

Immutable recording of all system actions:

```javascript
// src/audit/audit-logger.js

class AuditLogger {
  constructor(storage) {
    this.storage = storage; // FileStorage, DatabaseStorage, etc.
  }

  async logAction(event) {
    // Ensure all required fields present
    const auditEvent = {
      id: uuid(),
      timestamp: new Date().toISOString(),
      event_type: event.event_type,
      user_id: event.user_id,
      agent: event.agent,
      action: event.action,
      resource_ids: event.resource_ids || [],
      status: event.status,
      result_details: event.result_details,
      cost: event.cost || 0,
      provider_used: event.provider_used,
      ip_address: event.ip_address,
      request_id: event.request_id,
      additional_data: event.additional_data
    };

    // Validate
    this.validateAuditEvent(auditEvent);

    // Store immutably
    await this.storage.append(auditEvent);

    // Also send to external logging if configured
    if (this.externalLogger) {
      await this.externalLogger.log(auditEvent);
    }

    return auditEvent;
  }

  validateAuditEvent(event) {
    const required = [
      'id',
      'timestamp',
      'event_type',
      'user_id',
      'action',
      'status'
    ];

    for (const field of required) {
      if (!event[field]) {
        throw new Error(`Missing required audit field: ${field}`);
      }
    }
  }

  async getAuditTrail(filters = {}) {
    // Retrieve audit events matching filters
    return this.storage.query(filters);
  }

  async getAuditTrailForUser(userId, limit = 100) {
    return this.getAuditTrail({ user_id: userId, limit });
  }

  async getAuditTrailForAction(action, limit = 100) {
    return this.getAuditTrail({ action, limit });
  }

  async validateIntegrity() {
    // Verify audit trail integrity (checksums, ordering)
    return this.storage.validateIntegrity();
  }
}

module.exports = AuditLogger;
```

---

### Audit Event Schema

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-07-24T10:30:00Z",
  "event_type": "action_executed",
  "user_id": "user@example.com",
  "agent": "Foxtrot",
  "agent_code": "FF",
  "action": "media:generate:image",
  "resource_ids": ["course-123", "lesson-456"],
  "status": "success",
  "result_details": {
    "images_generated": 5,
    "resolution": "1024x1024",
    "quality": "high"
  },
  "cost": 0.15,
  "cost_currency": "USD",
  "provider_used": "stability-ai",
  "ip_address": "192.168.1.100",
  "request_id": "req-789",
  "authorization_status": "approved",
  "approval_time_ms": 250,
  "execution_time_ms": 45000,
  "error": null,
  "additional_data": {
    "model": "stable-diffusion-xl",
    "prompt": "classroom with students...",
    "fallback_used": false
  }
}
```

---

### Storage Backends

#### File-based (Development)

```javascript
// src/audit/file-storage.js

const fs = require('fs').promises;
const path = require('path');

class FileAuditStorage {
  constructor(directory) {
    this.directory = directory;
  }

  async append(event) {
    const date = new Date().toISOString().split('T')[0];
    const filename = path.join(this.directory, `audit-${date}.jsonl`);
    
    // Append to file (JSONL format)
    await fs.appendFile(
      filename,
      JSON.stringify(event) + '\n'
    );
  }

  async query(filters) {
    // Read and filter events
    // For development only - use database for production
  }

  async validateIntegrity() {
    // Verify file structure and checksums
  }
}
```

#### Database-based (Production)

```javascript
// src/audit/database-storage.js

class DatabaseAuditStorage {
  constructor(db) {
    this.db = db;
  }

  async append(event) {
    // Insert into audit table
    await this.db.query(
      `INSERT INTO audit_events 
       (id, timestamp, event_type, user_id, agent, action, status, cost, provider_used, result_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        event.id,
        event.timestamp,
        event.event_type,
        event.user_id,
        event.agent,
        event.action,
        event.status,
        event.cost,
        event.provider_used,
        JSON.stringify(event.result_details)
      ]
    );
  }

  async query(filters) {
    // Build parameterized query
    let query = 'SELECT * FROM audit_events WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.user_id) {
      query += ` AND user_id = $${paramCount++}`;
      params.push(filters.user_id);
    }

    if (filters.action) {
      query += ` AND action = $${paramCount++}`;
      params.push(filters.action);
    }

    if (filters.since) {
      query += ` AND timestamp >= $${paramCount++}`;
      params.push(filters.since);
    }

    query += ` ORDER BY timestamp DESC`;
    
    if (filters.limit) {
      query += ` LIMIT $${paramCount++}`;
      params.push(filters.limit);
    }

    return this.db.query(query, params);
  }

  async validateIntegrity() {
    // Check database integrity
  }
}
```

---

### High-Impact Actions

Actions requiring explicit approval:

```yaml
high_impact_actions:
  - action: "courses:publish"
    label: "Publish course to LAO Academy"
    requires_approval: true
    approval_timeout_minutes: 5
    audit_required: true

  - action: "media:generate:video:high"
    label: "Generate high-resolution video"
    requires_approval: true
    cost_threshold: 5.00
    approval_timeout_minutes: 10

  - action: "voice:clone"
    label: "Clone user voice"
    requires_approval: true
    audit_required: true

  - action: "data:export"
    label: "Export user data"
    requires_approval: true
    audit_required: true

  - action: "system:configuration:change"
    label: "Change system configuration"
    requires_approval: true
    approval_timeout_minutes: 15
```

For high-impact actions, system creates an approval request:

```javascript
// src/authorization/approval-gateway.js

class ApprovalGateway {
  async requestApproval(userId, action, context = {}) {
    const approvalRequest = {
      id: uuid(),
      user_id: userId,
      action: action,
      context: context,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60000), // 5 min default
      status: 'pending',
      approver_id: null,
      approved_at: null
    };

    // Store request
    await this.storage.save(approvalRequest);

    // Notify approvers (via email, Slack, SMS, etc.)
    await this.notifier.notifyApprovers(approvalRequest);

    // Return request and wait for approval
    return approvalRequest;
  }

  async approveRequest(requestId, approverId, notes = '') {
    const request = await this.storage.get(requestId);

    if (request.status !== 'pending') {
      throw new Error(`Request ${requestId} is not pending`);
    }

    if (new Date() > new Date(request.expires_at)) {
      throw new Error(`Request ${requestId} has expired`);
    }

    request.status = 'approved';
    request.approver_id = approverId;
    request.approved_at = new Date().toISOString();
    request.approver_notes = notes;

    await this.storage.save(request);

    // Audit the approval
    await auditLog({
      timestamp: new Date().toISOString(),
      event_type: 'approval_granted',
      user_id: request.user_id,
      action: request.action,
      approver_id: approverId
    });

    return request;
  }

  async denyRequest(requestId, approverId, reason = '') {
    const request = await this.storage.get(requestId);
    request.status = 'denied';
    request.denier_id = approverId;
    request.denial_reason = reason;

    await this.storage.save(request);

    await auditLog({
      timestamp: new Date().toISOString(),
      event_type: 'approval_denied',
      user_id: request.user_id,
      action: request.action,
      denier_id: approverId
    });
  }
}
```

---

### Cost Tracking

Every external API call tracked:

```javascript
// src/utils/cost-tracker.js

class CostTracker {
  async trackCost(event) {
    const costEvent = {
      id: uuid(),
      timestamp: new Date().toISOString(),
      user_id: event.user_id,
      provider: event.provider,
      operation: event.operation,
      units: event.units,
      cost_per_unit: event.cost_per_unit,
      total_cost: event.units * event.cost_per_unit,
      currency: 'USD'
    };

    await this.storage.append(costEvent);

    // Check cost limits
    const userCosts = await this.getUserMonthlyCosts(
      event.user_id,
      new Date()
    );

    if (userCosts.total > event.monthly_limit) {
      logger.warn(
        `User ${event.user_id} approaching monthly cost limit: $${userCosts.total}`
      );
    }

    return costEvent;
  }

  async getUserMonthlyCosts(userId, date) {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    return this.storage.query({
      user_id: userId,
      since: monthStart,
      until: monthEnd
    });
  }
}
```

---

### Summary

- **IrisKey Integration**: Verify user identity via biometrics
- **Permission Checking**: Role-based access control
- **Policy Evaluation**: Constraints and limits
- **Cost Estimation**: Pre-action cost checks
- **Approval Gateway**: High-impact action approval
- **Audit Logging**: Immutable event recording
- **Audit Trail Query**: Retrieve historical events
- **Cost Tracking**: Monitor all external API calls

All actions flow through this system. Business logic never skips authorization.


---

## Part VI — Implementation Guide

> Merged from `docs/IMPLEMENTATION_GUIDE.md`. Content preserved verbatim.

**Version:** 1.0  
**Purpose:** Step-by-step guide to building the modular agent system  
**Status:** Active

---

### Core Principle: Progressive Buildout

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

### Phase 1: Foundation

#### 1.1 Project Structure

```bash
mkdir -p src/{core,providers,agents,authorization,config,utils}
mkdir -p docs tests config/providers
```

#### 1.2 Package Configuration

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

#### 1.3 Provider Registry

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

#### 1.4 Base Adapter Interface

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

#### 1.5 Alpha Orchestrator Stub

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

#### 1.6 Main Entry Point

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

#### 1.7 Utilities

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

### Phase 2: First Provider - Voicebox

Once Phase 1 foundation is solid, add your first real provider.

#### 2.1 Voicebox Adapter

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

#### 2.2 Echo Agent

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

#### 2.3 Configuration

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

### Phase 3: Second Provider - Media Generation

Once voice is working, add media generation.

#### 3.1 Media Adapter Interface

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

#### 3.2 ComfyUI Adapter (Local)

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

### How to Add a New Provider

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

### Testing Strategy

#### Unit Tests

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

#### Integration Tests

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

### Deployment

#### Docker Compose (Development)

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

#### Environment Variables

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

### Key Principles to Remember

1. **Progressive Enablement**: Only enable providers when needed
2. **Adapter Pattern**: All external calls through adapters
3. **Graceful Fallback**: Try next provider if one fails
4. **Cost Tracking**: Every call logged with cost
5. **Health Monitoring**: Periodic health checks
6. **No Hardcoding**: Configuration drives everything
7. **Easy Testing**: Mock adapters for tests
8. **Documentation**: Keep docs in sync with code

---

### Next Steps

1. Complete Phase 1 foundation
2. Test with Voicebox (Phase 2)
3. Add media generation (Phase 3)
4. Build orchestration (Phase 4)
5. Add authorization (Phase 5)
6. Extend with more agents as needed

Start small. Add providers as requirements emerge. Keep it simple.


---

## Part VII — Quick Start

> Merged from `docs/QUICKSTART.md`. Content preserved verbatim.

**Get the foundation running in 30 minutes**

---

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

---

### Step 1: Initialize Project (5 min)

```bash
# You're already in the repo
cd /home/user/patento-webhook

# Create directory structure
mkdir -p src/{core,providers,agents,authorization,config,utils}
mkdir -p tests/{unit,integration}
```

---

### Step 2: Install Dependencies (5 min)

```bash
npm install express axios uuid dotenv pino pino-pretty joi
npm install --save-dev jest nodemon
```

---

### Step 3: Create Configuration Files (5 min)

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

### Step 4: Create Core Foundation (10 min)

Copy the Phase 1 code from IMPLEMENTATION_GUIDE.md:

- `src/providers/adapter-base.js`
- `src/providers/registry.js`
- `src/core/alpha-orchestrator.js`
- `src/index.js`

---

### Step 5: Test It (5 min)

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

### Step 6: Add First Provider - Voicebox (5 min)

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

### You Now Have:

✅ Provider Registry - discovers and manages adapters  
✅ Base Adapter Interface - normalizes provider APIs  
✅ Provider Health Checking - automatic availability monitoring  
✅ Alpha Orchestrator - task routing foundation  
✅ First Specialist Agent (Echo) - voice operations  
✅ First Provider Adapter (Voicebox) - pluggable voice provider  
✅ HTTP API - REST endpoints for orchestration  

---

### What's NOT Included Yet:

❌ Authorization & Audit  
❌ Multi-agent coordination  
❌ Media generation  
❌ Course workflows  
❌ Persistence/Database  
❌ WebSocket updates  

---

### Next: Test with Real Provider

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

### Common Issues

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

### Key Concepts in This Foundation

1. **Provider Registry** - Central hub for discovering capabilities
2. **Adapter Pattern** - Normalizes different providers to same interface
3. **Agent Architecture** - Specialist agents delegate via orchestrator
4. **Health Checking** - Automatic provider availability monitoring
5. **Cost Tracking** - Every operation tracked for billing/auditing
6. **Graceful Fallback** - Try next provider if one fails
7. **Configuration-Driven** - No hardcoded provider names

---

### Next Steps

1. ✅ Get foundation running
2. 🔧 Install Voicebox locally (Docker is easiest)
3. 🧪 Test Echo agent with real Voicebox
4. ➕ Add media generation (ComfyUI adapter)
5. 🔐 Add authorization system
6. 📊 Add more agents as needed

---

### Reference Docs

- `docs/ARCHITECTURE.md` - System design overview
- `docs/PROVIDER_REGISTRY.md` - Available providers
- `docs/ADAPTER_SPECIFICATION.md` - How to create adapters
- `docs/AGENT_SYSTEM.md` - Agent framework
- `docs/IMPLEMENTATION_GUIDE.md` - Detailed implementation steps

---

**You're ready to build.** Start small, test each piece, add providers on-demand.


---

## Part VIII — Competitive Engineering Intelligence

> Merged from `docs/LAO-COMPETITIVE-ENGINEERING-INTELLIGENCE.md`. Content preserved verbatim.

**Version:** 1.0
**Status:** Living document — revise before each significant capability is built
**Last Updated:** 2026-08-09
**Owner:** LAO Engineering

---

### Purpose

This document exists to stop LAO building things badly that other people have already learned how to build well, and to stop LAO copying things that only *look* like they work.

It is not a feature list and not a competitor brochure. For each category it records what the strongest products actually do, where they measurably fail, what that implies for LAO's architecture, and what LAO should write itself.

**Standing rule:** research does not authorise implementation. Nothing in this document is a commitment to build. Each capability must still pass the value test (§B) and the build-vs-borrow classification (§C) before any code is written.

#### How to read this with the rest of the docs

This document sits *above* the existing LAO specifications and does not supersede them:

| Existing doc | Relationship |
|---|---|
| `ARCHITECTURE.md` | Constrains everything here. The adapter/registry/no-hardcoded-providers rules are assumed, not re-litigated. |
| `PROVIDER_REGISTRY.md` | This document supplies the **licence and risk posture** for entries in that registry. |
| `ADAPTER_SPECIFICATION.md` | Every "ADAPT" verdict below must land behind an adapter defined by that spec. |
| `AGENT_SYSTEM.md` | Category verdicts map to NATO agents (noted per category). |
| `AUTHORIZATION_AND_AUDIT.md` | Approval gates and audit obligations identified here feed that spec. |

---

### A. Executive findings

Seven findings from this research change how LAO should be built. They are ordered by how much they should change behaviour.

**A1. The AI tutoring premise most products are sold on is false, and the true version is more useful.**
Bloom's "2 sigma" claim — the one nearly every AI-tutor pitch deck cites — has never replicated at that magnitude. A 2020 meta-analysis of 96 tutoring studies found an average effect of roughly **0.37σ**, not 2σ, and the original studies were short, novel-topic experiments tested immediately on the taught material. Critically, the evidence suggests the potency came from **tutoring combined with mastery learning**, not tutoring alone. *Implication: LAO's differentiator is not "we have an AI tutor." It is mastery gating — not letting a learner advance on evidence they have not produced. That is the half everyone drops because it is the half that annoys users.*

**A2. An AI assistant without pedagogical guardrails makes learners measurably worse.**
The PNAS study on high-school mathematics is the single most important input to LAO's AI design. Students with a plain ChatGPT-style interface improved 48% *while they had access* — then scored **17% worse than students who never had access at all** once it was removed. A version prompted to give teacher-designed hints instead of answers both improved in-session performance more (127%) and largely eliminated the damage. *Implication: an answer-dispensing chatbot is not a neutral feature that we can add now and refine later. It is actively negative for LAO's stated goal. The hint-ladder contract in §D1 is a correctness requirement, not a nicety.*

**A3. Course length predicts completion more strongly than course quality.**
MOOC completion sits at 5–15% (median ~12.6% across 221 courses; ~6% average across 61 Coursera courses). But sub-2-hour micro-learning completes at 80–90%, while 40+ hour courses complete at 5–10%. 50% of dropouts occur in the first two weeks; the top causes are lack of time (38%) and lost motivation (25%). *Implication: LAO should refuse to ship a 40-hour course format at all. The unit of learning should be small enough to finish in one sitting, and the first two weeks deserve disproportionate engineering.*

**A4. Commitment beats motivation mechanics.**
Paying even $29 for a certificate increased completion probability roughly **6x** versus auditing the same course free. That is a larger effect than any streak or badge system reports. *Implication: LAO's retention design should favour genuine commitment devices (a real project with a deadline, a public portfolio artifact, a client expecting delivery) over engagement mechanics. This aligns with the LEARN→BUILD→LAUNCH→EARN thesis rather than fighting it.*

**A5. Remotion's licence directly taxes LAO's stated video pipeline.**
Remotion is **not** OSI open source. It is free for individuals, non-profits, and for-profits with **up to 3 employees**. For-profit companies with 4+ employees need a paid Company Licence, and LAO's exact intended use — an automated lesson-video pipeline — falls under the "Automators" tier at **$0.01/render with a $100/month minimum spend**. *Implication: this is a real, recurring cost with an employee-count cliff. It does not block use, but it must be a deliberate, adapter-isolated decision with a known exit — see §7 and §D6.*

**A6. n8n cannot be LAO's embedded automation engine.**
n8n is source-available under the Sustainable Use License, not open source. Use is limited to **internal business purposes** or personal/non-commercial use. Running n8n as the automation engine that LAO's paying learners use is not internal use. *Implication: study n8n's UX (it is excellent), do not embed its code. Kestra (Apache-2.0) and Temporal (MIT) are the licence-safe engines.*

**A7. The best learning-platform code is nearly all network copyleft.**
Moodle is GPL-3.0; Open edX, Canvas LMS, SuiteCRM, and Cal.com core are AGPL-3.0; Mautic is GPL-3.0. AGPL's network clause triggers source-disclosure obligations when the software is *accessed over a network* — which is exactly how LAO would serve it. *Implication: this category is "study, don't adopt." The lessons are free; the code is not, at LAO's intended posture.*

**A8. Piper — a provider already named in LAO's registry — relicensed, and the safe version is now unmaintained.**
`PROVIDER_REGISTRY.md` lists Piper as a local TTS provider. The MIT-licensed repository (`rhasspy/piper`) was **archived on 6 October 2025** and is read-only. Development moved to `OHF-Voice/piper1-gpl`, which is **GPL-3.0**. This forces a real choice: use the MIT version and accept unmaintained software with no security updates, or use the maintained version and accept GPL-3.0 obligations. *Implication: this is not hypothetical licence trivia — it is a live decision on a component LAO has already specified. It also demonstrates why the register below records licence posture as a thing that must be re-verified at adoption rather than assumed from memory: this licence changed within the last year.*

**A9. The demand LAO's graduates would serve is documented, quantified, and describes itself as a skills problem.**
Between 50% and 71% of non-adopting small businesses cite **lack of expertise** as their primary barrier to AI adoption — ahead of cost, regulation, and data privacy. Among small businesses already using AI, 45% cite lack of technical expertise and 47% struggle to choose the right tools, while **77% have no formal prompting strategy**. 76% are using or exploring AI and 79% plan to increase investment. Meanwhile the freelance marketplaces that ought to connect this demand to new supply reject newcomers structurally: every trust signal they rank on (Job Success Score, reviews, badges) requires a track record a beginner cannot have, making them *algorithmically invisible and socially unverified at once*. *Implication: LAO's output and this demand are shaped for each other, and the thing preventing the match is a credibility gap that LAO — uniquely — holds the evidence to close. This is the basis of the Opportunity Engine (§E6).*

#### What this means in one sentence

The competitive opportunity is not more features. It is that **almost every incumbent optimises for course consumption, while the evidence says outcomes come from mastery gating, short units, real commitment, and an AI that withholds answers** — and nobody is doing all four at once, because each one individually depresses the engagement metrics these products are measured on.

---

### B. The value test (applied, not asserted)

Per the standing principle, no capability is built without answering the four questions. Applied to the major candidates in this document:

| Capability | Problem solved | Who suffers today | LEARN | BUILD | LAUNCH | EARN | Verdict |
|---|---|---|---|---|---|---|---|---|
| Mastery ledger + gating | Learners advance without competence, then stall on real work | Beginners who "finished a course" and still cannot build | ✅ | ✅ | — | — | **Build** |
| Hint-ladder AI coach | Answer-giving AI creates dependency and worse outcomes (A2) | Every learner using a generic chatbot | ✅ | ✅ | — | — | **Build** |
| Evidence graph → portfolio | Completion certificates are not credible proof of capability | Learners with no employment/client signal | — | ✅ | ✅ | ✅ | **Build** |
| Progression engine (L→B→L→E) | The learn-to-earn gap is unstructured and most people fall in it | Learners who finish learning and stop | ✅ | ✅ | ✅ | ✅ | **Build** |
| **Opportunity Engine** | Capable learners are structurally locked out of paid work by cold-start; real demand cannot find them (A9) | Every learner reaching the end of BUILD | ✅ | ✅ | ✅ | ✅ | **Build (smallest slice)** |
| Lesson video generation | Text-only lessons exclude several learning modes; manual video is slow | Neurodivergent and low-literacy learners; LAO content ops | ✅ | — | — | — | **Build (thin)** |
| Automation workflows | Repeated manual steps in launching/running a small venture | Learners at LAUNCH/EARN | — | ✅ | ✅ | ✅ | **Adapt** |
| Lightweight project tracking | Beginners drown in enterprise PM tools | Learners at BUILD | — | ✅ | ✅ | — | **Build (minimal)** |
| CRM / pipeline | Tracking clients and follow-ups once earning starts | Learners at EARN only | ❌ | ❌ | ⚠️ | ✅ | **Defer — narrow slice only** |
| Booking / calendar | Scheduling calls with clients | Learners at EARN only | ❌ | ❌ | ❌ | ⚠️ | **Do not build — link out** |
| Community platform | Isolation is a top dropout cause | All learners | ✅ | ✅ | — | — | **Defer — integrate, don't build** |

The two ❌-heavy rows are the honest output of this test: **LAO should not build a CRM or a booking system.** Both are commodity, both are solved, and neither helps a learner learn or build. Section 7 and 3 explain what the narrow exceptions are.

---

### C. Build-vs-borrow register

Classification per the standing rule: **A — USE** (commodity, no advantage), **B — ADAPT** (permissive, sits behind an LAO interface), **C — STUDY THEN BUILD** (solved, but LAO can do materially better), **D — LAO ORIGINAL** (strategic IP).

| Capability | Class | Rationale |
|---|---|---|
| Learner intelligence / learner state model | **D** | Core IP. Everything else reads from it. No external component models a learner *and* their venture. |
| Mastery & progression model | **D** | The evidence in A1 says this is the actual mechanism. Must be ours. |
| AI coaching architecture (hint ladder) | **D** | A2 makes this a correctness-critical contract, not a prompt. |
| Evidence graph / portfolio intelligence | **D** | Trust mechanism. Directly serves EARN. Nothing comparable exists. |
| LEARN→BUILD→LAUNCH→EARN progression | **D** | The product thesis. Cannot be borrowed. |
| Opportunity matching & mission generation | **D** | The demand↔curriculum loop requires holding learning, evidence, and demand together. Only LAO does. |
| Skills vocabulary (ESCO / O*NET) | **A** | Mature, permissive (CC BY 4.0), gives external interoperability. Inventing one is pure cost. |
| Marketplace: escrow, payments, disputes | **—** | **Explicitly refused.** Off-thesis and enormous (§E6). |
| Lesson authoring & delivery | **C** | LMS category is mature but bloated and copyleft (A7). Build small. |
| Assessment & spaced practice scheduling | **C** | Algorithms are public and well-understood; implementations are heavy. |
| Workflow / automation engine | **B** | Temporal (MIT) or Kestra (Apache-2.0) behind an LAO workflow interface. |
| Agent framework | **B** | Already correct in `AGENT_SYSTEM.md` — LAO abstraction, swappable framework. |
| Video rendering / composition | **B** | Remotion + FFmpeg behind a render adapter. Licence-loaded (A5) — exit path required. |
| Speech synthesis / captions | **B** | Already covered by the voice adapter category. |
| Auth, storage, queues, email delivery | **A** | Commodity. Zero advantage in owning. |
| Booking / calendar | **A** | Link out to an existing tool. Do not build, do not host. |
| CRM / pipeline | **A→C** | Commodity as CRM; the narrow "opportunity tracking" slice is C. |
| Community | **A** | Integrate an existing platform. Do not build a forum. |

---

### D. Category intelligence

Each category records: leading products, leading open source, what genuinely works, where they fail, architecture/UX/accessibility lessons, licence posture, and LAO's verdict.

---

#### D1. Learning platforms

**Leading products:** Khan Academy, Duolingo, Coursera, Udemy, Brilliant, Codecademy, freeCodeCamp
**Leading open source:** Moodle (GPL-3.0), Open edX (AGPL-3.0), Canvas LMS (AGPL-3.0), freeCodeCamp (BSD-3-Clause code; curriculum separately licensed)

##### What genuinely works

| Product | The idea worth stealing | Why it works |
|---|---|---|
| Khan Academy | Mastery-based progression with prerequisite graph | Aligns with the only mechanism A1 actually supports |
| Duolingo | Sessions short enough to complete on a phone queue | Directly attacks the "no time" 38% dropout cause |
| Duolingo English Test | IRT-based computer-adaptive testing — harder items to stronger learners | Measures ability in far fewer items than a fixed test |
| Brilliant | Learn *by* solving, not by watching then solving | Removes the passive-consumption gap where dropout happens |
| freeCodeCamp | Certification requires building 5 real projects | Evidence of capability, not evidence of attendance |
| Codecademy | Zero-setup in-browser environment | Environment setup is a brutal, invisible beginner filter |
| Brilliant/Duolingo | Immediate, specific feedback on the attempt | Delayed feedback is near-worthless for correction |

##### Where they measurably fail

- **Consumption is the measured unit.** Completion of *videos* and *streaks* are the tracked metrics, not capability. This is why 5–15% completion coexists with high "engagement."
- **The 40-hour course is a known-bad format that persists** because it justifies price, not because it works (A3).
- **Certificates are not evidence.** A completion certificate asserts attendance. Employers and clients discount them accordingly — freeCodeCamp is the notable exception precisely because it requires artifacts.
- **The learn-to-apply cliff.** Every platform ends at "course complete." The learner is then alone. This is LAO's entire opening.
- **Streaks punish life.** Duolingo's streak is a powerful commitment device that inverts into a quit trigger the day it breaks. Loss-framed mechanics manufacture churn events.
- **LMS bloat.** Moodle/Open edX/Canvas are institution-shaped: cohorts, gradebooks, terms, registrar integrations. Nearly none of it serves an individual learner.

##### Architecture lessons

1. **Separate the content graph from the progress ledger.** Every mature LMS conflates them and pays for it forever. LAO's lesson content should be immutable, versioned, addressable data; learner progress should be an append-only event log referencing content versions. This means content can be edited without corrupting history — and history stays auditable, which LAO already requires (`AUTHORIZATION_AND_AUDIT.md`).
2. **Model prerequisites as a DAG, not a linear course.** A sequence is a special case of a graph. Starting linear forecloses adaptivity; starting with a graph costs little.
3. **Assessment items need stable identity and difficulty metadata** from day one. Retrofitting IRT-style calibration onto items that lack identity is expensive.
4. **Progress events belong on LAO's existing event-driven backbone**, not in a separate subsystem.

##### UX lessons

- Default lesson unit target: **completable in one sitting on a phone** (A3).
- Always show *what is unlocked next* and *what evidence unlocks it* — mastery gating is only tolerable when the gate is legible.
- Resume must be exact. Losing position is a silent churn cause.
- Never let a learner get stuck with no path forward; the hint ladder (§D2) is the escape hatch.

##### Accessibility lessons

- Moodle and Open edX have genuinely invested in accessibility and are worth studying as reference implementations, particularly for keyboard navigation and screen-reader semantics in complex interactive widgets.
- Interactive assessment widgets are where most platforms fail WCAG. Drag-and-drop without a keyboard equivalent is the classic defect.
- Video without accurate captions and transcript excludes deaf/HoH learners *and* everyone in a noisy room — this is the highest-leverage accessibility investment in the product.

##### Licence posture

| Project | Licence | Consequence for LAO |
|---|---|---|
| Moodle | GPL-3.0 | Distribution/derivative obligations. Study only. |
| Open edX | AGPL-3.0 | **Network-use copyleft.** Serving it to LAO users triggers source disclosure. Study only. |
| Canvas LMS | AGPL-3.0 (community edition) | Same as above. Instructure's commercial licence removes it — at cost. Study only. |
| freeCodeCamp | BSD-3-Clause (code) | Permissive, but curriculum is licensed separately — do not assume the content carries the code licence. |

> ⚠️ **A7 in practice:** none of the strong open-source LMS platforms can be folded into LAO at its intended posture without either source-disclosure obligations or a commercial licence. This is a *design gift*, not a setback — it forces LAO to build something small and learner-shaped instead of inheriting an institution-shaped monolith.

##### LAO verdict

- **Use:** nothing directly.
- **Avoid:** adopting any full LMS; the 40-hour course format; loss-framed streaks; certificates as the terminal output.
- **Improve:** mastery gating that is actually enforced; one-sitting units; evidence as the output instead of certificates.
- **Class:** **C — STUDY THEN BUILD.**

---

#### D2. AI learning

**Leading products:** Khanmigo, Duolingo Max, Synthesis, various LLM tutors
**Concepts studied:** Socratic tutoring, adaptive engines, intelligent tutoring systems, multimodal learning

##### The decisive evidence

This category has more marketing than evidence, but two rigorous studies bracket the truth:

| Study | Finding | What it tells LAO |
|---|---|---|
| PNAS, high-school maths | Plain ChatGPT interface: +48% with access, **−17% versus never having access** once removed. Guardrailed tutor: +127% with access, damage largely eliminated. | The *interface contract* determines whether AI helps or harms. Not the model. |
| Kestin et al., Harvard physics | Students learned more in less time with a well-designed AI tutor than in an active-learning class | The ceiling is genuinely high **when the design is right** |

Read together: the variance between "AI tutor helps enormously" and "AI tutor causes harm" is almost entirely **design**, not model capability. This is unusually actionable — it means LAO's advantage here is achievable with engineering discipline rather than a frontier-model budget.

##### Where current AI tutors fail

- **They answer.** The default LLM behaviour is to be maximally helpful *right now*, which is precisely the behaviour that produces the −17%.
- **They are context-blind.** A chatbot bolted onto a lesson does not know what the learner already mastered, failed last week, or is building. It re-explains what they know and skips what they don't.
- **They are stateless across sessions.** Every conversation restarts the relationship.
- **They cannot verify.** They will confidently assess a wrong answer as right, and no audit trail exists to catch it.
- **Privacy is an afterthought.** Learner struggle data is among the most sensitive data a product can hold; most tutors ship it to a third-party API with no learner-visible control.

##### Architecture lessons

1. **The tutor must be a consumer of learner state, not an owner of it.** If the AI holds context in a conversation buffer, the context dies with the session and cannot be audited or corrected. Learner state must be a first-class store (§E1) that the tutor reads.
2. **Model choice must be swappable.** Already correct in LAO's architecture — the tutor sits behind the LLM adapter category, never referencing a provider.
3. **The pedagogical contract belongs in LAO code, not in a prompt.** A prompt is advisory; the model can and will violate it. Answer-withholding for assessed items must be enforced by LAO's own logic — a response that would resolve an open assessment item is rejected or downgraded before it reaches the learner.
4. **Every tutoring exchange is an auditable event.** LAO already has the audit spine; tutoring should use it. This also produces the dataset needed to measure whether the tutor is helping (§F).
5. **Privacy boundary is architectural.** Learner state sent to an external model must pass through an explicit, minimising projection — the tutor gets what it needs for *this* interaction, not the learner's full history.

##### UX lessons

- Escalate help in graded steps; never jump to the answer.
- Make it visible that help was used — help usage is signal, not shame, and it feeds mastery evidence weighting.
- Let the learner ask "just tell me" — and honour it *only* on non-assessed material, with the item then marked as taught-not-demonstrated.
- Voice input is an accessibility feature and a mobile convenience simultaneously.

##### Accessibility lessons

- Multiple explanation modes for the same concept (text / spoken / visual / worked example / analogy) is the single most valuable adaptive behaviour for neurodivergent learners, and it is far easier than full adaptive sequencing.
- Do not use time-to-answer as a competence signal without an accommodation path — it penalises processing-speed differences, not understanding.
- Plain-language rewriting on demand serves dyslexic learners, ESL learners, and stressed learners at once.

##### Licence posture

Concepts, not code. No licence exposure. Model providers sit behind LAO's existing LLM adapter.

##### LAO verdict

- **Use:** LLM providers via adapter (already specified).
- **Avoid:** a general-purpose chat window; unbounded answer-giving; conversation-buffer-as-memory; shipping raw learner history to third parties.
- **Improve:** enforce the hint ladder in code; ground the tutor in real learner state; make it auditable and measurable.
- **Class:** **D — LAO ORIGINAL** (the coaching architecture), **A — USE** (the underlying models).

---

#### D3. Business building (CRM)

**Leading products:** GoHighLevel, HubSpot, Salesforce, Pipedrive, Zoho
**Leading open source:** Odoo (LGPL-3.0 community), SuiteCRM (AGPL-3.0), Mautic (GPL-3.0)

##### What works

- **Pipeline-as-stages** is a genuinely good abstraction — it makes an abstract process concrete and shows what to do next.
- **Pipedrive's discipline:** every deal has a next action with a date. This single constraint is most of the value of a CRM.
- **GoHighLevel's insight** is bundling — the small operator wants one thing that works, not seven integrations. This is directly relevant to LAO's audience.
- **Contact-as-timeline** — one place showing everything that happened with a person.

##### Where they fail LAO's user

- They assume you **already have** a business, customers, and a sales process. LAO's learner has none of these. A CRM presented to someone with zero leads is an empty, discouraging spreadsheet.
- Enterprise complexity: custom fields, territories, forecasting, permissions. All irrelevant.
- They optimise for *managing* volume, not *getting the first one*. The first client is a completely different problem to the hundredth, and no CRM addresses it.

##### Architecture lessons

- Stages should be data, not code — but LAO should ship one opinionated default rather than a stage builder.
- Contacts and opportunities are commodity schemas; do not over-invent them.
- Timeline/activity modelling maps cleanly onto LAO's existing event log — same backbone, different projection.

##### UX lessons

- For someone with 0–5 prospects, a list with a next action beats a kanban board.
- "What should I do today?" is the only view that matters at this scale.

##### Accessibility lessons

- Kanban drag-and-drop is a recurring WCAG failure. If LAO ever builds a board, keyboard move-to-stage is mandatory from the first commit, not a follow-up.

##### Licence posture

| Project | Licence | Consequence |
|---|---|---|
| Odoo (community) | LGPL-3.0 | Weak copyleft — usable across a boundary, but heavyweight and ERP-shaped. |
| SuiteCRM | AGPL-3.0 | Network copyleft. Study only. |
| Mautic | GPL-3.0 | Strong copyleft. Study only. |

##### LAO verdict

**Do not build a CRM.** The value test (§B) returns ❌ for LEARN and BUILD, and the EARN benefit is served by a far smaller object.

Build instead: an **opportunity record** attached to the progression engine — who, what they might need, what LAO capability matches it, next action, date. That is roughly 5 fields, not a CRM. If a learner outgrows it, that is a success signal and they should export to a real CRM.

- **Class:** **A** as CRM (don't build), **C** for the narrow opportunity-tracking slice.
- **Agent mapping:** Kilo (KK), constrained hard.

---

#### D4. Automation

**Leading products:** Zapier, Make
**Leading open source:** Temporal (MIT), Kestra (Apache-2.0), n8n (Sustainable Use License — **not** open source), Mautic workflows (GPL-3.0)

##### What works

- **Trigger → condition → action** is the correct mental model and is now universally understood. Do not invent a new vocabulary.
- **Zapier's templates** — most users do not want to build a workflow, they want to pick one that already exists.
- **n8n's execution view** — showing the actual data at each step is the best debugging UX in the category, and it is why people tolerate self-hosting it.
- **Temporal's durable execution** — workflows survive process death and resume exactly. This is the correct engineering answer for anything long-running.
- **Kestra's declarative YAML** — workflows as version-controllable data rather than code.

##### Where they fail

- Zapier/Make get expensive fast at volume and are opaque about failure.
- n8n is powerful but is a developer tool wearing a no-code costume; beginners hit the complexity wall quickly.
- Temporal is excellent and genuinely hard — it demands real engineering investment and is not something a learner will ever touch directly.
- Almost all of them handle **partial failure** poorly from the user's perspective: the run failed, something half-happened, and the user cannot tell what.

##### Architecture lessons

1. **LAO already has an event-driven architecture — do not replace it.** The standing instruction is correct. The right move is a workflow *interface* over the existing event backbone, with a durable engine behind it only where durability is genuinely required.
2. **Durability is the feature.** Retries, idempotency, and resumability are the entire reason to adopt an engine rather than write a scheduler.
3. **Human approval must be a first-class workflow state**, not an out-of-band hack — LAO's authorization spec already requires approval gates for high-impact actions, and workflows will invoke exactly those actions.
4. **Workflow history is an audit artifact.** Same spine again.

##### UX lessons

- Ship recipes, not a builder. A builder is the *second* product.
- Show the data at each step (learn from n8n).
- On failure, state plainly what completed and what did not.

##### Licence posture

> ⚠️ **n8n — hard constraint (A6).** The Sustainable Use License permits use and modification **only for internal business purposes or personal/non-commercial use**, and prohibits reselling the service. Operating n8n as the automation engine that LAO's learners use is *not* internal use and would require a separate commercial agreement with n8n. n8n has relaxed restrictions on consulting/support services, which does not help this use case.
>
> **Verdict: study n8n's UX. Do not embed n8n's code.**

| Project | Licence | Verdict |
|---|---|---|
| Temporal | MIT | ✅ Safe. Best choice if durable execution is genuinely needed. |
| Kestra | Apache-2.0 | ✅ Safe (OSS core; enterprise edition is separate). Good if declarative YAML fits. |
| n8n | Sustainable Use License | ❌ Cannot embed as customer-facing engine. |
| Mautic | GPL-3.0 | ❌ Strong copyleft. Study only. |

##### LAO verdict

- **Use:** Temporal (MIT) or Kestra (Apache-2.0), behind an LAO workflow adapter.
- **Avoid:** embedding n8n; replacing LAO's event architecture; shipping a node-graph builder as v1.
- **Improve:** failure honesty; approval-as-state; recipes over builders.
- **Class:** **B — ADAPT.**
- **Agent mapping:** India (II).

---

#### D5. AI agents

**Studied:** OpenAI Agents SDK concepts, LangGraph (MIT), CrewAI (MIT), AutoGen/AG2 (Apache-2.0), OpenHands, Aider, Continue

##### What works

- **LangGraph's explicit state graph** — agent flow as an inspectable graph with checkpointing, rather than an opaque loop. This is the strongest architectural idea in the category.
- **CrewAI's role/task decomposition** — readable and maps almost directly onto LAO's existing 26-agent NATO model.
- **AutoGen/AG2's conversational multi-agent patterns** — useful for structured critique and review loops.
- **OpenHands' sandboxing** — agents that touch a filesystem or shell must be contained. Non-negotiable.
- **Aider's repo-map + git discipline** — every agent change is a commit, so every change is reviewable and revertible. This is the best audit pattern in the category and LAO should adopt the *principle* directly.
- **Continue's boundary** — the human stays in the loop by default.

##### Where they fail

- **Framework lock-in is severe.** These frameworks want to own your control flow. Migrating between them is a rewrite. This is precisely why the standing instruction says do not make a framework the core of LAO — that instruction is correct and this research reinforces it.
- **Reliability degrades with autonomy.** Long autonomous chains compound error. The failure mode is confident wrongness.
- **Permissions are usually coarse** — an agent typically gets a tool or does not, with no scoping, cost ceiling, or approval gate.
- **Weak audit trails.** Most frameworks log for debugging, not for accountability.
- **Cost is invisible** until the bill arrives.

##### Architecture lessons

1. **LAO's existing design is already right here.** `AGENT_SYSTEM.md` + `ADAPTER_SPECIFICATION.md` define an LAO agent abstraction with framework adapters (CrewAI/AutoGen/LangGraph). This research validates that decision — do not revisit it.
2. **The LAO agent contract should own** identity, permissions, cost ceiling, approval gates, audit emission, and failure recovery. The framework should own only *execution strategy*. If a framework is doing anything from the first list, the boundary has leaked.
3. **Checkpointing/resumability (LangGraph's strength) should be an LAO-level concept**, so it survives a framework swap.
4. **Sandboxing is an LAO responsibility.** Never inherit a framework's sandbox assumptions.
5. **Cost ceilings must be enforced pre-execution**, not observed post-hoc — LAO's cost tracker already exists for this.

##### Licence posture

| Project | Licence | Notes |
|---|---|---|
| LangGraph | MIT | ✅ Permissive |
| CrewAI | MIT | ✅ Permissive |
| AutoGen / AG2 | Apache-2.0 | ✅ Permissive; note the AutoGen→AG2 community fork when pinning |
| OpenHands | MIT | ✅ Permissive |
| Aider | Apache-2.0 | ✅ Permissive; patterns more valuable than the code |
| Continue | Apache-2.0 | ✅ Permissive; patterns more valuable than the code |

Permissive across the board — this is the safest category in the document, and the only one where adoption carries no licence-driven constraint. Attribution and copyright notices must still be preserved.

##### LAO verdict

- **Use:** one framework behind the existing agent adapter; swap freely.
- **Avoid:** framework-owned control flow; unbounded autonomy; agents with unscoped permissions.
- **Improve:** permissions, cost ceilings, approval gates, and audit — the four things every framework under-serves and LAO already has specifications for.
- **Class:** **B — ADAPT** (frameworks) with **D** for the LAO agent contract itself.

---

#### D6. Video and content

**Studied:** Remotion, FFmpeg, Canva, CapCut, Descript, Synthesia-style workflows

##### What works

- **Remotion's core idea** — video as React components — makes video *programmable and diffable*. For templated lesson video at volume, this is the strongest approach available.
- **Descript's transcript-as-timeline** — edit the text, the video follows. The best content-editing UX innovation of the last decade and directly applicable to lesson correction.
- **Canva's constrained templates** — non-designers produce acceptable output because the template forbids bad choices.
- **CapCut's captions-by-default** — auto-captions as the default state, not an export option.
- **FFmpeg** — the universal substrate. Everything ends here eventually.

##### Where they fail

- AI-avatar video ("Synthesia-style") produces content that is *technically* a video and pedagogically inert — a talking head reading a script is not better than well-structured text, and often worse because it cannot be skimmed.
- Rendering is slow and expensive at volume; cost per lesson is easy to underestimate.
- Generated video is hard to correct — a one-word error means a re-render, which is why most auto-video pipelines quietly ship stale content.

##### Architecture lessons

1. **Keep the pipeline staged and inspectable.** The target pipeline — lesson data → script → visual plan → narration → subtitles → composition → encode — should have **each stage independently addressable, cacheable, and re-runnable**. A one-word script fix must not re-run narration for the whole lesson.
2. **Script and visual plan are data, not artifacts of rendering.** They should be reviewable and correctable before anything expensive happens.
3. **Subtitles are generated from the narration script, not transcribed from audio.** Source-derived captions are exact; ASR captions have error rates. This is both an accessibility win and cheaper.
4. **Render must be an adapter** (LAO's rule already) — this is what makes A5 survivable.
5. **Local-capable rendering** matters for cost control and matches LAO's local-first principle.

##### UX lessons

- Captions on by default.
- Every video must have a text equivalent — for accessibility, for skimming, and for search.
- Show the script before rendering; correction at the script stage costs nothing.

##### Accessibility lessons

- Captions, transcript, and audio description path are baseline, not enhancements.
- **Never encode information in visuals alone** — narration must carry the meaning, because some learners will only receive the audio.
- Respect reduced-motion preferences; generated video loves gratuitous animation.

##### Licence posture — the two traps

> ⚠️ **Remotion (A5).** Not OSI open source. Free for individuals, non-profits, and for-profits with **≤3 employees**. For-profits with **4+ employees require a paid Company Licence**. LAO's intended use — an automated lesson-video pipeline — is the **"Automators"** tier: **$0.01 per render, $100/month minimum spend** (Enterprise: $500/month minimum). The "Creators" tier ($25/seat/month) explicitly does *not* cover automation.
>
> **Consequence:** LAO's video pipeline has a per-render marginal cost and an employee-count cliff. This is acceptable *if* deliberate. It is unacceptable as an accident discovered at headcount 4. **Mandatory:** Remotion sits behind a render adapter with a documented fallback path (direct FFmpeg composition, or an alternative programmatic renderer) so the decision stays reversible.

> ⚠️ **FFmpeg licence mode.** FFmpeg is **LGPL-2.1-or-later by default**. Passing `--enable-gpl` — which is what enables `libx264` among others — **changes the effective licence to GPL-2.0-or-later**. For LAO this means: build/ship an **LGPL configuration** (no `--enable-gpl`, no `--enable-libx264`) unless a deliberate decision is made to accept GPL obligations. Note also that codec **patent** licensing (e.g. H.264) is a separate question from copyright licensing and is not resolved by choosing LGPL.

| Project | Licence | Verdict |
|---|---|---|
| Remotion | Proprietary / company licence | ⚠️ Usable with paid licence at 4+ employees. Adapter-isolated, exit path required. |
| FFmpeg | LGPL-2.1+ default; GPL-2.0+ with `--enable-gpl` | ⚠️ Build configuration is a licence decision. Document the build flags. |

##### LAO verdict

- **Use:** FFmpeg (LGPL build) as substrate; Remotion behind an adapter, as a deliberate paid decision.
- **Avoid:** avatar-narrator video; monolithic re-render pipelines; ASR-derived captions when the script is available.
- **Improve:** stage-level caching and correction; script-derived exact captions; text equivalent always shipped alongside.
- **Class:** **B — ADAPT**, with the licence caveats above as blocking conditions.
- **Agent mapping:** Foxtrot (FF) with Echo (EE) for narration.

---

#### D7. Booking / calendar

**Studied:** Calendly, Cal.com (AGPL-3.0 core + proprietary `/ee`), Google Calendar workflows

The standing instruction asks whether LAO learners actually need this. **Applying the value test honestly: no.**

- LEARN: ❌ — booking does not help anyone learn.
- BUILD: ❌ — no contribution.
- LAUNCH: ❌ — you can launch without it.
- EARN: ⚠️ — marginal, and only for learners who sell via calls, which is a subset.

A learner who needs to book calls can use Calendly's free tier or Cal.com today, at zero cost to LAO. Building or hosting scheduling means owning timezone handling, calendar sync, availability logic, and reschedule/cancel flows — a genuinely deep problem — for a capability that does not advance the core thesis.

**Licence note if this is ever revisited:** Cal.com core is AGPL-3.0 (network copyleft — hosting it for LAO users triggers source-disclosure obligations) and its `/ee` directory is proprietary, requiring a purchased licence key for self-hosting. That combination makes it a poor adoption target and a fine study target.

- **LAO verdict: do not build. Link out.** Revisit only if usage data shows scheduling is a real bottleneck at EARN.
- **Class:** **A — USE** (external, unhosted).

---

#### D8. Project management

**Studied:** Linear, Notion, Trello, Asana, GitHub Projects

##### What works

- **Linear's opinionation and speed** — few concepts, fast keyboard-first UI, no configuration. The best model in the category for LAO's purposes.
- **Trello's immediacy** — a beginner understands a board in seconds with zero training.
- **GitHub Projects' proximity to the work** — tracking lives where the artifacts live.

##### Where they fail

- Notion and Asana are construction kits: infinitely configurable, so the user's first job is building their own tool. For a beginner this is a trap that consumes the motivation they should be spending on the actual project.
- Enterprise concepts (sprints, story points, epics, workflows) are noise for a solo learner building one thing.
- All of them require the user to *decide what the tasks are* — which is exactly what a beginner cannot do. This is the real gap.

##### Architecture lessons

- Tasks should be **generated from the project template and the learner's chosen venture**, not authored from a blank page. The scarce resource for a beginner is knowing what to do next, not somewhere to write it down.
- Project state should be a projection of the progression engine (§E4), not a separate system.

##### UX lessons

- One list. One current task. "What's next" as the default and primary view.
- No configuration surface in v1. Zero.
- Completion of a project task should produce evidence (§E3) automatically — the tracker feeds the portfolio.

##### Accessibility lessons

- Keyboard-first (Linear's model) is an accessibility win before it is a power-user feature.
- Any board view needs keyboard move-to-column from day one.

##### Licence posture

All commercial SaaS. Study only. No exposure.

##### LAO verdict

- **Avoid:** boards, sprints, configurability, blank-page task entry.
- **Improve:** generate the plan; one next action; completion produces evidence.
- **Class:** **C — STUDY THEN BUILD**, minimal.

---

#### D9. Portfolio / creator tools

**Studied:** LinkedIn, Behance, GitHub profiles, Linktree, Carrd

##### What works

- **GitHub profile** — the strongest capability signal in existence, because it is *derived from real work* rather than self-asserted. Commits cannot be easily faked into a coherent history.
- **Behance** — visual work shown as work, not described in prose.
- **Linktree/Carrd** — near-zero-friction publishing. Someone with no technical skill has a live page in minutes.

##### Where they fail

- **LinkedIn is self-assertion.** Anyone can claim anything; the signal-to-noise is poor and everyone knows it.
- **Portfolios are manual.** They require the learner to stop working, reflect, write, curate, and publish — a separate skill, done at exactly the moment their motivation is lowest.
- **No provenance.** A portfolio piece does not carry evidence that the person actually did it, when, or how.

##### This is LAO's strongest structural opportunity

LAO uniquely observes the entire process: which lessons were mastered, which practice items were passed unaided, what was built, what shipped, what earned. **No other platform holds this chain.** LinkedIn sees claims; GitHub sees commits; LAO sees the causal path from learning to outcome.

That makes an *automatically-generated, provenance-backed* portfolio not just a convenience feature but a credibility instrument — see §E3.

##### Architecture lessons

- Portfolio must be a **projection over the evidence graph**, generated on demand — never a separate hand-maintained document that drifts.
- Every claim needs a link to its supporting evidence, with a timestamp.
- Learner control is mandatory: they decide what is public. Provenance without consent is surveillance.

##### UX lessons

- Generate a draft; let the learner edit and choose. Never publish automatically.
- The output must be a shareable URL — that is the unit clients and employers accept.

##### Accessibility lessons

- Generated portfolio pages must themselves meet WCAG 2.2 AA. Shipping an inaccessible page that represents a learner is a direct harm to that learner's prospects.
- Require alt text on portfolio images at generation time.

##### Licence posture

Commercial SaaS, studied for patterns. No exposure.

##### LAO verdict

- **Avoid:** manual portfolio construction; unverifiable claims; auto-publishing without consent.
- **Improve:** provenance-backed, auto-drafted, learner-controlled.
- **Class:** **D — LAO ORIGINAL.**

---

#### D10. Community

**Studied:** Discord, Circle, Slack communities, Reddit, GitHub Discussions, Discourse (GPL-2.0)

##### What works

- **Discourse's trust levels** — earned moderation privileges scale a community without scaling paid moderators. The best structural idea in the category.
- **GitHub Discussions' proximity** — conversation attached to the artifact it concerns.
- **Reddit's threading** and Discourse's search — knowledge that persists and is findable.
- **Small, purposeful groups** consistently outperform large open channels for actual learning support.

##### Where they fail

- **Discord is a knowledge shredder.** Real-time chat means the same question is answered daily and never findable. Excellent for belonging, terrible for learning.
- **Moderation and safety are real, ongoing, expensive obligations** — with a learner population that may include vulnerable adults and minors, this is not a side concern.
- **Engagement mechanics manufacture noise.** Karma and reaction counts optimise for participation volume, not usefulness.
- Empty communities are actively negative — a dead forum signals a dead product.

##### Architecture lessons

- Do not build a forum. This is a solved, deep, permanently-maintained problem.
- If community is integrated, treat it as an external system behind an integration boundary, with LAO identity mapped in.
- Anything of lasting value that emerges in community should be promotable into LAO's knowledge base (Quebec/QQ) rather than left to rot in a chat log.

##### Accessibility lessons

- Real-time chat is hostile to several groups: screen-reader users (constant live-region updates), learners with processing differences, and anyone in a different timezone. Asynchronous, threaded formats are more inclusive by default.

##### Licence posture

Discourse is GPL-2.0 (verify at adoption). Self-hosting for internal use is straightforward; modification-and-distribution triggers obligations. Integration over adoption avoids the question entirely.

##### LAO verdict

- **Avoid:** building a forum; real-time-only community; karma/engagement mechanics; launching community before there is a population to fill it.
- **Improve:** peer support tied to *what the learner is actually stuck on*, and promotion of good answers into durable knowledge.
- **Class:** **A — USE** (integrate an existing platform). Defer until learner volume justifies it.
- **Agent mapping:** Yankee (YY) for comms, Quebec (QQ) for knowledge promotion.

---

#### D11. Accessibility

**Benchmark:** WCAG 2.2 (current W3C Recommendation), plus accessible LMS practice.

##### Standards position (verified)

- **WCAG 2.2 is the current standard** — 86 success criteria across levels A/AA/AAA (77 carried from 2.1 with one obsoleted, plus nine new). The nine additions target low vision, cognitive and learning disabilities, and motor/touch accessibility.
- **Level AA is the accepted conformance target** and should be LAO's baseline.
- **WCAG 3.0 is still a Working Draft.** Candidate Recommendation is anticipated around Q4 2027, with final Recommendation no earlier than 2028. Its March 2026 draft moves to ~174 outcome-based requirements with Bronze/Silver/Gold graded scoring rather than binary pass/fail. **WCAG 3.0 will not supersede WCAG 2.2 — they will coexist.**

**Implication for LAO:** target **WCAG 2.2 AA now**. Do not delay or design around WCAG 3.0 — it is years from being required. But note that its outcome-based, graded model rewards products that go beyond checklist compliance, which is the direction LAO's multi-modal design already points.

##### The multi-modal requirement

The standing instruction requires the same lesson to be available as text, voice, video, image, interaction, example, and practice. This is more demanding than WCAG conformance and is a genuine differentiator — but only if it is architectural.

**This is the key architectural consequence in the entire document:** if lessons are *authored* as video or as prose, multi-modality is impossible to retrofit at acceptable cost. Lessons must be authored as **structured, modality-neutral content** from which each representation is *derived*. Get this wrong at the start and every lesson ever written must be re-authored.

##### Architecture lessons

1. **Modality-neutral lesson source is non-negotiable.** Concept, explanation, worked example, practice item, and misconception are semantic units — not paragraphs and not scenes.
2. Every derived representation traces back to the same source unit, so a correction propagates everywhere.
3. Learner modality preference belongs in learner state (§E1) and persists across the product.
4. Accessibility must be testable in CI — automated checks catch a meaningful fraction of defects and prevent regressions.

##### UX lessons

- Keyboard navigation for every interaction, including assessment widgets.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.
- Do not convey meaning by colour alone.
- Text resizing to 200% must not break layout.
- Dyslexia-friendly presentation: generous line height, adjustable measure, no justified text, user-selectable typeface.
- Neurodivergent-friendly: predictable structure, no unexpected motion, no imposed time pressure, clear "what happens next."

##### Licence posture

Standards, not code. No exposure. Automated tooling (e.g. axe-core, MPL-2.0 — verify at adoption) sits in CI, not in the shipped product.

##### LAO verdict

- **Use:** WCAG 2.2 AA as the baseline; automated a11y testing in CI.
- **Avoid:** retrofitting accessibility; authoring lessons in a single modality; time-pressure mechanics without accommodation.
- **Improve:** derive all modalities from one source — most platforms cannot do this at all.
- **Class:** **D — LAO ORIGINAL** (the modality-neutral lesson model).

---

#### D12. Mobile

**Principle:** every significant feature is evaluated mobile-first — not designed for desktop and shrunk.

##### What works

- **Duolingo** is the reference: sessions sized for a queue or a commute, thumb-reachable targets, works one-handed.
- Offline-tolerant behaviour — learning happens on transit with poor connectivity.
- Native-feeling input: voice, camera, touch.

##### Where competitors fail

- Coursera, Udemy, and the open-source LMS platforms are all desktop-first products with mobile ports. Video plays acceptably; everything else is cramped.
- **Code-learning platforms are the worst offenders** — Codecademy and freeCodeCamp are genuinely hard to use on a phone, because a code editor is a poor fit for a small touch screen. This matters enormously for LAO's audience, many of whom will be phone-primary.
- Long-form reading on mobile has poor completion.

##### The honest problem for LAO

LAO teaches building with AI, which implies producing artifacts. Artifact production on a phone is genuinely constrained. **The answer is not to pretend otherwise**, but to split the experience by what each device is actually good at:

| Device | Genuinely good for |
|---|---|
| Phone | Learning, practice, review, coaching conversation, progress, capture, approvals |
| Desktop | Building, editing, complex artifact production |

Sessions should be *designed* for the phone; building should be *supported* on desktop with the phone able to review, approve, and continue. State must be continuous across both — a learner starts a session on a phone and continues on a laptop with no loss.

##### Accessibility lessons

- Touch targets ≥ 44px; WCAG 2.2's new criteria explicitly address touch/motor accessibility.
- One-handed reachability is a motor-accessibility feature.
- Never rely on hover — it does not exist on touch.
- Test with mobile screen readers, not just desktop ones.

##### LAO verdict

- **Avoid:** desktop-first design; phone-based code editors; long-form mobile reading; hover-dependent UI.
- **Improve:** device-appropriate task split with continuous state — nobody in the category does this well.
- **Class:** **D — LAO ORIGINAL** (the split-session model); **A** for the underlying platform tech.

---

#### D13. Opportunity marketplaces and matching

**Leading products:** Upwork, Fiverr, Toptal, Contra, LinkedIn Jobs, Braintrust
**Adjacent:** grant/funding databases, local business directories
**Open reference data:** ESCO (CC BY 4.0 data; EUPL-1.2 API), O*NET (CC BY 4.0)

##### What works

- **Structured opportunity records.** Reducing messy demand to typed fields (scope, budget, deadline, required skills) is what makes matching possible at all.
- **Toptal's pre-vetting.** Screening once, then vouching, is more efficient than making every client re-evaluate every candidate. It is also the only model in the category that solves credibility *before* a track record exists.
- **Escrow and milestones.** Both sides need protection; this is the genuine service marketplaces provide.
- **Upwork's Rising Talent badge** is an explicit acknowledgement that the cold-start problem is real enough to need a manufactured signal.

##### Where they fail — and the failure is structural

**The cold-start trap is the defining failure of this category.** Platform trust signals — Job Success Score, badges, review count, star rating — all require completed contracts. A newcomer has none, which makes them *algorithmically invisible and socially unverified simultaneously*. Clients filter on exactly the signals the newcomer cannot have. Reported outcome: typically 2–3 weeks to a first job, with some sending 20+ proposals before a single reply.

This is a catch-22 by construction: **you need reviews to get hired and hiring to get reviews.** It is not a bug the platforms can fix, because their only evidence of capability *is* prior platform activity.

Compounding it:

- **Applying costs money.** Upwork's Connects run ~$0.15 each at 6–16 per application, so an active search costs roughly $10–20/month before earning anything. Beginners pay to be ignored.
- **Fees are material.** Upwork takes a variable 0–15% service fee (most contracts near 10%); Fiverr takes a flat **20%** of every order and tip.
- **Race to the bottom.** Undifferentiated newcomers compete on price alone, which is the one axis where a beginner should never compete.
- **Matching is keyword-based**, not capability-based. Nobody knows what the candidate can actually *do*.
- **Nobody teaches.** A rejected freelancer receives no diagnosis and no path. The marketplace has no interest in their development.

##### The demand-side finding that matters most

The market's stated bottleneck is *precisely what LAO teaches*:

| Signal | Figure |
|---|---|
| Non-adopting small businesses citing **lack of expertise** as the primary barrier | **50–71%** — ahead of cost, regulation, and privacy |
| SMB AI users citing lack of technical expertise as a challenge | 45% |
| SMB AI users who find it hard to choose the right tools | 47% |
| SMBs using AI with **no formal prompting strategy or system** | **77%** |
| Small businesses actively using or exploring AI | 76% (with 79% planning increased investment) |
| EU adoption gap, large enterprise vs. small (10–49 employees) | 55% vs **17%** |

The barrier is explicitly *skills and confidence, not access or cost*. That is a demand pool shaped like LAO's output.

##### Architecture lessons

1. **Matching must run on demonstrated capability, not self-asserted skills.** This is the one thing LAO can do that no marketplace can, because LAO holds the mastery evidence.
2. **Do not invent a skills vocabulary.** ESCO (~3,000 occupations, ~14,000 competencies, 28 languages) and O*NET already exist, are permissively licensed, and give interoperability with external job data. LAO's originality belongs in the *mastery model*, not the noun list.
3. **Opportunity is a typed record, not a CRM object** — and it is the same record the narrow EARN-stage slice in §D3 needs. Do not build two.
4. **Sourcing and matching must be separable.** Matching can be tested against learner-entered opportunities long before LAO sources any.

##### UX lessons

- One well-matched opportunity beats a feed of fifty. Volume is the incumbent's model and it is what produces spam.
- Show *why* a match was made and what the gap is — an unexplained match is unactionable.
- Never let a rejection be terminal with no diagnosis; that is the category's cruellest failure.

##### Accessibility lessons

- Opportunity records must be readable as plain structured text, not only as cards in a visual feed.
- Deadline pressure needs accommodation paths, consistent with §D11.

##### Licence posture

| Source | Licence | Verdict |
|---|---|---|
| ESCO classification data | CC BY 4.0 ✅ | ✅ Usable with attribution |
| ESCO API | EUPL-1.2 ✅ | Weak copyleft; fine behind a service boundary |
| O*NET | CC BY 4.0 ✅ | ✅ Usable with attribution |
| Upwork / Fiverr / LinkedIn | Proprietary | Study only; check ToS before any programmatic access |

> ⚠️ Attribution is a **condition** of CC BY 4.0, not a courtesy. If ESCO or O*NET vocabulary is used, the attribution must ship with the product.

##### LAO verdict

- **Use:** ESCO/O*NET vocabulary, with attribution.
- **Avoid:** building a two-sided marketplace; taking a transaction cut; auto-applying on a learner's behalf; volume feeds.
- **Improve:** match on evidence rather than reviews, and return a *diagnosis* rather than a rejection.
- **Class:** **D — LAO ORIGINAL** (the engine); **A — USE** (the skills vocabulary).
- **Agent mapping:** Kilo (KK) opportunities, Lima (LL) grants/funding, Charlie (CC) sourcing, Uniform (UU) compliance review.

---

### E. Proposed LAO original implementations

These are the strategic capabilities that should be written as LAO IP. They are described here as *designs to be evaluated*, not as approved work. Each must still pass §B and §18 discipline.

#### E1. Learner State Vector (LSV) — the spine

**Problem:** every capability in this document needs to know the same things about the learner, and no external component models both a learner *and* their venture.

A single, queryable, learner-owned state object holding:

| Facet | Contents |
|---|---|
| Mastery | Per-concept mastery with evidence and decay (E2) |
| Difficulty history | What they struggled with, when, how it resolved |
| Preferences | Modality preference, pace, session length, accommodations |
| Interests | Domain, venture direction |
| Progression | Current LEARN/BUILD/LAUNCH/EARN stage and gates (E4) |
| Artifacts | What they have built and shipped |
| Consent | What may leave the system, to which providers, for what purpose |

**Design constraints:**
- Derived from the append-only event log — never hand-mutated, always reconstructible.
- The tutor, the video pipeline, the progression engine, and the portfolio all *read* it; only the event log writes it.
- Consent facet is enforced at the adapter boundary: an external provider receives a **minimised projection**, never the whole vector.
- Learner-inspectable and exportable. If a learner cannot see their own model, it is surveillance.

**Why original:** no external component models this. It is the thing that makes LAO's AI contextual rather than a chatbot.

#### E2. Mastery Ledger

**Problem:** A1 — mastery learning is the mechanism that actually works, and almost nobody enforces it.

- Mastery is **evidence-derived**, never self-asserted and never granted by content consumption.
- Evidence is weighted: unaided correct > correct after hint > correct after answer shown. The hint ladder (E5) makes this measurable.
- Mastery **decays** without retrieval, scheduling spaced review. Retrieval practice and spacing are among the best-supported findings in learning science.
- Concepts form a prerequisite DAG; a concept is reachable only when its prerequisites hold sufficient mastery.
- **Gates are real.** If LAO does not withhold progression, it is not doing mastery learning — it is doing a progress bar.

**Honest risk:** gating increases short-term friction and will depress naive engagement metrics. The evidence in A1 says this is the trade that produces outcomes. LAO must measure outcomes (§F), not engagement, or it will optimise the gate away.

#### E3. Evidence Graph → Portfolio Intelligence

**Problem:** D9 — capability claims are unverifiable, and portfolio construction is manual work demanded at the worst moment.

A directed graph linking: `concept mastered → practice evidence → project artifact → shipped outcome → earning event`.

- Every portfolio claim resolves to a path through this graph with timestamps.
- The portfolio is a **generated projection**, not a maintained document.
- Learner-controlled visibility per claim; nothing is public by default.
- Because the chain is causal, LAO can state *how* someone learned something, not just that they claim it.

**Why original:** LAO is structurally positioned to hold this chain end-to-end. LinkedIn, GitHub, and every LMS each see one fragment.

#### E4. Progression Engine (LEARN → BUILD → LAUNCH → EARN)

**Problem:** every platform ends at "course complete" and abandons the learner at exactly the transition that matters.

An explicit state machine with defined entry/exit criteria per stage:

| Stage | Exit criteria (illustrative) |
|---|---|
| LEARN | Required concepts at mastery threshold with unaided evidence |
| BUILD | A working artifact exists and meets its acceptance checks |
| LAUNCH | The artifact is publicly reachable and a first outreach action has occurred |
| EARN | A real transaction or engagement is recorded |

- Stages are **not** UI tabs. They are gated states with criteria, driving what LAO shows, what the coach prioritises, and which capabilities activate.
- Regression is permitted and normal — a learner at BUILD who hits a knowledge gap is routed back to targeted LEARN, not restarted.
- Provides the *reason* for every other subsystem to activate: the CRM slice (D3) only exists at EARN; project tracking (D8) only at BUILD.

**Why original:** this is the product thesis. It cannot be borrowed.

#### E5. Socratic Escalation Protocol (the hint ladder)

**Problem:** A2 — this is a correctness requirement, not a feature.

An enforced escalation ladder, with the constraint implemented in LAO code rather than in a prompt:

1. Reflect the learner's attempt back and ask what they expected
2. Point to the relevant concept (with a modality matched to their preference)
3. Narrow to the specific step that is wrong
4. Worked example of an *analogous* problem — never the exact one
5. Explicit answer — **permitted only for non-assessed material**, and the item is then marked *taught, not demonstrated*

**Hard constraints:**
- A response that would resolve an open assessed item is blocked before it reaches the learner. Prompting alone is insufficient — models will violate advisory instructions.
- Every rung is recorded as evidence and weighted into the mastery ledger (E2).
- The learner can always see which rung they are on and request escalation — the protocol must not feel like withholding for its own sake.
- Provider-agnostic: the ladder is LAO logic, so it survives any model or framework swap.

**Measurable success criterion, derived directly from A2:** learners must perform *better* on unaided assessment after coached practice than a control cohort without coaching. If LAO cannot demonstrate that, the coach is reproducing the −17% and must be changed.

#### E6. Opportunity Engine

**Problem:** LAO's learner reaches the end of BUILD with genuine capability and no route to EARN. The marketplaces that exist reject them *structurally* — not for lack of skill, but because their trust signals require a track record the learner cannot have yet (§D13). Meanwhile a large, documented demand pool reports that its primary barrier is exactly the expertise LAO teaches. **Supply and demand both exist and cannot find each other.** That gap is the Opportunity Engine's entire reason to exist.

##### Why LAO can do this and marketplaces cannot

A marketplace's only evidence of capability is prior activity on that marketplace. LAO holds something no marketplace has: a **causal, timestamped record of how a capability was acquired and demonstrated** (E3). That converts the cold-start problem from unsolvable into merely hard.

| | Upwork / Fiverr | LinkedIn | Coursera / Udemy | **LAO** |
|---|---|---|---|---|
| Sees capability evidence | Only prior platform work | Self-asserted claims | Course completion | **Full causal chain** |
| Finds work | ✅ | ⚠️ | ❌ | ✅ (matching, not brokering) |
| Teaches the gap | ❌ | ❌ | ✅ (generic) | ✅ (**targeted at a real opportunity**) |
| Closes the loop | ❌ | ❌ | ❌ | ✅ |

##### The loop (the original mechanism)

The engine's value is not matching. Matching is commodity. The value is that **matching runs in both directions**:

```
Opportunity  ──requires──▶  Capability
                               │
                    ┌──────────┴──────────┐
                    │                     │
              mastery held          mastery missing
                    │                     │
                    ▼                     ▼
        Evidence-backed approach    Targeted learning mission
                    │                     │
                    │                     ▼
                    │             mastery + new evidence
                    │                     │
                    └──────────◀──────────┘
```

**A capability gap is not a rejection — it is a curriculum.** Demand pulls the syllabus rather than a syllabus being pushed at the learner. No product in §D13 or §D1 does this, because doing it requires holding the opportunity, the mastery model, and the evidence graph at once.

##### Components

| Component | Responsibility |
|---|---|
| **Opportunity record** | Typed: source, kind (client work / grant / local need / own product), required capabilities (ESCO-vocabulary), effort, expected value, deadline, evidence expected. Same record as the EARN-stage slice in §D3 — built once. |
| **Capability matcher** | Matches required capabilities against the **Mastery Ledger** (E2) — demonstrated, not claimed. Returns a ranked match *with its reasoning exposed*. |
| **Gap analyser** | The difference between required and held mastery. The engine's most valuable output — more useful than the match itself. |
| **Mission generator** | Converts a gap into a targeted LEARN mission routed through the Progression Engine (E4). This is the loop-closing component. |
| **Evidence-backed introduction** | Assembles a verifiable Evidence Graph (E3) link into the learner's approach, so a beginner arrives with proof instead of assertions. |
| **Calibration guard** | Refuses to back an approach the evidence does not support (see risks). |

##### Hard constraints

These are design boundaries, not preferences:

- **LAO does not become a marketplace.** No liquidity to bootstrap, no escrow, no disputes, no payments, no fraud surface. LAO matches and vouches; the transaction happens wherever the two parties prefer. This is a deliberate refusal of the largest, most off-thesis build in this document.
- **LAO does not take a transaction cut.** A percentage of learner earnings would make LAO's incentive transaction volume rather than learner outcome — and would directly corrupt mastery gating (E2), because a gated learner is a learner not earning. The incentive must stay aligned with the learner getting *good*, not with them transacting.
- **LAO never auto-applies on a learner's behalf.** Proposal spam is the documented failure mode of §D13. Automating it would make LAO the problem and would destroy the credibility instrument in a single quarter.
- **Calibration over optimism.** An evidence-backed introduction is only worth something while it is *reliably* accurate. One oversold beginner damages the signal for every subsequent learner. The engine must be willing to say "not yet, here is what's missing."

##### Honest risks

1. **Sourcing is the hard half, and it has its own cold start.** An empty opportunity feed is worse than none — the same failure recorded for community in §D10. Matching must therefore be proven against learner-entered opportunities (their own network, local businesses they already know) *before* any sourcing investment.
2. **A bad match costs the learner's scarcest resource.** Not time — motivation. Precision must beat recall at every stage; one good match beats fifty plausible ones.
3. **Evidence credibility is a one-way door.** It compounds while accurate and collapses permanently when abused.
4. **Regulatory exposure.** Matching people to paid work can touch employment-agency and labour regulation depending on jurisdiction, and grant matching may touch financial-promotion rules. **Requires Uniform (UU) review before any sourcing or introduction feature ships** — not before design.

##### Smallest valuable version

Per §18 discipline, the first build is deliberately unglamorous:

> **Learner-entered opportunities + gap analysis + mission generation.** No sourcing. No introductions. No marketplace. No automation.

That tests the only genuinely novel claim — *that turning a real opportunity's requirements into a targeted learning mission produces better outcomes than a generic syllabus* — at the lowest possible cost. If the loop does not create value at this size, no amount of sourcing will rescue it. Evidence-backed introductions come second, and only once the Evidence Graph (E3) has enough substance to be worth showing.

##### Why original

The opportunity record is commodity, the skills vocabulary is borrowed (ESCO/O*NET, CC BY 4.0), and the matching maths is standard. **The loop is the IP** — and it is only constructible by a system that holds learning, evidence, and demand together. It is also the capability that makes the LEARN→BUILD→LAUNCH→EARN thesis a mechanism rather than a slogan.

#### E7. Friction Budget

**Problem:** the stated target is "least possible friction" — currently unmeasurable, therefore unmanageable.

An explicit instrument tracking, per learner journey: time-to-first-learning-moment, time-to-first-built-artifact, time-to-first-launch, time-to-first-earning, and the count of blocking steps at each transition. Every proposed feature must state its expected effect on this budget; features that add friction without a compensating outcome gain are rejected.

**Why original:** it operationalises the actual product goal, and it is the guard that stops LAO drifting toward "more features."

---

### F. Test and measure

The standing principle ends in TEST → MEASURE. These are the measurements that would tell LAO whether any of the above worked. Committing to them *before* building is what prevents retrospective justification.

| Capability | Primary metric | Guardrail metric (must not degrade) |
|---|---|---|
| Mastery ledger | Unaided assessment performance at gate | Time-to-gate does not become discouraging |
| Hint ladder (E5) | **Post-coaching unaided performance vs. uncoached control** (the A2 test) | In-session completion |
| Lesson unit sizing | Session completion rate (target: micro-learning's 80–90%, per A3) | Concept retention at spaced review |
| First-two-weeks design | 14-day retention (attacks the 50%-of-dropouts window) | Not achieved via engagement mechanics |
| Progression engine | Stage transition rates, especially BUILD→LAUNCH | Regression rate stays healthy, not zero |
| Evidence graph | Portfolio artifacts generated per learner; external engagement with them | Learner consent rate stays high |
| **Opportunity Engine — the loop** | **Gap → mission → mastery → win conversion rate** (the claim that demand-derived missions beat generic syllabus) | Learner does not abandon after a failed pursuit |
| Opportunity Engine — matching | Match *precision*: share of pursued opportunities that convert | Precision must not be bought with recall collapse |
| Evidence-backed introduction | Response rate vs. an unbacked approach baseline | **Calibration: share of backed approaches that the work justified** — if this falls, stop |
| Multi-modal lessons | Modality usage distribution; outcome parity across modalities | No modality is systematically worse |
| Video pipeline | Cost per lesson-minute; correction turnaround | Caption accuracy |
| Friction budget | Time-to-first-earning | — |
| Accessibility | Automated WCAG 2.2 AA pass rate in CI; assistive-tech task completion | Zero regressions merged |

**The measurement that matters most:** LAO's thesis is that a person can go from not knowing how to use AI to building something valuable and potentially earning from it. The honest headline metric is **time-to-first-earning-event**, with completion rate as a supporting measure — not course completions, not streaks, not DAU.

---

### G. Open-source component register

Per the standing open-source policy. **Every licence below marked ✅ was verified against the project's own repository or documentation during this research** (see Sources) — none are asserted from memory. Two carry active warnings (Remotion, Piper) and one is rejected outright (n8n).

**Version and maintenance activity are deliberately not recorded here** — they change continuously and a stale value in a compliance register is worse than none. Both must be captured, pinned, and security-reviewed at the moment of adoption, and this register updated at that point.

| Project | Licence | Purpose | Distributed? | Modified? | Alternative | Interface boundary |
|---|---|---|---|---|---|---|
| **Temporal** | MIT ✅ | Durable workflow execution | No — server-side | No | Kestra | LAO workflow adapter |
| **Kestra** | Apache-2.0 ✅ | Declarative orchestration | No — server-side | No | Temporal | LAO workflow adapter |
| **n8n** | Sustainable Use License ✅ | ❌ **Rejected** — not usable as customer-facing engine | — | — | Temporal / Kestra | N/A — study UX only |
| **LangGraph** | MIT ✅ | Agent execution strategy | No | No | CrewAI, AG2 | LAO agent adapter |
| **CrewAI** | MIT ✅ | Role-based agent orchestration | No | No | LangGraph, AG2 | LAO agent adapter |
| **AutoGen / AG2** | Apache-2.0 ✅ | Multi-agent conversation patterns | No | No | LangGraph | LAO agent adapter |
| **OpenHands** | MIT ✅ | Sandboxing patterns | No | No | Own sandbox | Study; LAO owns sandboxing |
| **Aider** | Apache-2.0 ✅ | Git-commit-per-change audit pattern | No | No | — | Pattern only |
| **Continue** | Apache-2.0 ✅ | Human-in-loop patterns | No | No | — | Pattern only |
| **Remotion** | ⚠️ Proprietary / Company Licence ✅ | Programmatic video composition | Rendered output only | No | Direct FFmpeg composition | LAO render adapter — **exit path mandatory** |
| **FFmpeg** | ⚠️ LGPL-2.1+ default; GPL-2.0+ with `--enable-gpl` ✅ | Encode / transcode substrate | Yes, if bundled | No | — | LAO media adapter; **build flags are a licence decision** |
| **Whisper** | MIT ✅ (code *and* model weights) | Speech-to-text | No | No | Vosk | LAO voice adapter |
| **Piper** (`rhasspy/piper`) | MIT ✅ — ⚠️ **archived 2025-10-06, read-only** | Local TTS | No | No | See below | LAO voice adapter |
| **Piper** (`OHF-Voice/piper1-gpl`) | ⚠️ **GPL-3.0** ✅ — the maintained successor | Local TTS | No | No | Kokoro, other TTS behind same adapter | LAO voice adapter — **decision required (A8)** |
| **Moodle** | GPL-3.0 ✅ | ❌ Study only | — | — | — | None |
| **Open edX** | AGPL-3.0 ✅ | ❌ Study only — network copyleft | — | — | — | None |
| **Canvas LMS** | AGPL-3.0 ✅ | ❌ Study only — network copyleft | — | — | — | None |
| **SuiteCRM** | AGPL-3.0 ✅ | ❌ Study only | — | — | — | None |
| **Mautic** | GPL-3.0 ✅ | ❌ Study only | — | — | — | None |
| **Odoo (community)** | LGPL-3.0 ✅ | Study only — ERP-shaped | — | — | — | None |
| **Cal.com** | AGPL-3.0 core + proprietary `/ee` ✅ | ❌ Not adopted — link out instead | — | — | Calendly (external) | None |
| **Discourse** | GPL-2.0-or-later ✅ | Community, if ever integrated | No — separate service | No | Circle, Discord | Integration boundary only |
| **freeCodeCamp** | BSD-3-Clause code; curriculum separate ✅ | Study — project-based certification model | — | — | — | None |
| **axe-core** | MPL-2.0 ✅ | CI accessibility testing | No — dev dependency | No | Other a11y tooling | CI only, not shipped |
| **ESCO** (classification data) | CC BY 4.0 ✅ | Skills/occupation vocabulary for matching | Yes — vocabulary ships | No | O*NET | LAO capability model — **attribution must ship** |
| **ESCO** (API) | EUPL-1.2 ✅ | Optional lookup service | No — service boundary | No | Local copy of the data | Weak copyleft; keep behind a service boundary |
| **O*NET** | CC BY 4.0 ✅ | Alternative/complementary skills taxonomy | Yes — vocabulary ships | No | ESCO | Same as ESCO; **attribution must ship** |

#### Standing licence rules

1. **Never remove third-party copyright notices.**
2. **Never claim third-party code as LAO code.**
3. Prefer permissive licences (MIT, Apache-2.0, BSD) where technically appropriate.
4. **AGPL and source-available licences (n8n's SUL) require explicit sign-off before adoption** — not an engineering-level decision.
5. Every adopted component sits behind an adapter per `ADAPTER_SPECIFICATION.md`, so any licence change is survivable.
6. Pin versions and record maintenance/security status at adoption, and update this register then.

---

### H. What LAO should explicitly not do

Recording rejections is as valuable as recording adoptions, because rejected ideas return.

| Do not | Why |
|---|---|
| Build a CRM | Fails the value test on LEARN and BUILD (§B) |
| Build a booking/calendar system | Fails on all four; deep problem, no thesis contribution (§D7) |
| Build a community forum | Solved, permanently expensive, integrate instead (§D10) |
| Embed n8n as the automation engine | Sustainable Use License prohibits it (A6) |
| Adopt any AGPL LMS into the hosted product | Network copyleft triggers source disclosure (A7) |
| Ship an answer-giving AI assistant | Measurably harms learning outcomes (A2) |
| Ship 40-hour courses | 5–10% completion is a known-bad format (A3) |
| Use loss-framed streaks as the retention mechanism | Manufactures churn; commitment devices are stronger (A4) |
| Make an agent framework the core | Lock-in; LAO's existing abstraction is correct (§D5) |
| Author lessons in a single modality | Forecloses multi-modal delivery permanently (§D11) |
| Design desktop-first | Violates the mobile-first principle (§D12) |
| Cite Bloom's 2σ in any LAO material | It does not replicate; ~0.37σ is the honest figure (A1) |
| Build a two-sided marketplace | Liquidity, escrow, disputes, fraud — enormous and off-thesis (§E6) |
| Take a cut of learner earnings | Would make LAO's incentive transaction volume, corrupting mastery gating (§E6) |
| Auto-apply to opportunities for learners | Proposal spam is the category's documented failure mode (§D13) |
| Invent a skills taxonomy | ESCO and O*NET exist under CC BY 4.0; originality belongs in the mastery model |

---

### I. Open questions

Recorded honestly rather than resolved prematurely. Each needs an answer before the related capability is built.

1. **Video's actual value.** A3 says short units win, and text is faster to correct, cheaper, and more accessible than video. Is generated lesson video worth its cost and licence exposure (A5), or is it valuable primarily as a *modality option* for learners who need it? This should be tested against learner outcomes before the pipeline is built out.
2. **Mastery gating tolerance.** Gating is the mechanism (A1) but adds friction. Where is the threshold at which learners abandon rather than push through? This needs measurement, not assumption.
3. **Earning attribution.** How does LAO verify an earning event without becoming a payment processor or demanding invasive proof? The evidence graph's credibility depends on this.
4. **Phone-primary learners who cannot access a desktop.** §D12's split-session model assumes desktop availability for BUILD. For learners without it, what is the genuine path? This may be the most important unanswered accessibility question in the product.
5. **Duolingo's adaptive model.** IRT/computer-adaptive testing in the Duolingo English Test is well documented, but the internals of their consumer-app adaptive system are not publicly verified. LAO should base its own adaptivity on the published IRT/CAT and spacing literature rather than inferred competitor behaviour.
6. **Community timing.** Community helps retention but is negative when empty. What learner volume justifies starting it?
7. **Opportunity sourcing (§E6).** The engine's hard half. Learner-entered opportunities prove the loop but do not scale it. Which source comes next — public listings, local business outreach, partner channels, grant databases — is unresolved, and each carries different ToS and regulatory weight.
8. **Does the demand pool actually hire beginners?** A9 establishes that small businesses report a skills barrier. It does *not* establish that they will hire a newly-capable beginner rather than an agency. This assumption underpins the Opportunity Engine and should be tested with real learners before sourcing is built.
9. **Piper decision (A8).** Unmaintained MIT versus maintained GPL-3.0 versus a different TTS engine entirely. Because Piper sits behind LAO's voice adapter, this is a low-cost decision to defer — but it should be made deliberately, not by whichever version someone installs first.

---

### J. Maintenance

Revise this document when:

- A capability in §D is about to be built — re-verify that category's licences and re-run the value test.
- A licence changes. Remotion's terms and n8n's SUL are the highest-risk watch items; both have changed before.
- A measurement in §F contradicts a finding here. **Measured evidence from LAO's own learners supersedes this research.**
- A significant new product or open-source project appears in a category.

Do not let this document become a static artifact. An unmaintained competitive intelligence document is worse than none, because it is trusted.

---

### Sources

Primary and authoritative sources consulted for the verified claims in this document.

**Licensing**
- [Remotion licence terms](https://www.remotion.dev/docs/license/terms) · [Remotion licence FAQ](https://www.remotion.dev/docs/license/faq) · [Remotion company licensing](https://www.remotion.pro/license)
- [n8n Sustainable Use License (docs)](https://docs.n8n.io/sustainable-use-license/) · [n8n announcement](https://blog.n8n.io/announcing-new-sustainable-use-license/) · [n8n LICENSE.md](https://github.com/n8n-io/n8n/blob/master/LICENSE.md)
- [FFmpeg License and Legal Considerations](https://www.ffmpeg.org/legal.html) · [FFmpeg LICENSE](https://ffmpeg.org/doxygen/4.4/md_LICENSE.html)
- [Cal.com — changing to AGPLv3 and introducing the Enterprise Edition](https://cal.com/blog/changing-to-agplv3-and-introducing-enterprise-edition) · [Cal.com /ee LICENSE](https://github.com/calcom/cal.com/blob/main/packages/features/ee/LICENSE)
- [Open-source LMS licence comparison](https://selleo.com/blog/open-source-lms-comparison)
- [Temporal repository](https://github.com/temporalio/temporal) · [Kestra repository](https://github.com/kestra-io/kestra)
- [CrewAI](https://en.wikipedia.org/wiki/CrewAI)
- [OpenHands (MIT)](https://github.com/All-Hands-AI/OpenHands) · [Aider (Apache-2.0)](https://github.com/Aider-AI/aider) · [Continue (Apache-2.0)](https://github.com/continuedev/continue)
- [Whisper (MIT, code and weights)](https://github.com/openai/whisper)
- [Piper — archived MIT repository](https://github.com/rhasspy/piper) · [Piper — maintained GPL-3.0 successor](https://github.com/OHF-Voice/piper1-gpl)
- [Discourse (GPL-2.0-or-later)](https://github.com/discourse/discourse) · [axe-core (MPL-2.0)](https://github.com/dequelabs/axe-core)

**Learning science and outcomes**
- [Generative AI without guardrails can harm learning — PNAS](https://www.pnas.org/doi/10.1073/pnas.2422633122) · [preprint PDF](https://hamsabastani.github.io/education_llm.pdf)
- [An AI tutor helped Harvard students learn more physics in less time — Hechinger Report](https://hechingerreport.org/proof-points-ai-tutor-harvard-physics/)
- [Two-Sigma Tutoring: Separating Science Fiction from Science Fact — Education Next](https://www.educationnext.org/two-sigma-tutoring-separating-science-fiction-from-science-fact/) · [Bloom's 2 sigma problem — Wikipedia](https://en.wikipedia.org/wiki/Bloom's_2_sigma_problem) · [Nintil systematic review](https://nintil.com/bloom-sigma/)
- [Online course completion statistics](https://www.skillademia.com/statistics/online-course-completion-statistics/) · [Uncovering MOOC Completion — Open Praxis](https://openpraxis.org/articles/10.55982/openpraxis.16.3.606)
- [AutoIRT: Calibrating Item Response Theory Models with AutoML (Duolingo English Test)](https://arxiv.org/abs/2409.08823) · [BanditCAT and AutoIRT](https://arxiv.org/pdf/2410.21033)

**Accessibility**
- [WCAG 2.2 checklist and success criteria](https://www.levelaccess.com/blog/wcag-2-2-aa-summary-and-checklist-for-website-owners/) · [WCAG 2.2 success criteria explained](https://216digital.com/wcag-2-2-success-criteria-explained-the-2026-compliance-guide/)
- [WCAG 3.0 status and timeline](https://www.webability.io/blog/wcag-3-0-explained)

**Opportunity, demand, and skills taxonomies**
- [Upwork — top reasons you can't get a job on Upwork](https://www.upwork.com/resources/cant-get-jobs-on-upwork) · [Upwork first client with no reviews](https://zenlance.net/upwork-first-client-with-no-reviews/) · [Fiverr — building credibility with no reviews](https://community.fiverr.com/public/blogs/how-to-build-credibility-on-fiverr-when-you-have-no-reviews-2025-09-23)
- [Upwork vs Fiverr — fee comparison](https://freelancecompare.com/blog/upwork-vs-fiverr-comparison) · [Upwork vs Fiverr fees, pay and Connects](https://sidequesthustle.com/guides/upwork-vs-fiverr-comparison)
- [SME AI adoption in 2026 — what the data shows](https://www.omago.ai/blog/sme-ai-adoption-2026-data) · [Small business AI adoption statistics](https://capsulecrm.com/blog/small-business-ai-adoption-statistics/) · [US small business AI adoption data points](https://epiphanydynamics.ai/blog/state-of-ai-adoption-us-small-business-2026/)
- [ESCO copyright notice — skills and competences](https://esco.ec.europa.eu/en/copyright-notice-esco-skills-competences) · [ESCO API terms](https://esco.ec.europa.eu/en/use-esco/use-esco-services-api) · [EUPL 1.2](https://eupl.eu/)



---

## Part IX — Reconciliation Log

**Status:** Open defects. None of these are fixed in Parts I–VIII.

Consolidating eight documents into one exposed conflicts that were invisible while the content sat in separate files. This log records every one of them.

**Why nothing was silently corrected:** the merge brief was to combine the documentation, not to redesign the API surface. Renaming properties or rewriting licence records across specifications is a design decision, not a formatting one. Each entry below therefore states the conflict, the evidence, and a **recommended** resolution — to be ratified before it is applied.

**Severity key:** 🔴 will produce broken code · 🟠 legal or factual risk · 🟡 confusing but not harmful

---

### §1 — The base adapter and base agent are each specified twice, incompatibly

🔴 **The single most serious finding.** Part III and Part VI both define `ProviderAdapter`, and they disagree. Part IV and Part VI both define the agent's counters, and they disagree.

| Property | Part III (Adapter Spec) | Part VI (Implementation Guide) |
|---|---|---|
| Cost accumulator | `cost_tracker` | `costTracker` |
| Health timestamp | `last_checked` | `lastChecked` |
| Agent success counter | `completed_count` (Part IV) | `completedCount` |
| `constructor(config)` | `config` required | `config = {}`, `id` defaults to `uuid()` |
| `healthCheck()` | **abstract** — throws `'healthCheck() must be implemented'` | **concrete** — returns `'healthy'` unconditionally |

Occurrence counts across the source documents:

| Identifier | snake_case | camelCase |
|---|---|---|
| cost tracker | `cost_tracker` — Adapter Spec ×5, Impl Guide ×1 | `costTracker` — Impl Guide ×6 |
| health timestamp | `last_checked` — Adapter Spec ×3, Agent System ×1, Provider Registry ×2 | `lastChecked` — Impl Guide ×5, Quick Start ×1 |
| success counter | `completed_count` — Agent System ×7 | `completedCount` — Impl Guide ×3, Quick Start ×1 |

**The Implementation Guide contradicts itself**, using `cost_tracker` once and `costTracker` six times.

**Concrete failures this causes:**

1. An adapter written from Part III exposes `cost_tracker`. The registry's `tryAdapters()` sorting in Part III reads `a.cost_tracker?.total` — consistent. But an adapter written from Part VI exposes `costTracker`, so that same sort silently reads `undefined`, coerces to `0`, and **every Part VI adapter sorts as if it were free.** Cost-based provider selection breaks silently, with no error.
2. The Quick Start Echo agent (Part VII) runs `this.completedCount++` while the Part IV base agent defines `this.completed_count`. The increment creates a new property; `getStatus()` keeps reporting `completed: 0` forever.
3. `healthCheck()` is abstract in one spec and a permissive default in the other. Under Part VI's version, an adapter that forgets to implement a health check **reports itself healthy**, defeating the registry's health gating and the fallback chain entirely.

**Recommended resolution:** adopt camelCase for JavaScript object properties (the language convention, and the majority usage), and keep snake_case for YAML and JSON configuration keys where it is already consistent (`docker_support`, `health_check_url`, `last_tested`). Keep `healthCheck()` **abstract** per Part III — a default that claims health is actively dangerous. Apply across Parts III, IV, VI, VII in one pass.

---

### §2 — Five components are defined two or three times over

🟡 Duplication is the mechanism that produced §1. It will produce more.

| Component | Defined in |
|---|---|
| `ProviderAdapter` base class | Part III "Base Adapter Interface"; Part VI §1.4 |
| `ProviderRegistry` | Part III "Adapter Registry Integration"; Part VI §1.3 |
| Voicebox adapter | Part III "Adapter Implementation Example"; Part VI §2.1; Part VII Step 6 |
| Echo agent | Part IV "Echo Agent (Voice)"; Part VI §2.2; Part VII Step 6 |
| `config/providers.yaml` | Part III "Configuration Format"; Part VI §2.3 |

All copies are retained in this document, because they are not identical and choosing between them is a design decision (§1).

**Recommended resolution:** designate Parts II–V as normative and Parts VI–VII as narrative. Every code block in VI/VII that restates a normative definition should be replaced by a reference to it, keeping only genuinely tutorial-specific code (stubs and wiring).

---

### §3 — Three licence records in Part II are wrong or stale

🟠 Part II's provider inventory predates the verified licence research in Part VIII §G. Where they disagree, **Part VIII is correct** — its entries were verified against each project's own repository.

| Provider | Part II records | Verified reality | Impact |
|---|---|---|---|
| **AutoGen** | `license: CC-BY-4.0` | **Apache-2.0** | CC-BY-4.0 is a *content* licence and is not appropriate for software at all. The record is wrong in kind, not just in detail. |
| **Piper** | `license: MIT`, `github: rhasspy/piper` | That repo was **archived 2025-10-06** and is read-only. Development moved to `OHF-Voice/piper1-gpl` under **GPL-3.0**. | Choose unmaintained MIT or maintained GPL-3.0. See Part VIII §A8. |
| **Coqui TTS** | listed as an available provider, `cost: free` | Coqui **shut down its commercial operation in January 2024**; the original repo is no longer officially developed. Code and models remain available and a community fork is maintained. | Not disqualifying, but "actively available provider" overstates it. |

⚠️ **Additional caveat on Coqui:** Part II records `license: MPL-2.0`, which covers the *code*. Coqui's XTTS **model weights** are widely reported to carry a separate, non-commercial licence. Code licence and model-weight licence are different things — the same distinction Part VIII §G draws for freeCodeCamp's code versus curriculum. **Verify the weights licence before any commercial use.**

**Recommended resolution:** correct the AutoGen entry, split the Piper entry in two with the trade-off stated, annotate Coqui's maintenance status and weights caveat, and add a `licence_verified` date field to the registry schema so staleness becomes visible rather than assumed.

---

### §4 — The Quick Start cannot succeed as written

🔴 Part VII promises a running system in 30 minutes. It cannot currently deliver one, and the failure is in the repository, not the documentation.

| Problem | Evidence |
|---|---|
| `package.json` dependencies do not match the code | It declares `claude-sdk` and `webhook-tools`. The committed code requires `express`, `axios`, and `claude-api`. None of the declared packages are required by any file. |
| The start script targets a file that does not exist | `"main": "index.js"`, `"start": "node index.js"` — there is no `index.js` in the repository. |
| `claude-document-generator.js` uses an API that does not exist | It requires `claude-api` and calls `new ClaudeClient().createDocument(...)`. Anthropic's SDK is `@anthropic-ai/sdk`, and it has no `createDocument` method. |
| `webhook-handler-with-claude.js` posts to a non-existent endpoint | `https://api.claude.ai/endpoint`. The Messages API is `https://api.anthropic.com/v1/messages`. |

Following Part VII Step 5 (`npm start`, expecting `Server listening on port 3000`) therefore fails at the first run for a new contributor.

**Recommended resolution:** treat this as a code defect rather than a documentation one. Either bring `package.json` and the two committed scripts into line with the specifications, or remove the placeholder scripts and let Part VI §1 be the sole entry point. **This should be resolved before anyone is asked to follow the Quick Start.**

---

### §5 — Lower-severity inconsistencies

🟡 Recorded for completeness; none block work.

| Item | Detail |
|---|---|
| Course-creation workflow appeared three times, and the fullest version was in the file being retired | Part I "Data Flow" and Part IV "Example: Course Creation Workflow" both describe it, but the `INDEX.md` variant was the only one showing the **Sierra/IrisKey approval gate, the pre-approval cost estimate, and the audit aggregation**. Part IV omits all three. The unique steps are preserved immediately below; **Part IV should absorb them.** |
| `docs/` file-structure listings are now stale | Parts I, VI, and VII each describe a `docs/` tree that no longer exists after this consolidation. |
| Part VII's "Reference Docs" points at merged files | Those paths are now Parts of this document. |
| `src/` structure differs slightly between Parts I and VI | Part I lists `agents/[nato-agents]/`; Part VI's Phase 1 tree differs in nesting. |
| Version headers are inconsistent | Parts I–V carry "Version 1.0"; this consolidated document is 2.0. Individual Part versions were left untouched. |

---

#### Preserved: the approval and audit steps missing from Part IV

The retired `INDEX.md` workflow included these stages, which neither Part I nor Part IV contains. They are the steps that connect the agent system to Part V's authorization and audit spine, so losing them would have quietly removed the only worked example of a high-impact approval gate.

```
Alpha → Uniform: Check compliance
  ├─ Verifies legal requirements
  └─ Returns compliance report
  ↓
Alpha → Sierra: Request approval (high-impact)
  ├─ Check identity via IrisKey biometric
  ├─ Verify permission to publish
  ├─ Estimate cost: $2.45 (if using paid providers)
  └─ Await user approval
  ↓
Alpha → Tango: Assemble & publish
  ├─ Packages course
  ├─ Uploads to LAO Academy
  └─ Returns published link
  ↓
Alpha: Aggregate results → Return to user
  ↓
Audit System: Record all events immutably
  - Research conducted / Script written / Narration generated
  - Images created / Approvals granted / Course published
  - Total cost: $X.XX
```

---

### §6 — What consolidation actually proved

The strongest argument for merging was not tidiness. It was that **§1 existed for months and was undetectable while the documents sat apart.** Two incompatible definitions of the same base class, in two files that never referenced each other, cannot be spotted by reading either file correctly.

Part VIII §D1 recommends separating content from progress ledgers so that edits cannot corrupt history. §1 here is the same failure in the documentation layer: the same definition copied into two places, then edited in one. Single-sourcing the normative definitions (§2) is the structural fix, and it matters more than any individual rename.

---
