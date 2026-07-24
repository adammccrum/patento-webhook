# Echo Agent - Voice and Audio Operations

## Overview

Echo is the specialized agent responsible for all voice and audio operations in the patento-webhook system. It provides text-to-speech synthesis, speech-to-text transcription, audio metadata extraction, and voice preview capabilities.

**Agent Identity:**
- Code: `EE`
- Name: `Echo`
- Role: `Voice & Audio`
- Category: Voice operations orchestration

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│ API Layer (voice.js routes)                                 │
│ - HTTP endpoints with validation and authentication          │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ Orchestration Layer (EchoAgent)                              │
│ - Task validation and routing                                │
│ - Provider selection and fallback                            │
│ - Policy enforcement                                         │
│ - Job lifecycle management                                   │
│ - Event emission                                             │
│ - Database persistence                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│ Provider Layer (Voice Provider Adapters)                     │
│ - Mock (testing)                                             │
│ - Piper (local TTS)                                          │
│ - Whisper.cpp (local STT)                                    │
│ - Kokoro (future advanced TTS)                              │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

```
Client Request
    │
    ▼
HTTP Route Handler (Authorization + Validation)
    │
    ▼
VoiceTask Model (Creation + Validation)
    │
    ▼
Echo Agent (processVoiceTask)
    ├─ RBAC Permission Check
    ├─ Policy Check (voice cloning prohibition)
    ├─ Provider Selection (capability-based)
    ├─ Job Persistence (database)
    ├─ Provider Execution
    ├─ Output File Storage (secure)
    ├─ Job Completion Persistence
    └─ Event Emission (Operation Centre)
    │
    ▼
VoiceResult Model (Safe Serialization)
    │
    ▼
HTTP Response (with job tracking info)
```

## Core Responsibilities

### 1. Task Validation

Echo receives `VoiceTask` objects and validates:
- Required fields: task_id, objective_id, requesting_identity, operation, language
- Constraints: text max 10000 chars, language pattern matching
- Privacy classification: public, internal, confidential, sensitive
- Retention policy: duration_days (1-365), auto_delete flag

### 2. Permission Enforcement

Checks RBAC permissions via injected rbacEngine:

| Operation | Required Permission |
|-----------|-------------------|
| TEXT_TO_SPEECH | voice:create |
| SPEECH_TO_TEXT | voice:transcribe |
| VOICE_PREVIEW | voice:preview |
| AUDIO_METADATA | voice:view |

Returns `403 Forbidden` if user lacks required permission.

### 3. Policy Enforcement

Validates against configured policies:
- **Phase 5A**: Voice cloning explicitly prohibited
  - Rejects tasks with `voice_profile.voice_name` set
  - Returns error: "Voice cloning is not available in Phase 5A"
- Future phases may add: identity verification, consent requirements

### 4. Provider Selection

Two-tier selection algorithm:

```javascript
if (userRequestedProvider && isHealthy(userRequestedProvider)) {
  useProvider(userRequestedProvider);
} else {
  provider = registryLookup(capability);
  if (!provider) {
    selectFallbackProvider(excludeCurrentProvider);
  }
}
```

**Provider Registry Integration:**
- Queries `providerRegistry.getAdapterForCapability(category, capability)`
- Validates provider health via `adapter.healthCheck()`
- Falls back to alternative providers if primary fails
- Requires provider to be: enabled=true, configured=true, installed=true

### 5. Operation Execution

Executes the selected provider's operation:

```javascript
switch (operation) {
  case TEXT_TO_SPEECH:
    return adapter.textToSpeech(params);
  case SPEECH_TO_TEXT:
    return adapter.speechToText(params);
  case AUDIO_METADATA:
    return adapter.inspectAudio(params);
  case VOICE_PREVIEW:
    return adapter.previewVoice(params);
}
```

**Retry Logic:**
- Max retries: 3 (configurable)
- Retry delay: 1000ms (configurable)
- Fallback provider attempted if primary fails and fallback_allowed=true

### 6. Output Storage

Securely stores generated audio files:
- Via `VoiceStorageManager.saveVoiceOutput()`
- Random file identifiers (UUIDs) - not predictable
- MIME type validation (audio/wav, audio/mpeg, audio/flac, audio/ogg, audio/pcm)
- File size validation (max 100MB)
- SHA256 integrity hash
- Expiry date calculated from retention policy
- Database record created with audit trail

