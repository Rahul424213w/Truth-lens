# TruthLens - AI Misinformation Detection System

## Project Overview
TruthLens is an AI-powered tool that detects potential misinformation and educates users on identifying credible, trustworthy content. The system features text analysis, URL credibility checking, image analysis, user authentication, and educational content.

## Features
- **Text Analysis**: Analyze text content for misinformation, bias, and manipulation techniques
- **URL Credibility Check**: Verify source credibility and analyze web content for trustworthiness  
- **Image Analysis**: Detect manipulated images and visual misinformation
- **User Authentication**: Secure JWT-based authentication system
- **Educational Content**: Media literacy tips and fact-checking guidance

## Technology Stack
- **Backend**: FastAPI, Python, MongoDB, Google Generative AI (Gemini)
- **Frontend**: React, Tailwind CSS, Axios
- **AI Integration**: Google Gemini 1.5 Flash for content analysis
- **Authentication**: JWT tokens with bcrypt password hashing
- **Database**: MongoDB for user data and analysis history

## API Endpoints
- `GET /api/health` - Health check
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/analyze/text` - Text content analysis
- `POST /api/analyze/url` - URL credibility analysis
- `POST /api/analyze/image` - Image analysis
- `GET /api/user/analyses` - User analysis history
- `GET /api/education/tips` - Media literacy tips

## Setup Instructions

### Backend Setup
1. Install dependencies: `pip install -r backend/requirements.txt`
2. Set environment variables:
   - `GOOGLE_API_KEY`: Your Google AI API key
   - `MONGO_URL`: MongoDB connection string
   - `JWT_SECRET`: Secret key for JWT tokens
3. Run the server: `python backend/server.py`

### Frontend Setup
1. Install dependencies: `cd frontend && npm install`
2. Set environment variable: `REACT_APP_BACKEND_URL=http://localhost:8001`
3. Start the development server: `npm start`

## Deployment
The application is ready for deployment on platforms like:
- Heroku
- Railway
- Vercel (frontend)
- MongoDB Atlas (database)

## Security Features
- JWT-based authentication
- Password hashing with bcrypt
- CORS configuration
- Input validation and sanitization
- Secure file upload handling

## Educational Value
TruthLens not only detects misinformation but also educates users about:
- Source credibility assessment
- Bias detection techniques
- Fact-checking strategies
- Media literacy skills
- Critical thinking approaches
