import {
  ProviderConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  AudioTranscriptionRequest,
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