### 7. Job Persistence

Stores job lifecycle in database via `VoiceJobRepository`:

| Stage | Action |
|-------|--------|
| Creation | Insert job record with status='started' |
| Completion | Update with status='completed', processing_time_ms, provider_id |
| Failure | Update with status='failed', error, error_code, retry_count |
| Cancellation | Update with status='cancelled' |

Enables:
- Job recovery after system restart
- Audit trail continuity
- Statistics queries (jobs per provider, operation, user)

### 8. Event Emission

Emits events to Operation Centre for real-time monitoring:

| Event Type | When | Payload |
|-----------|------|---------|
| voice.job_started | Job created | job_id, task_id, operation, correlation_id |
| voice.provider_selected | Provider chosen | job_id, provider_id, correlation_id |
| voice.job_retrying | Retry attempted | job_id, attempt, correlation_id |
| voice.job_completed | Job completed | job_id, task_id, provider_id, operation, processing_time_ms, correlation_id |
| voice.job_failed | Job failed | job_id, error, correlation_id |
| voice.job_cancelled | Job cancelled | job_id, correlation_id |

## Configuration

Echo is configured via constructor dependency injection:

```javascript
const echoAgent = new EchoAgent(
  providerRegistry,      // Registered voice providers
  rbacEngine,           // Permission checking
  policyEngine,         // Policy enforcement
  auditLogger,          // Audit event logging
  jobRepository,        // Database persistence
  storageManager        // File storage
);
```

### Environment Variables

- `VOICE_OUTPUT_DIR`: Directory for generated audio files (default: ./voice-outputs)
- `PIPER_BIN_PATH`: Path to Piper binary (default: /usr/bin/piper)
- `PIPER_MODELS_DIR`: Directory for Piper voice models (default: ./piper-models)
- `WHISPER_BIN_PATH`: Path to whisper.cpp binary (default: /usr/bin/whisper)
- `WHISPER_MODELS_DIR`: Directory for Whisper models (default: ./whisper-models)

## Provider Integration

### VoiceProviderAdapter Interface

All voice providers extend `VoiceProviderAdapter` and implement:

```javascript
async initialize()              // Startup
async healthCheck()             // Status check
async listCapabilities()        // Advertise abilities
async listVoices()              // Available voices
async textToSpeech(params)      // TTS operation
async speechToText(params)      // STT operation
async inspectAudio(params)      // Metadata extraction
async previewVoice(params)      // Voice preview
async cancelJob(jobId)          // Cancel in-progress job
async cleanup()                 // Resource cleanup
async shutdown()                // Shutdown
```

See [VOICE_PROVIDER_INTERFACE.md](./VOICE_PROVIDER_INTERFACE.md) for complete specification.

## Job Tracking

### Active Jobs

Echo maintains `activeJobs` Map during execution:

```javascript
{
  job_id: {
    job_id: uuid,
    task_id: uuid,
    status: 'started|processing|completed|failed|cancelled',
    operation: 'text_to_speech|speech_to_text|audio_metadata|voice_preview',
    provider_id: 'provider-name',
    retry_count: 0,
    audit_reference: uuid,
    created_at: Date,
    started_at: Date,
    completed_at: Date|null,
    processing_time_ms: number|null
  }
}
```

### Completed Jobs

Echo maintains `completedJobs` array (last 100):

```javascript
echoAgent.getCompletedJobs(limit)  // Returns array of completed job records
```

### Job Queries

**API Endpoints:**
- `GET /voice/jobs` - Lists active and recent completed jobs
- `GET /voice/jobs/:job_id` - Individual job status

## Security Considerations

### 1. Default-Deny Authorization

- All voice operations require explicit permission grant
- Permission mapping defined in Echo._checkPermissions()
- Missing or denied permission returns error immediately

### 2. Policy Enforcement

- Policy engine consulted before any provider is selected
- Voice cloning explicitly prohibited in Phase 5A
- Extensible for future policy additions

### 3. Input Validation

- VoiceTask validated via Joi schema before processing
- Text length limits enforced
- Language patterns validated
- Privacy classification restricted to defined values

### 4. File Security

