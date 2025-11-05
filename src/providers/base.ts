import {
  ProviderConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  AudioTranscriptionRequest,
  ProviderType,
} from '../types';
import logger from '../utils/logger';

export abstract class BaseProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  
  async imageGeneration(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    throw new Error('Image generation not supported by this provider');
  }

  async audioTranscription(request: AudioTranscriptionRequest): Promise<any> {
    throw new Error('Audio transcription not supported by this provider');
  }

  /**
   * Static method to fetch available models from a provider
   * Used when MODELS env var is not set but API_KEY and BASE_URL are provided
   */
  static async fetchAvailableModels(
    type: ProviderType,
    apiKey: string,
    baseUrl?: string,
    options?: { region?: string; projectId?: string }
  ): Promise<string[]> {
    try {
      // OpenAI-compatible providers (use /v1/models endpoint)
      const openaiCompatible = ['openai', 'groq', 'openrouter', '302ai', 'xai', 'azure'];
      
      if (openaiCompatible.includes(type)) {
        const url = baseUrl ? `${baseUrl}/models` : this.getDefaultBaseUrl(type) + '/models';
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          logger.warn(`Failed to fetch models for ${type}: ${response.status} ${response.statusText}`);
          return [];
        }

        const data: any = await response.json();
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((model: any) => model.id).filter(Boolean);
        }
      }

      // Anthropic - doesn't have a models endpoint, return common models
      if (type === 'anthropic') {
        logger.info('Anthropic does not have a models API endpoint, using predefined model list');
        return [
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
        ];
      }

      // Gemini
      if (type === 'gemini') {
        const url = baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
        const response = await fetch(`${url}/models?key=${apiKey}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          logger.warn(`Failed to fetch models for Gemini: ${response.status} ${response.statusText}`);
          return [];
        }

        const data: any = await response.json();
        if (data.models && Array.isArray(data.models)) {
          return data.models
            .filter((model: any) => model.supportedGenerationMethods?.includes('generateContent'))
            .map((model: any) => model.name.replace('models/', ''))
            .filter(Boolean);
        }
      }

      // Cloudflare Workers AI
      if (type === 'cloudflare' && options?.projectId) {
        const url = `https://api.cloudflare.com/client/v4/accounts/${options.projectId}/ai/models/search`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          logger.warn(`Failed to fetch models for Cloudflare: ${response.status} ${response.statusText}`);
          return [];
        }

        const data: any = await response.json();
        if (data.result && Array.isArray(data.result)) {
          return data.result.map((model: any) => model.name).filter(Boolean);
        }
      }

      // Cohere
      if (type === 'cohere') {
        const url = baseUrl || 'https://api.cohere.ai/v1';
        const response = await fetch(`${url}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          logger.warn(`Failed to fetch models for Cohere: ${response.status} ${response.statusText}`);
          return [];
        }

        const data: any = await response.json();
        if (data.models && Array.isArray(data.models)) {
          return data.models.map((model: any) => model.name).filter(Boolean);
        }
      }

      // For AWS Bedrock and Vertex AI, return empty array as they require more complex setup
      if (type === 'aws' || type === 'vertex') {
        logger.info(`${type} requires manual model configuration`);
        return [];
      }

      return [];
    } catch (error) {
      logger.error(`Error fetching models for ${type}:`, error);
      return [];
    }
  }

  private static getDefaultBaseUrl(type: ProviderType): string {
    const urls: Record<string, string> = {
      'openai': 'https://api.openai.com/v1',
      'groq': 'https://api.groq.com/openai/v1',
      'openrouter': 'https://openrouter.ai/api/v1',
      '302ai': 'https://api.302.ai/v1',
      'xai': 'https://api.x.ai/v1',
    };
    return urls[type] || '';
  }

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  protected handleError(error: any): never {
    logger.error(`Provider ${this.config.name} error:`, error);
    
    if (error.message?.includes('timeout')) {
      throw {
        error: {
          message: 'Request timeout',
          type: 'timeout_error',
          code: 'timeout',
        },
      };
    }

    if (error.response) {
      throw {
        error: {
          message: error.response.data?.error?.message || error.message,
          type: error.response.data?.error?.type || 'api_error',
          code: error.response.status,
        },
      };
    }

    throw {
      error: {
        message: error.message || 'Unknown error',
        type: 'provider_error',
      },
    };
  }
}
