# Voice Provider Interface Specification

## Overview

All voice providers in patento-webhook implement a standardized `VoiceProviderAdapter` interface. This enables the Echo agent to treat all providers uniformly, regardless of implementation details (local, cloud, mock, etc.).

**Key Principle:** Providers are isolated behind typed adapters. Echo doesn't need to know about Piper, Whisper.cpp, or any specific provider implementation.

## Base Class: VoiceProviderAdapter

### Class Definition

```javascript
class VoiceProviderAdapter {
  constructor(providerId, providerName, executionMode) {
    this.provider_id = providerId;
    this.name = providerName;
    this.execution_mode = executionMode;  // 'local', 'cloud', 'hybrid'
    this.capabilities = [];               // Array of capability strings
    this.installed = false;               // Binary/model availability
    this.configured = false;              // Configuration readiness
    this.health_status = 'unknown';       // Health check status
    this.last_tested = null;              // Last health check timestamp
  }
}
```

### Required Methods

#### 1. initialize()

```javascript
async initialize()
```

**Purpose:** Startup and configuration validation.

**Responsibilities:**
- Check if provider binary/model files are installed
- Verify configuration is correct
- Create necessary directories
- Load configuration from environment variables
- Validate dependencies

**Returns:** void (throws error on failure)

**Example (Piper):**
```javascript
async initialize() {
  try {
    await fs.access(PIPER_BIN_PATH);  // Check binary exists
    this.installed = true;
    
    await fs.mkdir(PIPER_OUTPUT_DIR, { recursive: true });  // Create output dir
    this.configured = true;
    this.health_status = 'healthy';
  } catch (error) {
    this.installed = false;
    this.health_status = 'not_installed';
  }
}
```

#### 2. isInstalled()

```javascript
isInstalled() : boolean
```

**Purpose:** Check if provider binary/models are available.

**Returns:** 
- `true`: Binary and critical models installed
- `false`: Missing binary or required models

**Example:**
```javascript
isInstalled() {
  return this.installed;
}
```

#### 3. isConfigured()

```javascript
isConfigured() : boolean
```

**Purpose:** Check if provider is ready for use.

**Returns:**
- `true`: All configuration complete, models loaded, dependencies available
- `false`: Missing configuration or dependencies

**Example:**
```javascript
isConfigured() {
  return this.configured && this.installed;
}
```

#### 4. healthCheck()

```javascript
async healthCheck() : Promise<{status: string, message?: string}>
```

**Purpose:** Verify provider is operational.

**Returns:**
```javascript
{
  status: 'healthy|degraded|error|not_installed|unavailable|misconfigured',
  message: 'Optional error description'
}
```

**Implementation:**
- Test basic functionality without heavy computation
- For binaries: Try `--version` or `--help`
- For models: Check if model files are readable
- Timeout after 5 seconds
- Update `this.health_status` and `this.last_tested`

**Status Codes:**
| Status | Meaning | Action |
|--------|---------|--------|
| healthy | Ready for use | Echo will select if preferred |
| degraded | Partially functional | Echo will use if no healthy alternatives |
| error | Runtime error | Echo will skip and try fallback |
| not_installed | Binary/models missing | Install required components |
| unavailable | Temporarily unreachable | Retry later |
| misconfigured | Configuration invalid | Fix configuration |

**Example:**
```javascript
async healthCheck() {
  try {
    if (!this.installed) {
      return { status: 'not_installed', message: 'Binary not found' };
    }
    
    const child = spawn(PIPER_BIN_PATH, ['--help'], { timeout: 5000 });
    return await new Promise((resolve) => {
      child.on('exit', (code) => {
        resolve({ status: code === 0 ? 'healthy' : 'error' });
      });
    });
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}
```

#### 5. listCapabilities()

```javascript
async listCapabilities() : Promise<Array<{name, description, [languages, formats]?}>>
```

**Purpose:** Advertise provider's capabilities.

