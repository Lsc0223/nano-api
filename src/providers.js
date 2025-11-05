const OpenAIProvider = require('./openai');
// Import other providers here as they are created
// const AnthropicProvider = require('./anthropic');
// const GeminiProvider = require('./gemini');

function createProviders() {
    const providers = [];

    // Configure OpenAI providers from environment variables
    const openaiApiKeys = process.env.OPENAI_API_KEYS ? process.env.OPENAI_API_KEYS.split(',') : [];
    if (openaiApiKeys.length > 0) {
        openaiApiKeys.forEach(key => {
            const [apiKey, ...models] = key.split(':');
            if(apiKey && models.length > 0) {
                 providers.push(new OpenAIProvider({ apiKey, models, apiBaseUrl: process.env.OPENAI_API_BASE_URL }));
            }
        });
    }
    
    // Configure Deepseek providers (uses OpenAI format)
    const deepseekApiKeys = process.env.DEEPSEEK_API_KEYS ? process.env.DEEPSEEK_API_KEYS.split(',') : [];
    if (deepseekApiKeys.length > 0) {
        deepseekApiKeys.forEach(key => {
            const [apiKey, ...models] = key.split(':');
            if(apiKey && models.length > 0) {
                providers.push(new OpenAIProvider({ apiKey, models, apiBaseUrl: 'https://api.deepseek.com/v1' }));
            }
        });
    }
    
    // Configure OpenRouter providers (uses OpenAI format)
    const openRouterApiKeys = process.env.OPENROUTER_API_KEYS ? process.env.OPENROUTER_API_KEYS.split(',') : [];
    if (openRouterApiKeys.length > 0) {
        openRouterApiKeys.forEach(key => {
            const [apiKey, ...models] = key.split(':');
            if(apiKey && models.length > 0) {
                providers.push(new OpenAIProvider({ apiKey, models, apiBaseUrl: 'https://openrouter.ai/api/v1' }));
            }
        });
    }

    // Configure other providers...

    return providers;
}


module.exports = {
    createProviders,
};
