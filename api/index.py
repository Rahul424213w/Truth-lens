from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import os
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import requests
from urllib.parse import urlparse
import tempfile
import aiofiles
import asyncio
import google.generativeai as genai
import json

# Load environment variables
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "AIzaSyBvOkBwqLcFdEfGhIjKlMnOpQrStUvWxYz")
MONGO_URL = os.getenv("MONGO_URL", "mongodb+srv://truthlens:truthlens123@cluster0.mongodb.net/truthlens_db?retryWrites=true&w=majority")
DB_NAME = os.getenv("DB_NAME", "truthlens_db")
JWT_SECRET = os.getenv("JWT_SECRET", "truthlens-super-secret-jwt-key-2024")

app = FastAPI(title="TruthLens - AI Misinformation Detection API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MongoDB client
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Security
security = HTTPBearer()

# Pydantic Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    password_hash: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class Analysis(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    content_type: str  # "text", "url", "image"
    content: str
    analysis_result: Dict[str, Any]
    credibility_score: float
    risk_level: str  # "low", "medium", "high", "critical"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class TextAnalysisRequest(BaseModel):
    content: str

class URLAnalysisRequest(BaseModel):
    url: str

class AnalysisResponse(BaseModel):
    analysis_id: str
    content_type: str
    credibility_score: float
    risk_level: str
    summary: str
    detailed_analysis: Dict[str, Any]
    educational_tips: List[str]

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str) -> str:
    payload = {"user_id": user_id}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_jwt_token(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload["user_id"]
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_id = verify_jwt_token(credentials.credentials)
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

async def extract_url_content(url: str) -> str:
    """Extract text content from URL"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Simple text extraction (in production, use BeautifulSoup)
        content = response.text
        # Remove HTML tags (basic approach)
        import re
        clean_content = re.sub(r'<[^>]+>', '', content)
        clean_content = re.sub(r'\s+', ' ', clean_content).strip()
        
        # Limit content length
        return clean_content[:5000] if len(clean_content) > 5000 else clean_content
    except Exception as e:
        return f"Error extracting content: {str(e)}"

async def analyze_with_gemini(content: str, content_type: str, url: str = None) -> Dict[str, Any]:
    """Analyze content using Google's Gemini API"""
    try:
        # Configure the Gemini API
        genai.configure(api_key=GOOGLE_API_KEY)
        
        # Initialize the model
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Prepare the system prompt
        system_prompt = """You are TruthLens, an expert AI system specialized in detecting misinformation and educating users about media literacy. 

Your role is to:
1. Analyze content for potential misinformation, bias, and credibility issues
2. Provide educational explanations about manipulation techniques
3. Assess source credibility and reliability
4. Give actionable tips for users to verify information

Always respond in JSON format with these exact keys:
{
    "credibility_score": (float between 0.0-1.0, where 1.0 is most credible),
    "risk_level": ("low", "medium", "high", or "critical"),
    "summary": "Brief 2-3 sentence summary of your assessment",
    "red_flags": ["list", "of", "concerning", "elements"],
    "positive_indicators": ["list", "of", "credible", "elements"],
    "manipulation_techniques": ["list", "of", "techniques", "detected"],
    "source_analysis": "Analysis of the source credibility (if URL provided)",
    "fact_check_suggestions": ["specific", "things", "to", "verify"],
    "educational_explanation": "Detailed explanation of why this content might be misleading and how to identify such content in future"
}

Be thorough but concise. Focus on education and empowerment."""
        
        # Prepare the analysis prompt
        if content_type == "url":
            prompt = f"""{system_prompt}

Please analyze this URL and its content for misinformation and credibility:

URL: {url}
Content extracted from URL:
{content}

Provide a comprehensive analysis focusing on:
1. Source credibility and reputation
2. Content accuracy and potential bias
3. Signs of manipulation or misinformation
4. Educational guidance for users"""
        elif content_type == "text":
            prompt = f"""{system_prompt}

Please analyze this text content for misinformation and credibility:

Content:
{content}

Provide a comprehensive analysis focusing on:
1. Factual accuracy and verifiability
2. Emotional manipulation techniques
3. Logical fallacies or bias
4. Educational guidance for users"""
        else:  # image
            prompt = f"""{system_prompt}

Please analyze this image content for misinformation and credibility:

Image description/text: {content}

Provide a comprehensive analysis focusing on:
1. Visual manipulation signs
2. Context and source verification
3. Common image misinformation techniques
4. Educational guidance for users"""
        
        # Generate content using Gemini
        response = model.generate_content(prompt)
        response_text = response.text
        
        # Parse JSON response
        try:
            # First try direct JSON parsing
            analysis_result = json.loads(response_text)
        except json.JSONDecodeError:
            try:
                # Try to extract JSON from markdown code blocks
                import re
                json_match = re.search(r'```json\s*(\{.*?\})\s*```', response_text, re.DOTALL)
                if json_match:
                    analysis_result = json.loads(json_match.group(1))
                else:
                    # Try to find JSON without code blocks
                    json_match = re.search(r'(\{.*?\})', response_text, re.DOTALL)
                    if json_match:
                        analysis_result = json.loads(json_match.group(1))
                    else:
                        raise json.JSONDecodeError("No JSON found", response_text, 0)
            except (json.JSONDecodeError, AttributeError):
                # Fallback parsing if JSON is malformed
                analysis_result = {
                    "credibility_score": 0.5,
                    "risk_level": "medium",
                    "summary": "Analysis completed but response parsing failed",
                    "red_flags": ["Response format error"],
                    "positive_indicators": [],
                    "manipulation_techniques": [],
                    "source_analysis": "Unable to parse detailed analysis",
                    "fact_check_suggestions": ["Manual verification recommended"],
                    "educational_explanation": response_text[:500] + "..." if len(response_text) > 500 else response_text
                }
        
        return analysis_result
        
    except Exception as e:
        # Fallback analysis in case of API failure
        return {
            "credibility_score": 0.3,
            "risk_level": "high",
            "summary": f"Analysis failed due to technical error: {str(e)}",
            "red_flags": ["Technical analysis failure", "Unable to verify content"],
            "positive_indicators": [],
            "manipulation_techniques": [],
            "source_analysis": "Could not analyze source",
            "fact_check_suggestions": ["Manual fact-checking strongly recommended"],
            "educational_explanation": "Due to technical limitations, this content could not be properly analyzed. Please verify this information through multiple reliable sources."
        }

# API Endpoints

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "TruthLens API"}

