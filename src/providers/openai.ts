import { BaseProvider } from './base';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  AudioTranscriptionRequest,
} from '../types';

export class OpenAIProvider extends BaseProvider {
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const timeout = this.config.timeout || 120000;

    try {
      const response = await this.fetchWithTimeout(
        `${baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(request),
        },
        timeout
      );

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      return await response.json() as ChatCompletionResponse;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async imageGeneration(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const timeout = this.config.timeout || 120000;

    try {
      const response = await this.fetchWithTimeout(
        `${baseUrl}/images/generations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: request.model || 'dall-e-3',
            prompt: request.prompt,
            n: request.n,
            size: request.size,
            quality: request.quality,
            style: request.style,
            response_format: request.response_format,
            user: request.user,
          }),
        },
        timeout
      );

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      return await response.json() as ImageGenerationResponse;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async audioTranscription(request: AudioTranscriptionRequest): Promise<any> {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const timeout = this.config.timeout || 120000;

    try {
      const formData = new FormData();
      formData.append('file', request.file);
      formData.append('model', request.model);
      if (request.language) formData.append('language', request.language);
      if (request.prompt) formData.append('prompt', request.prompt);
      if (request.response_format) formData.append('response_format', request.response_format);
      if (request.temperature !== undefined) {
        formData.append('temperature', request.temperature.toString());
      }

      const response = await this.fetchWithTimeout(
        `${baseUrl}/audio/transcriptions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: formData,
        },
        timeout
      );

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      return await response.json();
    } catch (error) {
      return this.handleError(error);
    }
  }
}
