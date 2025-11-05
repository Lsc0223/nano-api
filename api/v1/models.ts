import { VercelRequest, VercelResponse } from '@vercel/node';
import authManager from '../../src/core/auth';
import rateLimiter from '../../src/core/ratelimit';
import config from '../../src/utils/config';
import logger from '../../src/utils/logger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method not allowed', type: 'invalid_request_error' } });
  }

  try {
    const apiKey = authManager.validateApiKey(req.headers.authorization);
    if (!apiKey) {
      return res.status(401).json({ error: { message: 'Invalid API key', type: 'invalid_request_error' } });
    }

    const canProceed = await rateLimiter.checkRateLimit(apiKey);
    if (!canProceed) {
      return res.status(429).json({
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
        },
      });
    }

    logger.info('Fetching available models');

    const providers = await config.getProviders();
    const modelsSet = new Set<string>();

    for (const provider of providers) {
      provider.models.forEach(model => {
        if (authManager.validateModelAccess(apiKey, model)) {
          modelsSet.add(model);
        }
      });
    }

    const models = Array.from(modelsSet).map(modelId => ({
      id: modelId,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'unified-api',
    }));

    const rateLimitInfo = rateLimiter.getRateLimitInfo(apiKey);
    res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.floor(rateLimitInfo.reset / 1000).toString());

    return res.status(200).json({
      object: 'list',
      data: models,
    });
  } catch (error: any) {
    logger.error('Models list error:', error);

    return res.status(500).json({
      error: {
        message: 'Internal server error',
        type: 'internal_error',
      },
    });
  }
}
