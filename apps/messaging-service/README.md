# Messaging Service

Real-time messaging service with WebSocket support for the Build Market platform.

## Features

- ✅ Real-time messaging with Socket.IO
- ✅ Conversation management
- ✅ Message history
- ✅ Read receipts
- ✅ Typing indicators
- ✅ Online/offline status
- ✅ File attachments support
- ✅ MongoDB persistence with Prisma ORM

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Create `.env` file:
```bash
# Copy the example file
cp .env.example .env

# Edit .env and set your DATABASE_URL
# For local MongoDB: DATABASE_URL="mongodb://localhost:27017/messaging"
# For MongoDB Atlas: DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/messaging?retryWrites=true&w=majority"
```

3. Set up MongoDB:

**Option A: Local MongoDB Installation (Recommended - No Docker)**

Windows:
```bash
# Download MongoDB Community Server from https://www.mongodb.com/try/download/community
# Run the installer and follow the setup wizard
# MongoDB will run as a Windows service automatically

# Or use winget (if available):
winget install MongoDB.Server

# Verify MongoDB is running:
mongosh --eval "db.version()"
```

macOS:
```bash
# Install via Homebrew:
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB:
brew services start mongodb-community

# Verify MongoDB is running:
mongosh --eval "db.version()"
```

Linux:
```bash
# Ubuntu/Debian:
sudo apt-get install mongodb-org

# Start MongoDB:
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify MongoDB is running:
mongosh --eval "db.version()"
```

**Option B: MongoDB Atlas (Cloud - Free Tier Available)**

1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free account
3. Create a new cluster (free M0 tier)
4. Create a database user
5. Whitelist your IP address (or use 0.0.0.0/0 for development)
6. Get your connection string and update `.env`

4. Generate Prisma Client:
```bash
pnpm prisma generate
```

5. Push the schema to your database:
```bash
pnpm run db:push
```

## Starting the Service

Start the service:
```bash
# Development (with hot reload)
pnpm run dev

# Production
pnpm run build
pnpm start
```

## Prisma Commands

```bash
# Generate Prisma Client
pnpm prisma:generate

# Push schema changes to database
pnpm run db:push

# Open Prisma Studio (Database GUI)
pnpm prisma:studio
```

## API Endpoints

### REST API

#### Conversations

- `GET /api/conversations/user/:userId` - Get all conversations for a user
- `POST /api/conversations` - Create or get a conversation
- `GET /api/conversations/:id` - Get conversation by ID
- `POST /api/conversations/:id/read` - Mark conversation as read

#### Messages

- `GET /api/messages/conversation/:conversationId` - Get messages for a conversation
- `POST /api/messages` - Send a message (REST fallback)
- `POST /api/messages/:id/read` - Mark message as read

### WebSocket Events

#### Client → Server

- `authenticate` - Authenticate user: `userId`
- `join:conversation` - Join conversation room: `conversationId`
- `leave:conversation` - Leave conversation room: `conversationId`
- `message:send` - Send message: `{ conversationId, senderId, content, type?, attachments? }`
- `typing:start` - Start typing: `{ conversationId, userId }`
- `typing:stop` - Stop typing: `{ conversationId, userId }`
- `messages:read` - Mark messages as read: `{ conversationId, userId }`

#### Server → Client

- `message:new` - New message received: `{ message, conversation }`
- `typing:start` - User started typing: `{ conversationId, userId }`
- `typing:stop` - User stopped typing: `{ conversationId, userId }`
- `messages:read` - Messages marked as read: `{ conversationId, userId }`
- `user:online` - User came online: `userId`
- `user:offline` - User went offline: `userId`
- `error` - Error occurred: `{ message }`

## Integration with Client

```typescript
import { io } from "socket.io-client";

// Connect to messaging service
const socket = io("http://localhost:3010");

// Authenticate
socket.emit("authenticate", userId);

// Join conversation
socket.emit("join:conversation", conversationId);

// Send message
socket.emit("message:send", {
  conversationId,
  senderId: userId,
  content: "Hello!",
});

// Listen for new messages
socket.on("message:new", ({ message, conversation }) => {
  console.log("New message:", message);
});

// Typing indicators
socket.emit("typing:start", { conversationId, userId });
socket.emit("typing:stop", { conversationId, userId });
```

## Database Schema (Prisma)

The schema is defined in `prisma/schema.prisma`. View it with:
```bash
pnpm prisma:studio
```

### Conversation Model
```prisma
model Conversation {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  participants  String[]  // Array of user IDs
  lastMessage   String?
  lastMessageAt DateTime?
  unreadCount   Json      @default("{}") // Map of userId → unread count
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  messages      Message[]
}
```

### Message Model
```prisma
model Message {
  id             String       @id @default(auto()) @map("_id") @db.ObjectId
  conversationId String       @db.ObjectId
  senderId       String
  content        String
  type           MessageType  @default(text)
  attachments    Attachment[]
  readBy         String[]     @default([])
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}
```

## Performance

- Messages are paginated (50 per page)
- Conversations are limited to 50 most recent
- Indexes on conversationId, senderId, and timestamps
- Socket.IO rooms for efficient message broadcasting

## TODO

- [ ] Add message search
- [ ] Add message reactions
- [ ] Add group conversations
- [ ] Add voice/video call signaling
- [ ] Add message encryption
- [ ] Add file upload integration
- [ ] Add Redis for socket scaling
- [ ] Add rate limiting
- [ ] Add profanity filter
- [ ] Add message moderation

