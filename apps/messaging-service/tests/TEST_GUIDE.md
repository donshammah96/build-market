# Messaging Service - Test Guide

Comprehensive testing suite for the messaging microservice.

## Table of Contents

1. [Overview](#overview)
2. [Test Structure](#test-structure)
3. [Setup](#setup)
4. [Running Tests](#running-tests)
5. [Test Coverage](#test-coverage)
6. [Writing Tests](#writing-tests)
7. [Troubleshooting](#troubleshooting)

## Overview

The test suite includes:

- **Unit Tests**: Test individual functions and utilities in isolation
- **Integration Tests**: Test API routes with real database interactions
- **E2E Tests**: Test complete workflows including WebSocket communication (coming soon)

### Test Stack

- **Jest**: Test framework
- **Supertest**: HTTP assertion library
- **Socket.IO Client**: WebSocket testing
- **Prisma**: Database operations
- **TypeScript**: Type-safe tests

## Test Structure

```
tests/
├── setup.ts                     # Global test configuration
├── helpers/
│   ├── jwt.helper.ts           # JWT token generation utilities
│   └── prisma.helper.ts        # Database setup/cleanup utilities
├── unit/
│   ├── encryption.test.ts      # Encryption utilities tests
│   └── auth.middleware.test.ts # Authentication middleware tests
├── integration/
│   ├── conversations.test.ts   # Conversation routes tests
│   └── messages.test.ts        # Message routes tests
└── e2e/
    └── websocket.test.ts       # End-to-end WebSocket tests (TODO)
```

## Setup

### Prerequisites

1. **MongoDB**: Running instance for test database
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongo-test mongo:latest
   
   # Or use your existing MongoDB instance
   ```

2. **Environment Variables**: Create `.env.test` file
   ```bash
   cp .env.test.example .env.test
   ```

3. **Install Dependencies**:
   ```bash
   pnpm install
   ```

4. **Generate Prisma Client**:
   ```bash
   pnpm prisma:generate
   ```

### Database Setup

The test suite uses a separate test database (`messaging-test`) to avoid affecting development data.

- Tests automatically clean the database before each test suite
- Database connection is managed by `prisma.helper.ts`
- All test data is isolated and cleaned up

## Running Tests

### All Tests
```bash
pnpm test
```

### Watch Mode (for development)
```bash
pnpm test:watch
```

### Coverage Report
```bash
pnpm test:coverage
```

### Specific Test Types

**Unit Tests Only:**
```bash
pnpm test:unit
```

**Integration Tests Only:**
```bash
pnpm test:integration
```

**E2E Tests Only:**
```bash
pnpm test:e2e
```

### Single Test File
```bash
pnpm test encryption.test.ts
```

### Specific Test Case
```bash
pnpm test -t "should encrypt and decrypt"
```

## Test Coverage

Current coverage targets:

| Component | Target | Status |
|-----------|--------|--------|
| Encryption Utils | 100% | ✅ |
| Auth Middleware | 100% | ✅ |
| Conversation Routes | 95% | ✅ |
| Message Routes | 95% | ✅ |
| WebSocket Handlers | 90% | 🚧 |
| Overall | 95% | 🚧 |

### Viewing Coverage Report

After running `pnpm test:coverage`:

```bash
# Open HTML report in browser
open coverage/lcov-report/index.html
```

## Writing Tests

### Unit Test Example

```typescript
// tests/unit/myUtil.test.ts
import { myFunction } from '../../src/utils/myUtil.js';

describe('myFunction', () => {
  it('should do something specific', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });

  it('should handle edge cases', () => {
    expect(() => myFunction(null)).toThrow();
  });
});
```

### Integration Test Example

```typescript
// tests/integration/myRoute.test.ts
import request from 'supertest';
import express from 'express';
import { myRoutes } from '../../src/routes/myRoutes.js';
import { generateTestToken, testUsers } from '../helpers/jwt.helper.js';
import { cleanDatabase } from '../helpers/prisma.helper.js';

const app = express();
app.use(express.json());
app.use('/api/my-route', myRoutes);

describe('My Routes', () => {
  let token: string;

  beforeAll(() => {
    token = generateTestToken(testUsers.alice);
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should handle requests correctly', async () => {
    const response = await request(app)
      .post('/api/my-route')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: 'test' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

### Best Practices

#### 1. Test Organization
- Group related tests using `describe()` blocks
- Use clear, descriptive test names
- Follow AAA pattern: Arrange, Act, Assert

#### 2. Database Management
- Always clean database before each test suite
- Use helper functions for creating test data
- Don't rely on test execution order

#### 3. Authentication
- Use `generateTestToken()` helper for valid tokens
- Test both authenticated and unauthenticated scenarios
- Test authorization (user A can't access user B's data)

#### 4. Assertions
- Be specific with expectations
- Test happy paths and error cases
- Verify response structure and data

#### 5. Cleanup
- Clean up resources after tests
- Close database connections
- Clear timers and intervals

### Test Helpers

#### JWT Helper

```typescript
import { generateTestToken, testUsers } from '../helpers/jwt.helper';

// Generate valid token
const token = generateTestToken(testUsers.alice);

// Generate expired token
const expiredToken = generateExpiredToken(testUsers.alice);

// Generate invalid token
const invalidToken = generateInvalidToken();

// Use predefined test users
testUsers.alice.id // 'user-alice-123'
testUsers.bob.id   // 'user-bob-456'
testUsers.charlie.id // 'user-charlie-789'
```

#### Prisma Helper

```typescript
import {
  cleanDatabase,
  createTestConversation,
  createTestMessage,
} from '../helpers/prisma.helper';

// Clean all test data
await cleanDatabase();

// Create test conversation
const conversation = await createTestConversation({
  participants: ['user-1', 'user-2'],
  projectId: 'project-123',
});

// Create test message
const message = await createTestMessage({
  conversationId: conversation.id,
  senderId: 'user-1',
  content: encryptMessage('Test message'),
});
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Error

```
Error: MongoDB connection failed
```

**Solution:**
- Ensure MongoDB is running
- Check `DATABASE_URL` in `.env.test`
- Verify MongoDB is accessible on localhost:27017

#### 2. Test Timeout

```
Timeout - Async callback was not invoked within the 30000ms timeout
```

**Solution:**
- Increase timeout in specific test:
  ```typescript
  it('long running test', async () => {
    // test code
  }, 60000); // 60 second timeout
  ```
- Check for missing `await` statements
- Ensure database operations complete

#### 3. JWT Verification Error

```
Error: NEXTAUTH_SECRET environment variable is required
```

**Solution:**
- Ensure `.env.test` exists with `NEXTAUTH_SECRET`
- Check `tests/setup.ts` is setting environment variables
- Verify jest configuration includes `setupFilesAfterEnv`

#### 4. Encryption Error

```
Error: MESSAGE_ENCRYPTION_SECRET environment variable is required
```

**Solution:**
- Set `MESSAGE_ENCRYPTION_SECRET` in `.env.test`
- Secret must be at least 32 characters

#### 5. Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::3010
```

**Solution:**
- Tests should not start actual HTTP server
- Use supertest with app instance directly
- Don't call `app.listen()` in test files

#### 6. Prisma Client Not Generated

```
Error: @prisma/client did not initialize yet
```

**Solution:**
```bash
pnpm prisma:generate
```

### Debugging Tests

#### Run Single Test with Logs
```bash
NODE_ENV=test pnpm test encryption.test.ts --verbose
```

#### Enable Console Logs
Comment out console mock in `tests/setup.ts`:

```typescript
// global.console = {
//   ...console,
//   log: jest.fn(),
//   ...
// };
```

#### Debug with Node Inspector
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

### Clean Database Manually

If tests leave orphaned data:

```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/messaging-test

# Drop test database
use messaging-test
db.dropDatabase()
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:latest
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Generate Prisma Client
        run: pnpm prisma:generate
      
      - name: Run tests
        run: pnpm test:coverage
        env:
          DATABASE_URL: mongodb://localhost:27017/messaging-test
          NEXTAUTH_SECRET: test-secret
          MESSAGE_ENCRYPTION_SECRET: test-encryption-secret
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Future Improvements

### Planned Test Additions

1. **WebSocket E2E Tests**
   - Real-time message delivery
   - Typing indicators
   - Connection/disconnection handling
   - Authentication over WebSocket

2. **Load Testing**
   - Concurrent message sending
   - Multiple simultaneous connections
   - Database performance under load

3. **Security Testing**
   - SQL injection attempts (though using Prisma)
   - XSS prevention
   - Rate limiting
   - Token expiration handling

4. **Snapshot Testing**
   - API response structures
   - Error message consistency

5. **Performance Testing**
   - Message encryption/decryption speed
   - Database query optimization
   - Memory leak detection

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Aim for >90% code coverage
3. Include both happy path and error cases
4. Update this guide with new helpers/patterns
5. Run full test suite before committing

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/ladjs/supertest)
- [Socket.IO Testing](https://socket.io/docs/v4/testing/)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing/unit-testing)

## Support

For issues or questions:
1. Check this guide's troubleshooting section
2. Review existing test examples
3. Check GitHub issues
4. Ask the team on Slack

---

**Happy Testing! 🧪**

