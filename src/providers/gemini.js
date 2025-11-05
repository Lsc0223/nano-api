class GeminiProvider {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.apiBaseUrl = 'https-//generativelanguage.googleapis.com/v1beta';
        this.models = config.models;
        this.key = `gemini:${this.models.join(',')}`;
    }

    async createChatCompletion(body) {
        // Transformation logic from OpenAI format to Gemini format will go here
        throw new Error('Gemini provider not yet implemented.');
    }
}

module.exports = GeminiProvider;
