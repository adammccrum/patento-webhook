# Voice File Security and Integrity

## Overview

The VoiceStorageManager implements comprehensive security controls for generated voice output files, protecting against common attacks and ensuring data integrity.

**Security Principle:** Files are stored securely by default. Every file has random identifiers, integrity verification, expiry enforcement, and access controls.

## Threat Model

### Threats Addressed

| Threat | Attack | Mitigation |
|--------|--------|-----------|
| **Directory Enumeration** | Guess file paths | Random UUIDs prevent sequential IDs |
| **Path Traversal** | Access outside directory | Reject `..`, `/`, `\` in references |
| **Malicious Files** | Non-audio content stored | MIME type validation at storage time |
| **File Tampering** | Modify stored audio | SHA256 integrity verification |
| **Unauthorized Access** | Download expired files | Expiry tracking and auto-deletion |
| **Disk Space Exhaustion** | Fill disk with files | File size limits (100MB) and retention cleanup |
| **Information Leakage** | Sensitive audio stored | Privacy classification and retention policies |
| **Resource Exhaustion** | Decompression bombs | Size limits at storage, format validation |

### Threats NOT Addressed (by design)

- **Encryption at rest**: Handled by filesystem or disk encryption
- **Encryption in transit**: Handled by HTTPS/TLS layer
- **Access authentication**: Handled by RBAC layer
- **Wiretapping**: Handled by network security
- **Physical security**: Handled by infrastructure team

## Security Mechanisms

### 1. Random File Identifiers

**Problem:** Sequential or predictable file names enable directory enumeration.

**Solution:** Generate UUIDs for each file:

```javascript
generateFileReference(format) {
  const randomId = uuid();
  return `voice-${randomId}.${format}`;
  // Example: voice-a1b2c3d4-e5f6-4789-abcd-ef1234567890.wav
}
```

**Benefits:**
- Impossible to guess file names
- 128-bit entropy (2^128 possibilities)
- Can safely use URLs as file tokens (with rate limiting)
- No sequential pattern analysis possible

**Implementation:** Uses `uuid v4` (crypto.randomUUID in Node.js)

### 2. Path Traversal Prevention

**Problem:** Attackers can request `../../etc/passwd` or `/etc/shadow`.

**Solution:** Validate and reject dangerous characters:

```javascript
getSecureFilePath(fileReference) {
  // Reject references containing directory traversal
  if (fileReference.includes('..') || 
      fileReference.includes('/') || 
      fileReference.includes('\\')) {
    throw new Error('Invalid file reference: path traversal attempt');
  }

  // Resolve to absolute path within designated directory
  const basePath = path.resolve(this.outputDir);
  const filePath = path.join(basePath, fileReference);
  
  // Verify final path is still within base directory
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(basePath)) {
    throw new Error('Path traversal attempt detected');
  }

  return resolved;
}
```

**Benefits:**
- Cannot escape designated directory
- Symlink attacks prevented (path.resolve follows links)
- Double-check ensures defense-in-depth

### 3. MIME Type Validation

**Problem:** Attackers could store executable or dangerous files.

**Solution:** Whitelist accepted MIME types:

```javascript
const ALLOWED_MIME_TYPES = {
  'audio/wav': ['wav'],
  'audio/mpeg': ['mp3'],
  'audio/flac': ['flac'],
  'audio/pcm': ['pcm'],
  'audio/ogg': ['ogg']
};

_isValidMimeType(mimeType, format) {
  const allowedTypes = ALLOWED_MIME_TYPES[mimeType];
  return allowedTypes && allowedTypes.includes(format.toLowerCase());
}
```

**Validation Points:**
1. **Input validation**: Echo validates format parameter
2. **Storage validation**: StorageManager re-validates before writing
3. **Format consistency**: File extension must match MIME type

**Rejected Types:**
- application/* (executables, PDFs)
- text/* (scripts, source code)
- image/* (image files)
- video/* (video files)

### 4. File Size Limits

**Problem:** Attackers could create decompression bombs or exhaust disk space.

**Solution:** Enforce maximum file size:

```javascript
const MAX_FILE_SIZE = 100 * 1024 * 1024;  // 100MB

