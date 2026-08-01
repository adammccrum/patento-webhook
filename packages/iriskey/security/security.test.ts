/**
 * Security package tests
 */

import {
  InputSanitizer,
  CSRFProtection,
  SecretsValidator,
} from './src/index';

describe('@iriskey/security', () => {
  describe('InputSanitizer', () => {
    describe('sanitizeHtml', () => {
      it('removes script tags from HTML', () => {
        const input = '<p>Hello <script>alert("xss")</script> World</p>';
        const result = InputSanitizer.sanitizeHtml(input);
        expect(result).not.toContain('<script>');
      });

      it('strips all markup, keeping only text', () => {
        const input = '<p>Hello <b>World</b></p>';
        const result = InputSanitizer.sanitizeHtml(input);
        expect(result).toBe('Hello World');
      });
    });

    describe('isValidEmail', () => {
      it('validates correct email', () => {
        expect(InputSanitizer.isValidEmail('test@example.com')).toBe(true);
      });

      it('rejects invalid emails', () => {
        expect(InputSanitizer.isValidEmail('not-an-email')).toBe(false);
        expect(InputSanitizer.isValidEmail('test@')).toBe(false);
        expect(InputSanitizer.isValidEmail('')).toBe(false);
      });
    });

    describe('validateFileUpload', () => {
      it('rejects oversized files', () => {
        const file = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', {
          type: 'image/jpeg',
        });
        const result = InputSanitizer.validateFileUpload(file, {
          maxSize: 10 * 1024 * 1024,
          allowedMimeTypes: ['image/jpeg'],
          allowedExtensions: ['jpg'],
        });
        expect(result.valid).toBe(false);
      });

      it('accepts valid uploads', () => {
        const file = new File(['image data'], 'test.jpg', {
          type: 'image/jpeg',
        });
        const result = InputSanitizer.validateFileUpload(file, {
          maxSize: 10 * 1024 * 1024,
          allowedMimeTypes: ['image/jpeg'],
          allowedExtensions: ['jpg'],
        });
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('CSRFProtection', () => {
    describe('generateToken', () => {
      it('generates unique tokens', () => {
        const token1 = CSRFProtection.generateToken();
        const token2 = CSRFProtection.generateToken();
        expect(token1).not.toBe(token2);
        expect(token1.length).toBeGreaterThan(30);
      });
    });

    describe('constantTimeCompare', () => {
      it('compares tokens safely', () => {
        const token1 = 'test-token-1234567890abcdef';
        const token2 = 'test-token-1234567890abcdef';
        const result = CSRFProtection.constantTimeCompare(token1, token2);
        expect(result).toBe(true);
      });

      it('returns false for different tokens', () => {
        const token1 = 'test-token-1111111111111111';
        const token2 = 'test-token-2222222222222222';
        const result = CSRFProtection.constantTimeCompare(token1, token2);
        expect(result).toBe(false);
      });
    });
  });

  describe('SecretsValidator', () => {
    describe('isStrongSecret', () => {
      it('accepts strong secrets', () => {
        expect(SecretsValidator.isStrongSecret('MyPass123!@#SecureSecret456789xy').strong).toBe(true);
      });

      it('rejects short secrets', () => {
        expect(SecretsValidator.isStrongSecret('Short1!').strong).toBe(false);
      });

      it('rejects secrets without special characters', () => {
        expect(SecretsValidator.isStrongSecret('MyPasswordWithoutSpecials1234567').strong).toBe(false);
      });

      it('rejects secrets without numbers', () => {
        expect(SecretsValidator.isStrongSecret('MyPasswordWithoutNumbers!@#$%^&*').strong).toBe(false);
      });
    });
  });
});
