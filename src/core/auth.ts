import config from '../utils/config';
import logger from '../utils/logger';

export class AuthManager {
  validateApiKey(authHeader: string | undefined): string | null {
    if (!authHeader) {
      logger.warn('Missing authorization header');
      return null;
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      logger.warn('Invalid authorization header format');
      return null;
    }

    const apiKey = match[1];
    const keyConfig = config.getApiKeyConfig(apiKey);

    if (!keyConfig) {
      logger.warn('Invalid API key');
      return null;
    }

    return apiKey;
  }

  validateModelAccess(apiKey: string, model: string): boolean {
    const allowed = config.isModelAllowedForApiKey(apiKey, model);
    if (!allowed) {
      logger.warn(`API key does not have access to model: ${model}`);
    }
    return allowed;
  }
}

export default new AuthManager();
