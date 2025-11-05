import { ProviderConfig } from '../types';
import config from '../utils/config';
import cooldownManager from './cooldown';
import logger from '../utils/logger';

export class LoadBalancer {
  private counters: Map<string, number> = new Map();

  async selectProvider(model: string): Promise<ProviderConfig | null> {
    const providers = await config.getProvidersForModel(model);
    
    if (providers.length === 0) {
      logger.error(`No providers available for model: ${model}`);
      return null;
    }

    const availableProviders = providers.filter(p => {
      const isInCooldown = cooldownManager.isInCooldown(p.name);
      if (isInCooldown) {
        logger.debug(`Provider ${p.name} is in cooldown, skipping`);
      }
      return !isInCooldown;
    });

    if (availableProviders.length === 0) {
      logger.warn(`All providers for model ${model} are in cooldown`);
      return providers[0];
    }

    const selected = this.weightedRandomSelection(availableProviders);
    logger.info(`Selected provider: ${selected.name} for model: ${model}`);
    return selected;
  }

  private weightedRandomSelection(providers: ProviderConfig[]): ProviderConfig {
    const totalWeight = providers.reduce((sum, p) => sum + (p.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const provider of providers) {
      random -= provider.weight || 1;
      if (random <= 0) {
        return provider;
      }
    }

    return providers[providers.length - 1];
  }

  async selectNextProvider(model: string, excludeProviders: string[]): Promise<ProviderConfig | null> {
    const providers = await config.getProvidersForModel(model);
    
    const availableProviders = providers.filter(p => {
      if (excludeProviders.includes(p.name)) return false;
      return !cooldownManager.isInCooldown(p.name);
    });

    if (availableProviders.length === 0) {
      logger.warn(`No more providers available for retry for model: ${model}`);
      return null;
    }

    const selected = this.weightedRandomSelection(availableProviders);
    logger.info(`Selected next provider for retry: ${selected.name}`);
    return selected;
  }

  async getAllProvidersForModel(model: string): Promise<ProviderConfig[]> {
    return await config.getProvidersForModel(model);
  }
}

export default new LoadBalancer();
