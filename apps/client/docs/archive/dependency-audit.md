# apps/client Dependency Audit

This document captures package hygiene classification used for the server-package extraction.

## Runtime Classification

### Browser-Only

- `react`, `react-dom`, `@tanstack/react-query`, `next-themes`
- UI packages (`@radix-ui/*`, `lucide-react`, `framer-motion`, `recharts`, `sonner`, etc.)
- form/client packages (`react-hook-form`, `@hookform/resolvers`)

### Server-Only

- auth: `next-auth`
- mail: `resend`
- queue/infra: `bullmq`, `ioredis`
- storage/media: `@aws-sdk/*`, `sharp`

### Shared

- `next`, `zod`, `date-fns`, `nanoid`, `lru-cache`
- workspace libs: `@build/db`, `@build/types`, `@build/enums`, `@build/resilience`

### Dead / Candidate Removal from apps/client

- `@clerk/express`
- `express`
- `nodemailer`
- `bcrypt`
- `better-auth`
- `@react-email/render`
- `radix-ui`
- `@ngrok/ngrok`
- duplicate/misaligned declarations moved to correct scopes

## Extraction Targets

- `@build/auth-server` for auth helpers/contracts (`password-hash`, `session-claims`, role helpers)
- `@build/messaging-server` for messaging domain facade
- `@build/mail-server` for mail adapter (`sendEmail`)
- `@build/queue-server` for queue primitives and queue contracts
