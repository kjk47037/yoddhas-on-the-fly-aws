const { HfInference } = require('@huggingface/inference');
const axios = require('axios');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const apiKeyManager = require('../utils/api-key-manager');

// Initialize HF client with first key and router endpoint
let hf = new HfInference(apiKeyManager.getCurrentKey(), {
  endpoint: 'https://router.huggingface.co'
});

class ContentService {
  async generateCompleteBrandKit(brandName, industry, personality) {
    try {
      console.log('Generating brand kit for:', { brandName, industry, personality });
      
      // Generate all components in parallel
      const [logo, colorPalette, fonts, brandTone, socialTemplates] = await Promise.all([
        this.generateLogo(brandName, industry, personality),
        this.generateColorPalette(industry, personality),
        this.generateFontPairings(personality),
        this.generateBrandTone(brandName, industry, personality),
        this.generateSocialTemplates(brandName)
      ]);

      const result = {
        logo,
        colorPalette,
        fonts,
        brandTone,
        socialTemplates,
        metadata: {
          brandName,
          industry,
          personality,
          generatedAt: new Date().toISOString()
        }
      };

      console.log('Generated brand kit:', result);
      return result;
    } catch (error) {
      console.error('Error in generateCompleteBrandKit:', error);
      throw new Error('Failed to generate complete brand kit');
    }
  }

  async generateLogo(brandName, industry, personality) {
    try {
      const prompt = `Create a modern, minimalist logo for ${brandName}, a ${industry} company with a ${personality} personality. The logo should be simple, memorable, and professional. Vector style, clean design, suitable for business use.`;
      
      console.log('Generating logo with prompt:', prompt);
      
      // Use the generateImage method to create actual logo
      const logoResult = await this.generateImage(prompt);
      return logoResult.imageData;
    } catch (error) {
      console.error('Error generating logo:', error);
      // Fallback to placeholder if image generation fails
      return 'https://via.placeholder.com/400x200?text=Logo+Error';
    }
  }

  async generateColorPalette(industry, personality) {
    try {
      // Default color palettes based on personality
      const colorPalettes = {
        Professional: ['#2C3E50', '#34495E', '#7F8C8D', '#BDC3C7', '#ECF0F1'],
        Friendly: ['#3498DB', '#2980B9', '#5DADE2', '#AED6F1', '#EBF5FB'],
        Innovative: ['#9B59B6', '#8E44AD', '#BB8FCE', '#D7BDE2', '#F4ECF7'],
        Luxurious: ['#2C3E50', '#C0392B', '#E74C3C', '#F1948A', '#FADBD8'],
        Playful: ['#F1C40F', '#F39C12', '#F9E79F', '#FCF3CF', '#FEF9E7'],
        Serious: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6', '#BDC3C7'],
        Modern: ['#16A085', '#1ABC9C', '#48C9B0', '#A3E4D7', '#D1F2EB'],
        Traditional: ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#F5DEB3'],
        Bold: ['#C0392B', '#E74C3C', '#F1948A', '#F5B7B1', '#FADBD8'],
        Minimalist: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6', '#BDC3C7']
      };

      return colorPalettes[personality] || colorPalettes.Professional;
    } catch (error) {
      console.error('Error generating color palette:', error);
      return ['#2C3E50', '#34495E', '#7F8C8D', '#BDC3C7', '#ECF0F1'];
    }
  }

