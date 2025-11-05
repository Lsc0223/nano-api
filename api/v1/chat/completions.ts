import { VercelRequest, VercelResponse } from '@vercel/node';
import authManager from '../../../src/core/auth';
import rateLimiter from '../../../src/core/ratelimit';
import moderationManager from '../../../src/core/moderation';
import retryManager from '../../../src/core/retry';
import logger from '../../../src/utils/logger';
import { ChatCompletionRequest } from '../../../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
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

    const request: ChatCompletionRequest = req.body;

    if (!request.model) {
      return res.status(400).json({
        error: {
          message: 'Model is required',
          type: 'invalid_request_error',
        },
      });
    }

    if (!request.messages || !Array.isArray(request.messages)) {
      return res.status(400).json({
        error: {
          message: 'Messages are required and must be an array',
          type: 'invalid_request_error',
        },
      });
    }

    const hasAccess = authManager.validateModelAccess(apiKey, request.model);
    if (!hasAccess) {
      return res.status(403).json({
        error: {
          message: 'You do not have access to this model',
          type: 'permission_error',
        },
      });
    }

    const moderationResult = await moderationManager.moderateContent(request.messages);
    if (moderationResult.flagged) {
      return res.status(400).json({
        error: {
          message: moderationResult.reason || 'Content violates usage policy',
          type: 'content_policy_violation',
        },
      });
    }

    logger.info(`Processing chat completion request for model: ${request.model}`);

    const response = await retryManager.executeWithRetry(request, 'chat');

    const rateLimitInfo = rateLimiter.getRateLimitInfo(apiKey);
    res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.floor(rateLimitInfo.reset / 1000).toString());

    return res.status(200).json(response);
  } catch (error: any) {
    logger.error('Chat completion error:', error);

    const statusCode = error.error?.code || 500;
    return res.status(typeof statusCode === 'number' ? statusCode : 500).json({
      error: {
        message: error.error?.message || 'Internal server error',
        type: error.error?.type || 'internal_error',
      },
    });
  }
}
