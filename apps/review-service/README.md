# Review Service

Review and rating management service for professionals, stores, and products.

## Features

- ✅ Review creation and management
- ✅ 5-star rating system
- ✅ Pros & cons
- ✅ Image attachments
- ✅ Helpful votes
- ✅ Review moderation
- ✅ Aggregate ratings
- ✅ Rating distribution
- ✅ Verified purchases

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Configure environment:
```bash
PORT=3012
MONGODB_URI=mongodb://localhost:27017/reviews
```

3. Start the service:
```bash
pnpm run dev
```

## API Endpoints

### Reviews

#### Get Reviews
```
GET /api/reviews/:entityType/:entityId?page=1&limit=10
```

#### Create Review
```
POST /api/reviews
Body: {
  "userId": "user123",
  "userName": "John Doe",
  "entityType": "professional|store|product",
  "entityId": "123",
  "rating": 5,
  "title": "Great service!",
  "content": "Very professional and helpful",
  "pros": ["Professional", "On time"],
  "cons": ["Expensive"],
  "images": ["https://..."]
}
```

#### Mark as Helpful
```
POST /api/reviews/:id/helpful
Body: { "userId": "user123" }
```

#### Flag Review
```
POST /api/reviews/:id/flag
```

#### Moderate Review (Admin)
```
PATCH /api/reviews/:id/moderate
Body: { "moderationStatus": "approved|rejected" }
```

### Ratings

#### Get Aggregate Rating
```
GET /api/ratings/:entityType/:entityId

Response: {
  "averageRating": 4.5,
  "totalReviews": 128,
  "distribution": {
    "1": 2,
    "2": 5,
    "3": 15,
    "4": 38,
    "5": 68
  }
}
```

## Database Schema

### Review
- `userId`: User ID
- `userName`: Display name
- `entityType`: professional | store | product
- `entityId`: Entity ID
- `rating`: 1-5 stars
- `title`: Review title (optional)
- `content`: Review content
- `pros`: Array of positive points
- `cons`: Array of negative points
- `images`: Array of image URLs
- `verified`: Verified purchase
- `helpful`: Helpful vote count
- `helpfulBy`: Users who voted helpful
- `flagged`: Flagged for moderation
- `moderationStatus`: pending | approved | rejected

