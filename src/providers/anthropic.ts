import { BaseProvider } from './base';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  ContentPart,
} from '../types';

export class AnthropicProvider extends BaseProvider {
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.anthropic.com/v1';
    const timeout = this.config.timeout || 120000;

    try {
      const { messages, system } = this.convertMessages(request.messages);
      
      const anthropicRequest: any = {
        model: request.model,
        messages,
        max_tokens: request.max_tokens || 4096,
        temperature: request.temperature,
        top_p: request.top_p,
        stop_sequences: Array.isArray(request.stop) ? request.stop : request.stop ? [request.stop] : undefined,
      };

      if (system) {
        anthropicRequest.system = system;
      }

      if (request.tools && request.tools.length > 0) {
        anthropicRequest.tools = request.tools.map(tool => ({
          name: tool.function.name,
          description: tool.function.description,
          input_schema: tool.function.parameters,
        }));
      }

      const response = await this.fetchWithTimeout(
        `${baseUrl}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(anthropicRequest),
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

  private convertMessages(messages: ChatMessage[]): { messages: any[]; system?: string } {
    let system: string | undefined;
    const convertedMessages: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = typeof msg.content === 'string' ? msg.content : '';
        continue;
      }

      const anthropicMsg: any = {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: [],
      };

      if (typeof msg.content === 'string') {
        anthropicMsg.content = msg.content;
      } else if (Array.isArray(msg.content)) {
        anthropicMsg.content = msg.content.map((part: ContentPart) => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text };
          } else if (part.type === 'image_url') {
            const imageUrl = part.image_url?.url || '';
            if (imageUrl.startsWith('data:')) {
              const match = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
              if (match) {
                return {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: `image/${match[1]}`,
                    data: match[2],
                  },
                };
              }
            } else {
              return {
                type: 'image',
                source: {
                  type: 'url',
                  url: imageUrl,
                },
              };
            }
          }
          return part;
        });
      }

      if (msg.tool_calls) {
        anthropicMsg.content = msg.tool_calls.map(tc => ({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        }));
      }

      if (msg.tool_call_id) {
        anthropicMsg.content = [
          {
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: msg.content,
          },
        ];
      }

      convertedMessages.push(anthropicMsg);
    }

    return { messages: convertedMessages, system };
  }

  private convertResponse(anthropicResponse: any, model: string): ChatCompletionResponse {
    const content = anthropicResponse.content[0];
    
    let messageContent: string = '';
    let toolCalls: any[] | undefined;

    if (content.type === 'text') {
      messageContent = content.text;
    } else if (content.type === 'tool_use') {
      toolCalls = anthropicResponse.content
        .filter((c: any) => c.type === 'tool_use')
        .map((c: any) => ({
          id: c.id,
          type: 'function',
          function: {
            name: c.name,
            arguments: JSON.stringify(c.input),
          },
        }));
    }

    return {
      id: anthropicResponse.id,
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
          finish_reason: anthropicResponse.stop_reason === 'end_turn' ? 'stop' : anthropicResponse.stop_reason,
        },
      ],
      usage: {
        prompt_tokens: anthropicResponse.usage.input_tokens,
        completion_tokens: anthropicResponse.usage.output_tokens,
        total_tokens: anthropicResponse.usage.input_tokens + anthropicResponse.usage.output_tokens,
      },
    };
  }
}
