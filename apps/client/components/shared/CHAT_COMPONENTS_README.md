# Chat Components Documentation

## Overview

Production-ready chat components with real-time messaging, animations, and modern UI.

## Components

### 1. ChatWindow

Main chat interface with messages display and input.

**Features:**
- ✅ Real-time messaging via WebSocket
- ✅ Message encryption/decryption (handled by API)
- ✅ Typing indicators (animated)
- ✅ Read receipts (checkmarks)
- ✅ Optimistic updates
- ✅ Auto-scroll to bottom
- ✅ Loading states with skeletons
- ✅ Error handling with retries
- ✅ Character count (max 1000)
- ✅ Animations with Framer Motion
- ✅ Responsive design

**Props:**
```typescript
interface ChatWindowProps {
  conversationId: string;
  otherUserId?: string;
  otherUserName?: string;
  otherUserAvatar?: string;
}
```

**Usage:**
```typescript
<ChatWindow
  conversationId="conv-123"
  otherUserId="user-456"
  otherUserName="John Doe"
  otherUserAvatar="/avatars/john.jpg"
/>
```

### 2. ConversationsList

Sidebar showing all conversations with search and selection.

**Features:**
- ✅ List all conversations
- ✅ Search conversations
- ✅ Unread count badges
- ✅ Last message preview
- ✅ Time formatting (smart)
- ✅ Selection state
- ✅ Loading skeletons
- ✅ Empty state
- ✅ Auto-refresh (30s)
- ✅ Smooth animations

**Props:**
```typescript
interface ConversationsListProps {
  onSelectConversation: (conversationId: string, otherUserId: string) => void;
  selectedId?: string;
}
```

**Usage:**
```typescript
<ConversationsList
  onSelectConversation={handleSelect}
  selectedId={currentConversationId}
/>
```

### 3. MessagesPage

Full-page layout combining conversations list and chat window.

**Features:**
- ✅ Split layout (1/3 - 2/3)
- ✅ Responsive design
- ✅ State management
- ✅ Empty state
- ✅ Page animations

**Usage:**
```typescript
// app/(dashboard)/messages/page.tsx
export default function MessagesPage() {
  return <MessagesPageContent />;
}
```

## Animations

### Message Animations
- **Entry**: Slide up + fade in (0.2s)
- **Exit**: Scale down + fade out
- **Hover**: Slight scale up (1.02)

### Typing Indicator
- **3 dots**: Sequential bounce animation
- **Container**: Slide up + fade in/out

### Conversation Items
- **Entry**: Slide from left with stagger
- **Hover**: Background color transition
- **Tap**: Scale down (0.98)

### Unread Badge
- **Entry**: Scale from 0 to 1

## WebSocket Events

### Client → Server

```typescript
// Authenticate
socket.emit("authenticate", { token: "jwt-token" });

// Join conversation
socket.emit("join:conversation", conversationId);

// Leave conversation
socket.emit("leave:conversation", conversationId);

// Typing start
socket.emit("typing:start", { conversationId, userId });

// Typing stop
socket.emit("typing:stop", { conversationId, userId });
```

### Server → Client

```typescript
// Authenticated
socket.on("authenticated", (data) => {});

// New message
socket.on("message:new", ({ message }) => {});

// Typing indicators
socket.on("typing:start", ({ userId }) => {});
socket.on("typing:stop", ({ userId }) => {});

// Messages read
socket.on("messages:read", ({ userId }) => {});

// Errors
socket.on("error", ({ message }) => {});
```

## API Integration

Uses `messagingClient` from `@/lib/messaging-client`:

```typescript
// Get conversations
await messagingClient.getConversations();

// Get conversation
await messagingClient.getConversation(id);

// Get messages
await messagingClient.getMessages(conversationId, page, limit);

// Send message
await messagingClient.sendMessage({ conversationId, content, type });

// Mark as read
await messagingClient.markConversationAsRead(id);
```

## State Management

Uses React Query for:
- Caching
- Optimistic updates
- Auto-refetching
- Background updates
- Error handling

```typescript
// Query keys
["conversations"] // List of conversations
["conversation", id] // Single conversation
["messages", conversationId] // Messages for conversation
```

## Environment Variables

Required in `.env.local`:

```env
NEXT_PUBLIC_MESSAGING_SERVICE_URL=http://localhost:3010
```

