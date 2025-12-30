const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

class ApiKeyManager {
  constructor() {
    this.currentKeyIndex = 1;
    this.maxKeys = 7;
    this.keyPrefix = 'HUGGINGFACE_API_KEY';
    this.validateKeys();
  }

  validateKeys() {
    // Check if we have at least one valid key
    const hasValidKey = Array.from({ length: this.maxKeys }).some((_, i) => {
      const key = process.env[`${this.keyPrefix}${i + 1}`];
      return key && key.trim().length > 0;
    });

    if (!hasValidKey) {
      throw new Error('No valid Huggingface API keys found in environment variables');
    }
  }

  getCurrentKey() {
    return process.env[`${this.keyPrefix}${this.currentKeyIndex}`];
  }

  rotateKey() {
    const initialIndex = this.currentKeyIndex;
    let attempts = 0;

    // Try to find the next valid key
    while (attempts < this.maxKeys) {
      this.currentKeyIndex = (this.currentKeyIndex % this.maxKeys) + 1;
      const newKey = this.getCurrentKey();
      
      if (newKey && newKey.trim().length > 0) {
        console.log(`Rotating to API key ${this.currentKeyIndex}`);
        return newKey;
      }

      attempts++;
      // If we've come back to the initial key, all keys have been tried
      if (this.currentKeyIndex === initialIndex) {
        break;
      }
    }
    
    throw new Error('All API keys have been exhausted. Please check your API key credits.');
  }

  isCreditsExceededError(error) {
    // Check multiple error message patterns that might indicate exceeded credits
    const errorText = error.message || 
                     error.response?.data?.error || 
                     (typeof error.response?.data === 'string' ? error.response.data : '') ||
                     '';
    
    const patterns = [
      'exceeded your monthly included credits',
      'reached the free monthly usage limit',
      'monthly usage limit',
      'usage limit',
      'Payment Required',
      '402'
    ];
    
    return patterns.some(pattern => 
      errorText.toLowerCase().includes(pattern.toLowerCase()) ||
      error.response?.status === 402
    );
  }

  async executeWithKeyRotation(operation) {
    const maxAttempts = this.maxKeys;
    let attempts = 0;
    let lastError = null;
    
    while (attempts < maxAttempts) {
      try {
        const currentKey = this.getCurrentKey();
        if (!currentKey || currentKey.trim().length === 0) {
          this.rotateKey();
          continue;
        }

        return await operation(currentKey);
      } catch (error) {
        attempts++;
        lastError = error;
        
        // Check for credits exceeded error
        if (this.isCreditsExceededError(error)) {
          console.log(`API key ${this.currentKeyIndex} has exceeded credits. Rotating to next key...`);
          try {
            this.rotateKey();
            continue; // Try with the next key
          } catch (rotationError) {
            throw new Error('All API keys have been exhausted. Please check your API key credits.');
          }
        }
        
        // If error is not related to credits, throw it
        throw error;
      }
    }
    
    // If we've tried all keys and still have errors
    if (lastError) {
      if (this.isCreditsExceededError(lastError)) {
        throw new Error('All API keys have been exhausted. Please check your API key credits.');
      }
      throw lastError;
    }
    
    throw new Error('Failed to execute operation with any available API key.');
  }
}

// Export a singleton instance
module.exports = new ApiKeyManager(); 