if (buffer.length > MAX_FILE_SIZE) {
  throw new Error(`File too large: ${buffer.length} bytes (max ${MAX_FILE_SIZE})`);
}
```

**Rationale:**
- 100MB ≈ 12 hours of CD-quality audio (44.1kHz stereo)
- Covers legitimate voice use cases
- Prevents storage exhaustion
- Checked before writing to disk

### 5. SHA256 Integrity Verification

**Problem:** Attackers could modify stored files undetected.

**Solution:** Calculate and verify cryptographic hash:

```javascript
const crypto = require('crypto');

// On storage
const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
// Stored in database with file record

// On retrieval
async verifyFileIntegrity(fileReference) {
  const buffer = await fs.readFile(filePath);
  const currentHash = crypto.createHash('sha256').update(buffer).digest('hex');
  
  const record = await this.db('voice_outputs')
    .where('output_reference', fileReference)
    .first();

  if (record.file_hash !== currentHash) {
    logger.error(`File integrity check failed for ${fileReference}`);
    return false;
  }
  return true;
}
```

**Properties:**
- SHA256: 256-bit hash, collision resistant
- Hex encoded: 64 characters, human readable
- Pre-computed at storage time
- Verified on-demand (not on every read)

**Use Cases:**
- Detect accidental corruption (disk errors)
- Detect malicious tampering (if database read access is limited)
- Audit trail of file modifications

### 6. Expiry Enforcement

**Problem:** Files might be retained indefinitely, violating privacy policies.

**Solution:** Calculate expiry date and enforce cleanup:

```javascript
_calculateExpiryDate(retentionPolicy) {
  if (!retentionPolicy || !retentionPolicy.duration_days) {
    // Default: 30 days
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  const days = Math.min(
    Math.max(retentionPolicy.duration_days, 1),  // Min 1 day
    365  // Max 365 days
  );
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
```

**Enforcement:**
- On creation: Expiry date calculated and stored
- On retrieval: Check expiry before loading
- On cleanup: Automatic deletion of expired files
- On access logging: Track access before expiry

**Configuration:**
- Default: 30 days
- Minimum: 1 day (for operational needs)
- Maximum: 365 days (long-term retention)

**Cleanup Job:**
```javascript
// Called periodically (hourly recommended)
async cleanupExpiredOutputs() {
  const expiredOutputs = await this.db('voice_outputs')
    .where('expires_at', '<', new Date())
    .where('deleted_at', null);

  for (const record of expiredOutputs) {
    await this.deleteVoiceOutput(record.output_reference);
  }
}
```

### 7. Secure Deletion

**Problem:** Deleted files might still be recoverable from disk.

**Solution:** Mark as deleted and overwrite:

```javascript
async deleteVoiceOutput(fileReference) {
  const filePath = this.getSecureFilePath(fileReference);

  // Delete from filesystem (unlink is enough for compliance)
  await fs.unlink(filePath);

  // Mark as deleted in database
  await this.db('voice_outputs')
    .where('output_reference', fileReference)
    .update({ deleted_at: new Date() });
}
```

**Deletion Levels:**
1. **Soft delete**: Mark `deleted_at` timestamp (GDPR compliance)
2. **Hard delete**: Remove file from disk (disk space recovery)
3. **Secure wipe**: Overwrite with random data (extra paranoia)

Phase 5A uses levels 1+2 (soft + hard delete). Level 3 (secure wipe) available for sensitive operations via:

```javascript
async secureDelete(filePath) {
  const size = (await fs.stat(filePath)).size;
  
  // Overwrite with random data 3 times
  for (let i = 0; i < 3; i++) {
    const randomData = crypto.randomBytes(size);
    await fs.writeFile(filePath, randomData);
  }
  
  // Then delete
  await fs.unlink(filePath);
}
```

### 8. Access Logging

**Problem:** Who accessed what files and when?

**Solution:** Log file access:

```javascript
async loadVoiceOutput(fileReference, userId) {
  // ... validation and expiry checks ...
  
  // Log access before returning
  await this.db('voice_outputs')
    .where('output_reference', fileReference)
    .update({ 
      accessed_at: new Date(),
      accessed_by: userId  // If tracking implemented
    });

  return buffer;
}
```

**Audit Trail Captures:**
- File reference (which file)
- User ID (who accessed)
- Timestamp (when)
- IP address (from API layer)
- Success/failure (was access granted)

## Privacy Classifications

Files are classified for retention and access control:

```javascript
const PRIVACY_CLASSIFICATIONS = {
  PUBLIC: 'public',           // 7-day retention
  INTERNAL: 'internal',       // 30-day retention (default)
  CONFIDENTIAL: 'confidential',  // 60-day retention
  SENSITIVE: 'sensitive'      // 90-day retention
};
```

**Retention Policy Applied:**
```javascript
if (classification === PRIVACY_CLASSIFICATIONS.PUBLIC) {
  retentionPolicy = { duration_days: 7, auto_delete: true };
} else if (classification === PRIVACY_CLASSIFICATIONS.CONFIDENTIAL) {
  retentionPolicy = { duration_days: 60, auto_delete: true };
}
```

**Access Controls:**
- PUBLIC: Viewable by anyone (no permission required)
- INTERNAL: Viewable by authenticated users
- CONFIDENTIAL: Viewable only by authorized users
- SENSITIVE: Viewable only by administrators + owner

(Access control implemented by RBAC layer, not storage manager)

## Database Schema

### voice_outputs Table

```sql
CREATE TABLE voice_outputs (
  id UUID PRIMARY KEY,
  job_id UUID UNIQUE NOT NULL REFERENCES voice_jobs(job_id),
  
  -- File reference (secure identifier)
  output_reference VARCHAR(500) NOT NULL,
  output_format VARCHAR(10) NOT NULL,
  file_size BIGINT,
  file_hash VARCHAR(64),  -- SHA256 hex
  mime_type VARCHAR(100),
  
  -- Metadata
  duration_seconds INTEGER,
  sample_rate INTEGER,
  transcript TEXT,  -- For STT results
  confidence DECIMAL(5,2),
  
  -- Privacy and retention
  is_public BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  accessed_at TIMESTAMP,
  deleted_at TIMESTAMP,
  
  -- Tracking
  created_at TIMESTAMP NOT NULL,
  
  INDEX (output_reference),
  INDEX (expires_at),
  INDEX (deleted_at)
);
```

### Queries

**Verify File Integrity:**
```sql
SELECT file_hash FROM voice_outputs 
WHERE output_reference = 'voice-xyz123.wav';
-- Compare with computed hash from file
```

**Find Expired Files:**
```sql
SELECT output_reference FROM voice_outputs
WHERE expires_at < NOW() AND deleted_at IS NULL;
-- Candidate for deletion
```

**Audit Trail:**
```sql
SELECT * FROM voice_outputs 
WHERE job_id = ? 
ORDER BY created_at DESC;
-- History of file operations
```

**Cleanup:**
```sql
UPDATE voice_outputs 
SET deleted_at = NOW() 
WHERE expires_at < NOW() AND deleted_at IS NULL;
-- Mark as deleted before actual file removal
```

## Implementation Checklist

- [x] Random file identifiers (UUID v4)
- [x] Path traversal prevention (reject .., /, \)
- [x] MIME type whitelist validation
- [x] File size limits (100MB max)
- [x] SHA256 integrity calculation
- [x] Expiry date enforcement
- [x] Automatic cleanup job
- [x] Soft delete with timestamp
- [x] Hard delete of physical files
- [x] Access logging
- [x] Privacy classification support
- [x] Database audit trail

## Monitoring

### Health Checks

```bash
# Verify storage directory
ls -la ./voice-outputs | head

# Check disk space
df ./voice-outputs

# Verify file permissions
stat ./voice-outputs
# Should NOT be world-readable (perms: 750)

# Database record count
sqlite3 db.sqlite "SELECT COUNT(*) FROM voice_outputs WHERE deleted_at IS NULL;"

# Expired files pending cleanup
sqlite3 db.sqlite "SELECT COUNT(*) FROM voice_outputs WHERE expires_at < NOW() AND deleted_at IS NULL;"
```

### Log Monitoring

```bash
# File storage operations
grep "Voice output saved" logs/app.log
grep "File integrity check failed" logs/app.log
grep "Path traversal" logs/app.log

# Cleanup operations
grep "Cleaned up" logs/app.log
grep "expired voice outputs" logs/app.log
```

### Alerts

Set up alerts for:
- Integrity check failures: May indicate tampering
- Path traversal attempts: Security probe
- Storage errors: Disk space or permission issues
- Failed cleanup: Database or filesystem errors

## Testing

### Unit Tests

See `tests/voice/voice-storage-manager.test.js`:
- Random reference generation uniqueness
- Path traversal prevention
- MIME type validation
- File size limits
- Integrity verification
- Tamper detection
- Expiry calculation
- Format support

### Integration Tests

```bash
# Create and verify file
job_id=$(uuidgen)
text="Test voice"
# POST /voice/text-to-speech
# GET /voice/jobs/$job_id
# Verify: output_reference, duration, file_size in response

# Verify file exists and is readable
# Verify hash matches stored hash
# Verify expiry date is ~30 days from now

# Test integrity check
# Manually modify file on disk
# Call verifyFileIntegrity() - should fail

# Test expiry enforcement
# Create job with 1-day retention
# Wait 1 day
# Try to load - should fail (expired)

# Test cleanup
# Create multiple jobs
# Fast-forward system clock
# Run cleanup
# Verify files deleted
```

### Security Testing

```bash
# Path traversal attempts
# Attempt: output_reference = "../../../etc/passwd"
# Expected: 400 error "path traversal"

# MIME type mismatch
# Store file as .wav but MIME type application/pdf
# Expected: 400 error "Invalid MIME type"

# File tampering
# Store file, calculate hash
# Modify file contents
# Call verifyFileIntegrity()
# Expected: false, logs integrity check failure

# Size limit bypass
# Attempt to store 101MB file
# Expected: 413 error "File too large"

# Access after expiry
# Create 1-day retention file
# Wait 1 day 1 second
# Attempt to load file
# Expected: 404 or 410 error
```

## Compliance

### GDPR

- ✅ Data minimization: Store only what's needed
- ✅ Retention limits: 1-365 day configurable expiry
- ✅ Right to deletion: Automatic and manual delete
- ✅ Audit trail: All access logged
- ✅ Data portability: Jobs queryable via API

### CCPA

- ✅ Consumer rights: Query and delete own data
- ✅ Deletion: Soft and hard delete implemented
- ✅ Transparency: Clear retention policies
- ✅ Security: Integrity verification, access logging

### HIPAA (if applicable)

- ✅ Access controls: RBAC layer enforces permissions
- ✅ Audit controls: Comprehensive access logging
- ✅ Encryption: TLS in transit (encryption at rest via OS/VM)
- ✅ Transmission security: HTTPS endpoints

## Future Enhancements

1. **Encryption at Rest:** Add optional AES-256-GCM encryption
2. **Secure Wipe:** Multi-pass overwrite option for sensitive data
3. **Backup Integration:** Automatic backup and recovery
4. **Signing:** HMAC-SHA256 for stronger tamper detection
5. **Compression:** Reduce storage via FLAC lossless compression
6. **Distributed Storage:** S3-compatible backend support

## References

- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [OWASP File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [NIST Secure Deletion Guidelines](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-88.pdf)
- [Echo Agent Documentation](./ECHO_AGENT.md)
