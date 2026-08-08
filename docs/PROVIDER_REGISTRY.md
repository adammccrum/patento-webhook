# Provider Registry Specification

**Version:** 1.0  
**Purpose:** Define all available open-source and commercial providers  
**Status:** Living document

---

## Registry Entry Schema

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

## Voice Providers

### Voicebox (Open Source)
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

### Piper (Open Source)
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

### Kokoro TTS (Open Source)
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

### Whisper.cpp (Open Source)
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

### Coqui TTS (Open Source)
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

### Google Cloud TTS (Commercial)
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

### AWS Polly (Commercial)
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

## Media Providers

### ComfyUI (Open Source)
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

### Stable Diffusion (Open Source)
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

### FLUX (Open Source)
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

### CogVideoX (Open Source)
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

### Stability AI (Commercial)
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

### OpenAI DALL-E (Commercial)
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

## Agent Frameworks

### CrewAI (Open Source)
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

### AutoGen (Open Source)
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

### LangGraph (Open Source)
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

### OpenHands (Open Source)
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

## Document Providers

### AnythingLLM (Open Source)
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

### Docling (Open Source)
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

## Vision Providers

### YOLO (Open Source)
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

### SAM2 (Open Source)
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

## Database Providers

### PostgreSQL (Open Source)
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

### Redis (Open Source)
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

### ChromaDB (Open Source)
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

### Qdrant (Open Source)
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

## LLM Providers

### Ollama (Open Source)
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

### vLLM (Open Source)
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

### OpenRouter (Commercial)
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

## Memory Providers

Accessed through the `MemoryAdapter` interface only — see
[MEMORY_PROVIDER_SPECIFICATION.md](MEMORY_PROVIDER_SPECIFICATION.md).

Memory providers do **not** participate in automatic fallback chains. If the
configured provider is unavailable, agents run without memory and say so.

### Local Memory (Default)
```yaml
id: local-memory
category: memory
subcategories:
  - session
  - project
  - learner
  - operational
name: Local Memory
license: internal
capabilities:
  - persistent-recall
  - provenance
  - correction
  - expiry
  - subject-erasure
  - export
deployment:
  local_support: true
  cloud_support: false
  store: sqlite
cost:
  type: free
status:
  enabled: true
  health: unknown
adapter:
  interface: MemoryAdapter
  adapter_file: src/providers/adapters/memory/local-memory-adapter.js
  implemented: false
egress:
  allow_egress: false
  destinations: []
```

### TencentDB Agent Memory (Open Source — EVALUATION ONLY)
```yaml
id: tencentdb-agent-memory
category: memory
subcategories:
  - project
name: TencentDB Agent Memory
github: https://github.com/TencentCloud/TencentDB-Agent-Memory
license: MIT            # GitHub reports NOASSERTION; manual determination — see BACKLOG MEM-8
capabilities:
  - persistent-recall
  - semantic-search
  - knowledge-graph
deployment:
  docker_support: true
  local_support: true    # standalone / SQLite mode
  cloud_support: true    # service mode — OUT OF SCOPE (TCVDB + COS)
  arm64_support: unverified
  required_env_vars:
    - TDAI_LLM_BASE_URL   # defaults to https://api.openai.com/v1 — must be repointed locally
    - TDAI_LLM_MODEL
cost:
  type: free
status:
  enabled: false         # GATED — do not enable
  health: unknown
  approval: evaluation-candidate
adapter:
  interface: MemoryAdapter
  adapter_file: src/providers/adapters/memory/tencent-memory-adapter.js
  implemented: false
egress:
  allow_egress: false
  allowed_scopes: []     # learner never permitted
constraints:
  - Proxy mode (ANTHROPIC_BASE_URL interception) is REJECTED — never enable
  - Service mode, TCVDB, COS and CodeGraph on private repos are out of scope
  - MemoryCore HTTP API only; pin to a commit SHA, never a branch or :latest
  - Blocked on decision gates G1-G8 in TENCENTDB_MEMORY_ASSESSMENT.md
```

---

## Status Tracking

Each provider entry includes:
- `enabled`: Is this provider active in current environment?
- `health`: Current health status (healthy/degraded/unhealthy)
- `last_checked`: When was health last verified?
- `uptime_percent`: Rolling uptime percentage
- `last_error`: Last error encountered (for debugging)

---

## Usage Rules

1. **Always check `enabled` flag** before using provider
2. **Check health status** before critical operations
3. **Use adapter interface** - never call provider directly
4. **Track cost** for every external API call
5. **Implement fallback chains** - use next provider if primary fails
6. **Log provider selection** for audit trail
7. **Test with mock providers** during development
8. **Monitor provider health** continuously

---

## Adding New Providers

To add a new provider:

1. Create entry in this registry with full metadata
2. Implement adapter (extends `ProviderAdapter`)
3. Add health check endpoint
4. Add configuration for enabling/disabling
5. Test with mock data
6. Document in README

No changes to business logic needed.
