/*
  Quick script to check which HuggingFace API keys still have credits
*/

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');

async function testKey(keyIndex, apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return { keyIndex, status: 'not_set', message: 'Key not configured' };
  }

  try {
    const response = await axios.post(
      'https://router.huggingface.co/v1/chat/completions',
      {
        model: 'meta-llama/Llama-3.1-8B-Instruct:sambanova',
        messages: [
          { role: 'user', content: 'Say "test"' }
        ],
        max_tokens: 10,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return { 
      keyIndex, 
      status: 'working', 
      message: 'Key has credits available',
      keyPreview: `${apiKey.substring(0, 10)}...`
    };
  } catch (error) {
    const status = error.response?.status;
    const errorMsg = error.response?.data?.error || error.message;
    
    if (status === 402 || (errorMsg && errorMsg.includes('exceeded your monthly included credits'))) {
      return { 
        keyIndex, 
        status: 'limit_exceeded', 
        message: 'Monthly limit exceeded',
        keyPreview: `${apiKey.substring(0, 10)}...`
      };
    } else if (status === 401) {
      return { 
        keyIndex, 
        status: 'invalid', 
        message: 'Invalid API key',
        keyPreview: `${apiKey.substring(0, 10)}...`
      };
    } else {
      return { 
        keyIndex, 
        status: 'error', 
        message: errorMsg || `HTTP ${status}`,
        keyPreview: `${apiKey.substring(0, 10)}...`
      };
    }
  }
}

async function main() {
  console.log('Checking HuggingFace API keys...\n');
  
  const results = [];
  for (let i = 1; i <= 6; i++) {
    const key = process.env[`HUGGINGFACE_API_KEY${i}`];
    console.log(`Testing HUGGINGFACE_API_KEY${i}...`);
    const result = await testKey(i, key);
    results.push(result);
    
    const statusIcon = result.status === 'working' ? '✅' : 
                      result.status === 'limit_exceeded' ? '❌' : 
                      result.status === 'not_set' ? '⚪' : '⚠️';
    console.log(`  ${statusIcon} ${result.message}\n`);
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n=== Summary ===');
  const working = results.filter(r => r.status === 'working');
  const exceeded = results.filter(r => r.status === 'limit_exceeded');
  const notSet = results.filter(r => r.status === 'not_set');
  
  console.log(`✅ Working keys: ${working.length}`);
  console.log(`❌ Limit exceeded: ${exceeded.length}`);
  console.log(`⚪ Not set: ${notSet.length}`);
  
  if (working.length === 0 && exceeded.length > 0) {
    console.log('\n⚠️  WARNING: All configured keys have exceeded their limits!');
    console.log('   Consider using Gemini API (GEMINI_API_KEY) as fallback.');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
