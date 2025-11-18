# Notification Service

Multi-channel notification service supporting email, push, and in-app notifications.

## Features

- ✅ Email notifications via Nodemailer
- ✅ In-app notifications
- ✅ Push notifications (TODO)
- ✅ Notification history
- ✅ Read/unread status
- ✅ Bulk operations
- ✅ MongoDB persistence

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Configure environment variables:
```bash
PORT=3011
MONGODB_URI=mongodb://localhost:27017/notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@buildmarket.com
```

3. Start the service:
```bash
# Development
pnpm run dev

# Production
pnpm run build
pnpm start
```

## API Endpoints

### Get Notifications
```
GET /api/notifications/user/:userId?unreadOnly=true
```

### Create Notification
```
POST /api/notifications
Body: {
  "userId": "user123",
  "type": "email|push|in_app",
  "category": "order|message|project|review|system",
  "title": "New Order",
  "content": "Your order has been placed",
  "data": { "orderId": "123" }
}
```

### Mark as Read
```
PATCH /api/notifications/:id/read
```

### Mark All as Read
```
PATCH /api/notifications/user/:userId/read-all
```

### Delete Notification
```
DELETE /api/notifications/:id
```

## Integration

```typescript
// Create notification
await fetch("http://localhost:3011/api/notifications", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: "user123",
    type: "in_app",
    category: "order",
    title: "Order Shipped",
    content: "Your order #123 has been shipped",
    data: { orderId: "123" }
  })
});
```

