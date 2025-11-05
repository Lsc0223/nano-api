export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string | Array<ContentPart>;
  name?: string;
  function_call?: any;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: any;
  };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
  response_format?: { type: 'text' | 'json_object' };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ImageGenerationRequest {
  model?: string;
  prompt: string;
  n?: number;
  size?: string;
  quality?: string;
  style?: string;
  response_format?: string;
  user?: string;
}

export interface ImageGenerationResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

export interface AudioTranscriptionRequest {
  file: any;
  model: string;
  language?: string;
  prompt?: string;
  response_format?: string;
  temperature?: number;
}

export interface ModerationRequest {
  input: string | string[];
  model?: string;
}

export interface ModerationResponse {
  id: string;
  model: string;
  results: Array<{
    flagged: boolean;
    categories: Record<string, boolean>;
    category_scores: Record<string, number>;
  }>;
}

export interface ProviderConfig {
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl?: string;
  models: string[];
  weight?: number;
  enabled?: boolean;
  timeout?: number;
  region?: string;
  projectId?: string;
}

export type ProviderType = 
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'vertex'
  | 'azure'
  | 'aws'
  | 'xai'
  | 'cohere'
  | 'groq'
  | 'cloudflare'
  | 'openrouter'
  | '302ai';

export interface ApiKeyConfig {
  key: string;
  allowedModels: string[];
  rateLimit: string;
}

export interface CooldownEntry {
  channelName: string;
  cooldownUntil: number;
}

export interface RateLimitConfig {
  limit: number;
  window: number;
}

export interface RequestContext {
  apiKey: string;
  requestId: string;
  startTime: number;
  model: string;
  provider?: string;
}

export interface ProviderResponse {
  response: any;
  provider: string;
  model: string;
  cached?: boolean;
}

export interface ErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
    param?: string;
  };
}
