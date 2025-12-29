const contentService = require('../services/content.service');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const generateContent = async (req, res) => {
  try {
    const { prompt, contentType, platforms, performanceData } = req.body;
    const content = await contentService.generateContent(prompt, contentType, platforms, performanceData);
    res.json(content);
  } catch (error) {
    console.error('Error generating content:', error);
    
    // Check if error is related to API keys being exhausted
    if (error.message && error.message.includes('API keys have been exhausted')) {
      return res.status(503).json({ 
        error: 'Service temporarily unavailable. Please try again later.',
        details: 'API quota exceeded. System is attempting to recover.'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to generate content',
      details: error.message
    });
  }
};

const generateOptimizedContent = async (req, res) => {
  try {
    const { prompt, contentType, platforms, performanceData } = req.body;
    
    if (!performanceData) {
      return res.status(400).json({ error: 'Performance data is required for optimization' });
    }
    
    console.log('Generating optimized content with performance data:', performanceData);
    const content = await contentService.generateContent(prompt, contentType, platforms, performanceData);
    
    res.json({
      ...content,
      optimized: true,
      optimizationFactors: Object.keys(performanceData).filter(key => 
        performanceData[key] && 
        (Array.isArray(performanceData[key]) ? performanceData[key].length > 0 : true)
      )
    });
  } catch (error) {
    console.error('Error generating optimized content:', error);
    
    // Check if error is related to API keys being exhausted
    if (error.message && error.message.includes('API keys have been exhausted')) {
      return res.status(503).json({ 
        error: 'Service temporarily unavailable. Please try again later.',
        details: 'API quota exceeded. System is attempting to recover.'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to generate optimized content',
      details: error.message
    });
  }
};

const generateImage = async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    console.log('Generating image for prompt:', prompt);
    const imageResult = await contentService.generateImage(prompt);
    res.json(imageResult);
  } catch (error) {
    console.error('Error generating image:', error);
    
    // Check if error is related to API keys being exhausted
    if (error.message && error.message.includes('API keys have been exhausted')) {
      return res.status(503).json({ 
        error: 'Service temporarily unavailable. Please try again later.',
        details: 'API quota exceeded. System is attempting to recover.'
      });
    }
    
    res.status(500).json({ 
      error: `Failed to generate image: ${error.message}`,
      details: error.message
    });
  }
};

const generateVideoScript = async (req, res) => {
  try {
    const { prompt, advancedOptions = {} } = req.body;
    const scriptContent = await contentService.generateVideoScript(prompt, advancedOptions);
    res.json(scriptContent);
  } catch (error) {
    console.error('Error generating video script:', error);
    res.status(500).json({ error: 'Failed to generate video script' });
  }
};

const saveContent = async (req, res) => {
  try {
    const contentData = req.body;
    const savedContent = await contentService.saveContent(contentData);
    res.json(savedContent);
  } catch (error) {
    console.error('Error saving content:', error);
    res.status(500).json({ error: error.message });
  }
};

const getAllContent = async (req, res) => {
  try {
    const content = await contentService.getAllContent();
    res.json(content);
  } catch (error) {
    console.error('Error getting content:', error);
    res.status(500).json({ error: error.message });
  }
};

// Rate and track content performance
const rateContent = async (req, res) => {
  try {
    const { contentId, rating, feedback, contentType } = req.body;
    
    if (!contentId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Valid content ID and rating (1-5) are required' });
    }
    
    // Save the rating to the database or service
    const updatedContent = await contentService.saveContentRating(contentId, rating, feedback, contentType);
    
    res.json({
      success: true,
      message: 'Rating saved successfully',
      contentId,
      rating,
      updatedContent
    });
  } catch (error) {
    console.error('Error saving content rating:', error);
    res.status(500).json({ error: error.message });
  }
};

// Track actual performance metrics for content
const trackContentPerformance = async (req, res) => {
  try {
    const { contentId, metrics } = req.body;
    
    if (!contentId || !metrics) {
      return res.status(400).json({ error: 'Content ID and metrics are required' });
    }
    
    // Save the performance metrics
    const updatedContent = await contentService.saveContentPerformance(contentId, metrics);
    
    res.json({
      success: true,
      message: 'Performance metrics saved successfully',
      contentId,
      updatedContent
    });
  } catch (error) {
    console.error('Error saving content performance:', error);
    res.status(500).json({ error: error.message });
  }
};

const analyzePostsWithGemini = async (req, res) => {
    try {
        const { prompt } = req.body;
        const geminiApiKey = process.env.GEMINI_API_KEY;

        if (!geminiApiKey) {
            return res.status(500).json({ 
                error: 'Gemini API key not configured on server' 
            });
        }

        if (!prompt) {
            return res.status(400).json({ 
                error: 'Prompt is required' 
            });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
        
        console.log('Making request to:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Gemini API error details:', errorData);
            throw new Error(`Gemini API error: ${response.status}. Details: ${errorData}`);
        }

        const data = await response.json();
        
        const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!analysisText) {
            console.error('No analysis text found in response:', data);
            throw new Error('No analysis generated - check API response structure');
        }

        res.json({ analysis: analysisText });
    } catch (error) {
        console.error('Error in analyzePostsWithGemini:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to generate analysis' 
        });
    }
};

module.exports = {
  generateContent,
  generateOptimizedContent,
  generateImage,
  generateVideoScript,
  saveContent,
  getAllContent,
  analyzePostsWithGemini,
  rateContent,
  trackContentPerformance
};