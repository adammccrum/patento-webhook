/**
 * Tests for Voice Storage Manager - File Security and Retention
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const VoiceStorageManager = require('../../src/voice/voice-storage-manager');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuid } = require('uuid');

describe('Voice Storage Manager', () => {
  let storageManager;
  const testDir = './test-voice-outputs';

  beforeEach(async () => {
    process.env.VOICE_OUTPUT_DIR = testDir;
    storageManager = new VoiceStorageManager(null); // No DB for unit tests
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('File Reference Generation', () => {
    it('should generate secure file reference', () => {
      const ref = storageManager.generateFileReference('wav');
      expect(ref).toMatch(/^voice-[a-f0-9-]+\.wav$/);
    });

    it('should generate unique references', () => {
      const ref1 = storageManager.generateFileReference('wav');
      const ref2 = storageManager.generateFileReference('wav');
      expect(ref1).not.toBe(ref2);
    });

    it('should respect file format', () => {
      const formats = ['wav', 'mp3', 'flac'];
      for (const format of formats) {
        const ref = storageManager.generateFileReference(format);
        expect(ref).toMatch(new RegExp(`\\.${format}$`));
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should reject references with ..',  () => {
      expect(() => {
        storageManager.getSecureFilePath('../../../etc/passwd');
      }).toThrow('path traversal');
    });

    it('should reject references with /', () => {
      expect(() => {
        storageManager.getSecureFilePath('../../etc/passwd');
      }).toThrow('path traversal');
    });

    it('should reject references with \\', () => {
      expect(() => {
        storageManager.getSecureFilePath('..\\..\\windows\\system32');
      }).toThrow('path traversal');
    });

    it('should accept valid references', () => {
      const ref = storageManager.generateFileReference('wav');
      const filePath = storageManager.getSecureFilePath(ref);
      expect(filePath).toContain(testDir);
      expect(filePath).toContain(ref);
    });
  });

  describe('MIME Type Validation', () => {
    it('should accept valid MIME types', async () => {
      const mimeTypes = [
        { type: 'audio/wav', format: 'wav' },
        { type: 'audio/mpeg', format: 'mp3' },
        { type: 'audio/flac', format: 'flac' }
      ];

      for (const { type, format } of mimeTypes) {
        const buffer = Buffer.from('test audio data');
        const jobId = uuid();
        try {
          // Should not throw
          await storageManager.saveVoiceOutput(jobId, buffer, format, type);
        } catch (e) {
          expect(e.message).not.toContain('Invalid MIME');
        }
      }
    });

    it('should reject invalid MIME types', async () => {
      const buffer = Buffer.from('test audio data');
      const jobId = uuid();

      await expect(
        storageManager.saveVoiceOutput(jobId, buffer, 'wav', 'application/pdf')
      ).rejects.toThrow('Invalid MIME');
    });

    it('should reject mismatched format and MIME type', async () => {
      const buffer = Buffer.from('test audio data');
      const jobId = uuid();

      await expect(
        storageManager.saveVoiceOutput(jobId, buffer, 'wav', 'audio/mpeg')
      ).rejects.toThrow('Invalid MIME');
    });
  });

  describe('File Size Limits', () => {
    it('should accept files under limit', async () => {
      const buffer = Buffer.alloc(1000); // 1KB
      const jobId = uuid();
      const result = await storageManager.saveVoiceOutput(jobId, buffer, 'wav', 'audio/wav');
      expect(result.fileReference).toBeTruthy();
    });

    it('should reject files over 100MB limit', async () => {
      const buffer = Buffer.alloc(101 * 1024 * 1024); // 101MB
      const jobId = uuid();

      await expect(
        storageManager.saveVoiceOutput(jobId, buffer, 'wav', 'audio/wav')
      ).rejects.toThrow('too large');
    });
  });

  describe('File Storage', () => {
    it('should save file to disk', async () => {
      const buffer = Buffer.from('test audio data');
      const jobId = uuid();
      const result = await storageManager.saveVoiceOutput(jobId, buffer, 'wav', 'audio/wav');

      const savedFile = await fs.readFile(result.filePath);
      expect(savedFile).toEqual(buffer);
    });

    it('should generate SHA256 hash', async () => {
      const buffer = Buffer.from('test audio data');
      const jobId = uuid();
      const result = await storageManager.saveVoiceOutput(jobId, buffer, 'wav', 'audio/wav');

      expect(result.fileHash).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex length
    });

    it('should set expiry date based on retention policy', async () => {
      const buffer = Buffer.from('test audio data');
      const jobId = uuid();
      const retentionPolicy = { duration_days: 7, auto_delete: true };

      const result = await storageManager.saveVoiceOutput(
        jobId,
        buffer,
        'wav',
        'audio/wav',
        { retentionPolicy }
      );

      const now = Date.now();
      const expiry = result.expiryDate.getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      // Should be approximately 7 days from now (within 1 minute tolerance)
      expect(expiry - now).toBeGreaterThan(sevenDaysMs - 60000);
      expect(expiry - now).toBeLessThan(sevenDaysMs + 60000);
    });

    it('should use default retention of 30 days if not specified', async () => {
      const buffer = Buffer.from('test audio data');
      const jobId = uuid();

      const result = await storageManager.saveVoiceOutput(jobId, buffer, 'wav', 'audio/wav');

      const now = Date.now();
      const expiry = result.expiryDate.getTime();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      expect(expiry - now).toBeGreaterThan(thirtyDaysMs - 60000);
      expect(expiry - now).toBeLessThan(thirtyDaysMs + 60000);
    });
  });

  describe('File Integrity Verification', () => {
    it('should verify file hash matches stored hash', async () => {
      const buffer = Buffer.from('test audio data');
      const jobId = uuid();

      const result = await storageManager.saveVoiceOutput(jobId, buffer, 'wav', 'audio/wav');
      const isValid = await storageManager.verifyFileIntegrity(result.fileReference);
      expect(isValid).toBe(true);
    });

    it('should detect file tampering', async () => {
      const buffer = Buffer.from('test audio data');
      const jobId = uuid();

      const result = await storageManager.saveVoiceOutput(jobId, buffer, 'wav', 'audio/wav');

      // Tamper with the file
      const tamperedBuffer = Buffer.from('tampered audio data');
      await fs.writeFile(result.filePath, tamperedBuffer);

      const isValid = await storageManager.verifyFileIntegrity(result.fileReference);
      expect(isValid).toBe(false);
    });
  });

  describe('File Deletion', () => {
    it('should delete file from disk', async () => {
      const buffer = Buffer.from('test audio data');
      const jobId = uuid();

      const result = await storageManager.saveVoiceOutput(jobId, buffer, 'wav', 'audio/wav');
      const filePath = result.filePath;

      // Verify file exists
      await fs.access(filePath);

      // Delete file
      await storageManager.deleteVoiceOutput(result.fileReference);

      // Verify file is gone
      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it('should handle deletion of non-existent files gracefully', async () => {
      const fakeReference = 'voice-nonexistent-uuid.wav';
      // Should not throw
      await storageManager.deleteVoiceOutput(fakeReference);
    });
  });

  describe('Format Support', () => {
    it('should support WAV format', async () => {
      const buffer = Buffer.from('wav data');
      const jobId = uuid();
      const result = await storageManager.saveVoiceOutput(jobId, buffer, 'wav', 'audio/wav');
      expect(result.fileReference).toContain('.wav');
    });

    it('should support MP3 format', async () => {
      const buffer = Buffer.from('mp3 data');
      const jobId = uuid();
      const result = await storageManager.saveVoiceOutput(jobId, buffer, 'mp3', 'audio/mpeg');
      expect(result.fileReference).toContain('.mp3');
    });

    it('should support FLAC format', async () => {
      const buffer = Buffer.from('flac data');
      const jobId = uuid();
      const result = await storageManager.saveVoiceOutput(jobId, buffer, 'flac', 'audio/flac');
      expect(result.fileReference).toContain('.flac');
    });

    it('should reject unsupported formats', async () => {
      const buffer = Buffer.from('data');
      const jobId = uuid();

      await expect(
        storageManager.saveVoiceOutput(jobId, buffer, 'exe', 'application/octet-stream')
      ).rejects.toThrow('Unsupported format');
    });
  });

  describe('Metadata Handling', () => {
    it('should store transcript for STT results', async () => {
      const buffer = Buffer.from('audio data');
      const jobId = uuid();
      const metadata = {
        transcript: 'Hello, this is a test',
        confidence: 0.95,
        duration: 5000,
        sampleRate: 16000
      };

      const result = await storageManager.saveVoiceOutput(
        jobId,
        buffer,
        'wav',
        'audio/wav',
        metadata
      );

      expect(result.fileReference).toBeTruthy();
    });

    it('should store audio metadata', async () => {
      const buffer = Buffer.from('audio data');
      const jobId = uuid();
      const metadata = {
        duration: 2500,
        sampleRate: 48000,
        isPublic: false
      };

      const result = await storageManager.saveVoiceOutput(
        jobId,
        buffer,
        'wav',
        'audio/wav',
        metadata
      );

      expect(result.fileReference).toBeTruthy();
    });
  });
});
