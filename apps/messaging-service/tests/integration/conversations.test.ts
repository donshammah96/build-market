/**
 * Integration Tests - Conversation Routes
 */

import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { conversationRoutes } from '../../src/routes/conversations.js';
import { generateTestToken, testUsers } from '../helpers/jwt.helper.js';
import { cleanDatabase, createTestConversation, createTestMessage } from '../helpers/prisma.helper.js';
import { encryptMessage } from '../../src/utils/encryption.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/conversations', conversationRoutes);

describe('Conversation Routes', () => {
  let donToken: string;
  let shammahToken: string;
  let evansToken: string;

  beforeAll(() => {
    donToken = generateTestToken(testUsers.don);
    shammahToken = generateTestToken(testUsers.shammah);
    evansToken = generateTestToken(testUsers.evans);
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('POST /api/conversations', () => {
    it('should create a new conversation', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${donToken}`)
        .send({
          participants: [testUsers.don.id, testUsers.shammah.id],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        participants: expect.arrayContaining([testUsers.don.id, testUsers.shammah.id]),
      });
      expect(response.body.data.id).toBeDefined();
    });

    it('should include authenticated user in participants if missing', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${donToken}`)
        .send({
          participants: [testUsers.don.id, testUsers.shammah.id], // Include both users
        });

      expect(response.status).toBe(201);
      expect(response.body.data.participants).toContain(testUsers.don.id);
      expect(response.body.data.participants).toContain(testUsers.shammah.id);
    });

    it('should return existing conversation if participants match', async () => {
      // Create initial conversation
      const firstResponse = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${donToken}`)
        .send({
          participants: [testUsers.don.id, testUsers.shammah.id],
        });

      const conversationId = firstResponse.body.data.id;

      // Try to create duplicate
      const secondResponse = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${shammahToken}`)
        .send({
          participants: [testUsers.don.id, testUsers.shammah.id],
        });

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.data.id).toBe(conversationId);
      expect(secondResponse.body.message).toMatch(/Existing conversation|Conversation already exists/);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .send({
          participants: [testUsers.don.id, testUsers.shammah.id],
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject request with invalid data', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${donToken}`)
        .send({
          participants: ['only-one'], // Less than minimum 2
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid request data');
    });

    it('should create conversation with optional projectId', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${donToken}`)
        .send({
          participants: [testUsers.don.id, testUsers.shammah.id],
          projectId: 'project-123',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.projectId).toBe('project-123');
    });
  });

  describe('GET /api/conversations/user/:userId', () => {
    it('should get all conversations for a user', async () => {
      // Create test conversations
      await createTestConversation({
        participants: [testUsers.don.id, testUsers.shammah.id],
        lastMessage: 'Hello Bob',
      });
      await createTestConversation({
        participants: [testUsers.don.id, testUsers.shammah.id],
        lastMessage: 'Hi Charlie',
      });
      await createTestConversation({
        participants: [testUsers.shammah.id, testUsers.evans.id],
      });

      const response = await request(app)
        .get(`/api/conversations/user/${testUsers.don.id}`)
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].participants).toContain(testUsers.don.id);
    });

    it('should return empty array when user has no conversations', async () => {
      const response = await request(app)
        .get(`/api/conversations/user/${testUsers.don.id}`)
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should deny access to other users\' conversations', async () => {
      const response = await request(app)
        .get(`/api/conversations/user/${testUsers.shammah.id}`)
        .set('Authorization', `Bearer ${donToken}`); // Don tries to access Shammah's conversations

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Forbidden');
    });

    it('should order conversations by lastMessageAt', async () => {
      const conv1 = await createTestConversation({
        participants: [testUsers.don.id, testUsers.shammah.id],
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const conv2 = await createTestConversation({
        participants: [testUsers.don.id, testUsers.evans.id],
      });

      const response = await request(app)
        .get(`/api/conversations/user/${testUsers.don.id}`)
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.body.data[0].id).toBe(conv2.id);
      expect(response.body.data[1].id).toBe(conv1.id);
    });
  });

  describe('GET /api/conversations/:id', () => {
    it('should get a specific conversation', async () => {
      const conversation = await createTestConversation({
        participants: [testUsers.don.id, testUsers.shammah.id],
      });

      const response = await request(app)
        .get(`/api/conversations/${conversation.id}`)
          .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(conversation.id);
    });

    it('should return 404 for non-existent conversation', async () => {
      const response = await request(app)
        .get('/api/conversations/000000000000000000000000') // Valid MongoDB ObjectID format
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should deny access to conversation user is not part of', async () => {
      const conversation = await createTestConversation({
        participants: [testUsers.shammah.id, testUsers.evans.id],
      });

      const response = await request(app)
        .get(`/api/conversations/${conversation.id}`)
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/conversations/:id/read', () => {
    it('should mark conversation as read', async () => {
      const conversation = await createTestConversation({
        participants: [testUsers.don.id, testUsers.shammah.id],
      });

      const response = await request(app)
        .post(`/api/conversations/${conversation.id}/read`)
        .set('Authorization', `Bearer ${donToken}`)
        .send({ userId: testUsers.don.id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny marking other users\' messages as read', async () => {
      const conversation = await createTestConversation({
        participants: [testUsers.don.id, testUsers.shammah.id],
      });

      const response = await request(app)
        .post(`/api/conversations/${conversation.id}/read`)
        .set('Authorization', `Bearer ${donToken}`)
        .send({ userId: testUsers.shammah.id });

      expect(response.status).toBe(403);
    });

    it('should return 400 with invalid request body', async () => {
      const conversation = await createTestConversation({
        participants: [testUsers.don.id, testUsers.shammah.id],
      });

      const response = await request(app)
        .post(`/api/conversations/${conversation.id}/read`)
        .set('Authorization', `Bearer ${donToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/conversations/:id', () => {
    it('should remove user from conversation', async () => {
      const conversation = await createTestConversation({
        participants: [testUsers.don.id, testUsers.shammah.id, testUsers.evans.id],
      });

      const response = await request(app)
        .delete(`/api/conversations/${conversation.id}`)
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.participants).not.toContain(testUsers.don.id);
      expect(response.body.data.participants).toContain(testUsers.shammah.id);
      expect(response.body.data.participants).toContain(testUsers.evans.id);
    });

    it('should delete conversation when last participant leaves', async () => {
      const conversation = await createTestConversation({
        participants: [testUsers.don.id],
      });

      const response = await request(app)
        .delete(`/api/conversations/${conversation.id}`)
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });

    it('should deny access to conversation user is not part of', async () => {
      const conversation = await createTestConversation({
        participants: [testUsers.shammah.id, testUsers.evans.id],
      });

      const response = await request(app)
        .delete(`/api/conversations/${conversation.id}`)
        .set('Authorization', `Bearer ${donToken}`);

      expect(response.status).toBe(403);
    });
  });
});

