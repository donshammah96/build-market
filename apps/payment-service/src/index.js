import { clerkMiddleware } from '@hono/clerk-auth';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { shouldBeUser } from './middleware/authMiddleware.js';
const app = new Hono();
app.use('*', clerkMiddleware());
app.get('/', (c) => {
    return c.text('Payment service is running on port 8002');
});
app.get('/test', shouldBeUser, (c) => {
    return c.json({
        message: 'Payment service authenticated!', userId: c.get('userId')
    });
});
app.get("/health", (c) => {
    return c.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: Date.now()
    });
});
const start = async () => {
    try {
        serve({
            fetch: app.fetch,
            port: 8002
        }, (info) => {
            console.log(`Payment service is running on http://localhost:${info.port}`);
        });
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
};
start();
