# Documentation Index

## Core Architectural Documents

### 1. **[ARCHITECTURE.md](ARCHITECTURE.md)** 
   The system design blueprint. Start here to understand:
   - Layer architecture (orchestrator → agents → adapters → providers)
   - No hardcoded providers principle
   - Core components overview
   - Data flow example

### 2. **[PROVIDER_REGISTRY.md](PROVIDER_REGISTRY.md)**
   Complete inventory of available providers:
   - Voice providers (Voicebox, Piper, Whisper, Google Cloud, AWS)
   - Media providers (ComfyUI, Stable Diffusion, FLUX, CogVideoX, Stability AI, OpenAI)
   - Agent frameworks (CrewAI, AutoGen, LangGraph, OpenHands)
   - Document, vision, database, and LLM providers
   - Registry entry schema and metadata requirements

### 3. **[ADAPTER_SPECIFICATION.md](ADAPTER_SPECIFICATION.md)**
   How to create pluggable provider adapters:
   - Base `ProviderAdapter` interface
   - Category-specific adapters (Voice, Media, Agents, Documents, Vision)
   - Adapter implementation example (Voicebox)
   - Error handling patterns
   - Provider swapping via configuration
   - Testing with mock adapters

### 4. **[AGENT_SYSTEM.md](AGENT_SYSTEM.md)**
   26-agent NATO phonetic system specification:
   - All agent definitions and roles
   - Alpha Orchestrator specification
   - Base Agent interface
   - Echo (voice) and Foxtrot (media) example implementations
   - Agent communication patterns
   - Course creation workflow example

### 5. **[AUTHORIZATION_AND_AUDIT.md](AUTHORIZATION_AND_AUDIT.md)**
   Security, identity, and compliance:
   - Authorization flow (identity → permission → approval → execution → audit)
   - IrisKey biometric integration
   - Role-based permission system
   - Immutable audit event logging
   - High-impact action approval gates
   - Cost tracking system
   - Storage backends (file and database)

### 6. **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)**
   Step-by-step how to build the system:
   - Phase 1: Foundation (registry, adapters, orchestrator)
   - Phase 2: First provider (Voicebox)
   - Phase 3: Media generation (ComfyUI)
   - Progressive enablement strategy
   - Testing strategy (unit and integration)
   - Docker deployment
   - How to add new providers

### 7. **[QUICKSTART.md](QUICKSTART.md)**
   Get running in 30 minutes:
   - 6-step startup guide
   - Copy-paste code snippets
   - Test endpoints
   - Common issues and fixes

### 8. **[MEMORY_PROVIDER_SPECIFICATION.md](MEMORY_PROVIDER_SPECIFICATION.md)**
   Persistent agent memory, engine-agnostic (implemented by `LocalMemoryAdapter`):
   - `MemoryProvider` interface and record schema
   - Four separated scopes: session, project, learner, operational
   - Explicit, audited writes; correction, deletion and expiry
   - Provenance and the untrusted-recall trust model
   - Local-first egress gate and replaceability tests
   - Storage backend rationale (append-only journal)

### 9. **[TENCENTDB_MEMORY_ASSESSMENT.md](TENCENTDB_MEMORY_ASSESSMENT.md)**
   Evaluation of TencentDB Agent Memory (**research approved · production integration NOT approved**):
   - Repository, licence and dependency findings
   - Mac and Claude Code compatibility
   - Security and privacy risks R1–R10
   - Six explicitly rejected integration modes
   - Smallest integration path and decision gates G1–G8

### 10. **[BACKLOG.md](BACKLOG.md)**
   Engineering backlog and recorded decisions:
   - Memory subsystem workstream (MEM-1 … MEM-8)
   - Decision log

---

## Key Principles

### 1. No Hardcoded Providers
Every provider accessed through adapters. Business logic never references specific services.

```javascript
// ✅ GOOD: Via adapter
const adapter = await registry.getAdapter('voice', 'text-to-speech');
const audio = await adapter.textToSpeech(text);

// ❌ BAD: Direct provider reference
const audio = await voicebox.textToSpeech(text);
```

### 2. Progressive Enablement
Install and enable providers only when needed. Configuration drives what's active.

```yaml
# config/providers.yaml - Control what's enabled
voice:
  voicebox: enabled: true
  piper: enabled: false
  google-cloud: enabled: false
```

### 3. Adapter Pattern
All providers implement the same interface for their category:

