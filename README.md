# TruthLens - AI Misinformation Detection System

TruthLens is an AI-powered tool that helps users detect potential misinformation and learn to identify credible, trustworthy content. Built with modern web technologies and powered by Google's Gemini AI.

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

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- MongoDB (local or cloud)
- Google AI API key

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   ```bash
   export GOOGLE_API_KEY="your-google-api-key"
   export MONGO_URL="mongodb://localhost:27017"
   export JWT_SECRET="your-secret-key"
   ```

4. Run the server:
   ```bash
   python server.py
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   export REACT_APP_BACKEND_URL="http://localhost:8001"
   ```

4. Start the development server:
   ```bash
   npm start
   ```

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login with existing credentials

### Analysis Endpoints
- `POST /api/analyze/text` - Analyze text content for misinformation
- `POST /api/analyze/url` - Analyze URL and its content for credibility
- `POST /api/analyze/image` - Analyze uploaded images for manipulation

### User Endpoints
- `GET /api/user/analyses` - Get user's analysis history
- `GET /api/analysis/{id}` - Get detailed analysis results

### Educational Endpoints
- `GET /api/education/tips` - Get media literacy tips

## Deployment

### Using Docker
1. Build the Docker image:
   ```bash
   docker build -t truthlens .
   ```

2. Run the container:
   ```bash
   docker run -p 8001:8001 truthlens
   ```

### Using Heroku
1. Create a Heroku app:
   ```bash
   heroku create your-app-name
   ```

2. Set environment variables:
   ```bash
   heroku config:set GOOGLE_API_KEY=your-key
   heroku config:set MONGO_URL=your-mongodb-url
   heroku config:set JWT_SECRET=your-secret
   ```

3. Deploy:
   ```bash
   git push heroku main
   ```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@truthlens.com or create an issue in the GitHub repository.
