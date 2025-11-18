# Build Market - Turborepo Monorepo

> 🚀 **Looking to speed up development?** See [README-SPEEDUP.md](./README-SPEEDUP.md) for immediate performance improvements!

A production-ready, full-stack marketplace application built with Turborepo monorepo architecture. Build Market connects homeowners with verified construction professionals, vendors, and suppliers, offering a comprehensive platform for project management, real-time messaging, e-commerce, and professional services.

## Table of Contents

- [Overview](#-overview)
- [Recent Updates](#-recent-updates)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Technology Stack](#-technology-stack)
- [Architecture](#-architecture)
- [Services Documentation](#-services-documentation)
- [Security Features](#-security-features)
- [Performance Optimizations](#-performance-optimizations)
- [Testing](#-testing)
- [Development Workflow](#-development-workflow)
- [Environment Variables](#-environment-variables)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## 🏗️ Overview

Build Market is a comprehensive construction and home improvement marketplace that provides:

- **Professional Discovery**: Find and connect with verified architects, contractors, designers, and engineers
- **Project Management**: Track projects from planning to completion with real-time updates
- **E-commerce Platform**: Browse and purchase materials from verified vendors and stores
- **Real-time Messaging**: WebSocket-powered instant messaging between clients and professionals
- **Idea Books**: Create and share design inspiration boards
- **Review System**: Comprehensive rating and review system for professionals and stores
- **Advanced Search**: Elasticsearch-powered search with geo-spatial filtering and autocomplete
- **Multi-role Support**: Separate portals for clients, professionals, and administrators

## 🌟 Recent Updates

- ✅ **Refactored API Routes** - Enhanced security, performance, and error handling
- ✅ **90%+ Test Coverage** - Comprehensive test suite with Vitest
- ✅ **Performance Optimized** - 50-80% faster queries with strategic database indexes
- ✅ **Production Ready** - Rate limiting, input validation, standardized responses
- 📚 **Full Documentation** - See [QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md) and [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
cd packages/db
npx prisma migrate deploy
cd ../..

# Start only the client app (fastest)
pnpm run dev:client

# Start only the admin app
pnpm run dev:admin

# Start everything (slower)
pnpm run dev
```

### 🧪 Run Tests

```bash
# Run all tests
cd apps/client
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# UI mode
npm run test:ui
```

**Pro tip**: Use selective commands for 10x faster startup! See [performance guide](./README-SPEEDUP.md).

## 📦 Project Structure

```
build-market/
├── apps/
│   ├── client/              # Main customer-facing marketplace (Next.js 15)
│   ├── admin/               # Admin dashboard for platform management
│   ├── messaging-service/   # Real-time messaging (Socket.io + MongoDB)
│   ├── search-service/      # Search engine (Elasticsearch + Redis)
│   ├── notification-service/# Push notifications and alerts
│   ├── review-service/      # Reviews and ratings management
│   ├── payment-service/     # Payment processing (Stripe integration)
│   ├── order-service/       # Order and fulfillment management
│   ├── project-service/     # Project lifecycle management
│   ├── email-service/       # Email notifications via Kafka
│   └── analytics-service/   # Analytics and reporting
├── packages/
│   ├── db/                  # Prisma PostgreSQL client and schema
│   ├── project-db/          # Project-specific database models
│   ├── order-db/            # Order database models (MongoDB)
│   ├── types/               # Shared TypeScript type definitions
│   ├── ui/                  # Shared React components (shadcn/ui)
│   ├── kafka/               # Kafka client and utilities
│   ├── eslint-config/       # Shared ESLint configurations
│   └── typescript-config/   # Shared TypeScript configurations
└── docs/                    # Documentation and guides
```

### Frontend Applications

#### Client App (`apps/client`)
**Main marketplace application - Port 3030**

Features:
- 🏠 **Marketplace**: Browse professionals, stores, and products
- 🛒 **E-commerce**: Shopping cart, checkout, and order tracking
- 👤 **User Portal**: Client dashboard, project management, and messaging
- 🔧 **Professional Portal**: Business dashboard, lead management, and calendar
- 🎨 **Idea Books**: Design inspiration boards with image collections
- 💬 **Real-time Chat**: WebSocket-based messaging with typing indicators
- 📱 **Responsive Design**: Mobile-first design with Tailwind CSS
- 🔐 **Authentication**: Clerk integration with role-based access control

Technology:
- Next.js 15 with App Router
- React 19
- TypeScript 5.7
- Tailwind CSS 4
- Clerk Auth
- Zustand (state management)
- React Query (data fetching)
- Socket.io Client
- Vitest (testing)

#### Admin App (`apps/admin`)
**Administrative dashboard - Separate deployment**

Features:
- 📊 Platform analytics and reporting
- 👥 User and professional management
- ✅ Verification and approval workflows
- 🏪 Store and product moderation
- 📝 Content management
- 🚨 Monitoring and alerts

### Backend Microservices

#### Messaging Service (`apps/messaging-service`)
**Real-time messaging - Port 3010**

- WebSocket communication with Socket.io
- MongoDB persistence with Prisma
- Conversation and message management
- Read receipts and typing indicators
- Online/offline status tracking
- File attachment support
- See [Messaging Service README](apps/messaging-service/README.md)

#### Search Service (`apps/search-service`)
**Full-text search - Port 3005**

- Elasticsearch for search indexing
- Redis caching for sub-second responses
- Geo-spatial search for location-based queries
- Autocomplete with fuzzy matching
- Advanced filtering (rating, price, category)
- Pagination and relevance scoring
- See [Search Service README](apps/search-service/README.md)

#### Notification Service (`apps/notification-service`)
**Push notifications - Port 3011**

- Email notifications
- Push notifications
- In-app alerts
- SMS (future)
- Event-driven architecture

#### Review Service (`apps/review-service`)
**Reviews and ratings - Port 3012**

- Professional and store reviews
- Star ratings and detailed feedback
- Moderation queue
- Aggregate rating calculations
- Review verification

#### Payment Service (`apps/payment-service`)
**Payment processing**

- Stripe integration
- Transaction management
- Refund processing
- Payment history
- Invoice generation

#### Order Service (`apps/order-service`)
**Order management**

- Order lifecycle tracking
- Status updates
- Inventory management
- Fulfillment coordination
- MongoDB storage

#### Project Service (`apps/project-service`)
**Project management**

- Project lifecycle (planning → completion)
- Timeline tracking
- Budget management
- Milestone tracking
- Client-professional collaboration

#### Email Service (`apps/email-service`)
**Email delivery**

- Transactional emails
- Marketing campaigns
- Email templates
- Kafka event-driven
- Delivery tracking

### Shared Packages

#### `@repo/db`
- Prisma ORM for PostgreSQL
- Schema definitions and migrations
- Database seeding
- Performance indexes
- Connection pooling

#### `@repo/types`
- Shared TypeScript interfaces
- Type definitions for all services
- Ensures type safety across monorepo
- Auto-generated from Prisma schema

#### `@repo/ui`
- Shared React components
- shadcn/ui component library
- Design system tokens
- Reusable UI primitives

#### `@repo/kafka`
- Kafka client configuration
- Producer and consumer utilities
- Event schemas
- Message serialization

Everything is 100% [TypeScript](https://www.typescriptlang.org/).

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router, React 19, Server Components)
- **Styling**: Tailwind CSS 4, Framer Motion
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: Zustand, React Query (@tanstack/react-query)
- **Forms**: React Hook Form + Zod validation
- **Authentication**: Clerk (OAuth, email/password, MFA)
- **Real-time**: Socket.io Client
- **Testing**: Vitest, React Testing Library
- **Type Safety**: TypeScript 5.7 (strict mode)

### Backend Services
- **Runtime**: Node.js 18+
- **API Framework**: Next.js API Routes, Express, Hono
- **ORM**: Prisma (PostgreSQL), Mongoose (MongoDB)
- **Real-time**: Socket.io
- **Event Streaming**: Kafka
- **Search**: Elasticsearch
- **Caching**: Redis, Upstash Redis
- **File Storage**: S3-compatible storage
- **Payment**: Stripe
- **Email**: Nodemailer, Resend
- **Webhooks**: Svix

### Databases
- **Primary Database**: PostgreSQL (User data, projects, products)
- **NoSQL**: MongoDB (Messages, notifications, reviews)
- **Search Engine**: Elasticsearch (Full-text search)
- **Cache**: Redis (Session, rate limiting, search cache)

### Development Tools
- **Monorepo**: Turborepo 2.x
- **Package Manager**: pnpm 10.x
- **Linting**: ESLint 9
- **Formatting**: Prettier 3
- **Testing**: Vitest, Jest
- **CI/CD**: GitHub Actions (ready)
- **API Testing**: Vitest, Postman collections
- **Database Tools**: Prisma Studio, MongoDB Compass

### Infrastructure
- **Hosting**: Vercel (frontend), AWS/GCP (services)
- **CDN**: Vercel Edge Network, CloudFront
- **Monitoring**: Ready for Sentry, DataDog
- **Logging**: Structured logging ready
- **Analytics**: Ready for integration

## 🏛️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│                   (Next.js 15 - Port 3030)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Marketplace  │  │    Shop      │  │    User      │         │
│  │              │  │              │  │              │         │
│  │ • Professionals  • Cart       │  │ • Dashboard  │         │
│  │ • Stores     │  │ • Checkout   │  │ • Messages   │         │
│  │ • Inspiration│  │ • Orders     │  │ • Profile    │         │
│  │ • Projects   │  │ • Wishlist   │  │ • Reviews    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                           │
│  │Professional  │  │    Auth      │                           │
│  │   Portal     │  │              │                           │
│  │              │  │ • Sign In    │                           │
│  │ • Dashboard  │  │ • Sign Up    │                           │
│  │ • Projects   │  │ • OAuth      │                           │
│  │ • Leads      │  │ • MFA        │                           │
│  │ • Calendar   │  │              │                           │
│  └──────────────┘  └──────────────┘                           │
│                                                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    HTTP/WebSocket
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                    SERVICES LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Messaging (3010) │  │ Notification     │                    │
│  │                  │  │ Service (3011)   │                    │
│  │ • WebSocket      │  │                  │                    │
│  │ • Conversations  │  │ • Email          │                    │
│  │ • Real-time Chat │  │ • Push           │                    │
│  │ • Typing Status  │  │ • In-App         │                    │
│  │ • Read Receipts  │  │ • SMS (future)   │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Search (3005)    │  │ Review Service   │                    │
│  │                  │  │     (3012)       │                    │
│  │ • Elasticsearch  │  │                  │                    │
│  │ • Redis Cache    │  │ • Reviews        │                    │
│  │ • Autocomplete   │  │ • Ratings        │                    │
│  │ • Geo-search     │  │ • Moderation     │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Order Service    │  │ Payment Service  │                    │
│  │                  │  │                  │                    │
│  │ • Order Mgmt     │  │ • Stripe         │                    │
│  │ • Tracking       │  │ • Transactions   │                    │
│  │ • Status Updates │  │ • Refunds        │                    │
│  │ • History        │  │ • Invoicing      │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Project Service  │  │ Email Service    │                    │
│  │                  │  │                  │                    │
│  │ • Project Mgmt   │  │ • Transactional  │                    │
│  │ • Timeline       │  │ • Marketing      │                    │
│  │ • Budget Track   │  │ • Templates      │                    │
│  │ • Milestones     │  │ • Kafka-driven   │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                     DATA LAYER                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  PostgreSQL │  │   MongoDB   │  │   Redis     │            │
│  │             │  │             │  │             │            │
│  │ • Users     │  │ • Messages  │  │ • Cache     │            │
│  │ • Products  │  │ • Notifs    │  │ • Sessions  │            │
│  │ • Orders    │  │ • Reviews   │  │ • Queues    │            │
│  │ • Projects  │  │             │  │ • Rate Limit│            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │Elasticsearch│  │   Kafka     │  │   S3/CDN    │            │
│  │             │  │             │  │             │            │
│  │ • Search    │  │ • Events    │  │ • Images    │            │
│  │ • Analytics │  │ • Streaming │  │ • Files     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Examples

#### User Authentication Flow
```
User Login → Clerk Auth → JWT Token → Cookie Storage
    ↓
[Client] → API Request with Cookie
    ↓
Middleware validates JWT
    ↓
Extract userId & role → Forward to API Route
    ↓
API Route checks permissions → Process request
    ↓
Return response with appropriate data
```

#### Shopping Flow
```
User adds to cart → CartStore (Zustand)
    ↓
Proceed to Checkout (3 steps)
    ↓
[Client] → Place Order
    ↓
Order Service → MongoDB
    ↓                ↓
Payment Service   Notification Service
    ↓                ↓
Stripe API       Email/Push Notification
    ↓
Confirmation Page with Order Details
```

#### Messaging Flow
```
User sends message → [Client] WebSocket
    ↓
Messaging Service (Port 3010)
    ↓
├─> Save to MongoDB (persist)
├─> Emit to conversation room (real-time)
└─> Check recipient status
    ↓ (if offline)
    Notification Service → Email/Push
```

#### Search Flow
```
User types query → [Client] Search Input
    ↓
Search Service (Port 3005)
    ↓
Check Redis Cache
    ↓ (cache miss)
Query Elasticsearch
    ↓
Apply filters & geo-search
    ↓
Cache results → Return to client
    ↓
Display with pagination & relevance score
```

### Design Patterns

#### Repository Pattern
- Encapsulates data access logic
- Testable and maintainable
- Used in: `apps/client/app/lib/repositories/`

#### Middleware Pattern
- Composable request handlers
- `withAuth`, `withRole`, `withValidation`
- Used in: API routes for security

#### Event-Driven Architecture
- Kafka for async communication
- Decoupled services
- Used in: Email, notifications, analytics

#### Circuit Breaker (Planned)
- Fault tolerance for external services
- Graceful degradation
- Future enhancement

### Database Schema Highlights

**Key Models** (PostgreSQL via Prisma):
- `User`: Multi-role support (client, professional, admin)
- `ProfessionalProfile`: Business info, certifications, services
- `ClientProfile`: Preferences, location
- `Project`: Lifecycle tracking, milestones, budgets
- `Product`: E-commerce catalog with stores
- `Order`: Purchase history and fulfillment
- `Review`: Ratings for professionals and stores
- `IdeaBook`: Design inspiration collections
- `Portfolio`: Professional work showcase

**Indexes** (Performance optimized):
- Composite indexes for common query patterns
- GIN indexes for array searches (services, tags)
- Geo-spatial indexes (coming soon)
- 50-80% query performance improvement

See [Prisma Schema](packages/db/prisma/schema.prisma) for full details.

## 🔐 Security Features

- ✅ **Authentication** - Clerk integration with middleware protection
- ✅ **Rate Limiting** - Configurable limits per endpoint (5-100 req/min)
- ✅ **Input Validation** - Zod schemas with sanitization
- ✅ **Webhook Security** - Signature verification with Svix
- ✅ **CORS Protection** - Origin whitelisting and preflight handling
- ✅ **Error Handling** - Generic messages in production, detailed in dev

## ⚡ Performance Optimizations

- 📊 **Database Indexes** - Strategic indexes for 50-80% faster queries
- 🏗️ **Repository Pattern** - Clean separation of concerns
- 🔄 **Transactions** - Atomic operations for data consistency
- 💾 **Query Optimization** - Removed N+1 patterns
- 🚀 **Ready for Caching** - Infrastructure for Redis/Next.js cache

## 🧪 Testing

- **Framework**: Vitest with React Testing Library
- **Coverage**: 90%+ on critical paths
- **Test Types**: Unit, integration, and edge case testing
- **Mocking**: Prisma, Clerk, and external services
- **CI/CD Ready**: Fast, reliable test suite

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting
- [Vitest](https://vitest.dev/) for unit testing
- [Prisma](https://www.prisma.io/) for database ORM
- [Clerk](https://clerk.com/) for authentication

### Build

To build all apps and packages, run the following command:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo build

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo build
yarn dlx turbo build
pnpm exec turbo build
```

You can build a specific package by using a [filter](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters):

```
# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo build --filter=docs

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo build --filter=docs
yarn exec turbo build --filter=docs
pnpm exec turbo build --filter=docs
```

### Develop

To develop all apps and packages, run the following command:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo dev

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo dev
yarn exec turbo dev
pnpm exec turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters):

```
# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo dev --filter=web

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo dev --filter=web
yarn exec turbo dev --filter=web
pnpm exec turbo dev --filter=web
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo login

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo login
yarn exec turbo login
pnpm exec turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```
# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo link

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo link
yarn exec turbo link
pnpm exec turbo link
```

## 📚 Documentation

### Getting Started
- **[Quick Start Guide](./QUICK_START_GUIDE.md)** - Setup, testing, and common commands
- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - Complete technical documentation
- **[Performance Guide](./README-SPEEDUP.md)** - Development speed improvements

### Database
- **[Migration Guide](./packages/db/prisma/migrations/add_performance_indexes.md)** - Database optimization
- **Prisma Schema**: `packages/db/prisma/schema.prisma`

### API Routes
All routes in `apps/client/app/api/` are:
- ✅ Secured with authentication middleware
- ✅ Rate limited
- ✅ Input validated
- ✅ Fully tested

## 🛠️ Development Workflow

### Database Migrations

```bash
cd packages/db

# Create a new migration
npx prisma migrate dev --name your_migration_name

# Apply migrations in production
npx prisma migrate deploy

# View database
npx prisma studio
```

### Testing Workflow

```bash
cd apps/client

# Run tests before committing
npm test

# Generate coverage report
npm run test:coverage

# Interactive UI for debugging
npm run test:ui
```

### Code Quality

```bash
# Lint code
pnpm run lint

# Format code
pnpm run format

# Type check
pnpm run type-check
```

## 🌐 Services Documentation

### Messaging Service
**Real-time WebSocket messaging**

```bash
cd apps/messaging-service
pnpm install
pnpm prisma generate
pnpm run dev  # Runs on port 3010
```

**Features**:
- Real-time chat with Socket.io
- Conversation management
- Read receipts and typing indicators
- Online/offline status tracking
- File attachments support
- MongoDB persistence

**API Endpoints**:
- `GET /api/conversations/user/:userId` - Get user conversations
- `POST /api/conversations` - Create/get conversation
- `POST /api/messages` - Send message
- WebSocket events: `message:send`, `typing:start`, `message:new`

See [Messaging Service README](apps/messaging-service/README.md) for full documentation.

### Search Service
**Elasticsearch-powered search**

```bash
cd apps/search-service
docker-compose up -d  # Start Elasticsearch & Redis
pnpm install
pnpm run dev  # Runs on port 3005
```

**Features**:
- Full-text search with fuzzy matching
- Redis caching for sub-second responses
- Geo-spatial search
- Autocomplete suggestions
- Advanced filtering

**API Endpoints**:
- `GET /api/search/professionals?q=...&location=...` - Search professionals
- `GET /api/search/stores?q=...&category=...` - Search stores
- `GET /api/search/products?q=...&price=...` - Search products
- `GET /api/search/autocomplete?q=...` - Get suggestions

See [Search Service README](apps/search-service/README.md) for full documentation.

### Notification Service
**Multi-channel notifications**

```bash
cd apps/notification-service
pnpm install
pnpm run dev  # Runs on port 3011
```

**Channels**:
- Email notifications
- Push notifications
- In-app alerts
- SMS (planned)

### Review Service
**Ratings and reviews**

```bash
cd apps/review-service
pnpm install
pnpm run dev  # Runs on port 3012
```

**Features**:
- Professional and store reviews
- Star ratings (1-5)
- Review moderation
- Aggregate rating calculations

### Payment Service
**Stripe integration**

```bash
cd apps/payment-service
pnpm install
pnpm run dev
```

**Features**:
- Payment processing
- Refund management
- Transaction history
- Invoice generation

## 🔧 Environment Variables

### Client App (`apps/client/.env`)

```env
# === Authentication (Required) ===
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx

# === Database (Required) ===
DATABASE_URL=postgresql://user:password@localhost:5432/buildmarket

# === Application (Required) ===
NEXT_PUBLIC_APP_URL=http://localhost:3030
NODE_ENV=development

# === Services (Optional - for full features) ===
MESSAGING_SERVICE_URL=http://localhost:3010
SEARCH_SERVICE_URL=http://localhost:3005
NOTIFICATION_SERVICE_URL=http://localhost:3011
REVIEW_SERVICE_URL=http://localhost:3012

# === Payment (Required for e-commerce) ===
STRIPE_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# === Email (Optional) ===
RESEND_API_KEY=re_xxxxx
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password

# === Redis (Optional - for production rate limiting) ===
UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxx

# === File Storage (Optional) ===
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_REGION=us-east-1
AWS_S3_BUCKET=buildmarket-uploads

# === Analytics (Optional) ===
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

### Messaging Service (`apps/messaging-service/.env`)

```env
PORT=3010
NODE_ENV=development
DATABASE_URL=mongodb://localhost:27017/messaging
# Or MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/messaging
```

### Search Service (`apps/search-service/.env`)

```env
PORT=3005
NODE_ENV=development

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Cache TTL (seconds)
CACHE_TTL=3600
AUTOCOMPLETE_CACHE_TTL=300
```

### Shared Database Package (`packages/db/.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/buildmarket
```

### Getting API Keys

#### Clerk (Authentication)
1. Sign up at [clerk.com](https://clerk.com)
2. Create a new application
3. Get keys from "API Keys" section
4. Set up webhook endpoint for user sync

#### Stripe (Payments)
1. Sign up at [stripe.com](https://stripe.com)
2. Get test keys from Dashboard → Developers → API keys
3. Set up webhook for payment events

#### Upstash Redis (Rate Limiting - Optional)
1. Sign up at [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy REST URL and token

#### MongoDB Atlas (Messaging - Free Tier)
1. Sign up at [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Create a free M0 cluster
3. Create database user and whitelist IP
4. Get connection string

## 🚀 Deployment

### Pre-deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Database indexes applied
- [ ] Rate limiting configured for production (Redis)
- [ ] CORS origins updated
- [ ] Error monitoring setup (Sentry, etc.)
- [ ] SSL certificates configured
- [ ] CDN configured for static assets
- [ ] Backup strategy in place

### Vercel Deployment (Client App)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
cd apps/client
vercel

# Deploy to production
vercel --prod
```

**Vercel Configuration**:
- Build Command: `cd ../.. && pnpm run build --filter=client`
- Output Directory: `apps/client/.next`
- Install Command: `pnpm install`
- Root Directory: `./`

### Docker Deployment (Services)

```bash
# Build service image
docker build -t buildmarket-messaging -f apps/messaging-service/Dockerfile .

# Run container
docker run -p 3010:3010 \
  -e DATABASE_URL=mongodb://... \
  buildmarket-messaging

# Or use docker-compose
docker-compose up -d
```

### Database Deployment

#### PostgreSQL (Recommended: AWS RDS, Supabase, Neon)

```bash
# Run migrations
cd packages/db
npx prisma migrate deploy

# Verify connection
npx prisma db pull
```

#### MongoDB (Recommended: MongoDB Atlas)

```bash
cd apps/messaging-service
npx prisma generate
npx prisma db push
```

#### Elasticsearch & Redis (Recommended: Elastic Cloud, Upstash)

Follow service-specific setup guides.

### Production Environment Variables

**Security Checklist**:
- ✅ Use production API keys (not test keys)
- ✅ Set `NODE_ENV=production`
- ✅ Use strong, unique passwords
- ✅ Enable SSL/TLS
- ✅ Restrict CORS origins
- ✅ Enable rate limiting with Redis
- ✅ Set up monitoring and alerts
- ✅ Configure backup jobs
- ✅ Use environment variable secrets (not committed)

## 🔍 Troubleshooting

### Common Issues

#### Port Already in Use

**Problem**: `Error: listen EADDRINUSE: address already in use :::3030`

**Solution**:
```bash
# Windows
netstat -ano | findstr :3030
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3030 | xargs kill -9
```

#### Database Connection Failed

**Problem**: `Error: Can't reach database server`

**Solution**:
1. Check if PostgreSQL is running
2. Verify `DATABASE_URL` in `.env`
3. Ensure database exists:
   ```bash
   createdb buildmarket
   ```
4. Test connection:
   ```bash
   psql postgresql://user:password@localhost:5432/buildmarket
   ```

#### Prisma Client Not Generated

**Problem**: `Cannot find module '@prisma/client'`

**Solution**:
```bash
cd packages/db
npx prisma generate
```

#### Clerk Authentication Errors

**Problem**: `Invalid API key` or `Unauthorized`

**Solutions**:
1. Verify `.env` has correct Clerk keys
2. Check key prefixes: `pk_test_` for publishable, `sk_test_` for secret
3. Restart development server after changing env vars
4. Clear Next.js cache:
   ```bash
   rm -rf .next
   pnpm run dev
   ```

#### MongoDB Connection Failed (Messaging Service)

**Problem**: `MongoServerError: Authentication failed`

**Solutions**:
1. Check MongoDB is running:
   ```bash
   # macOS
   brew services list | grep mongodb
   
   # Windows - check Services
   ```
2. For MongoDB Atlas:
   - Whitelist your IP address
   - Verify database user credentials
   - Check connection string format

#### Elasticsearch Not Connecting (Search Service)

**Problem**: `ConnectionError: ECONNREFUSED`

**Solutions**:
1. Start Elasticsearch:
   ```bash
   cd apps/search-service
   docker-compose up -d
   ```
2. Verify Elasticsearch is running:
   ```bash
   curl http://localhost:9200
   ```
3. Check logs:
   ```bash
   docker logs search-elasticsearch
   ```

#### Build Errors

**Problem**: Type errors or build failures

**Solutions**:
1. Clean install:
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```
2. Clean Turborepo cache:
   ```bash
   pnpm run clean:cache
   ```
3. Type check:
   ```bash
   pnpm run check-types
   ```

#### Test Failures

**Problem**: Tests failing after changes

**Solutions**:
1. Update test snapshots:
   ```bash
   cd apps/client
   npm test -- -u
   ```
2. Clear test cache:
   ```bash
   rm -rf node_modules/.vitest
   ```
3. Run specific test:
   ```bash
   npm test __tests__/api/professionals/route.test.ts
   ```

### Performance Issues

#### Slow Development Server

**Solutions**:
1. Use selective dev commands:
   ```bash
   pnpm run dev:client  # Only client app
   ```
2. See [README-SPEEDUP.md](./README-SPEEDUP.md) for optimization tips

#### Slow Database Queries

**Solutions**:
1. Apply performance indexes:
   ```bash
   cd packages/db
   npx prisma migrate deploy
   ```
2. Use Prisma Studio to inspect queries:
   ```bash
   npx prisma studio
   ```
3. Enable query logging in development

### Getting Help

1. **Check Documentation**:
   - [QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md)
   - [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
   - [ARCHITECTURE.md](./ARCHITECTURE.md)

2. **Check Service READMEs**:
   - [Messaging Service](apps/messaging-service/README.md)
   - [Search Service](apps/search-service/README.md)

3. **Review Test Files**: Test files show usage examples

4. **Check Issues**: Search existing issues or create a new one

## 📊 Project Stats

- **Languages**: TypeScript 100%
- **Lines of Code**: 50,000+ (estimated)
- **Monorepo Structure**: 13 apps + 7 shared packages
- **Frontend**: Next.js 15, React 19, Tailwind CSS 4
- **Backend**: 8 microservices + Next.js API Routes
- **Database**: PostgreSQL + MongoDB + Redis + Elasticsearch
- **Auth**: Clerk (OAuth, email/password, MFA)
- **Testing**: Vitest, 90%+ coverage on critical paths
- **API Routes**: 15+ secured endpoints with rate limiting
- **Deployment**: Vercel-ready frontend, Docker-ready services
- **Performance**: 50-80% faster queries with optimized indexes
- **Real-time**: WebSocket messaging with Socket.io
- **Search**: Elasticsearch with Redis caching
- **Payment**: Stripe integration
- **Monorepo Tool**: Turborepo 2.x with remote caching

## 🤝 Contributing

We welcome contributions to Build Market! Please follow these guidelines:

### Getting Started

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/build-market.git
   cd build-market
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Development Guidelines

#### Code Style

- **TypeScript**: Use strict mode, avoid `any` types
- **Formatting**: Prettier is configured (runs on save)
- **Linting**: ESLint rules enforced
- **Naming**:
  - Components: PascalCase (`UserProfile.tsx`)
  - Functions: camelCase (`getUserData()`)
  - Constants: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
  - Files: kebab-case for non-components (`api-response.ts`)

#### Writing Tests

**Required for all new features**:

```typescript
// Example test structure
describe('Feature Name', () => {
  it('should handle happy path', async () => {
    // Arrange
    const input = { ... };
    
    // Act
    const result = await yourFunction(input);
    
    // Assert
    expect(result).toEqual(expectedOutput);
  });

  it('should handle error case', async () => {
    // Test error scenarios
  });
});
```

**Test Coverage Requirements**:
- New API routes: 90%+ coverage
- Repositories: 85%+ coverage
- Utilities: 100% coverage

Run tests before committing:
```bash
cd apps/client
npm test
npm run test:coverage
```

#### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Features
git commit -m "feat(client): add user profile page"
git commit -m "feat(api): implement rate limiting"

# Bug fixes
git commit -m "fix(auth): resolve token expiration issue"

# Documentation
git commit -m "docs: update API documentation"

# Refactoring
git commit -m "refactor(db): optimize query performance"

# Tests
git commit -m "test(api): add tests for professionals endpoint"

# Chores
git commit -m "chore(deps): update dependencies"
```

#### Pull Request Process

1. **Update documentation** for user-facing changes
2. **Add tests** for new functionality
3. **Run linter and tests**:
   ```bash
   pnpm run lint
   pnpm run check-types
   cd apps/client && npm test
   ```
4. **Update CHANGELOG** (if applicable)
5. **Submit PR** with clear description:
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - Tested locally
   - Added unit tests
   - Updated integration tests

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] Tests passing
   ```

### Project-Specific Guidelines

#### Adding a New API Route

1. Create route file in `apps/client/app/api/`
2. Apply middleware: `withAuth`, `withValidation`, rate limiting
3. Use repository pattern for data access
4. Add comprehensive tests
5. Update API documentation

#### Adding a New Service

1. Create service directory in `apps/`
2. Add `package.json` with proper dependencies
3. Configure TypeScript and ESLint
4. Add health check endpoint
5. Document environment variables
6. Create service-specific README
7. Add to Turborepo config

#### Database Changes

1. Update Prisma schema: `packages/db/prisma/schema.prisma`
2. Create migration:
   ```bash
   cd packages/db
   npx prisma migrate dev --name your_migration_name
   ```
3. Update seed data if needed
4. Consider adding indexes for performance
5. Update TypeScript types

### Code Review Checklist

Reviewers will check:
- [ ] Code quality and readability
- [ ] Test coverage and quality
- [ ] Performance implications
- [ ] Security considerations
- [ ] Documentation completeness
- [ ] Breaking changes noted
- [ ] Database migrations safe
- [ ] Environment variables documented

### Areas Needing Contribution

#### High Priority
- [ ] Mobile responsiveness improvements
- [ ] Accessibility (WCAG 2.1 AA compliance)
- [ ] Performance optimizations
- [ ] Integration tests
- [ ] End-to-end tests with Playwright

#### Medium Priority
- [ ] GraphQL API layer
- [ ] Advanced search filters
- [ ] Real-time notifications UI
- [ ] Analytics dashboard
- [ ] Admin panel enhancements

#### Low Priority
- [ ] Internationalization (i18n)
- [ ] Dark mode improvements
- [ ] Progressive Web App features
- [ ] Voice search
- [ ] AI-powered recommendations

### Resources for Contributors

- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **API Implementation**: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **Quick Start**: [QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md)
- **Turborepo Docs**: [turborepo.com/docs](https://turborepo.com/docs)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)
- **Prisma Docs**: [prisma.io/docs](https://www.prisma.io/docs)

### Questions?

- Check existing documentation first
- Search closed issues for similar questions
- Open a discussion for general questions
- Open an issue for bugs or feature requests

Thank you for contributing to Build Market! 🎉

## 📄 License

This project is private and proprietary.

## 🙏 Acknowledgments

Built with amazing open-source technologies:
- [Next.js](https://nextjs.org/) - React framework
- [Turborepo](https://turborepo.com/) - Monorepo tool
- [Prisma](https://www.prisma.io/) - Database ORM
- [Clerk](https://clerk.com/) - Authentication
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Vitest](https://vitest.dev/) - Testing framework
- [Socket.io](https://socket.io/) - Real-time communication
- [Elasticsearch](https://www.elastic.co/) - Search engine
- [Stripe](https://stripe.com/) - Payment processing

Special thanks to all contributors and the open-source community! ❤️

## Useful Links

### Turborepo Documentation
- [Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.com/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.com/docs/reference/configuration)
- [CLI Usage](https://turborepo.com/docs/reference/command-line-reference)

### Technology Stack
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Vitest Documentation](https://vitest.dev/)
- [Tailwind CSS](https://tailwindcss.com/docs)
