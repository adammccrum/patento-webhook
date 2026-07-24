# Local Voice Deployment Guide

## Overview

This guide covers deployment and configuration of local voice providers (Piper for TTS, Whisper.cpp for STT) for the patento-webhook system.

**Key Point:** All local providers are optional. The system includes a MockVoiceAdapter for development and testing without external dependencies.

## Requirements Hierarchy

```
Phase 5A Minimum (Development):
└─ MockVoiceAdapter (included, no external dependencies)

Phase 5A Complete (Testing):
├─ MockVoiceAdapter (included)
└─ At least one real provider:
   ├─ Piper (recommended for TTS)
   ├─ Whisper.cpp (recommended for STT)
   └─ or both

Production (Future):
├─ Piper + Whisper.cpp (local stack)
└─ Optional: Cloud provider fallback
```

## Piper TTS Deployment

### What is Piper?

Piper is a lightweight, fast neural TTS system with:
- **Local execution**: No cloud dependencies, runs entirely on-device
- **Multi-language**: 13+ languages supported
- **Multiple voices**: 50+ voices available
- **Fast**: Real-time or faster synthesis
- **Small models**: <100MB per voice model

### Installation

#### Option 1: Pre-built Binaries (Recommended)

1. **Download Piper:**
```bash
# Linux x86_64
wget https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz
tar -xzf piper_linux_x86_64.tar.gz

# macOS (Apple Silicon)
wget https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_arm64.tar.gz
tar -xzf piper_macos_arm64.tar.gz

# Windows
# Download .exe from releases page
```

2. **Place binary:**
```bash
sudo mkdir -p /opt/piper
sudo cp piper/piper /opt/piper/
sudo chmod +x /opt/piper/piper

# Or set environment variable
export PIPER_BIN_PATH=/opt/piper/piper
```

3. **Verify installation:**
```bash
/opt/piper/piper --help
```

#### Option 2: Build from Source

```bash
git clone https://github.com/rhasspy/piper.git
cd piper/src
python3 -m pip install -e .

# Verify
piper --help
```

### Model Installation

1. **Create models directory:**
```bash
mkdir -p ./piper-models
export PIPER_MODELS_DIR=./piper-models
```

2. **Download voice models:**
```bash
# English US (recommended starting point)
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx -O piper-models/en/en_US/amy/medium.onnx

# Additional voices
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/john/medium/en_US-john-medium.onnx -O piper-models/en/en_US/john/medium.onnx

# Spanish
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx -O piper-models/es/es_ES/davefx/medium.onnx

# French
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx -O piper-models/fr/fr_FR/siwis/medium.onnx
```

3. **Directory structure:**
```
piper-models/
├── en/
│   └── en_US/
│       ├── amy/
│       │   └── medium.onnx
│       └── john/
│           └── medium.onnx
├── es/
│   └── es_ES/
│       └── davefx/
│           └── medium.onnx
└── fr/
    └── fr_FR/
        └── siwis/
            └── medium.onnx
```

### Configuration

#### Environment Variables

```bash
# Set in .env or shell
export PIPER_BIN_PATH=/opt/piper/piper
export PIPER_MODELS_DIR=./piper-models
export PIPER_OUTPUT_DIR=./piper-outputs
```

#### Application Configuration

No code changes needed. Echo automatically:
1. Checks PIPER_BIN_PATH existence
2. Registers PiperAdapter if available
3. Reports `not_installed` if binary missing
4. Falls back to MockAdapter or other providers

### Testing Piper Integration

```bash
# 1. Check health endpoint
curl http://localhost:3000/voice/health

# Expected response (if Piper installed):
{
  "providers": {
    "piper": "healthy",
    ...
  }
}

# 2. Create TTS job
curl -X POST http://localhost:3000/voice/text-to-speech \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test",
    "language": "en",
    "voice_id": "en-us-amy-medium",
    "output_format": "wav"
  }'

# Expected response:
{
  "status": "success",
  "job_id": "...",
  "operation": "text_to_speech",
  "output_reference": "voice-xyz123.wav",
  "processing_time_ms": 850
}
```

### Supported Voices (Phase 5A)

| Voice ID | Language | Name | Gender |
|----------|----------|------|--------|
| en-us-amy-medium | en | Amy | Female |
| en-us-john-medium | en | John | Male |
| en-gb-alan-medium | en-GB | Alan | Male |
| es-es-davefx-medium | es | Dave | Male |
| fr-fr-siwis-medium | fr | Siwis | Female |

