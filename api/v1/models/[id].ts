import { VercelRequest, VercelResponse } from '@vercel/node';
import authManager from '../../../src/core/auth';
import rateLimiter from '../../../src/core/ratelimit';
import config from '../../../src/utils/config';
import logger from '../../../src/utils/logger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: {
        message: 'Method not allowed. Use GET to retrieve model details.',
        type: 'invalid_request_error',
      },
    });
  }

  try {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: {
          message: 'Model ID is required',
          type: 'invalid_request_error',
        },
      });
    }

    logger.debug(`Received GET request for model: ${id}`);

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

    logger.debug(`Fetching model information for: ${id}`);

    // Check if API key has access to this model (if API key is provided)
    if (apiKey) {
      const hasAccess = authManager.validateModelAccess(apiKey, id);
      if (!hasAccess) {
        logger.warn(`API key does not have access to model: ${id}`);
        return res.status(403).json({
          error: {
            message: `You do not have access to model: ${id}`,
            type: 'permission_error',
          },
        });
      }
    }

    // Verify model exists in any provider
    const providers = await config.getProviders();
    let modelFound = false;
    for (const provider of providers) {
      if (provider.models.includes(id)) {
        modelFound = true;
        break;
      }
    }

    if (!modelFound) {
      logger.warn(`Model not found: ${id}`);
      return res.status(404).json({
        error: {
          message: `Model not found: ${id}`,
          type: 'invalid_request_error',
        },
      });
    }

    // Only add rate limit headers if API key was provided
    if (apiKey) {
      const rateLimitInfo = rateLimiter.getRateLimitInfo(apiKey);
      res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit.toString());
      res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.floor(rateLimitInfo.reset / 1000).toString());
    }

    logger.info(`Returning details for model: ${id}`);
    return res.status(200).json({
      id,
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
      root: id,
      parent: null,
    });
  } catch (error: any) {
    logger.error('Model detail endpoint error:', error);

    return res.status(500).json({
      error: {
        message: 'Internal server error while fetching model details',
        type: 'internal_error',
      },
    });
  }
}
