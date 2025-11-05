const providers = require('./providers');

const providerInstances = providers.createProviders();
const modelToProviders = {};
const providerCooldown = new Map(); // Map<providerKey, cooldownUntilTimestamp>
const providerStats = new Map(); // Map<providerKey, { lastFailure: timestamp, failures: count }>

const COOLDOWN_PERIOD_MS = process.env.COOLDOWN_PERIOD_MS || 5 * 60 * 1000; // 5 minutes

// Initialize model to provider mapping
for (const provider of providerInstances) {
    for (const model of provider.models) {
        if (!modelToProviders[model]) {
            modelToProviders[model] = [];
        }
        modelToProviders[model].push(provider);
    }
}


function getNextProvider(model) {
    const availableProviders = modelToProviders[model] || [];
    const now = Date.now();

    const activeProviders = availableProviders.filter(p => {
        const cooldownUntil = providerCooldown.get(p.key);
        return !cooldownUntil || now > cooldownUntil;
    });

    if (activeProviders.length === 0) {
        return null;
    }

    // Simple round-robin for now
    const provider = activeProviders.shift();
    activeProviders.push(provider);
    modelToProviders[model] = availableProviders; // maintain original order for next request

    return provider;
}

function handleProviderFailure(provider) {
    const now = Date.now();
    providerCooldown.set(provider.key, now + COOLDOWN_PERIOD_MS);
    
    const stats = providerStats.get(provider.key) || { failures: 0 };
    stats.failures++;
    stats.lastFailure = now;
    providerStats.set(provider.key, stats);

    console.log(`Provider ${provider.key} failed and is on cooldown for ${COOLDOWN_PERIOD_MS / 1000}s`);
}

module.exports = {
    getNextProvider,
    handleProviderFailure,
};