  async generateFontPairings(personality) {
    try {
      // Default font pairings based on personality
      const fontPairings = {
        Professional: [
          { primary: 'Roboto', secondary: 'Open Sans' },
          { primary: 'Montserrat', secondary: 'Lato' },
          { primary: 'Poppins', secondary: 'Inter' }
        ],
        Friendly: [
          { primary: 'Quicksand', secondary: 'Nunito' },
          { primary: 'Comfortaa', secondary: 'Varela Round' },
          { primary: 'Mukta', secondary: 'Work Sans' }
        ],
        Innovative: [
          { primary: 'Space Grotesk', secondary: 'DM Sans' },
          { primary: 'Outfit', secondary: 'Plus Jakarta Sans' },
          { primary: 'Sora', secondary: 'Inter' }
        ],
        Luxurious: [
          { primary: 'Playfair Display', secondary: 'Raleway' },
          { primary: 'Cormorant', secondary: 'Montserrat' },
          { primary: 'Libre Baskerville', secondary: 'Source Sans Pro' }
        ],
        Playful: [
          { primary: 'Fredoka One', secondary: 'Nunito' },
          { primary: 'Bubblegum Sans', secondary: 'Comfortaa' },
          { primary: 'Baloo 2', secondary: 'Quicksand' }
        ],
        Serious: [
          { primary: 'IBM Plex Sans', secondary: 'Inter' },
          { primary: 'Source Sans Pro', secondary: 'Open Sans' },
          { primary: 'Roboto', secondary: 'Lato' }
        ],
        Modern: [
          { primary: 'Space Grotesk', secondary: 'Inter' },
          { primary: 'Outfit', secondary: 'DM Sans' },
          { primary: 'Sora', secondary: 'Plus Jakarta Sans' }
        ],
        Traditional: [
          { primary: 'Merriweather', secondary: 'Source Sans Pro' },
          { primary: 'Playfair Display', secondary: 'Lato' },
          { primary: 'Libre Baskerville', secondary: 'Open Sans' }
        ],
        Bold: [
          { primary: 'Bebas Neue', secondary: 'Roboto' },
          { primary: 'Anton', secondary: 'Open Sans' },
          { primary: 'Oswald', secondary: 'Lato' }
        ],
        Minimalist: [
          { primary: 'Inter', secondary: 'Roboto' },
          { primary: 'DM Sans', secondary: 'Open Sans' },
          { primary: 'Plus Jakarta Sans', secondary: 'Lato' }
        ]
      };

      return fontPairings[personality] || fontPairings.Professional;
    } catch (error) {
      console.error('Error generating font pairings:', error);
      return [
        { primary: 'Roboto', secondary: 'Open Sans' },
        { primary: 'Montserrat', secondary: 'Lato' },
        { primary: 'Poppins', secondary: 'Inter' }
      ];
    }
  }

  async generateBrandTone(brandName, industry, personality) {
    try {
      // Default brand tones based on personality
      const brandTones = {
        Professional: 'Clear, authoritative, and trustworthy communication that builds confidence.',
        Friendly: 'Warm, approachable, and conversational tone that makes everyone feel welcome.',
        Innovative: 'Forward-thinking, dynamic, and cutting-edge communication that inspires.',
        Luxurious: 'Sophisticated, elegant, and premium messaging that conveys exclusivity.',
        Playful: 'Fun, energetic, and engaging tone that brings joy and excitement.',
        Serious: 'Focused, determined, and committed communication that shows dedication.',
        Modern: 'Contemporary, sleek, and progressive messaging that stays ahead of trends.',
        Traditional: 'Timeless, reliable, and established communication that honors heritage.',
        Bold: 'Confident, powerful, and impactful messaging that makes a statement.',
        Minimalist: 'Clean, simple, and focused communication that emphasizes clarity.'
      };

      return brandTones[personality] || brandTones.Professional;
    } catch (error) {
      console.error('Error generating brand tone:', error);
      return 'Professional and engaging communication style.';
    }
  }

  async generateSocialTemplates(brandName) {
    try {
      // Default social media templates
      return {
        instagram: [
          `📸 [Brand Update]\n\nExciting news from ${brandName}! Stay tuned for more updates.\n\n#${brandName.replace(/\s+/g, '')} #brandupdate`,
          `✨ [Product Feature]\n\nDiscover what makes ${brandName} special.\n\n#${brandName.replace(/\s+/g, '')} #productfeature`
        ],
        twitter: [
          `🚀 [News Update]\n\n${brandName} is making waves in the industry!\n\n#${brandName.replace(/\s+/g, '')} #news`,
          `💡 [Industry Insight]\n\nThoughts from ${brandName} on the latest trends.\n\n#${brandName.replace(/\s+/g, '')} #insight`
        ],
        linkedin: [
          `📊 [Industry Analysis]\n\n${brandName} shares insights on market trends.\n\n#${brandName.replace(/\s+/g, '')} #industry`,
          `🎯 [Company Update]\n\nLatest developments from ${brandName}.\n\n#${brandName.replace(/\s+/g, '')} #update`
        ]
      };
    } catch (error) {
      console.error('Error generating social templates:', error);
      return {
        instagram: ['Template 1', 'Template 2'],
        twitter: ['Template 1', 'Template 2'],
        linkedin: ['Template 1', 'Template 2']
      };
    }
  }

