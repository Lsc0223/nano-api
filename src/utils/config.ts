import { ProviderConfig, ApiKeyConfig, ProviderType } from '../types';
import { BaseProvider } from '../providers/base';
import logger from './logger';

export class Config {
  private static instance: Config;
  private providers: ProviderConfig[] = [];
  private apiKeys: Map<string, ApiKeyConfig> = new Map();
  private initPromise: Promise<void> | null = null;

  private constructor() {
    this.initPromise = this.loadConfig();
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private async loadConfig() {
    await this.loadProviders();
    this.loadApiKeys();
  }

  private async loadProviders() {
    const providerTypes: ProviderType[] = [
      'openai', 'anthropic', 'gemini', 'vertex', 'azure', 
      'aws', 'xai', 'cohere', 'groq', 'cloudflare', 'openrouter', '302ai'
    ];

    const providerPromises: Promise<void>[] = [];

    providerTypes.forEach(type => {
      const envPrefix = type.toUpperCase().replace(/\./g, '_');
      const apiKey = process.env[`${envPrefix}_API_KEY`];
      
      if (apiKey) {
        providerPromises.push(this.loadProviderConfig(type, envPrefix, apiKey, null));
      }

      let index = 1;
      while (true) {
        const apiKey = process.env[`${envPrefix}_${index}_API_KEY`];
        if (!apiKey) break;

        providerPromises.push(this.loadProviderConfig(type, envPrefix, apiKey, index));
        index++;
      }
    });

    await Promise.all(providerPromises);
  }

  private async loadProviderConfig(
    type: ProviderType,
    envPrefix: string,
    apiKey: string,
    index: number | null
  ) {
    const suffix = index ? `_${index}` : '';
    const name = index ? `${type}-${index}` : `${type}-default`;
    
    const modelsStr = process.env[`${envPrefix}${suffix}_MODELS`] || '';
    let models = modelsStr.split(',').map(m => m.trim()).filter(Boolean);
    
    const baseUrl = process.env[`${envPrefix}${suffix}_BASE_URL`];
    const region = process.env[`${envPrefix}${suffix}_REGION`];
    const projectId = process.env[`${envPrefix}${suffix}_PROJECT_ID`];
    
    // Auto-fetch models if not specified but API key and baseUrl are provided
    if (models.length === 0 && (baseUrl || this.hasDefaultEndpoint(type))) {
      logger.info(`Auto-fetching models for ${name}...`);
      try {
        const fetchedModels = await BaseProvider.fetchAvailableModels(
          type,
          apiKey,
          baseUrl,
          { region, projectId }
        );
        
        if (fetchedModels.length > 0) {
          models = fetchedModels;
          logger.info(`Successfully fetched ${fetchedModels.length} models for ${name}`);
        } else {
          logger.warn(`No models found for ${name}, provider will be skipped`);
        }
      } catch (error) {
        logger.error(`Failed to auto-fetch models for ${name}:`, error);
      }
    }
    
    // Only add provider if it has models
    if (models.length > 0) {
      const config: ProviderConfig = {
        name,
        type,
        apiKey,
        baseUrl,
        models,
        weight: parseInt(process.env[`${envPrefix}${suffix}_WEIGHT`] || '1'),
        enabled: process.env[`${envPrefix}${suffix}_ENABLED`] !== 'false',
        timeout: parseInt(process.env[`${envPrefix}${suffix}_TIMEOUT`] || '120000'),
        region,
        projectId,
      };
      this.providers.push(config);
    }
  }

  private hasDefaultEndpoint(type: ProviderType): boolean {
    const typesWithDefaults = [
      'openai', 'anthropic', 'gemini', 'groq', 
      'openrouter', '302ai', 'xai', 'cohere'
    ];
    return typesWithDefaults.includes(type);
  }

  private loadApiKeys() {
    const apiKeysStr = process.env.API_KEYS || '';
    const keys = apiKeysStr.split(',').map(k => k.trim()).filter(Boolean);

    keys.forEach((key, index) => {
      const allowedModelsStr = process.env[`API_KEY_${index + 1}_MODELS`] || '*';
      const allowedModels = allowedModelsStr.split(',').map(m => m.trim()).filter(Boolean);
      const rateLimit = process.env[`API_KEY_${index + 1}_RATE_LIMIT`] || '60/min';

      this.apiKeys.set(key, {
        key,
        allowedModels,
        rateLimit,
      });
    });

    if (this.apiKeys.size === 0) {
      const defaultKey = process.env.DEFAULT_API_KEY || 'default-key';
      this.apiKeys.set(defaultKey, {
        key: defaultKey,
        allowedModels: ['*'],
        rateLimit: '60/min',
      });
    }
  }

  async getProviders(): Promise<ProviderConfig[]> {
    await this.waitForInit();
    return this.providers.filter(p => p.enabled !== false);
  }

  async getProvidersForModel(model: string): Promise<ProviderConfig[]> {
    await this.waitForInit();
    return this.providers.filter(p => {
      if (p.enabled === false) return false;
      return p.models.some(m => this.matchModel(model, m));
    });
  }

  private matchModel(model: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === model) return true;
    
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(model);
  }

  getApiKeyConfig(apiKey: string): ApiKeyConfig | undefined {
    return this.apiKeys.get(apiKey);
  }

  isModelAllowedForApiKey(apiKey: string, model: string): boolean {
    const config = this.apiKeys.get(apiKey);
    if (!config) return false;

    return config.allowedModels.some(pattern => this.matchModel(model, pattern));
  }

  async getTimeoutForModel(model: string): Promise<number> {
    const modelTimeout = process.env[`MODEL_${model.toUpperCase().replace(/-/g, '_')}_TIMEOUT`];
    if (modelTimeout) {
      return parseInt(modelTimeout);
    }

    const providers = await this.getProvidersForModel(model);
    if (providers.length > 0 && providers[0].timeout) {
      return providers[0].timeout;
    }

    return parseInt(process.env.DEFAULT_TIMEOUT || '120000');
  }

  getCooldownTime(): number {
    return parseInt(process.env.COOLDOWN_TIME || '300000');
  }

  getMaxRetries(): number {
    return parseInt(process.env.MAX_RETRIES || '3');
  }

  getModerationEnabled(): boolean {
    return process.env.MODERATION_ENABLED === 'true';
  }

  getModerationApiKey(): string | undefined {
    return process.env.OPENAI_MODERATION_API_KEY || process.env.OPENAI_API_KEY;
  }
}

export default Config.getInstance();
