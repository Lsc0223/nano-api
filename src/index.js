require('dotenv').config();
const fastify = require('fastify')({ logger: true });

const providers = require('./providers');
const loadBalancer = require('./loadBalancer');

// Unified API endpoint
fastify.post('/v1/chat/completions', async (request, reply) => {
  try {
    const provider = loadBalancer.getNextProvider(request.body.model);
    if (!provider) {
      return reply.status(500).send({ error: 'No available providers for the requested model.' });
    }

    const response = await provider.createChatCompletion(request.body);
    return reply.send(response);
  } catch (error) {
    fastify.log.error(error);
    // Retry logic will be handled by the load balancer/provider manager
    return reply.status(500).send({ error: 'An error occurred while processing your request.' });
  }
});

// Other OpenAI compatible endpoints (placeholders)
fastify.post('/v1/images/generations', async (request, reply) => {
  reply.status(501).send({ error: 'Not Implemented' });
});
fastify.post('/v1/audio/transcriptions', async (request, reply) => {
    reply.status(501).send({ error: 'Not Implemented' });
});
fastify.post('/v1/moderations', async (request, reply) => {
    reply.status(501).send({ error: 'Not Implemented' });
});
fastify.get('/v1/models', async (request, reply) => {
    reply.status(501).send({ error: 'Not Implemented' });
});


const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
