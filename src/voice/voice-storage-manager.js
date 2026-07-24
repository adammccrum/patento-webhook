/**
 * Voice Storage Manager
 * Secures voice output files with expiry, MIME type validation, and path traversal prevention
 *
 * Security features:
 * - Random file identifiers (not predictable)
 * - Path traversal prevention
 * - MIME type validation
 * - File size limits
 * - Expiry tracking and automatic deletion
 * - Access logging
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');

const VOICE_OUTPUT_DIR = process.env.VOICE_OUTPUT_DIR || './voice-outputs';

// Allowed MIME types for voice outputs
const ALLOWED_MIME_TYPES = {
  'audio/wav': ['wav'],
  'audio/mpeg': ['mp3'],
  'audio/flac': ['flac'],
  'audio/pcm': ['pcm'],
  'audio/ogg': ['ogg']
};

// Maximum file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Minimum expiry: 1 hour, Maximum: 365 days
const MIN_EXPIRY_HOURS = 1;
const MAX_EXPIRY_DAYS = 365;

class VoiceStorageManager {
  constructor(db) {
    this.db = db;
    this.outputDir = VOICE_OUTPUT_DIR;
  }

  /**
   * Initialize storage directory
   */
  async initialize() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      logger.info(`Voice storage initialized at ${this.outputDir}`);
    } catch (error) {
      logger.error(`Failed to initialize voice storage: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate secure file reference
   * Returns a random identifier that doesn't expose actual file path
   */
  generateFileReference(format) {
    const randomId = uuid();
    return `voice-${randomId}.${format}`;
  }

  /**
   * Get secure file path from reference
   * Validates that reference doesn't contain path traversal attempts
   */
  getSecureFilePath(fileReference) {
    // Reject any reference containing directory traversal
    if (fileReference.includes('..') || fileReference.includes('/') || fileReference.includes('\\')) {
      throw new Error('Invalid file reference: path traversal attempt');
    }

    return path.join(this.outputDir, fileReference);
  }

  /**
   * Save voice output file
   */
  async saveVoiceOutput(jobId, buffer, format, mimeType, metadata = {}) {
    try {
      // Validate format
      if (!this._isValidFormat(format)) {
        throw new Error(`Unsupported format: ${format}`);
      }

      // Validate MIME type
      if (!this._isValidMimeType(mimeType, format)) {
        throw new Error(`Invalid MIME type for format: ${mimeType}`);
      }

      // Validate file size
      if (buffer.length > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${buffer.length} bytes (max ${MAX_FILE_SIZE})`);
      }

      // Generate secure reference
      const fileReference = this.generateFileReference(format);
      const filePath = this.getSecureFilePath(fileReference);

      // Save file
      await fs.writeFile(filePath, buffer);

      // Calculate SHA256 hash for integrity
      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

      // Calculate expiry based on retention policy
      const expiryDate = this._calculateExpiryDate(metadata.retentionPolicy);

      // Record in database
      const output = {
        id: uuid(),
        job_id: jobId,
        output_reference: fileReference,
        output_format: format,
        file_size: buffer.length,
        duration_seconds: metadata.duration || null,
        sample_rate: metadata.sampleRate || null,
        mime_type: mimeType,
        transcript: metadata.transcript || null,
        confidence: metadata.confidence || null,
        file_hash: fileHash,
        is_public: metadata.isPublic || false,
        expires_at: expiryDate,
        created_at: new Date()
      };

      if (this.db) {
        await this.db('voice_outputs').insert(output);
      }

      logger.info(`Voice output saved: ${fileReference} (${buffer.length} bytes, expires ${expiryDate.toISOString()})`);

      return {
        fileReference,
        filePath,
        fileHash,
        expiryDate,
        mimeType
      };
    } catch (error) {
      logger.error(`Failed to save voice output: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load voice output file
   * Only allows access to files that haven't expired
   */
  async loadVoiceOutput(fileReference, userId) {
    try {
      // Validate reference
      if (!fileReference) {
        throw new Error('File reference required');
      }

      // Get secure path
      const filePath = this.getSecureFilePath(fileReference);

      // Check file exists
      await fs.access(filePath);

      // Check database record if available
      if (this.db) {
        const record = await this.db('voice_outputs')
          .where('output_reference', fileReference)
          .first();

        if (!record) {
          throw new Error('File not found in records');
        }

        // Check expiry
        if (record.expires_at && new Date(record.expires_at) < new Date()) {
          throw new Error('File access expired');
        }

        // Check deletion
        if (record.deleted_at) {
          throw new Error('File has been deleted');
        }

        // Log access
        await this.db('voice_outputs')
          .where('output_reference', fileReference)
          .update({ accessed_at: new Date() });
      }

      // Load file
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      logger.error(`Failed to load voice output: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete voice output file
   */
  async deleteVoiceOutput(fileReference) {
    try {
      const filePath = this.getSecureFilePath(fileReference);

      // Check file exists
      try {
        await fs.access(filePath);
      } catch {
        logger.warn(`File not found when attempting deletion: ${fileReference}`);
        return; // Already deleted
      }

      // Delete from filesystem
      await fs.unlink(filePath);

      // Mark as deleted in database
      if (this.db) {
        await this.db('voice_outputs')
          .where('output_reference', fileReference)
          .update({ deleted_at: new Date() });
      }

      logger.info(`Voice output deleted: ${fileReference}`);
    } catch (error) {
      logger.error(`Failed to delete voice output: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean up expired voice outputs
   * Called periodically to enforce retention policies
   */
  async cleanupExpiredOutputs() {
    if (!this.db) {
      logger.warn('Database not available, skipping voice output cleanup');
      return;
    }

    try {
      const expiredOutputs = await this.db('voice_outputs')
        .where('expires_at', '<', new Date())
        .where('deleted_at', null)
        .select('output_reference');

      let deletedCount = 0;
      for (const record of expiredOutputs) {
        try {
          await this.deleteVoiceOutput(record.output_reference);
          deletedCount++;
        } catch (error) {
          logger.error(`Failed to delete expired output ${record.output_reference}: ${error.message}`);
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired voice outputs`);
      }
    } catch (error) {
      logger.error(`Voice output cleanup failed: ${error.message}`);
    }
  }

  /**
   * Verify file integrity using hash
   */
  async verifyFileIntegrity(fileReference) {
    try {
      const buffer = await fs.readFile(this.getSecureFilePath(fileReference));
      const currentHash = crypto.createHash('sha256').update(buffer).digest('hex');

      if (this.db) {
        const record = await this.db('voice_outputs')
          .where('output_reference', fileReference)
          .first();

        if (!record) {
          throw new Error('File record not found');
        }

        if (record.file_hash !== currentHash) {
          logger.error(`File integrity check failed for ${fileReference}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error(`File integrity verification failed: ${error.message}`);
      return false;
    }
  }

  // Private methods

  _isValidFormat(format) {
    const validFormats = Object.values(ALLOWED_MIME_TYPES).flat();
    return validFormats.includes(format.toLowerCase());
  }

  _isValidMimeType(mimeType, format) {
    const allowedTypes = ALLOWED_MIME_TYPES[mimeType];
    return allowedTypes && allowedTypes.includes(format.toLowerCase());
  }

  _calculateExpiryDate(retentionPolicy) {
    if (!retentionPolicy || !retentionPolicy.duration_days) {
      // Default: 30 days
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const days = Math.min(Math.max(retentionPolicy.duration_days, MIN_EXPIRY_HOURS / 24), MAX_EXPIRY_DAYS);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}

module.exports = VoiceStorageManager;