Additional voices available from [Piper Voices](https://huggingface.co/rhasspy/piper-voices).

### Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Piper binary not found" | PIPER_BIN_PATH incorrect | Check path and permissions |
| "Model not found" | Voice model not downloaded | Download model to PIPER_MODELS_DIR |
| "Health check timeout" | Binary hangs on --help | Try running binary manually |
| "No output file" | Directory permissions | Ensure PIPER_OUTPUT_DIR writable |
| "Segmentation fault" | Model incompatibility | Re-download model files |

## Whisper.cpp STT Deployment

### What is Whisper.cpp?

Whisper.cpp is a C++ implementation of OpenAI's Whisper with:
- **Local execution**: No API calls, runs on-device
- **Multi-language**: Supports 99 languages
- **Accuracy**: High accuracy matching cloud service
- **Performance**: Real-time transcription on CPU
- **Small**: ~1.5GB for largest model

### Installation

#### Option 1: Pre-built Binaries (Recommended)

1. **Download release:**
```bash
# Linux
wget https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip
unzip whisper-bin-x64.zip

# macOS
wget https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-arm64.zip
unzip whisper-bin-arm64.zip
```

2. **Install binary:**
```bash
sudo mkdir -p /opt/whisper
sudo cp main /opt/whisper/whisper
sudo chmod +x /opt/whisper/whisper

export WHISPER_BIN_PATH=/opt/whisper/whisper
```

3. **Verify:**
```bash
/opt/whisper/whisper --help
```

#### Option 2: Build from Source

```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
make

# Binary: ./main
export WHISPER_BIN_PATH=$(pwd)/main
```

### Model Installation

1. **Create models directory:**
```bash
mkdir -p ./whisper-models
export WHISPER_MODELS_DIR=./whisper-models
```

2. **Download models:**
```bash
# Base model (recommended for Phase 5A)
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin -O whisper-models/ggml-base.bin

# Tiny model (faster, less accurate)
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin -O whisper-models/ggml-tiny.bin

# Small model (balance)
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin -O whisper-models/ggml-small.bin
```

3. **Directory structure:**
```
whisper-models/
├── ggml-tiny.bin
├── ggml-base.bin
├── ggml-small.bin
└── ggml-medium.bin  (optional)
```

### Configuration

#### Environment Variables

```bash
export WHISPER_BIN_PATH=/opt/whisper/whisper
export WHISPER_MODELS_DIR=./whisper-models
export WHISPER_OUTPUT_DIR=./whisper-outputs
```

#### Model Size Selection

| Model | Size | Speed | Accuracy | RAM |
|-------|------|-------|----------|-----|
| tiny | 75MB | Very Fast | Low | 1GB |
| base | 140MB | Fast | Medium | 2GB |
| small | 466MB | Medium | Good | 4GB |
| medium | 1.5GB | Slow | High | 8GB |
| large | 2.9GB | Very Slow | Very High | 16GB |

**Phase 5A Recommendation:** Start with `base` or `small`.

### Testing Whisper Integration

```bash
# 1. Check health endpoint
curl http://localhost:3000/voice/health

# Expected response (if Whisper installed):
{
  "providers": {
    "whisper-cpp": "healthy",
    ...
  }
}

# 2. Create STT job
# First, create a test audio file or use existing
curl -X POST http://localhost:3000/voice/speech-to-text \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "audio_file": "/path/to/audio.wav",
    "language": "en"
  }'

# Expected response:
{
  "status": "success",
  "job_id": "...",
  "operation": "speech_to_text",
  "transcript": "Hello, this is a test",
  "confidence": 0.95,
  "processing_time_ms": 3500
}
```

### Supported Formats

Whisper.cpp accepts:
- WAV (RIFF PCM)
- MP3
- FLAC
- OGG Vorbis

### Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Whisper binary not found" | WHISPER_BIN_PATH incorrect | Check path and permissions |
| "Model not found" | Model file missing | Download model to WHISPER_MODELS_DIR |
| "Segmentation fault" | Model incompatibility | Use released model from official source |
| "Out of memory" | Model too large | Use smaller model (tiny, base) |
| "Timeout on transcription" | Audio too long or CPU slow | Reduce audio length or use smaller model |

## Docker Deployment

### With Piper and Whisper.cpp

```dockerfile
FROM node:18-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Piper
RUN mkdir -p /opt/piper && \
    wget https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz -O /tmp/piper.tar.gz && \
    tar -xzf /tmp/piper.tar.gz -C /opt/piper && \
    chmod +x /opt/piper/piper && \
    rm /tmp/piper.tar.gz

# Install Whisper.cpp
RUN git clone https://github.com/ggerganov/whisper.cpp.git /tmp/whisper && \
    cd /tmp/whisper && \
    make && \
    mkdir -p /opt/whisper && \
    cp main /opt/whisper/whisper && \
    chmod +x /opt/whisper/whisper && \
    rm -rf /tmp/whisper

# Download models
RUN mkdir -p /models/piper /models/whisper && \
    wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx -O /models/piper/en/en_US/amy/medium.onnx && \
    wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin -O /models/whisper/ggml-base.bin

# Setup application
WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY . .

# Environment
ENV PIPER_BIN_PATH=/opt/piper/piper
ENV PIPER_MODELS_DIR=/models/piper
ENV PIPER_OUTPUT_DIR=/app/voice-outputs
ENV WHISPER_BIN_PATH=/opt/whisper/whisper
ENV WHISPER_MODELS_DIR=/models/whisper
ENV WHISPER_OUTPUT_DIR=/app/voice-outputs

EXPOSE 3000

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  patento-webhook:
    build: .
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/patento
      PIPER_BIN_PATH: /opt/piper/piper
      PIPER_MODELS_DIR: /models/piper
      WHISPER_BIN_PATH: /opt/whisper/whisper
      WHISPER_MODELS_DIR: /models/whisper
    volumes:
      - voice-outputs:/app/voice-outputs
    ports:
      - "3000:3000"
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: patento
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  voice-outputs:
  postgres-data:
```

## Kubernetes Deployment

### With Local Providers

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: patento-webhook
spec:
  replicas: 2
  selector:
    matchLabels:
      app: patento-webhook
  template:
    metadata:
      labels:
        app: patento-webhook
    spec:
      containers:
      - name: app
        image: patento-webhook:latest
        env:
        - name: PIPER_BIN_PATH
          value: /opt/piper/piper
        - name: PIPER_MODELS_DIR
          value: /models/piper
        - name: WHISPER_BIN_PATH
          value: /opt/whisper/whisper
        - name: WHISPER_MODELS_DIR
          value: /models/whisper
        - name: VOICE_OUTPUT_DIR
          value: /data/voice-outputs
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        volumeMounts:
        - name: models
          mountPath: /models
        - name: voice-outputs
          mountPath: /data/voice-outputs
      volumes:
      - name: models
        configMap:
          name: voice-models
      - name: voice-outputs
        emptyDir: {}
```

## Performance Tuning

### Piper Optimization

```bash
# Use faster models (medium vs large)
# Set in PiperAdapter: PIPER_VOICES configuration

# Reduce output format complexity
# WAV > FLAC > MP3 (in terms of speed)

# Batch requests for throughput
# Echo handles this naturally via jobRepository
```

### Whisper Optimization

```bash
# Use smaller model sizes
# tiny: <100ms per second of audio
# base: ~300ms per second of audio
# small: ~800ms per second of audio

# CPU affinity for better performance
taskset -c 0-3 /opt/whisper/whisper ...

# GPU acceleration (if available)
# Rebuild whisper.cpp with CUDA support
```

## Monitoring

### Health Checks

```bash
# Piper health
curl -X POST -d "test" | /opt/piper/piper \
  --model piper-models/en/en_US/amy/medium.onnx \
  --output_file /tmp/test.wav && echo "OK"

# Whisper health
/opt/whisper/whisper \
  --model whisper-models/ggml-base.bin \
  --file /path/to/test.wav > /dev/null && echo "OK"
```

### Logs

```bash
# Application logs
tail -f logs/app.log | grep "voice\|Echo"

# Database query logs (if enabled)
tail -f logs/database.log | grep "voice_jobs"

# System logs
dmesg | grep -i "piper\|whisper"
```

### Metrics

Track via Operation Centre:
- Total jobs per provider
- Success/failure rates
- Average processing time
- Provider health status
- Active job count

## Fallback Configuration

### If Piper Unavailable

1. MockVoiceAdapter used for testing
2. Future: Cloud TTS fallback (e.g., Google Cloud TTS)

### If Whisper.cpp Unavailable

1. MockVoiceAdapter used for testing
2. Future: Cloud STT fallback (e.g., Google Cloud Speech-to-Text)

### Mixed Configuration

```javascript
// providers.js
const providers = [
  // Local (fast, free, no latency)
  { id: 'piper', adapter: new PiperAdapter() },
  { id: 'whisper-cpp', adapter: new WhisperAdapter('base') },
  
  // Cloud (optional fallback)
  // { id: 'google-tts', adapter: new GoogleTTSAdapter() },
  
  // Development/Testing
  { id: 'mock-voice', adapter: new MockVoiceAdapter() }
];

// Echo automatically selects based on:
// 1. Health status (preferred provider)
// 2. Capability match
// 3. Fallback availability
```

## Next Steps

1. **Development:** Use MockVoiceAdapter (no installation needed)
2. **Testing:** Install Piper for TTS testing
3. **Validation:** Install Whisper.cpp for STT testing
4. **Production:** Deploy both with proper Docker/Kubernetes setup

See [ECHO_AGENT.md](./ECHO_AGENT.md) for integration details.