# Authentication Endpoints
@app.post("/api/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Create user
    password_hash = hash_password(user_data.password)
    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=password_hash
    )
    
    await db.users.insert_one(user.dict())
    token = create_jwt_token(user.id)
    
    return {
        "message": "User registered successfully",
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    }

@app.post("/api/auth/login")
async def login(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user["id"])
    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"]
        }
    }

# Analysis Endpoints
@app.post("/api/analyze/text", response_model=AnalysisResponse)
async def analyze_text(request: TextAnalysisRequest, current_user: User = Depends(get_current_user)):
    """Analyze text content for misinformation"""
    
    # Perform AI analysis
    analysis_result = await analyze_with_gemini(request.content, "text")
    
    # Create analysis record
    analysis = Analysis(
        user_id=current_user.id,
        content_type="text",
        content=request.content,
        analysis_result=analysis_result,
        credibility_score=analysis_result["credibility_score"],
        risk_level=analysis_result["risk_level"]
    )
    
    await db.analyses.insert_one(analysis.dict())
    
    # Extract educational tips
    educational_tips = []
    educational_tips.extend(analysis_result.get("fact_check_suggestions", []))
    if analysis_result.get("educational_explanation"):
        educational_tips.append(analysis_result["educational_explanation"])
    
    return AnalysisResponse(
        analysis_id=analysis.id,
        content_type="text",
        credibility_score=analysis_result["credibility_score"],
        risk_level=analysis_result["risk_level"],
        summary=analysis_result["summary"],
        detailed_analysis=analysis_result,
        educational_tips=educational_tips
    )

@app.post("/api/analyze/url", response_model=AnalysisResponse)
async def analyze_url(request: URLAnalysisRequest, current_user: User = Depends(get_current_user)):
    """Analyze URL content for misinformation"""
    
    # Extract content from URL
    content = await extract_url_content(request.url)
    
    # Perform AI analysis
    analysis_result = await analyze_with_gemini(content, "url", request.url)
    
    # Create analysis record
    analysis = Analysis(
        user_id=current_user.id,
        content_type="url",
        content=request.url,
        analysis_result=analysis_result,
        credibility_score=analysis_result["credibility_score"],
        risk_level=analysis_result["risk_level"]
    )
    
    await db.analyses.insert_one(analysis.dict())
    
    # Extract educational tips
    educational_tips = []
    educational_tips.extend(analysis_result.get("fact_check_suggestions", []))
    if analysis_result.get("educational_explanation"):
        educational_tips.append(analysis_result["educational_explanation"])
    
    return AnalysisResponse(
        analysis_id=analysis.id,
        content_type="url",
        credibility_score=analysis_result["credibility_score"],
        risk_level=analysis_result["risk_level"],
        summary=analysis_result["summary"],
        detailed_analysis=analysis_result,
        educational_tips=educational_tips
    )

# Educational Content Endpoint
@app.get("/api/education/tips")
async def get_media_literacy_tips():
    """Get general media literacy tips"""
    tips = [
        "Check the source: Look for author credentials and publication reputation",
        "Examine the URL: Be wary of sites that mimic legitimate news sources",
        "Look for corroboration: See if other reputable sources report the same information",
        "Check the date: Old news can be misleading when shared out of context",
        "Analyze the language: Emotional or sensational language may indicate bias",
        "Verify images: Use reverse image search to check if images are used correctly",
        "Check for bias: Consider the source's potential political or commercial motivations",
        "Look for citations: Credible content usually references primary sources",
        "Be skeptical of shocking claims: Extraordinary claims require extraordinary evidence",
        "Consider your own biases: We're all more likely to believe information that confirms our existing beliefs"
    ]
    
    return {"tips": tips}

# Vercel handler
def handler(request):
    return app(request.scope, request.receive, request.send)