## Styling

### Theme Variables

Components use CSS variables from your theme:
- `--primary` - Primary color (sent messages)
- `--muted` - Received messages background
- `--accent` - Selected conversation
- `--destructive` - Error states

### Custom Classes

```css
/* Adjust message bubble roundness */
.rounded-2xl { border-radius: 1rem; }

/* Adjust heights */
.h-[600px] { height: 600px; }
```

## Accessibility

- ✅ Keyboard navigation (Enter to send)
- ✅ ARIA labels on inputs
- ✅ Focus management
- ✅ Screen reader friendly
- ✅ Semantic HTML

## Performance Optimizations

1. **Optimistic Updates**: Messages appear instantly
2. **Virtual Scrolling**: Could be added for 1000+ messages
3. **Debounced Typing**: Typing events throttled to 2s
4. **Query Invalidation**: Smart refetching
5. **Memoization**: React Query caching
6. **Lazy Loading**: Could add pagination scroll

## Responsive Design

### Mobile (< 768px)
- Stacked layout
- Full-width components
- Adjusted padding

### Tablet (768px - 1024px)
- 1/3 - 2/3 split
- Comfortable spacing

### Desktop (> 1024px)
- Full layout
- Optimal spacing
- Hover states

## Error Handling

### Network Errors
```typescript
// Toast notification
toast({
  variant: "destructive",
  title: "Failed to send message",
  description: "Please try again"
});
```

### Socket Disconnection
- Auto-reconnect (5 attempts)
- Exponential backoff
- User notification

### API Errors
- Retry button
- Error message display
- Rollback optimistic updates

## Security

- ✅ Authentication required (NextAuth)
- ✅ JWT token for WebSocket
- ✅ Message encryption (server-side)
- ✅ Authorization checks (API)
- ✅ XSS protection (sanitized content)

## Future Enhancements

### Planned Features
- [ ] File attachments (UI ready)
- [ ] Image uploads (UI ready)
- [ ] Voice messages
- [ ] Video calls
- [ ] Message reactions (emoji)
- [ ] Message forwarding
- [ ] Search within conversation
- [ ] Message pinning
- [ ] Group chats
- [ ] Admin controls
- [ ] Message deletion
- [ ] Edit messages
- [ ] Mention users (@username)
- [ ] Link previews
- [ ] Notification sounds
- [ ] Desktop notifications
- [ ] Unread count in title
- [ ] Conversation archive
- [ ] Message export

### Performance
- [ ] Virtual scrolling for large conversations
- [ ] Message pagination (load older)
- [ ] Image lazy loading
- [ ] Service worker for offline

### UX Improvements
- [ ] Drag & drop files
- [ ] Copy message text
- [ ] Message selection
- [ ] Bulk operations
- [ ] Keyboard shortcuts
- [ ] Dark mode optimizations
- [ ] Custom themes
- [ ] Message templates

## Troubleshooting

### Messages not loading
1. Check API connection
2. Verify authentication
3. Check console for errors
4. Verify `conversationId` is valid

### WebSocket not connecting
1. Check `NEXT_PUBLIC_MESSAGING_SERVICE_URL`
2. Verify messaging service is running
3. Check `session.accessToken` exists
4. Check browser console for errors

### Animations laggy
1. Reduce `AnimatePresence` items
2. Use `useReducedMotion` hook
3. Disable animations on low-end devices

### Typing indicator stuck
1. Check WebSocket connection
2. Verify event handlers
3. Check timeout (2s default)

## Dependencies

```json
{
  "dependencies": {
    "framer-motion": "^11.x",
    "socket.io-client": "^4.x",
    "@tanstack/react-query": "^5.x",
    "next-auth": "^5.x",
    "lucide-react": "^0.x",
    "@repo/types": "workspace:*"
  }
}
```

## Testing

### Unit Tests (TODO)
```typescript
// Test message sending
it("should send message", async () => {
  // ...
});

// Test typing indicator
it("should show typing when user types", () => {
  // ...
});
```

### E2E Tests (TODO)
```typescript
// Test conversation flow
test("user can send and receive messages", async () => {
  // ...
});
```

## Support

For issues or questions:
1. Check [MESSAGING_API_SETUP.md](../MESSAGING_API_SETUP.md)
2. Review messaging service logs
3. Check browser console
4. Verify environment variables

