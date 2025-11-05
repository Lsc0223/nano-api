import { BaseProvider } from './base';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  ContentPart,
} from '../types';

export class GeminiProvider extends BaseProvider {
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const baseUrl = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const timeout = this.config.timeout || 120000;

    try {
      const { contents, systemInstruction } = this.convertMessages(request.messages);
      
      const geminiRequest: any = {
        contents,
        generationConfig: {
          temperature: request.temperature,
          topP: request.top_p,
          maxOutputTokens: request.max_tokens,
          stopSequences: Array.isArray(request.stop) ? request.stop : request.stop ? [request.stop] : undefined,
        },
      };

      if (systemInstruction) {
        geminiRequest.systemInstruction = systemInstruction;
      }

      if (request.tools && request.tools.length > 0) {
        geminiRequest.tools = [{
          functionDeclarations: request.tools.map(tool => ({
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters,
          })),
        }];
      }

      const response = await this.fetchWithTimeout(
        `${baseUrl}/models/${request.model}:generateContent?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(geminiRequest),
        },
        timeout
      );

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      const data = await response.json();
      return this.convertResponse(data, request.model);
    } catch (error) {
      return this.handleError(error);
    }
  }

  private convertMessages(messages: ChatMessage[]): { contents: any[]; systemInstruction?: any } {
    let systemInstruction: any;
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = {
          parts: [{ text: typeof msg.content === 'string' ? msg.content : '' }],
        };
        continue;
      }

      const geminiMsg: any = {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [],
      };

      if (typeof msg.content === 'string') {
        geminiMsg.parts.push({ text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text') {
            geminiMsg.parts.push({ text: part.text });
          } else if (part.type === 'image_url') {
            const imageUrl = part.image_url?.url || '';
            if (imageUrl.startsWith('data:')) {
              const match = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
              if (match) {
                geminiMsg.parts.push({
                  inlineData: {
                    mimeType: `image/${match[1]}`,
                    data: match[2],
                  },
                });
              }
            }
          }
        }
      }

      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          geminiMsg.parts.push({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments),
            },
          });
        }
      }

      if (msg.tool_call_id) {
        geminiMsg.parts.push({
          functionResponse: {
            name: msg.name,
            response: typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content,
          },
        });
      }

      contents.push(geminiMsg);
    }

    return { contents, systemInstruction };
  }

  private convertResponse(geminiResponse: any, model: string): ChatCompletionResponse {
    const candidate = geminiResponse.candidates?.[0];
    if (!candidate) {
      throw new Error('No candidate in Gemini response');
    }

    const parts = candidate.content.parts;
    let messageContent = '';
    let toolCalls: any[] | undefined;

    for (const part of parts) {
      if (part.text) {
        messageContent += part.text;
      } else if (part.functionCall) {
        if (!toolCalls) toolCalls = [];
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args),
          },
        });
      }
    }

    const finishReasonMap: Record<string, string> = {
      STOP: 'stop',
      MAX_TOKENS: 'length',
      SAFETY: 'content_filter',
      RECITATION: 'content_filter',
      OTHER: 'stop',
    };

    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: messageContent,
            tool_calls: toolCalls,
          },
          finish_reason: finishReasonMap[candidate.finishReason] || 'stop',
        },
      ],
      usage: {
        prompt_tokens: geminiResponse.usageMetadata?.promptTokenCount || 0,
        completion_tokens: geminiResponse.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: geminiResponse.usageMetadata?.totalTokenCount || 0,
      },
    };
  }
}