```
VoiceAdapter interface:
├─ textToSpeech()
├─ speechToText()
├─ getAvailableVoices()
└─ cloneVoice()

All voice providers (Voicebox, Piper, Google, AWS) implement the same interface.
```

### 4. Fallback Chains
When primary provider unavailable, try next in chain automatically.

```
Voice request:
1. Try Voicebox → healthy? Use it
2. Voicebox down? Try Piper
3. Piper down? Try Google Cloud
4. All down? Error
```

### 5. Cost Tracking
Every external API call tracked for billing and auditing.

```javascript
await adapter.trackCost('textToSpeech', text.length, costPerUnit);
// Logged to audit trail
// Checked against user limits
// Shown to user before approval
```

### 6. Memory is Evidence, Not Authority
Persistent memory is retrieved as labelled, untrusted recall. It never enters
the system prompt, never grants permission, and never overrides a deterministic
rule. Writes are explicit and audited — never a side effect of a turn ending.

```
✅ GOOD: <recalled_memory trust="unverified" source="agent" captured="...">
❌ BAD:  memory contents concatenated into the system prompt
```

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│ HTTP API / User Interface                                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│ Authorization & Audit (IrisKey, Permissions, Compliance)    │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│ Alpha Orchestrator (Task Routing, Delegation)               │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│ Specialist Agents (26 NATO) (Echo, Foxtrot, Tango, etc)    │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│ Provider Registry & Discovery (Health Checks, Fallbacks)    │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│ Pluggable Adapters (Voice, Media, Agents, Documents, Vision)│
├────────────┬──────────────┬──────────────┬──────────────────┤
│ VoiceAdapter│ MediaAdapter │ AgentAdapter │ OtherAdapters  │
│  Voicebox  │  ComfyUI     │   CrewAI     │                 │
│  Piper     │  Stability   │   AutoGen    │                 │
│  Whisper   │  OpenAI      │   LangGraph  │                 │
│  Google    │  HuggingFace │              │                 │
│  AWS       │  RunPod      │              │                 │
└────────────┴──────────────┴──────────────┴──────────────────┘
```

---

## Agent System: 26 NATO Phonetic Agents

| Code | Agent | Role |
|------|-------|------|
| AA | Alpha | Executive Orchestrator |
| BB | Bravo | Software Engineering |
| CC | Charlie | Research & Intelligence |
| DD | Delta | Documents & Reports |
| EE | Echo | Voice & Audio |
| FF | Foxtrot | Image & Video Generation |
| GG | Golf | Marketing & Social Media |
| HH | Hotel | Website & Front-End |
| II | India | Automation & Workflows |
| JJ | Juliet | Customer Support |
| KK | Kilo | Sales & CRM |
| LL | Lima | Finance, Grants, Funding |
| MM | Mike | Cybersecurity |
| NN | November | DevOps & Infrastructure |
| OO | Oscar | Data & Analytics |
| PP | Papa | Testing & Quality Assurance |
| QQ | Quebec | Knowledge Base & Memory |
| RR | Romeo | APIs & Integrations |
| SS | Sierra | IrisKey Biometrics & Identity |
| TT | Tango | LAO Academy Training |
| UU | Uniform | Compliance & Governance |
| VV | Victor | Computer Vision |
| WW | Whiskey | Hardware & IoT |
| XX | X-ray | Experimental Projects |
| YY | Yankee | Communications |
| ZZ | Zulu | Monitoring & System Health |

---

## Reading Path

**Start with:**
1. QUICKSTART.md (get it running in 30 min)
2. ARCHITECTURE.md (understand the design)

**Then dive into:**
3. PROVIDER_REGISTRY.md (see available providers)
4. ADAPTER_SPECIFICATION.md (learn how providers work)

**For implementation:**
5. IMPLEMENTATION_GUIDE.md (step-by-step build)
6. AGENT_SYSTEM.md (agent details)
7. AUTHORIZATION_AND_AUDIT.md (security setup)

---

## Workflow Example: Create & Publish Course

```
User: "Create course on Machine Learning"
  ↓
Alpha receives objective, breaks into tasks
  ↓
Alpha → Charlie: Research "Machine Learning"
  ↓ Charlie discovers research providers, gathers info
  ├─ Found 5 relevant papers
  ├─ Summarized key concepts
  └─ Returns research document
  ↓
Alpha → Delta: Write course script from research
  ├─ Uses available LLM (Claude, local, or other)
  └─ Returns structured script
  ↓
