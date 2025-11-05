import { VercelRequest, VercelResponse } from '@vercel/node';
import authManager from '../../src/core/auth';
import rateLimiter from '../../src/core/ratelimit';
import config from '../../src/utils/config';
import logger from '../../src/utils/logger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({
      error: {
        message: 'Method not allowed. Use GET to list models.',
        type: 'invalid_request_error',
      },
    });
  }

  try {
    logger.debug(`Received ${req.method} request to /v1/models`);

    const apiKey = authManager.validateApiKey(req.headers.authorization);
    
    // If API key is provided, validate rate limit
    if (apiKey) {
      logger.debug(`Validating rate limit for API key: ${apiKey.substring(0, 8)}...`);
      const canProceed = await rateLimiter.checkRateLimit(apiKey);
      if (!canProceed) {
        logger.warn(`Rate limit exceeded for API key: ${apiKey.substring(0, 8)}...`);
        return res.status(429).json({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error',
          },
        });
      }
    } else {
      logger.debug('No API key provided - allowing unauthenticated access for dialog tools');
    }

    logger.debug('Fetching available models from providers');

    const providers = await config.getProviders();
    if (!providers || providers.length === 0) {
      logger.warn('No providers configured');
      return res.status(200).json({
        object: 'list',
        data: [],
      });
    }

    const modelsSet = new Set<string>();

    for (const provider of providers) {
      if (!provider.models || provider.models.length === 0) {
        logger.debug(`Provider ${provider.name} has no models`);
        continue;
      }

      for (const model of provider.models) {
        // If no API key, return all models; otherwise only return accessible models
        if (!apiKey || authManager.validateModelAccess(apiKey, model)) {
          modelsSet.add(model);
        }
      }
    }

    logger.debug(`Found ${modelsSet.size} models available`);

    const models = Array.from(modelsSet)
      .sort()
      .map(modelId => ({
        id: modelId,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'unified-api',
        permission: [
          {
            id: `modelperm-${Date.now()}`,
            object: 'model_permission',
            created: Math.floor(Date.now() / 1000),
            allow_create_engine: false,
            allow_sampling: true,
            allow_logprobs: true,
            allow_search_indices: false,
            allow_view: true,
            allow_fine_tuning: false,
            organization: '*',
            group_id: null,
            is_blocking: false,
          },
        ],
      }));

    // Only add rate limit headers if API key was provided
    if (apiKey) {
      const rateLimitInfo = rateLimiter.getRateLimitInfo(apiKey);
      res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit.toString());
      res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.floor(rateLimitInfo.reset / 1000).toString());
    }

    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    logger.info(`Returning ${models.length} models to client`);
    return res.status(200).json({
      object: 'list',
      data: models,
    });
  } catch (error: any) {
    logger.error('Models endpoint error:', error);

    return res.status(500).json({
      error: {
        message: 'Internal server error while fetching models',
        type: 'internal_error',
      },
    });
  }
}
