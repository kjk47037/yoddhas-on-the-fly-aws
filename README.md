# On the Fly -  GenAI Content Creation & Marketing Platform

## Overview

OnTheFly is an intelligent marketing automation platform that helps small businesses and content creators generate, optimize, and manage social media content across multiple platforms using AI and machine learning.

## Key Features

- **Content Studio** - AI-powered content generation with platform-specific optimization for Instagram, Twitter/X, and LinkedIn. Includes real-time ML predictions for engagement performance.
- **Email Campaigns** - Automated email marketing with customizable templates and audience segmentation.
- **Brand Kit Generator** - Automated brand identity creation including logos, color palettes, typography recommendations, and brand guidelines.
- **Campaign Builder** - Multi-platform campaign management with scheduling, audience targeting, and performance tracking.
- **Analytics Dashboard** - Real-time analytics aggregation from connected social platforms with AI-generated insights.
- **SEO Audit** - Website analysis for search engine optimization with actionable recommendations.
- **Competitor Analysis** - Instagram competitor analysis with AI-powered insights using Gemini API.
- **WhatsApp Integration** - Automated engagement alerts via Twilio integration.
- **Event-Based Triggers** - Automated actions triggered by user behavior, time-based events, or engagement milestones.
- **Exit Intent Popup** - Smart popups that detect when users are about to leave and display targeted offers or CTAs.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND LAYER                                  │
│                     React 18 + Vite + Tailwind + DaisyUI                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API GATEWAY LAYER                                 │
│                         Express.js REST API (:5005)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                 ┌────────────────────┼────────────────────┐
                 ▼                    ▼                    ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  Content Service    │  │   Flask Server      │  │   ML Server         │
│  (Node.js)          │  │   (:5004)           │  │   (:5007)           │
│                     │  │                     │  │                     │
│  • Text Generation  │  │  • Twitter API v2   │  │  • Random Forest    │
│  • Image Generation │  │  • Instagram API    │  │  • Engagement       │
│  • Video Scripts    │  │  • Social Analytics │  │    Prediction       │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
         │                                                  │
         ▼                                                  ▼
┌─────────────────────┐                          ┌─────────────────────┐
│   AI/ML Services    │                          │   Data Storage      │
│                     │                          │                     │
│  • Llama 3.1-8B     │                          │  • Firebase         │
│    (HuggingFace)    │                          │    Firestore        │
│  • FLUX.1-schnell   │                          │  • SQLite           │
│    (Wavespeed)      │                          │    (Events)         │
│  • Gemini 2.5 Flash │                          │                     │
└─────────────────────┘                          └─────────────────────┘
```

## Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS + DaisyUI
- **Routing**: React Router DOM
- **Charts**: Recharts, Chart.js
- **Icons**: React Icons, FontAwesome, Lucide

### Backend
- **Node.js Server**: Express.js (port 5005)
- **Python Server**: Flask (port 5004) - Twitter/Instagram APIs
- **ML Server**: Flask (port 5007) - Engagement predictions

### AI/ML Services
- **Text Generation**: HuggingFace Router (Llama-3.1-8B-Instruct)
- **Image Generation**: FLUX.1-schnell via Wavespeed API
- **Post Analysis**: Google Gemini 1.5 Flash
- **Engagement Prediction**: Custom Random Forest classifier (18 features)

### Database & Auth
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Event Storage**: SQLite

### External APIs
- **Twitter API v2**: Analytics and posting
- **RapidAPI Instagram**: Competitor analysis
- **Twilio**: WhatsApp notifications


## Built With

This project was developed using [Kiro IDE](https://kiro.dev) - an AI-powered development environment that helped with spec-driven development, code generation, and iterative feature building.

## Setup and Installation

### Prerequisites
- Node.js 18+
- Python 3.9+
- Firebase CLI (`npm install -g firebase-tools`)
- API keys for: Firebase, HuggingFace, Gemini, Twitter, RapidAPI, Twilio

### Frontend Setup
```bash
# Install dependencies
npm install

# Create .env file with required variables
# VITE_FIREBASE_API_KEY, VITE_GEMINI_API_KEY, etc.

# Run development server
npm run dev
```

### Backend Setup (Node.js)
```bash
cd backend

# Install dependencies
npm install

# Create .env file with API keys

# Run server
npm run dev  # runs on port 5005
```

### Backend Setup (Python - Flask)
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run Flask server
python src/flask_server.py  # runs on port 5004
```

### ML Server Setup
```bash
cd backend/ml

# Train the model (optional - pre-trained model included)
python train.py

# Run ML prediction server
python -m flask run --port 5007
```

## Environment Variables

### Frontend (.env)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_GEMINI_API_KEY=
VITE_RAPIDAPI_KEY=
VITE_MODELSLAB_API_KEY=
```

### Backend (.env)
```
API_KEY=           # Twitter API Key
API_SECRET=        # Twitter API Secret
ACCESS_TOKEN=      # Twitter Access Token
ACCESS_TOKEN_SECRET=
BEARER_TOKEN=
GEMINI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
```

## ML Model

The engagement prediction model uses a Random Forest classifier trained on 18 features:
- Content metrics (word count, hashtag count, emoji count, etc.)
- Timing features (hour, day of week)
- Platform-specific optimizations
- Historical performance data

Model files are saved with timestamps in `backend/ml/models/`.

## Demo Video

https://drive.google.com/file/d/1dmcibtPueMo7lZF3f6J-Y5g6wqNRQwrQ/view?usp=share_link


<img width="650" height="650" alt="logo2" src="https://github.com/user-attachments/assets/362e1d7e-da64-4778-a3d3-a43c998c9fae" />