**Returns:** Array of capability objects:
```javascript
[
  {
    name: 'text-to-speech',
    description: 'Synthesize text to audio',
    languages: ['en', 'es', 'fr', ...],  // Optional
    formats: ['wav', 'mp3', ...]        // Optional
  },
  {
    name: 'voice-preview',
    description: 'Preview a voice with sample text'
  }
]
```

**Implementation:**
- Should match capabilities in provider's `this.capabilities` array
- Avoid heavy computation (cache results)

**Example:**
```javascript
async listCapabilities() {
  return [
    {
      name: 'text-to-speech',
      description: 'Local TTS synthesis via Piper',
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ko'],
      formats: ['wav', 'mp3', 'flac']
    },
    {
      name: 'voice-preview',
      description: 'Preview voice with custom text'
    }
  ];
}
```

#### 6. listVoices()

```javascript
async listVoices() : Promise<Array<{voice_id, name, language, [gender, sample_rate]?}>>
```

**Purpose:** List available voices.

**Returns:** Array of voice objects:
```javascript
[
  {
    voice_id: 'en-us-amy-medium',
    name: 'Amy',
    language: 'en',
    gender: 'female',
    sample_rate: 22050
  },
  {
    voice_id: 'en-us-john-medium',
    name: 'John',
    language: 'en',
    gender: 'male',
    sample_rate: 22050
  }
]
```

**Implementation:**
- Cache results after first call
- Return empty array if no voices available
- voice_id must match textToSpeech/previewVoice voice_id parameter

**Example:**
```javascript
async listVoices() {
  if (this.voicesCache) return this.voicesCache;
  
  const voices = [
    { voice_id: 'en-us-amy-medium', name: 'Amy', language: 'en', gender: 'female' },
    { voice_id: 'en-us-john-medium', name: 'John', language: 'en', gender: 'male' }
  ];
  
  this.voicesCache = voices;
  return voices;
}
```

#### 7. textToSpeech(params)

```javascript
async textToSpeech({
  text: string,
  voice_id: string,
  language: string,
  output_format: string,  // wav, mp3, flac
  sample_rate?: number
}) : Promise<{
  outputFile: string,      // File path to generated audio
  outputUrl?: string,      // URL if cloud provider
  format: string,          // Output format (wav, mp3, flac)
  duration: number,        // Duration in milliseconds
  sampleRate: number,      // Sample rate in Hz
  language: string         // Output language
}>
```

**Purpose:** Synthesize text to speech.

**Parameters:**
- `text`: User text to synthesize (max 10000 chars, validated by Echo)
- `voice_id`: Which voice to use (from listVoices())
- `language`: Target language/locale (validated pattern by Echo)
- `output_format`: Desired format (wav, mp3, flac)
- `sample_rate`: Optional sample rate (8000, 16000, 24000, 44100, 48000)

**Returns:** Result object with generated audio reference

**Error Handling:**
- Throw error if voice_id not found
- Throw error if text too long (though Echo validates first)
- Throw error if format not supported
- Throw error if execution fails

**Implementation Notes:**
- Should validate parameters even though Echo also validates
- Store output file in designated output directory
- Keep files until retention policy expires
- Support concurrent requests (use job IDs to track)

**Example:**
```javascript
async textToSpeech(params) {
  const voiceConfig = PIPER_VOICES[params.voice_id];
  if (!voiceConfig) throw new Error(`Voice not found: ${params.voice_id}`);
  
  const jobId = uuid();
  const outputFile = path.join(PIPER_OUTPUT_DIR, `tts-${jobId}.wav`);
  
  return await this._synthesizeWithPiper(
    params.text,
    voiceConfig,
    outputFile,
    params.output_format
  );
}
```

#### 8. speechToText(params)

```javascript
async speechToText({
  audioFile: string,       // Path to audio file
  language: string         // Target language
}) : Promise<{
  transcript: string,      // Transcribed text
  confidence: number,      // 0.0 - 1.0 confidence score
  language: string,        // Detected or requested language
  duration: number         // Audio duration in milliseconds
}>
```

**Purpose:** Transcribe audio to text.

**Parameters:**
- `audioFile`: File path to audio input (validated/sanitized by Echo)
- `language`: Expected language (helps transcription)