  async generateContent(prompt, contentType, platforms, performanceData = null) {
    try {
      let enhancedPrompt = prompt;
      let additionalInstructions = '';
      let postingTime = '';
      
      // If performance data is provided, enhance the prompt with this data
      if (performanceData) {
        console.log('Using performance data to enhance content generation:', performanceData);
        
        // Store posting time separately
        if (performanceData.topEngagementPeriod) {
          postingTime = performanceData.topEngagementPeriod;
        }
        
        // Add hashtag recommendations
        if (performanceData.recommendedHashtags && performanceData.recommendedHashtags.length > 0) {
          const hashtagSuggestions = performanceData.recommendedHashtags.map(tag => `#${tag}`).join(' ');
          additionalInstructions += `\nIncorporate some of these hashtags naturally: ${hashtagSuggestions}`;
        }
        
        // Add content length recommendation
        if (performanceData.optimalContentLength) {
          additionalInstructions += `\nKeep the content within ${performanceData.optimalContentLength}.`;
        }
        
        // Add success factors as guidance
        if (performanceData.successFactors && performanceData.successFactors.length > 0) {
          additionalInstructions += '\nIncorporate these elements naturally:';
          performanceData.successFactors.forEach(factor => {
            additionalInstructions += `\n- ${factor}`;
          });
        }
      }
      
      // Build final prompt with performance-based instructions if available
      const systemPrompt = "You are a social media content expert. Create engaging, natural-sounding content. Do not include any meta instructions or [brackets] in the output. Do not mention posting times in the content.";
      const userPrompt = `Write a ${contentType} post about: ${prompt}\n\nGuidelines:${additionalInstructions}`;

      // Use the key rotation system for the API call
      const response = await apiKeyManager.executeWithKeyRotation(async (apiKey) => {
        try {
          const result = await axios.post(
            'https://router.huggingface.co/v1/chat/completions',
            {
              model: 'meta-llama/Llama-3.1-8B-Instruct:sambanova',
              messages: [
                {
                  role: 'system',
                  content: systemPrompt
                },
                {
                  role: 'user',
                  content: userPrompt
                }
              ],
              max_tokens: 500,
              temperature: 0.7
            },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            }
          );
          return result;
        } catch (error) {
          // Check if the error response contains the credits exceeded message
          if (error.response?.data?.error && typeof error.response.data.error === 'string') {
            error.message = error.response.data.error;
          }
          throw error;
        }
      });

      let generatedContent = response.data.choices[0].message.content.trim();
      
      // Clean up the content
      generatedContent = generatedContent
        .replace(/\[.*?\]/g, '') // Remove any [bracketed] text
        .replace(/\(Post this.*?\)/g, '') // Remove posting time instructions
        .replace(/\n+/g, '\n') // Replace multiple newlines with single
        .trim();

      // Calculate content quality score
      const contentQualityScore = this.calculateContentQualityScore(
        generatedContent,
        performanceData
      );

      return {
        content: generatedContent,
        metadata: {
          generatedAt: new Date().toISOString(),
          performanceEnhanced: performanceData ? true : false,
          predictedScore: contentQualityScore,
          recommendedPostingTime: postingTime,
          usedPerformanceData: performanceData ? {
            recommendedHashtags: performanceData.recommendedHashtags || [],
            optimalContentLength: performanceData.optimalContentLength || '',
            successFactors: performanceData.successFactors || []
          } : null,
          model: 'meta-llama/Llama-3.1-8B-Instruct:sambanova',
          apiUsed: 'serverless-inference'
        }
      };
    } catch (error) {
      console.error('Error generating content:', error.response?.data || error.message);
      // Preserve the original error message for key rotation
      throw error;
    }
  }

  calculateContentQualityScore(content, performanceData) {
    // Default score if no performance data is available
    if (!performanceData) {
      return 65; // Base score without performance data
    }
    
    let score = 70; // Base score with performance data
    const cleanContent = content.trim();
    
    try {
      // Check word count alignment
      if (performanceData.optimalContentLength) {
        const contentWords = cleanContent.split(/\s+/).length;
        const optimalRange = performanceData.optimalContentLength.match(/(\d+)-(\d+)/);
        
        if (optimalRange && optimalRange.length >= 3) {
          const minWords = parseInt(optimalRange[1]);
          const maxWords = parseInt(optimalRange[2]);
          
          if (contentWords >= minWords && contentWords <= maxWords) {
            score += 10; // Perfect length match
          } else if (contentWords >= minWords * 0.8 && contentWords <= maxWords * 1.2) {
            score += 5; // Close to optimal length
          }
        }
      }
      
      // Check hashtag usage
      if (performanceData.recommendedHashtags && performanceData.recommendedHashtags.length > 0) {
        const hashtags = performanceData.recommendedHashtags;
        let hashtagMatches = 0;
        
        hashtags.forEach(hashtag => {
          if (cleanContent.includes(`#${hashtag}`) || cleanContent.includes(` ${hashtag} `)) {
            hashtagMatches++;
          }
        });
        
        // Score based on percentage of recommended hashtags used
        const hashtagPercentage = (hashtagMatches / hashtags.length) * 100;
        if (hashtagPercentage > 50) {
          score += 10;
        } else if (hashtagPercentage > 25) {
          score += 5;
        }
      }
      
      // Check for presence of success factors in content
      if (performanceData.successFactors && performanceData.successFactors.length > 0) {
        // Look for keywords from success factors
        const successKeywords = performanceData.successFactors
          .join(' ')
          .toLowerCase()
          .match(/\b\w+\b/g)
          .filter(word => word.length > 3); // Only meaningful words
        
        let keywordMatches = 0;
        if (successKeywords) {
          successKeywords.forEach(keyword => {
            if (cleanContent.toLowerCase().includes(keyword)) {
              keywordMatches++;
            }
          });
          
          // Score based on keyword matches
          const keywordPercentage = (keywordMatches / successKeywords.length) * 100;
          if (keywordPercentage > 40) {
            score += 10;
          } else if (keywordPercentage > 20) {
            score += 5;
          }
        }
      }
      
      // Check if content contains images (based on instructions about images)
      if (performanceData.successFactors && 
          performanceData.successFactors.some(factor => factor.toLowerCase().includes('image'))) {
        if (cleanContent.toLowerCase().includes('image') || 
            cleanContent.toLowerCase().includes('photo') ||
            cleanContent.toLowerCase().includes('picture')) {
          score += 5;
        }
      }
      
      // Ensure score is within reasonable bounds
      return Math.min(100, Math.max(0, score));
    } catch (error) {
      console.error('Error calculating content quality score:', error);
      return 65; // Return default score on error
    }
  }

  async generateImage(prompt) {
    try {
      console.log('Generating image for prompt:', prompt);
      
      // Generate an image using FLUX.1-dev model with key rotation via router endpoint
      const buffer = await apiKeyManager.executeWithKeyRotation(async (apiKey) => {
        // Use wavespeed provider with FLUX.1-schnell via router endpoint
        const response = await axios.post(
          'https://router.huggingface.co/wavespeed/api/v3/wavespeed-ai/flux-schnell',
          {
            prompt: prompt,
            parameters: {
              negative_prompt: "blurry, distorted, low quality, duplicate, watermark, text overlay",
              guidance_scale: 3.5,
              num_inference_steps: 4
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 60000
          }
        );
        
        // Wavespeed API returns async job - need to poll for results
        const responseData = response.data;
        
        // Check if it's the async job format: { code: 200, message: "success", data: { status: "created", id: "..." } }
        if (responseData && responseData.data && responseData.data.id) {
          const jobId = responseData.data.id;
          console.log(`Job created with ID: ${jobId}, polling for results...`);
          
          // Use router endpoint for polling (not the direct wavespeed API)
          const pollUrl = `https://router.huggingface.co/wavespeed/api/v3/predictions/${jobId}/result`;
          
          // Poll the result URL until job is complete
          const maxAttempts = 60; // 60 attempts
          const pollInterval = 2000; // 2 seconds between polls
          
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            
            try {
              // Poll using router endpoint with HuggingFace token
              const resultResponse = await axios.get(pollUrl, {
                headers: {
                  'Authorization': `Bearer ${apiKey}`
                }
              });
              
              const resultData = resultResponse.data;
              // Response format: { code: 200, message: "success", data: { status: "...", outputs: [...] } }
              const status = resultData.data?.status || resultData.status;
              
              console.log(`Poll attempt ${attempt + 1}/${maxAttempts}, status: ${status}`);
              
              if (status === 'completed' || status === 'succeeded') {
                // Job completed, extract image from outputs array
                const outputs = resultData.data?.outputs || resultData.outputs || [];
                
                if (outputs.length > 0) {
                  // Get the first output image URL
                  const imageUrl = outputs[0];
                  
                  if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
                    // Fetch image from URL (e.g., CloudFront URL)
                    console.log(`Fetching generated image from: ${imageUrl}`);
                    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                    console.log('✓ Image generated using wavespeed FLUX.1-schnell');
                    return Buffer.from(imageResponse.data);
                  } else if (typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
                    // Base64 data URI
                    const base64Data = imageUrl.split(',')[1];
                    console.log('✓ Image generated using wavespeed FLUX.1-schnell');
                    return Buffer.from(base64Data, 'base64');
                  } else {
                    throw new Error(`Unexpected image format in outputs: ${typeof imageUrl}`);
                  }
                }
                
                throw new Error('Job completed but outputs array is empty');
              } else if (status === 'failed' || status === 'error') {
                const errorMsg = resultData.data?.error || resultData.error || 'Job failed';
                throw new Error(`Image generation job failed: ${errorMsg}`);
              }
              // If status is still 'created' or 'processing', continue polling
            } catch (pollError) {
              // Handle various error cases
              if (pollError.response) {
                const status = pollError.response.status;
                // 404 or 401 might mean job is still processing or not ready
                if (status === 404 || status === 401) {
                  console.log(`Result not ready yet (${status}), continuing to poll...`);
                  continue;
                }
                // Log other errors but continue polling (might be temporary)
                if (status >= 500) {
                  console.log(`Server error (${status}), retrying...`);
                  continue;
                }
              }
              // If it's not a retryable error, throw it
              throw pollError;
            }
          }
          
          throw new Error('Image generation timed out - job did not complete within expected time');
        }
        
        // If response is not async job format, try to extract image directly
        if (responseData && responseData.data && typeof responseData.data === 'object') {
          const data = responseData.data;
          
          // Check for outputs array
          if (data.outputs && Array.isArray(data.outputs) && data.outputs[0]) {
            const imageData = data.outputs[0];
            if (typeof imageData === 'string') {
              if (imageData.startsWith('data:')) {
                const base64Data = imageData.split(',')[1];
                console.log('✓ Image generated using wavespeed FLUX.1-schnell');
                return Buffer.from(base64Data, 'base64');
              } else if (imageData.startsWith('http')) {
                const imageResponse = await axios.get(imageData, { responseType: 'arraybuffer' });
                console.log('✓ Image generated using wavespeed FLUX.1-schnell');
                return Buffer.from(imageResponse.data);
              }
            }
          }
        }
        
        // Fallback: try to parse as direct image response
        if (Buffer.isBuffer(response.data)) {
          console.log('✓ Image generated using wavespeed FLUX.1-schnell');
          return response.data;
        }
        
        throw new Error(`Unexpected response format. Response structure: ${JSON.stringify(responseData, null, 2).substring(0, 500)}`);
      });
      const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      
      // Save to local file for Twitter
      const timestamp = Date.now();
      const localFileName = `temp_uploads/${timestamp}_image.jpg`;
      const localFilePath = path.join(__dirname, '..', localFileName);
      
      // Ensure directory exists
      await fs.promises.mkdir(path.dirname(localFilePath), { recursive: true });
      
      // Write the buffer to file
      await fs.promises.writeFile(localFilePath, buffer);
      
      return {
        imageData: base64Image,
        imagePath: localFileName,
        metadata: {
          model: "FLUX.1-schnell",
          prompt: prompt,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error generating image:', error);
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }

  async generateVideoScript(prompt, advancedOptions = {}) {
    try {
      const { tone = 'professional', length = 'medium' } = advancedOptions;
      
      // Updated to use key rotation
      const response = await apiKeyManager.executeWithKeyRotation(async (apiKey) => {
        return axios.post(
          'https://router.huggingface.co/v1/chat/completions',
          {
            model: 'meta-llama/Llama-3.1-8B-Instruct:sambanova',
            messages: [
              {
                role: 'user',
                content: `Write a professional video script that is ${length} in length and uses a ${tone} tone. The script should be for: ${prompt}

Format the response as a proper video script with:
- Timestamps for each section
- Camera directions in [brackets]
- Scene descriptions and transitions
- Clear sections for Opening, Introduction, Main Content, and Closing`
              }
            ],
            max_tokens: 1000,
            temperature: 0.7
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
      });

      const scriptContent = response.data.choices[0].message.content;

      return {
        content: scriptContent,
        metadata: {
          estimatedDuration: length === 'short' ? '1-2 minutes' : length === 'medium' ? '2-5 minutes' : '5+ minutes',
          tone: tone,
          generatedAt: new Date().toISOString(),
          model: 'meta-llama/Llama-3.1-8B-Instruct:sambanova',
          apiUsed: 'serverless-inference'
        }
      };
    } catch (error) {
      console.error('Error generating video script:', error.response?.data || error.message);
      throw new Error('Failed to generate video script');
    }
  }

  async saveContent(contentData) {
    // Implementation for saving content to database
    // This can be implemented later when needed
    return contentData;
  }

  async getAllContent() {
    // Implementation for retrieving all content
    // This can be implemented later when needed
    return [];
  }
  
  async saveContentRating(contentId, rating, feedback = null, contentType = 'social') {
    try {
      console.log(`Saving rating ${rating} for content ${contentId} (${contentType})`);
      
      // In a real implementation, you would save this to a database
      // Here we'll just return a mock response
      const timestamp = new Date().toISOString();
      
      // This would normally be retrieved and updated in the database
      const contentRating = {
        contentId,
        rating,
        feedback,
        contentType,
        timestamp,
        // These fields would normally be calculated from existing ratings
        averageRating: rating,
        ratingCount: 1
      };
      
      console.log('Saved content rating:', contentRating);
      
      return contentRating;
    } catch (error) {
      console.error('Error saving content rating:', error);
      throw new Error(`Failed to save content rating: ${error.message}`);
    }
  }
  
  async saveContentPerformance(contentId, metrics) {
    try {
      console.log(`Saving performance metrics for content ${contentId}:`, metrics);
      
      // In a real implementation, you would save these metrics to a database
      // and link them to the content with the given contentId
      
      // Mock implementation: combine input metrics with timestamp
      const performanceRecord = {
        contentId,
        metrics,
        timestamp: new Date().toISOString()
      };
      
      // This would be where you compare predicted performance with actual performance
      // to improve the learning algorithm
      
      console.log('Saved performance metrics:', performanceRecord);
      
      return performanceRecord;
    } catch (error) {
      console.error('Error saving content performance metrics:', error);
      throw new Error(`Failed to save content performance: ${error.message}`);
    }
  }
  
  // Method to analyze historical performance and generate insights
  async analyzeContentPerformance(contentType = 'social', limit = 20) {
    try {
      console.log(`Analyzing historical content performance for ${contentType}`);
      
      // In a real implementation, this would query the database for historical content,
      // ratings, and performance metrics to generate insights
      
      // Mock implementation that would normally be replaced with actual analysis
      const mockInsights = {
        topPerformers: [
          { contentId: 'mock1', engagement: 95, key_factors: ['image', 'morning_post', 'hashtags'] },
          { contentId: 'mock2', engagement: 87, key_factors: ['question', 'emoji', 'evening_post'] }
        ],
        patterns: {
          timing: { best: 'morning', worst: 'late_night' },
          content_length: { optimal: '15-25 words', correlation: 'strong' },
          media: { with_image: 85, without_image: 45 }
        },
        trends: {
          improving: ['hashtag_usage', 'post_timing'],
          declining: ['plain_text_posts']
        }
      };
      
      return mockInsights;
    } catch (error) {
      console.error('Error analyzing content performance:', error);
      throw new Error(`Failed to analyze content performance: ${error.message}`);
    }
  }
}

module.exports = new ContentService();