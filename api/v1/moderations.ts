import { VercelRequest, VercelResponse } from '@vercel/node';
import authManager from '../../src/core/auth';
import rateLimiter from '../../src/core/ratelimit';
import config from '../../src/utils/config';
import logger from '../../src/utils/logger';
import { ModerationRequest, ModerationResponse } from '../../src/types';

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

    const request: ModerationRequest = req.body;

    if (!request.input) {
      return res.status(400).json({
        error: {
          message: 'Input is required',
          type: 'invalid_request_error',
        },
      });
    }

    const moderationApiKey = config.getModerationApiKey();
    if (!moderationApiKey) {
      return res.status(500).json({
        error: {
          message: 'Moderation service not configured',
          type: 'internal_error',
        },
      });
    }

    logger.info('Processing moderation request');

    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${moderationApiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw error;
    }

    const data = await response.json() as ModerationResponse;

    const rateLimitInfo = rateLimiter.getRateLimitInfo(apiKey);
    res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.floor(rateLimitInfo.reset / 1000).toString());

    return res.status(200).json(data);
  } catch (error: any) {
    logger.error('Moderation error:', error);

    return res.status(500).json({
      error: {
        message: error.error?.message || 'Internal server error',
        type: error.error?.type || 'internal_error',
      },
    });
  }
}
