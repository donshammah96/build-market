
import {
  encryptMessage,
  decryptMessage,
  encryptAttachment,
  decryptAttachment,
  hashParticipants,
} from '../../src/utils/encryption.js';

describe('Encryption Utilities', () => {
  describe('encryptMessage / decryptMessage', () => {
    it('should encrypt and decrypt a message correctly', () => {
      const plaintext = 'Hello, this is a secret message!';
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same plaintext', () => {
      const plaintext = 'Same message';
      const encrypted1 = encryptMessage(plaintext);
      const encrypted2 = encryptMessage(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decryptMessage(encrypted1)).toBe(plaintext);
      expect(decryptMessage(encrypted2)).toBe(plaintext);
    });

    it('should encrypt empty strings', () => {
      const plaintext = '';
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt unicode characters', () => {
      const plaintext = '你好世界 🌍 مرحبا';
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt very long messages', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error when decrypting invalid format', () => {
      expect(() => {
        decryptMessage('invalid-encrypted-string');
      }).toThrow('Invalid encrypted message format');
    });

    it('should throw error when decrypting with wrong data', () => {
      expect(() => {
        decryptMessage('part1:part2:part3:part4');
      }).toThrow();
    });

    it('should throw error when environment variable is missing', () => {
      const originalSecret = process.env.MESSAGE_ENCRYPTION_SECRET;
      delete process.env.MESSAGE_ENCRYPTION_SECRET;

      expect(() => {
        encryptMessage('test');
      }).toThrow('MESSAGE_ENCRYPTION_SECRET');

      process.env.MESSAGE_ENCRYPTION_SECRET = originalSecret;
    });
  });

  describe('encryptAttachment / decryptAttachment', () => {
    const testAttachment = {
      url: 'https://example.com/file.pdf',
      filename: 'document.pdf',
      size: 1024,
      mimeType: 'application/pdf',
    };

    it('should encrypt and decrypt attachment metadata', () => {
      const encrypted = encryptAttachment(testAttachment);
      
      expect(encrypted.url).not.toBe(testAttachment.url);
      expect(encrypted.filename).not.toBe(testAttachment.filename);
      expect(encrypted.size).toBe(testAttachment.size);
      expect(encrypted.mimeType).toBe(testAttachment.mimeType);
      expect(encrypted.encrypted).toBe(true);

      const decrypted = decryptAttachment(encrypted);
      
      expect(decrypted.url).toBe(testAttachment.url);
      expect(decrypted.filename).toBe(testAttachment.filename);
      expect(decrypted.size).toBe(testAttachment.size);
      expect(decrypted.mimeType).toBe(testAttachment.mimeType);
    });

    it('should handle unencrypted attachments', () => {
      const unencrypted = { ...testAttachment, encrypted: false };
      const result = decryptAttachment(unencrypted);

      expect(result).toEqual({
        url: testAttachment.url,
        filename: testAttachment.filename,
        size: testAttachment.size,
        mimeType: testAttachment.mimeType,
        encrypted: false,
      });
    });

    it('should encrypt attachments with special characters in filename', () => {
      const attachment = {
        ...testAttachment,
        filename: '文档-2024 (1).pdf',
      };

      const encrypted = encryptAttachment(attachment);
      const decrypted = decryptAttachment(encrypted);

      expect(decrypted.filename).toBe(attachment.filename);
    });
  });

  describe('hashParticipants', () => {
    it('should generate consistent hash for same participants', () => {
      const participants1 = ['user-1', 'user-2', 'user-3'];
      const hash1 = hashParticipants(participants1);
      const hash2 = hashParticipants(participants1);

      expect(hash1).toBe(hash2);
    });

    it('should generate same hash regardless of order', () => {
      const participants1 = ['user-1', 'user-2', 'user-3'];
      const participants2 = ['user-3', 'user-1', 'user-2'];
      
      const hash1 = hashParticipants(participants1);
      const hash2 = hashParticipants(participants2);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different participants', () => {
      const participants1 = ['user-1', 'user-2'];
      const participants2 = ['user-1', 'user-3'];
      
      const hash1 = hashParticipants(participants1);
      const hash2 = hashParticipants(participants2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate hash for single participant', () => {
      const participants = ['user-1'];
      const hash = hashParticipants(participants);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it('should handle empty array', () => {
      const participants: string[] = [];
      const hash = hashParticipants(participants);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });
  });
});

