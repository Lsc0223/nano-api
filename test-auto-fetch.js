// Test script to verify auto-fetch models feature
// This is a simple test to ensure the config loads properly

async function test() {
  console.log('Testing auto-fetch models feature...\n');
  
  // Set up test environment variables
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
  // Don't set OPENAI_MODELS - should auto-fetch
  
  process.env.LOG_LEVEL = 'DEBUG';
  
  try {
    // Import the config module
    const configModule = await import('./src/utils/config.ts');
    const config = configModule.default;
    
    console.log('Config loaded successfully');
    
    // Wait for initialization
    await config.waitForInit();
    console.log('Config initialized');
    
    // Get providers
    const providers = await config.getProviders();
    console.log(`\nFound ${providers.length} provider(s):`);
    providers.forEach(p => {
      console.log(`- ${p.name}: ${p.models.length} models`);
      console.log(`  Models: ${p.models.slice(0, 5).join(', ')}${p.models.length > 5 ? '...' : ''}`);
    });
    
    console.log('\n✓ Test passed!');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
