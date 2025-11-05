import { ProviderConfig, ApiKeyConfig, ProviderType } from '../types';

export class Config {
  private static instance: Config;
  private providers: ProviderConfig[] = [];
  private apiKeys: Map<string, ApiKeyConfig> = new Map();

  private constructor() {
    this.loadConfig();
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private loadConfig() {
    this.loadProviders();
    this.loadApiKeys();
  }

  private loadProviders() {
    const providerTypes: ProviderType[] = [
      'openai', 'anthropic', 'gemini', 'vertex', 'azure', 
      'aws', 'xai', 'cohere', 'groq', 'cloudflare', 'openrouter', '302ai'
    ];

    providerTypes.forEach(type => {
      const envPrefix = type.toUpperCase().replace(/\./g, '_');
      const apiKey = process.env[`${envPrefix}_API_KEY`];
      
      if (apiKey) {
        const modelsStr = process.env[`${envPrefix}_MODELS`] || '';
        const models = modelsStr.split(',').map(m => m.trim()).filter(Boolean);
        
        if (models.length > 0) {
          const config: ProviderConfig = {
            name: `${type}-default`,
            type,
            apiKey,
            baseUrl: process.env[`${envPrefix}_BASE_URL`],
            models,
            weight: parseInt(process.env[`${envPrefix}_WEIGHT`] || '1'),
            enabled: process.env[`${envPrefix}_ENABLED`] !== 'false',
            timeout: parseInt(process.env[`${envPrefix}_TIMEOUT`] || '120000'),
            region: process.env[`${envPrefix}_REGION`],
            projectId: process.env[`${envPrefix}_PROJECT_ID`],
          };
          this.providers.push(config);
        }
      }

      let index = 1;
      while (true) {
        const apiKey = process.env[`${envPrefix}_${index}_API_KEY`];
        if (!apiKey) break;

        const modelsStr = process.env[`${envPrefix}_${index}_MODELS`] || '';
        const models = modelsStr.split(',').map(m => m.trim()).filter(Boolean);

        if (models.length > 0) {
          const config: ProviderConfig = {
            name: `${type}-${index}`,
            type,
            apiKey,
            baseUrl: process.env[`${envPrefix}_${index}_BASE_URL`],
            models,
            weight: parseInt(process.env[`${envPrefix}_${index}_WEIGHT`] || '1'),
            enabled: process.env[`${envPrefix}_${index}_ENABLED`] !== 'false',
            timeout: parseInt(process.env[`${envPrefix}_${index}_TIMEOUT`] || '120000'),
            region: process.env[`${envPrefix}_${index}_REGION`],
            projectId: process.env[`${envPrefix}_${index}_PROJECT_ID`],
          };
          this.providers.push(config);
        }

        index++;
      }
    });
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

  getProviders(): ProviderConfig[] {
    return this.providers.filter(p => p.enabled !== false);
  }

  getProvidersForModel(model: string): ProviderConfig[] {
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

  getTimeoutForModel(model: string): number {
    const modelTimeout = process.env[`MODEL_${model.toUpperCase().replace(/-/g, '_')}_TIMEOUT`];
    if (modelTimeout) {
      return parseInt(modelTimeout);
    }

    const providers = this.getProvidersForModel(model);
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
