import Fastify from "fastify";
import { clerkClient, clerkPlugin, getAuth } from '@clerk/fastify'

const fastify = Fastify({
    logger: true,
});

fastify.register(clerkPlugin)

fastify.get('/', async (request, reply) => {
    return reply.send({ message: "Order service is running on port 8001" });
});

fastify.get('/test', async (request, reply) => {
    try {
      const { isAuthenticated, userId } = getAuth(request)
  
      if (!isAuthenticated) {
        return reply.code(401).send({ error: 'User not authenticated' })
      }

      const user = await clerkClient.users.getUser(userId)
  
      return reply.send({
        message: 'User retrieved successfully',
        user,
      })
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({ error: 'Failed to retrieve user' })
    }
  })
  

fastify.get("/health", async (request, reply) => {
    return reply.status(200).send({
        status: "ok",
        uptime: process.uptime(),
        timestamp: Date.now()
    });
});

const start = async () => {
    try {
        await fastify.listen({ port: 8001})
        console.log("Order service is running on port 8001");
        console.log("Health check: http://localhost:8001/health");
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();