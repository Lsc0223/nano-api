const { request } = require('undici');

class OpenAIProvider {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.apiBaseUrl = config.apiBaseUrl || 'https://api.openai.com/v1';
        this.models = config.models;
        this.key = `${this.apiBaseUrl}:${this.models.join(',')}`;
    }

    async createChatCompletion(body) {
        const { 'max_tokens': maxTokens, temperature, stream, model, messages } = body;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        };

        const payload = {
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            stream,
        };

        const { body: responseBody, statusCode } = await request(`${this.apiBaseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        if (statusCode !== 200) {
            const errorBody = await responseBody.json();
            throw new Error(`OpenAI API error (${statusCode}): ${errorBody.error.message}`);
        }
        
        return responseBody.json();
    }
}

module.exports = OpenAIProvider;