**Returns:** Transcription result with transcript and confidence

**Error Handling:**
- Throw error if audio file not found
- Throw error if file format not supported
- Throw error if transcription fails

**Implementation Notes:**
- Audio file path is pre-validated by Echo
- Should validate file exists and is readable
- Support common formats: WAV, MP3, FLAC, OGG
- Confidence should be 0-1 (1.0 = perfect confidence)

**Example:**
```javascript
async speechToText(params) {
  const audioFile = this.sanitizePath(params.audioFile);
  
  return await this._transcribeWithWhisper(
    audioFile,
    params.language
  );
}
```

#### 9. inspectAudio(params)

```javascript
async inspectAudio({
  audioFile: string        // Path to audio file
}) : Promise<{
  file: string,            // File path
  size: number,            // File size in bytes
  format: string,          // Audio format (wav, mp3, etc)
  duration: number,        // Duration in milliseconds
  [sampleRate?: number],   // Sample rate if available
  [channels?: number]      // Number of channels if available
}>
```

**Purpose:** Extract audio metadata without transcription.

**Parameters:**
- `audioFile`: Path to audio input

**Returns:** Metadata object

**Implementation Notes:**
- Faster than speechToText
- Should not do full parsing if possible
- Can be basic (just file size) or advanced (headers)

**Example:**
```javascript
async inspectAudio(params) {
  const audioFile = this.sanitizePath(params.audioFile);
  const stats = await fs.stat(audioFile);
  
  return {
    file: audioFile,
    size: stats.size,
    format: this._guessFormat(audioFile),
    duration: 0  // Would need audio library to calculate
  };
}
```

#### 10. previewVoice(params)

```javascript
async previewVoice({
  voice_id: string,
  text?: string,
  language?: string
}) : Promise<{
  outputFile: string,
  outputUrl?: string,
  format: string,
  duration: number,
  sampleRate: number,
  language: string
}>
```

**Purpose:** Generate short preview audio for a voice.

**Parameters:**
- `voice_id`: Which voice to preview
- `text`: Optional text (default: "The quick brown fox...")
- `language`: Optional language override

**Returns:** Same as textToSpeech

**Implementation Notes:**
- Reuses textToSpeech internally
- Shorter retention (1-7 days vs 30 days typical)

**Example:**
```javascript
async previewVoice(params) {
  const defaultText = 'The quick brown fox jumps over the lazy dog.';
  return this.textToSpeech({
    voice_id: params.voice_id,
    text: params.text || defaultText,
    language: params.language,
    output_format: 'wav'
  });
}
```

#### 11. cancelJob(jobId)

```javascript
async cancelJob(jobId: string) : Promise<void>
```

**Purpose:** Cancel an in-progress job.

**Parameters:**
- `jobId`: Job identifier to cancel

**Implementation Notes:**
- Typically only needed for long-running operations
- For local synchronous providers: may be no-op
- For cloud/streaming providers: call API to cancel
- Should be idempotent (safe to call multiple times)

**Example:**
```javascript
async cancelJob(jobId) {
  const job = this.activeJobs.get(jobId);
  if (job && job.process) {
    job.process.kill();
    this.activeJobs.delete(jobId);
  }
}
```

#### 12. cleanup()

```javascript
async cleanup() : Promise<void>
```

**Purpose:** Perform routine cleanup (not shutdown).

**Responsibilities:**
- Delete old temporary files
- Clear caches
- Prepare for next operation

**Implementation Notes:**
- Called periodically (not necessarily on exit)
- Should not affect provider availability
- Should handle errors gracefully

**Example:**
```javascript
async cleanup() {
  try {
    const files = await fs.readdir(PIPER_OUTPUT_DIR);
    const now = Date.now();
    const maxAge = 60 * 60 * 1000;  // 1 hour
    
    for (const file of files) {
      const filePath = path.join(PIPER_OUTPUT_DIR, file);
      const stats = await fs.stat(filePath);
      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filePath);
      }
    }
  } catch (error) {
    logger.warn(`Cleanup failed: ${error.message}`);
  }
}
```

