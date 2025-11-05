import { ChatCompletionRequest, ChatCompletionResponse, ProviderConfig } from '../types';
import { BaseProvider } from '../providers/base';
import { OpenAIProvider } from '../providers/openai';
import { AnthropicProvider } from '../providers/anthropic';
import { GeminiProvider } from '../providers/gemini';
import loadBalancer from './loadbalancer';
import cooldownManager from './cooldown';
import config from '../utils/config';
import logger from '../utils/logger';

export class RetryManager {
  async executeWithRetry(
    request: ChatCompletionRequest,
    operation: 'chat' | 'image' | 'audio'
  ): Promise<ChatCompletionResponse> {
    const maxRetries = config.getMaxRetries();
    const triedProviders: string[] = [];
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const provider = attempt === 0
          ? loadBalancer.selectProvider(request.model)
          : loadBalancer.selectNextProvider(request.model, triedProviders);

        if (!provider) {
          if (attempt === 0) {
            throw new Error(`No provider available for model: ${request.model}`);
          }
          break;
        }

        triedProviders.push(provider.name);
        logger.info(`Attempt ${attempt + 1}/${maxRetries + 1} using provider: ${provider.name}`);

        const providerInstance = this.createProviderInstance(provider);
        const timeout = config.getTimeoutForModel(request.model);

        const result = await Promise.race([
          this.executeOperation(providerInstance, operation, request),
          this.createTimeoutPromise(timeout),
        ]);

        logger.info(`Request succeeded with provider: ${provider.name}`);
        return result;
      } catch (error: any) {
        lastError = error;
        const providerName = triedProviders[triedProviders.length - 1];
        
        logger.error(
          `Attempt ${attempt + 1} failed with provider ${providerName}:`,
          error.error?.message || error.message
        );

        if (this.isRetriableError(error)) {
          cooldownManager.addToCooldown(providerName);
          
          if (attempt < maxRetries) {
            continue;
          }
        } else {
          throw error;
        }
      }
    }

    logger.error(`All retry attempts exhausted for model: ${request.model}`);
    throw lastError || new Error('All retry attempts failed');
  }

  private createProviderInstance(config: ProviderConfig): BaseProvider {
    switch (config.type) {
      case 'openai':
      case 'groq':
      case 'openrouter':
      case '302ai':
        return new OpenAIProvider(config);
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'gemini':
        return new GeminiProvider(config);
      default:
        return new OpenAIProvider(config);
    }
  }

  private async executeOperation(
    provider: BaseProvider,
    operation: 'chat' | 'image' | 'audio',
    request: any
  ): Promise<any> {
    switch (operation) {
      case 'chat':
        return await provider.chatCompletion(request);
      case 'image':
        return await provider.imageGeneration(request);
      case 'audio':
        return await provider.audioTranscription(request);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject({
          error: {
            message: `Request timeout after ${timeout}ms`,
            type: 'timeout_error',
            code: 'timeout',
          },
        });
      }, timeout);
    });
  }

  private isRetriableError(error: any): boolean {
    const errorType = error.error?.type || '';
    const errorCode = error.error?.code || '';
    const errorMessage = error.error?.message || '';

    const retriableTypes = [
      'timeout_error',
      'api_error',
      'server_error',
      'rate_limit_error',
    ];

    const retriableCodes = [429, 500, 502, 503, 504];

    if (retriableTypes.includes(errorType)) {
      return true;
    }

    if (typeof errorCode === 'number' && retriableCodes.includes(errorCode)) {
      return true;
    }

    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('overloaded') ||
      errorMessage.includes('rate limit')
    ) {
      return true;
    }

    return false;
  }
}

export default new RetryManager();