- Generated files stored with random identifiers (not sequential)
- File paths validated to prevent traversal attacks
- MIME types validated before storage
- File size limits enforced
- SHA256 integrity verification
- Automatic cleanup of expired files

### 5. Error Handling

- Detailed error logging for diagnostics
- Safe error serialization in API responses
  - Admin users: full error details
  - Non-admin users: generic "Operation failed" message
- Stack traces never exposed to clients

### 6. Audit Trail

- All operations logged to audit_events table
- Correlation IDs track related events
- Audit references link to specific job executions
- Timestamps in UTC ISO format

## Performance Characteristics

### Throughput
- Echo itself is lightweight (just orchestration)
- Throughput depends on provider capabilities
- Mock adapter: ~100 TTS operations/minute (simulated)
- Piper TTS: ~50-200 operations/minute (depends on text length, CPU)
- Whisper.cpp STT: ~1-10 operations/minute (depends on audio length, model size)

### Latency
- Task validation: <10ms
- Provider selection: <50ms
- Database persistence: <20ms per operation
- Overall: Dominated by provider execution time (500ms - 30s)

### Resource Usage
- In-memory job tracking: ~1KB per active job
- Database connections: 1 per request (from pool)
- File storage: Depends on audio format and duration (~1KB per second of audio)

## Monitoring

### Health Check Endpoint

```bash
GET /voice/health
```

Response:
```json
{
  "agent": "Echo",
  "status": "operational|error",
  "active_jobs": 2,
  "providers": {
    "mock-voice": "healthy",
    "piper": "not_installed",
    "whisper-cpp": "degraded"
  },
  "timestamp": "2026-07-24T12:34:56.789Z"
}
```

### Event Streaming

Subscribe to WebSocket for real-time job events:

```javascript
ws.on('message', (data) => {
  const event = JSON.parse(data);
  if (event.type.startsWith('voice.')) {
    console.log(`Job ${event.job_id}: ${event.type}`);
  }
});
```

## Error Handling

### Common Errors

| Error | HTTP Code | Cause | Resolution |
|-------|-----------|-------|-----------|
| "User lacks permission for voice:create" | 403 | Missing permission | Grant voice:create role |
| "No suitable provider found for text_to_speech" | 503 | No healthy TTS provider | Install Piper or use Mock |
| "Voice cloning is not available in Phase 5A" | 400 | Attempted voice_profile.voice_name | Remove voice_name from request |
| "File too large: X bytes" | 413 | Audio exceeds 100MB | Use smaller file or compress |
| "Invalid MIME type for format" | 400 | MIME/format mismatch | Ensure correct audio format |

### Recovery Strategies

1. **Provider Failure**: Automatically attempts fallback provider if `fallback_allowed=true`
2. **Permission Denial**: User must be granted required permission
3. **Policy Rejection**: Request must comply with active policies
4. **File Storage**: Expired files automatically deleted; clients use job_id for retrieval

## Testing

### Mock Provider for Development

Echo uses MockVoiceAdapter for testing:

```javascript
const mockAdapter = new MockVoiceAdapter('mock-voice', ['text-to-speech', 'voice-preview']);
// Returns simulated results without external dependencies
```

### Test Coverage

- `tests/voice/echo-agent.test.js`: Agent orchestration and routing
- `tests/voice/voice-models.test.js`: Task and result validation
- `tests/voice/voice-api-routes.test.js`: Endpoint security and validation

See [Phase 5A Testing Report](./PHASE_5A_TESTING.md) for comprehensive test results.

## Future Enhancements (Post Phase 5A)

1. **Kokoro TTS**: Advanced generative voice synthesis with voice cloning support
2. **Cloud Providers**: Optional cloud TTS/STT fallback for unavailable local providers
3. **Voice Cloning**: Biometric identity verification + explicit authorization
4. **Real-Time Streaming**: WebSocket-based streaming for long operations
5. **Advanced Analytics**: Provider performance metrics and cost tracking
6. **Custom Voices**: User-uploaded voice models for personalization

## References

- [Voice Provider Interface Specification](./VOICE_PROVIDER_INTERFACE.md)
- [Local Voice Deployment Guide](./LOCAL_VOICE_DEPLOYMENT.md)
- [Voice File Security Documentation](./VOICE_FILE_SECURITY.md)
- [Phase 5A Implementation Report](./PHASE_5A_IMPLEMENTATION.md)