#### 13. shutdown()

```javascript
async shutdown() : Promise<void>
```

**Purpose:** Graceful shutdown (called on system exit).

**Responsibilities:**
- Stop all operations
- Release resources
- Save state if needed
- Perform final cleanup

**Implementation Notes:**
- Called once at system shutdown
- Should be idempotent
- Should complete in <30 seconds
- Log all shutdown steps

**Example:**
```javascript
async shutdown() {
  try {
    await this.cleanup();
    this.health_status = 'unavailable';
    logger.info('Piper adapter shutdown complete');
  } catch (error) {
    logger.error(`Shutdown failed: ${error.message}`);
  }
}
```

## Helper Methods (Base Class)

### Parameter Validation

```javascript
validateTextToSpeechParams(params) {
  // Verify required fields
  if (!params.text) throw new Error('text required');
  if (!params.language) throw new Error('language required');
  if (!params.voice_id) throw new Error('voice_id required');
  
  // Note: Echo already validates, this is defense-in-depth
}

validateSpeechToTextParams(params) {
  if (!params.audioFile) throw new Error('audioFile required');
  if (!params.language) throw new Error('language required');
}

validatePreviewVoiceParams(params) {
  if (!params.voice_id) throw new Error('voice_id required');
}

validateAudioInspectionParams(params) {
  if (!params.audioFile) throw new Error('audioFile required');
}
```

### Path Sanitization

```javascript
sanitizePath(filePath) {
  // Prevent path traversal attacks
  if (filePath.includes('..') || filePath.startsWith('/')) {
    throw new Error('Invalid file path');
  }
  
  // Resolve to absolute path within allowed directory
  const resolved = path.resolve(this.allowedDir, filePath);
  if (!resolved.startsWith(this.allowedDir)) {
    throw new Error('Path traversal attempt detected');
  }
  
  return resolved;
}
```

## Implementing a Custom Provider

### Template

```javascript
const VoiceProviderAdapter = require('../voice-provider-adapter');

class CustomVoiceAdapter extends VoiceProviderAdapter {
  constructor() {
    super('custom', 'Custom Voice Provider', 'local');
    this.capabilities = ['text-to-speech', 'voice-preview'];
  }

  async initialize() {
    // Startup and validation
  }

  async healthCheck() {
    // Return status
  }

  async listCapabilities() {
    // Return capabilities array
  }

  async listVoices() {
    // Return voices array
  }

  async textToSpeech(params) {
    // Implement TTS
  }

  async speechToText(params) {
    // Implement STT
  }

  async inspectAudio(params) {
    // Implement metadata extraction
  }

  async previewVoice(params) {
    // Implement preview
  }

  async cancelJob(jobId) {
    // Implement cancellation if needed
  }

  async cleanup() {
    // Cleanup routine
  }

  async shutdown() {
    // Graceful shutdown
  }
}

module.exports = CustomVoiceAdapter;
```

## Integration with Echo

Once a provider is implemented:

1. **Register with Provider Registry:**
```javascript
const customAdapter = new CustomVoiceAdapter();
providerRegistry.register({
  provider_id: 'custom',
  name: 'Custom Voice Provider',
  category: 'voice',
  enabled: true,  // Set to true to enable
  installed: false,  // Will be set by initialize()
  configured: false,  // Will be set by initialize()
  adapter: customAdapter
});
```

2. **Initialize provider:**
```javascript
await customAdapter.initialize();
```

3. **Echo will automatically:**
- Use for capability-based provider selection
- Call healthCheck() before selection
- Attempt fallback if primary fails
- Track jobs and events
- Persist output files securely

## Design Principles

1. **Isolation**: Echo knows only the adapter interface, not implementation details
2. **Consistency**: All providers implement the same contract
3. **Resilience**: Health checks and fallback support
4. **Security**: Path validation, MIME type checking in consuming layer
5. **Auditability**: All operations tracked and logged
6. **Extensibility**: Easy to add new providers without modifying Echo