Alpha → Echo: Narrate script
  ├─ Discovers voice providers
  ├─ Primary: Voicebox (local, free)
  ├─ Fallback: Google Cloud (paid)
  └─ Returns audio narration
  ↓
Alpha → Foxtrot: Generate course visuals
  ├─ Discovers media providers
  ├─ Primary: ComfyUI (local, free)
  ├─ Fallback: Stability AI (paid)
  └─ Returns course images
  ↓
Alpha → Papa: Validate content
  ├─ Checks factual accuracy
  ├─ Verifies media quality
  └─ Returns validation report
  ↓
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
Alpha → Golf: Create promotional content
  ├─ Generates social media posts
  └─ Returns marketing assets
  ↓
Alpha: Aggregate results → Return to user
  ↓
Audit System: Record all events immutably
  - Research conducted
  - Script written
  - Narration generated
  - Images created
  - Approvals granted
  - Course published
  - Total cost: $X.XX
```

---

## Quick Reference: Adding a Provider

Want to add a new provider (e.g., OpenAI's DALL-E)?

1. Create adapter file:
   ```javascript
   // src/providers/adapters/media/openai-adapter.js
   class OpenAIAdapter extends MediaAdapter { ... }
   ```

2. Update config:
   ```yaml
   # config/providers.yaml
   openai:
     enabled: false
     adapter: OpenAIAdapter
   ```

3. Test it:
   ```bash
   ENABLE_OPENAI=true npm test
   ```

4. Enable when needed:
   ```bash
   OPENAI_API_KEY=sk-xxx npm start
   ```

Done. No changes to business logic. No hardcoded provider references.

---

## Deployment Models

### Development: Local + Docker Compose
```yaml
services:
  app: our system
  voicebox: local voice provider
  comfyui: local media provider
  postgres: audit logging
```

### Production: Cloud + Fallbacks
```
Primary: Ollama (local LLM) + ComfyUI (local media)
Fallback: OpenRouter API + Stability AI API
Monitoring: Health checks every 60 sec
Audit: PostgreSQL with replication
```

### Hybrid: Best of Both
```
Free tier operations: Local providers (Voicebox, ComfyUI)
High-quality operations: Cloud providers (Stability AI, OpenAI)
Cost control: Alpha selects provider based on:
  - User's monthly budget
  - Quality requirements
  - Time constraints
```

---

## File Structure

```
/home/user/patento-webhook/
├── docs/                                   ← You are here
│   ├── INDEX.md                           ← This file
│   ├── ARCHITECTURE.md
│   ├── PROVIDER_REGISTRY.md
│   ├── ADAPTER_SPECIFICATION.md
│   ├── AGENT_SYSTEM.md
│   ├── AUTHORIZATION_AND_AUDIT.md
│   ├── IMPLEMENTATION_GUIDE.md
│   ├── QUICKSTART.md
│   ├── MEMORY_PROVIDER_SPECIFICATION.md
│   ├── TENCENTDB_MEMORY_ASSESSMENT.md
│   └── BACKLOG.md
│
├── src/
│   ├── core/                              ← Orchestration (to be created)
│   ├── providers/                         ← Registry & adapters
│   │   ├── adapter-base.js
│   │   ├── memory-provider.js             ← Egress gate, fail-closed routing
│   │   └── adapters/memory/               ← LocalMemoryAdapter + recall framing
│   ├── agents/                            ← Specialist agents
│   ├── authorization/                     ← Auth & audit
│   ├── config/                            ← Configuration
│   └── utils/                             ← Logging, helpers
│
├── tests/
│   └── memory/                            ← 82 memory subsystem tests
├── config/                                 ← YAML configurations
├── package.json                            ← Dependencies
└── .env                                    ← Environment variables
```

---

## What This Foundation Enables

✅ **Modular Architecture** - Add/remove components without rewriting  
✅ **Provider Flexibility** - Swap providers via config, no code changes  
✅ **Cost Optimization** - Use free local providers, fallback to cloud  
✅ **Graceful Degradation** - If provider down, try next automatically  
✅ **Security & Compliance** - Authorization gates + immutable audit trail  
✅ **Scalability** - Agents can run in parallel, distributed  
✅ **Testability** - Mock providers for testing, real providers for production  
✅ **Observability** - Health checks, status dashboard, audit logs  

---

## Next: Start Building

Follow the QUICKSTART.md to get the foundation running in 30 minutes.

Then use IMPLEMENTATION_GUIDE.md to add providers and agents progressively.

No provider is installed until needed. Build incrementally. Keep it simple.
