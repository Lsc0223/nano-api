class AnthropicProvider {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.apiBaseUrl = 'https://api.anthropic.com/v1';
        this.models = config.models;
        this.key = `anthropic:${this.models.join(',')}`;
    }

    async createChatCompletion(body) {
        // Transformation logic from OpenAI format to Anthropic format will go here
        throw new Error('Anthropic provider not yet implemented.');
    }
}

module.exports = AnthropicProvider;
