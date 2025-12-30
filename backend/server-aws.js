/**
 * AWS Deployment Server
 * Only includes: Post Generation, Email Generation, Video Script, Brand Kit
 * Excludes: Twitter posting, ML predictions, Instagram API
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Update this to your Vercel frontend URL in production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Health check for AWS
app.get('/', (req, res) => {
  res.json({ status: 'healthy', service: 'OnTheFly API' });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Import only the services needed for generation
const contentService = require('./src/services/content.service');
const emailService = require('./src/services/email.service');

// ============================================
// CONTENT GENERATION ROUTES
// ============================================

// Generate social media post
app.post('/api/content/generate', async (req, res) => {
  try {
    const { prompt, contentType, platforms } = req.body;
    const result = await contentService.generateContent(prompt, contentType, platforms);
    res.json(result);
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate optimized content (with performance data)
app.post('/api/content/generate-optimized', async (req, res) => {
  try {
    const { prompt, contentType, platforms, performanceData } = req.body;
    const result = await contentService.generateContent(prompt, contentType, platforms, performanceData);
    res.json(result);
  } catch (error) {
    console.error('Error generating optimized content:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate image
app.post('/api/content/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    const result = await contentService.generateImage(prompt);
    res.json(result);
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate video script
app.post('/api/content/video-script', async (req, res) => {
  try {
    const { prompt, advancedOptions } = req.body;
    const result = await contentService.generateVideoScript(prompt, advancedOptions);
    res.json(result);
  } catch (error) {
    console.error('Error generating video script:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// EMAIL GENERATION ROUTES
// ============================================

// Generate email preview
app.post('/api/email/preview', async (req, res) => {
  try {
    const { prompt, campaignType } = req.body;
    const content = await emailService.generateEmailContent(
      `Create a ${campaignType} email with the following requirements: ${prompt}`
    );
    res.json({ content });
  } catch (error) {
    console.error('Error generating email preview:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// BRAND KIT GENERATION ROUTES
// ============================================

app.post('/api/brand-kit/generate-complete', async (req, res) => {
  try {
    const { brandName, industry, personality } = req.body;
    const result = await contentService.generateCompleteBrandKit(brandName, industry, personality);
    res.json(result);
  } catch (error) {
    console.error('Error generating brand kit:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/brand-kit/generate-logo', async (req, res) => {
  try {
    const { brandName, industry, personality } = req.body;
    const result = await contentService.generateLogo(brandName, industry, personality);
    res.json(result);
  } catch (error) {
    console.error('Error generating logo:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/brand-kit/generate-colors', async (req, res) => {
  try {
    const { industry, personality } = req.body;
    const result = await contentService.generateColorPalette(industry, personality);
    res.json(result);
  } catch (error) {
    console.error('Error generating colors:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/brand-kit/generate-fonts', async (req, res) => {
  try {
    const { personality } = req.body;
    const result = await contentService.generateFontPairings(personality);
    res.json(result);
  } catch (error) {
    console.error('Error generating fonts:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/brand-kit/generate-tone', async (req, res) => {
  try {
    const { brandName, industry, personality } = req.body;
    const result = await contentService.generateBrandTone(brandName, industry, personality);
    res.json(result);
  } catch (error) {
    console.error('Error generating tone:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/brand-kit/generate-templates', async (req, res) => {
  try {
    const { brandName } = req.body;
    const result = await contentService.generateSocialTemplates(brandName);
    res.json(result);
  } catch (error) {
    console.error('Error generating templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5005;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OnTheFly API running on port ${PORT}`);
});
