const { Resend } = require('resend');
const { HfInference } = require('@huggingface/inference');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const path = require('path');
const axios = require('axios');
const apiKeyManager = require('../utils/api-key-manager');

// Load environment variables from the correct path
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Verify API key is loaded
if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not defined in environment variables');
}

// Initialize clients with API keys and router endpoint
let hf = new HfInference(apiKeyManager.getCurrentKey(), {
  endpoint: 'https://router.huggingface.co'
});
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Firebase Admin with service account
if (!admin.apps.length) {
  const serviceAccount = require('../../firebase-service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://ace-hackathon-24596.firebaseio.com"
  });
}

// List of allowed email addresses
const ALLOWED_EMAILS = [
  'jivansh777@gmail.com',
  'jvmusic777@gmail.com',
  'arnavdas167@gmail.com',
  'lordorigami4703@gmail.com',
  'kavya422chetwani@gmail.com',
];

class EmailService {
  async generateEmailContent(prompt) {
    try {
      const response = await apiKeyManager.executeWithKeyRotation(async (apiKey) => {
        return axios.post(
          'https://router.huggingface.co/v1/chat/completions',
          {
            model: "meta-llama/Llama-3.1-8B-Instruct:sambanova",
            messages: [
              {
                role: 'system',
                content: `You are a professional email marketing expert. You MUST output ONLY valid HTML code for emails. 
Do NOT use markdown formatting like **bold** or asterisks.
Do NOT include explanations or labels like "Subject Line:" or "Header Section:".
Output ONLY the HTML email body content that goes inside <body> tags.`
              },
              {
                role: 'user',
                content: `Create an HTML marketing email for: ${prompt}

Output ONLY this HTML structure (no markdown, no explanations):

<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
  <tr>
    <td style="background-color: #007bff; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0;">BRAND NAME</h1>
    </td>
  </tr>
  <tr>
    <td style="padding: 30px; background-color: #ffffff;">
      <h2 style="color: #333; margin-top: 0;">Headline Here</h2>
      <p style="color: #666; line-height: 1.6;">Email body content here...</p>
      <a href="#" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">Call to Action</a>
    </td>
  </tr>
  <tr>
    <td style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 0;">© 2025 Brand Name. All rights reserved.</p>
    </td>
  </tr>
</table>

Replace placeholders with relevant content for the campaign. Output ONLY the HTML, nothing else.`
              }
            ],
            max_tokens: 800,
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

      let cleanedResponse = response.data.choices[0].message.content.trim();
      
      // Remove any markdown formatting that might have slipped through
      cleanedResponse = cleanedResponse
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Convert **bold** to <strong>
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Convert *italic* to <em>
        .replace(/^```html\s*/i, '') // Remove opening code block
        .replace(/```\s*$/i, '') // Remove closing code block
        .replace(/^```\s*/gm, '') // Remove any remaining code blocks
        .trim();
      
      // If response doesn't start with HTML tag, wrap it
      if (!cleanedResponse.startsWith('<')) {
        cleanedResponse = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">${cleanedResponse}</div>`;
      }

      return cleanedResponse;
    } catch (error) {
      console.error('Error generating email content:', error.response?.data || error.message);
      throw new Error('Failed to generate email content');
    }
  }

  async sendEmail({ to, subject, content, from = "onboarding@resend.dev" }) {
    try {
      // Validate that all recipient emails are in the allowed list
      const invalidEmails = to.filter(email => !ALLOWED_EMAILS.includes(email));
      if (invalidEmails.length > 0) {
        throw new Error(`Invalid email recipients: ${invalidEmails.join(', ')}`);
      }

      // Generate a unique tracking ID for this email campaign
      const trackingId = uuidv4();
      console.log('=== Email Tracking Setup ===');
      console.log('Generated tracking ID:', trackingId);
      console.log('Backend URL:', process.env.BACKEND_URL);

      // Add tracking pixel to the email content
      const trackingUrl = `${process.env.BACKEND_URL}/api/email/track/${trackingId}`;
      console.log('Generated tracking URL:', trackingUrl);
      
      // Create a proper HTML email with tracking pixel
      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f6f6f6;">
            ${content}
            <img src="${trackingUrl}" width="1" height="1" alt="" style="display: none;" />
          </body>
        </html>
      `;

      console.log('Sending email with tracking pixel...');

      const response = await resend.emails.send({
        from,
        to,
        subject,
        html: emailHtml,
      });

      // Store initial tracking data in Firebase
      const trackingRef = admin.firestore().collection('emailTracking').doc(trackingId);
      await trackingRef.set({
        campaignId: trackingId,
        subject,
        recipients: to,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        opens: 0,
        openedBy: [],
        lastOpenedAt: null
      });

      console.log('Tracking data stored in Firebase');

      return {
        ...response,
        trackingId
      };
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  async createEmailCampaign(campaignData) {
    try {
      const { prompt, subject, campaignType } = campaignData;
      
      // Generate email content using llama
      const emailContent = await this.generateEmailContent(
        `Create a ${campaignType} email with the following requirements: ${prompt}`
      );

      // Send to all allowed emails
      const result = await this.sendEmail({
        to: ALLOWED_EMAILS,
        subject,
        content: emailContent,
      });

      return {
        success: true,
        messageId: result.id,
        trackingId: result.trackingId,
        content: emailContent,
        sentTo: ALLOWED_EMAILS
      };
    } catch (error) {
      console.error('Error creating email campaign:', error);
      throw new Error('Failed to create email campaign');
    }
  }

  async getEmailAnalytics(trackingId) {
    try {
      console.log('Fetching analytics for tracking ID:', trackingId);
      const trackingRef = admin.firestore().collection('emailTracking').doc(trackingId);
      const doc = await trackingRef.get();
      
      if (!doc.exists) {
        console.log('No tracking data found for ID:', trackingId);
        throw new Error('Tracking data not found');
      }

      const data = doc.data();
      console.log('Found tracking data:', data);
      return data;
    } catch (error) {
      console.error('Error fetching email analytics:', error);
      throw new Error('Failed to fetch email analytics');
    }
  }

  async getAllCampaignAnalytics() {
    try {
      console.log('Fetching all campaign analytics');
      const trackingRef = admin.firestore().collection('emailTracking');
      const snapshot = await trackingRef.orderBy('sentAt', 'desc').get();
      
      const analytics = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Convert Firestore timestamps to ISO strings
          sentAt: data.sentAt ? data.sentAt.toDate().toISOString() : null,
          lastOpenedAt: data.lastOpenedAt ? data.lastOpenedAt.toDate().toISOString() : null
        };
      });

      console.log('Found analytics for', analytics.length, 'campaigns');
      return analytics;
    } catch (error) {
      console.error('Error fetching all campaign analytics:', error);
      throw new Error('Failed to fetch campaign analytics');
    }
  }
}

module.exports = new EmailService(); 