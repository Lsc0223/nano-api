import { ProviderConfig } from '../types';
import { BaseProvider } from './base';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';

export function createProvider(config: ProviderConfig): BaseProvider {
  switch (config.type) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'groq':
      return new OpenAIProvider({
        ...config,
        baseUrl: config.baseUrl || 'https://api.groq.com/openai/v1',
      });
    case 'openrouter':
      return new OpenAIProvider({
        ...config,
        baseUrl: config.baseUrl || 'https://openrouter.ai/api/v1',
      });
    case '302ai':
      return new OpenAIProvider({
        ...config,
        baseUrl: config.baseUrl || 'https://api.302.ai/v1',
      });
    case 'xai':
      return new OpenAIProvider({
        ...config,
        baseUrl: config.baseUrl || 'https://api.x.ai/v1',
      });
    case 'cloudflare':
      return new OpenAIProvider({
        ...config,
        baseUrl: config.baseUrl || `https://api.cloudflare.com/client/v4/accounts/${config.projectId}/ai/v1`,
      });
    case 'azure':
      return new OpenAIProvider({
        ...config,
        baseUrl: config.baseUrl,
      });
    case 'cohere':
    case 'aws':
    case 'vertex':
    default:
      return new OpenAIProvider(config);
  }
}

export * from './base';
export * from './openai';
export * from './anthropic';
export * from './gemini';
