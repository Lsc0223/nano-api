import { CooldownEntry } from '../types';
import config from '../utils/config';
import logger from '../utils/logger';

export class CooldownManager {
  private cooldowns: Map<string, number> = new Map();

  addToCooldown(channelName: string) {
    const cooldownTime = config.getCooldownTime();
    const cooldownUntil = Date.now() + cooldownTime;
    
    this.cooldowns.set(channelName, cooldownUntil);
    logger.info(`Channel ${channelName} added to cooldown until ${new Date(cooldownUntil).toISOString()}`);
  }

  isInCooldown(channelName: string): boolean {
    const cooldownUntil = this.cooldowns.get(channelName);
    if (!cooldownUntil) return false;

    const now = Date.now();
    if (now >= cooldownUntil) {
      this.cooldowns.delete(channelName);
      logger.info(`Channel ${channelName} cooldown expired`);
      return false;
    }

    return true;
  }

  getCooldownInfo(channelName: string): CooldownEntry | null {
    const cooldownUntil = this.cooldowns.get(channelName);
    if (!cooldownUntil) return null;

    return {
      channelName,
      cooldownUntil,
    };
  }

  removeCooldown(channelName: string) {
    this.cooldowns.delete(channelName);
    logger.info(`Channel ${channelName} removed from cooldown`);
  }

  getActiveCooldowns(): CooldownEntry[] {
    const now = Date.now();
    const active: CooldownEntry[] = [];

    for (const [channelName, cooldownUntil] of this.cooldowns.entries()) {
      if (now < cooldownUntil) {
        active.push({ channelName, cooldownUntil });
      } else {
        this.cooldowns.delete(channelName);
      }
    }

    return active;
  }

  cleanup() {
    const now = Date.now();
    for (const [channelName, cooldownUntil] of this.cooldowns.entries()) {
      if (now >= cooldownUntil) {
        this.cooldowns.delete(channelName);
      }
    }
  }
}

export default new CooldownManager();
