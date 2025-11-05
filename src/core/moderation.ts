import { ModerationRequest, ModerationResponse, ChatMessage } from '../types';
import config from '../utils/config';
import logger from '../utils/logger';

export class ModerationManager {
  async moderateContent(messages: ChatMessage[]): Promise<{ flagged: boolean; reason?: string }> {
    if (!config.getModerationEnabled()) {
      return { flagged: false };
    }

    const apiKey = config.getModerationApiKey();
    if (!apiKey) {
      logger.warn('Moderation enabled but no API key configured');
      return { flagged: false };
    }

    try {
      const textContent = messages
        .map(m => {
          if (typeof m.content === 'string') {
            return m.content;
          } else if (Array.isArray(m.content)) {
            return m.content
              .filter(part => part.type === 'text')
              .map(part => part.text)
              .join(' ');
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');

      if (!textContent.trim()) {
        return { flagged: false };
      }

      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: textContent,
        }),
      });

      if (!response.ok) {
        logger.error(`Moderation API error: ${response.status}`);
        return { flagged: false };
      }

      const data = await response.json() as ModerationResponse;
      
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        if (result.flagged) {
          const categories = Object.entries(result.categories)
            .filter(([_, flagged]) => flagged)
            .map(([category]) => category);
          
          logger.warn(`Content flagged by moderation: ${categories.join(', ')}`);
          return {
            flagged: true,
            reason: `Content violates policy: ${categories.join(', ')}`,
          };
        }
      }

      return { flagged: false };
    } catch (error) {
      logger.error('Moderation check failed:', error);
      return { flagged: false };
    }
  }

  async moderateText(text: string): Promise<{ flagged: boolean; reason?: string }> {
    if (!config.getModerationEnabled()) {
      return { flagged: false };
    }

    const apiKey = config.getModerationApiKey();
    if (!apiKey) {
      return { flagged: false };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: text,
        }),
      });

      if (!response.ok) {
        logger.error(`Moderation API error: ${response.status}`);
        return { flagged: false };
      }

      const data = await response.json() as ModerationResponse;
      
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        if (result.flagged) {
          const categories = Object.entries(result.categories)
            .filter(([_, flagged]) => flagged)
            .map(([category]) => category);
          
          return {
            flagged: true,
            reason: `Content violates policy: ${categories.join(', ')}`,
          };
        }
      }

      return { flagged: false };
    } catch (error) {
      logger.error('Moderation check failed:', error);
      return { flagged: false };
    }
  }
}

export default new ModerationManager();
