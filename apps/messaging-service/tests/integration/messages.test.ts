import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { messageRoutes } from '../../src/routes/messages.js';
import { generateTestToken, testUsers } from '../helpers/jwt.helper.js';
import {
  cleanDatabase,
  createTestConversation,
  createTestMessage,
} from '../helpers/prisma.helper.js';
import { encryptMessage, decryptMessage } from '../../src/utils/encryption.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/messages', messageRoutes);

describe('Message Routes', () => {
  let donToken: string;
  let shammahToken: string;
  let conversationId: string;
  let evansToken: string;

  beforeAll(() => {
    donToken = generateTestToken(testUsers.don);
    shammahToken = generateTestToken(testUsers.shammah);
    evansToken = generateTestToken(testUsers.evans);
  });

  beforeEach(async () => {
    await cleanDatabase();
    const conversation = await createTestConversation({
      participants: [testUsers.don.id, testUsers.shammah.id],
    });
    conversationId = conversation.id;
  });

  describe('POST /api/messages', () => {
    it('should send a text message', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${donToken}`)
        .send({
          conversationId,
          senderId: testUsers.don.id,
          content: 'Hello Shammah!',
          type: 'text',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('Hello Shammah!');
      expect(response.body.data.senderId).toBe(testUsers.don.id);
      expect(response.body.data.type).toBe('text');
    });

    it('should encrypt message content', async () => {
      const plaintext = 'Secret message';
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${donToken}`)
        .send({
          conversationId,
          senderId: testUsers.don.id,
          content: plaintext,
        });

      expect(response.status).toBe(201);
      // Response should contain decrypted content
      expect(response.body.data.content).toBe(plaintext);
    });

    it('should send message with attachments', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${donToken}`)
        .send({
          conversationId,
          senderId: testUsers.don.id,
          content: 'Check out this file',
          type: 'file',
          attachments: [
            {
              url: 'https://example.com/file.pdf',
              filename: 'document.pdf',
              size: 1024,
              mimeType: 'application/pdf',
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.data.attachments).toHaveLength(1);
      expect(response.body.data.attachments[0].filename).toBe('document.pdf');
    });

    it('should deny sending message as another user', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${donToken}`)
        .send({
          conversationId,
          senderId: testUsers.shammah.id,
          content: 'Impersonation attempt',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Forbidden');
    });

    it('should deny sending to conversation user is not part of', async () => {
      const otherConversation = await createTestConversation({
        participants: [testUsers.shammah.id, testUsers.evans.id],
      });

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${donToken}`)
        .send({
          conversationId: otherConversation.id,
          senderId: testUsers.don.id,
          content: 'Unauthorized message',
        });

      expect(response.status).toBe(403);
    });

    it('should reject request with invalid data', async () => {
      const response = await request(app)
        .post('/api/messages')
          .set('Authorization', `Bearer ${donToken}`)
        .send({
          conversationId,
          senderId: testUsers.don.id,
          content: '', // Empty content
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid request data');
    });

    it('should initialize readBy array with sender', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${donToken}`)
        .send({
          conversationId,
          senderId: testUsers.don.id,
          content: 'Test message',
        });

      expect(response.body.data.readBy).toContain(testUsers.don.id);
      expect(response.body.data.readBy).toHaveLength(1);
    });
  });

  describe('GET /api/messages/conversation/:conversationId', () => {
    beforeEach(async () => {
      // Create test messages
      await createTestMessage({
        conversationId,
        senderId: testUsers.don.id,
        content: encryptMessage('Message 1'),
      });
      await createTestMessage({
        conversationId,
        senderId: testUsers.shammah.id,
        content: encryptMessage('Message 2'),
      });
      await createTestMessage({
        conversationId,
        senderId: testUsers.evans.id,
        content: encryptMessage('Message 3'),
      });
    });

    it('should get messages for a conversation', async () => {
      const response = await request(app)
        .get(`/api/messages/conversation/${conversationId}`)
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(3);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should decrypt messages in response', async () => {
      const response = await request(app)
        .get(`/api/messages/conversation/${conversationId}`)
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.body.data.items[0].content).toBe('Message 1');
      expect(response.body.data.items[1].content).toBe('Message 2');
      expect(response.body.data.items[2].content).toBe('Message 3');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/messages/conversation/${conversationId}?page=1&limit=2`)
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.total).toBe(3);
    });

    it('should order messages chronologically', async () => {
      const response = await request(app)
        .get(`/api/messages/conversation/${conversationId}`)
        .set('Authorization', `Bearer ${donToken}`);

      const messages = response.body.data.items;
      expect(messages[0].content).toBe('Message 1');
      expect(messages[2].content).toBe('Message 3');
    });

    it('should deny access to conversation user is not part of', async () => {
      const response = await request(app)
        .get(`/api/messages/conversation/${conversationId}`)
        .set('Authorization', `Bearer ${generateTestToken(testUsers.evans)}`);

      expect(response.status).toBe(403);
    });

    it('should return empty array for conversation with no messages', async () => {
      const newConversation = await createTestConversation({
        participants: [testUsers.don.id, testUsers.evans.id],
      });

      const response = await request(app)
        .get(`/api/messages/conversation/${newConversation.id}`)
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.items).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });
  });

  describe('GET /api/messages/:id', () => {
    it('should get a specific message', async () => {
      const message = await createTestMessage({
        conversationId,
        senderId: testUsers.don.id,
        content: encryptMessage('Specific message'),
      });

      const response = await request(app)
        .get(`/api/messages/${message.id}`)
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(message.id);
      expect(response.body.data.content).toBe('Specific message');
    });

    it('should return 404 for non-existent message', async () => {
      const response = await request(app)
        .get('/api/messages/000000000000000000000000') // Valid MongoDB ObjectID format
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(404);
    });

    it('should deny access to message in conversation user is not part of', async () => {
      const message = await createTestMessage({
        conversationId,
        senderId: testUsers.don.id,
        content: encryptMessage('Private message'),
      });

      const response = await request(app)
        .get(`/api/messages/${message.id}`)
        .set('Authorization', `Bearer ${generateTestToken(testUsers.evans)}`);

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/messages/:id', () => {
    it('should delete own message', async () => {
      const message = await createTestMessage({
        conversationId,
        senderId: testUsers.don.id,
        content: encryptMessage('To be deleted'),
      });

      const response = await request(app)
        .delete(`/api/messages/${message.id}`)
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny deleting other users\' messages', async () => {
      const message = await createTestMessage({
        conversationId,
        senderId: testUsers.shammah.id,
        content: encryptMessage('Bob\'s message'),
      });

      const response = await request(app)
        .delete(`/api/messages/${message.id}`)
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('only delete your own messages');
    });

    it('should return 404 for non-existent message', async () => {
      const response = await request(app)
        .delete('/api/messages/000000000000000000000000') // Valid MongoDB ObjectID format
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/messages/:id/read', () => {
    it('should mark message as read', async () => {
      const message = await createTestMessage({
        conversationId,
        senderId: testUsers.don.id,
        content: encryptMessage('Unread message'),
        readBy: [testUsers.don.id],
      });

      const response = await request(app)
        .post(`/api/messages/${message.id}/read`)
        .set('Authorization', `Bearer ${shammahToken}`)
        .send({ userId: testUsers.shammah.id });

      expect(response.status).toBe(200);
      expect(response.body.data.readBy).toContain(testUsers.shammah.id);
    });

    it('should not duplicate readBy entries', async () => {
      const message = await createTestMessage({
        conversationId,
        senderId: testUsers.don.id,
        content: encryptMessage('Already read'),
        readBy: [testUsers.don.id, testUsers.shammah.id],
      });

      const response = await request(app)
        .post(`/api/messages/${message.id}/read`)
        .set('Authorization', `Bearer ${shammahToken}`)
        .send({ userId: testUsers.shammah.id });

      expect(response.status).toBe(200);
      expect(response.body.data.readBy.filter((id: string) => id === testUsers.shammah.id)).toHaveLength(1);
    });

    it('should deny marking messages as read for other users', async () => {
      const message = await createTestMessage({
        conversationId,
        senderId: testUsers.don.id,
        content: encryptMessage('Message'),
      });

      const response = await request(app)
        .post(`/api/messages/${message.id}/read`)
        .set('Authorization', `Bearer ${donToken}`)
        .send({ userId: testUsers.shammah.id });

      expect(response.status).toBe(403);
    });
  });
});

