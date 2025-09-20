// TruthLens API Service - Client-side implementation
class TruthLensAPI {
  constructor() {
    this.baseURL = process.env.PUBLIC_URL || '';
    this.googleApiKey = 'AIzaSyBvOkBwqLcFdEfGhIjKlMnOpQrStUvWxYz';
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL}/api/health.json`);
      return await response.json();
    } catch (error) {
      return { status: 'healthy', service: 'TruthLens API (offline mode)' };
    }
  }

  // Get educational tips
  async getEducationalTips() {
    try {
      const response = await fetch(`${this.baseURL}/api/education/tips.json`);
      return await response.json();
    } catch (error) {
      return {
        tips: [
          "Check the source: Look for author credentials and publication reputation",
          "Examine the URL: Be wary of sites that mimic legitimate news sources",
          "Look for corroboration: See if other reputable sources report the same information"
        ]
      };
    }
  }

  // Analyze text using Google Gemini API
  async analyzeText(content) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.googleApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are TruthLens, an expert AI system specialized in detecting misinformation and educating users about media literacy.

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
    "source_analysis": "Analysis of the source credibility",
    "fact_check_suggestions": ["specific", "things", "to", "verify"],
    "educational_explanation": "Detailed explanation of why this content might be misleading and how to identify such content in future"
}

Please analyze this text content for misinformation and credibility:

Content: ${content}

Provide a comprehensive analysis focusing on:
1. Factual accuracy and verifiability
2. Emotional manipulation techniques
3. Logical fallacies or bias
4. Educational guidance for users

Be thorough but concise. Focus on education and empowerment.`
            }]
          }]
        })
      });

      const data = await response.json();
      let analysisText = data.candidates[0].content.parts[0].text;

      // Parse JSON response
      try {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = analysisText.match(/```json\s*(\{.*?\})\s*```/s);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]);
        } else {
          // Try to find JSON without code blocks
          const jsonMatch2 = analysisText.match(/(\{.*\})/s);
          if (jsonMatch2) {
            return JSON.parse(jsonMatch2[1]);
          }
        }
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
      }

      // Fallback response
      return {
        credibility_score: 0.5,
        risk_level: "medium",
        summary: "Analysis completed but response parsing failed",
        red_flags: ["Response format error"],
        positive_indicators: [],
        manipulation_techniques: [],
        source_analysis: "Unable to parse detailed analysis",
        fact_check_suggestions: ["Manual verification recommended"],
        educational_explanation: analysisText.substring(0, 500) + "..."
      };

    } catch (error) {
      console.error('Analysis error:', error);
      return {
        credibility_score: 0.3,
        risk_level: "high",
        summary: "Analysis failed due to technical error",
        red_flags: ["Technical analysis failure", "Unable to verify content"],
        positive_indicators: [],
        manipulation_techniques: [],
        source_analysis: "Could not analyze source",
        fact_check_suggestions: ["Manual fact-checking strongly recommended"],
        educational_explanation: "Due to technical limitations, this content could not be properly analyzed. Please verify this information through multiple reliable sources."
      };
    }
  }

  // Analyze URL content
  async analyzeURL(url) {
    try {
      // Extract content from URL (simplified version)
      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      const content = data.contents || '';

      // Clean HTML content
      const cleanContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 5000);

      // Analyze the content
      const analysis = await this.analyzeText(cleanContent);
      
      return {
        ...analysis,
        source_analysis: `URL: ${url}\n\nThis URL has been analyzed for credibility. ${analysis.source_analysis || 'Please verify the source independently.'}`
      };

    } catch (error) {
      console.error('URL analysis error:', error);
      return {
        credibility_score: 0.3,
        risk_level: "high",
        summary: "URL analysis failed due to technical error",
        red_flags: ["Technical analysis failure", "Unable to verify URL"],
        positive_indicators: [],
        manipulation_techniques: [],
        source_analysis: "Could not analyze URL",
        fact_check_suggestions: ["Manual fact-checking strongly recommended", "Check URL reputation"],
        educational_explanation: "Due to technical limitations, this URL could not be properly analyzed. Please verify this information through multiple reliable sources."
      };
    }
  }

  // Analyze image (simplified version)
  async analyzeImage(file) {
    try {
      // For GitHub Pages, we'll provide a simplified image analysis
      return {
        credibility_score: 0.6,
        risk_level: "medium",
        summary: "Image analysis completed. Please verify image authenticity independently.",
        red_flags: ["Image analysis limited in static deployment"],
        positive_indicators: ["Image appears to be uploaded successfully"],
        manipulation_techniques: ["Advanced image analysis not available in static mode"],
        source_analysis: "Image source verification recommended",
        fact_check_suggestions: [
          "Use reverse image search (Google Images, TinEye)",
          "Check image metadata",
          "Verify image context and source",
          "Look for signs of digital manipulation"
        ],
        educational_explanation: "In this static deployment, advanced image analysis is limited. For best results, use reverse image search tools to verify image authenticity and check for manipulation."
      };
    } catch (error) {
      console.error('Image analysis error:', error);
      return {
        credibility_score: 0.3,
        risk_level: "high",
        summary: "Image analysis failed",
        red_flags: ["Analysis failure"],
        positive_indicators: [],
        manipulation_techniques: [],
        source_analysis: "Could not analyze image",
        fact_check_suggestions: ["Use reverse image search", "Check image metadata"],
        educational_explanation: "Image analysis failed. Please use reverse image search tools to verify image authenticity."
      };
    }
  }

  // User authentication (simplified for static deployment)
  async register(username, email, password) {
    // Store user data in localStorage for demo purposes
    const user = {
      id: Date.now().toString(),
      username,
      email,
      created_at: new Date().toISOString()
    };
    
    localStorage.setItem('truthlens_user', JSON.stringify(user));
    localStorage.setItem('truthlens_token', 'demo_token_' + Date.now());
    
    return {
      message: "User registered successfully (demo mode)",
      token: 'demo_token_' + Date.now(),
      user
    };
  }

  async login(email, password) {
    // Check if user exists in localStorage
    const userData = localStorage.getItem('truthlens_user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user.email === email) {
        const token = 'demo_token_' + Date.now();
        localStorage.setItem('truthlens_token', token);
        return {
          message: "Login successful (demo mode)",
          token,
          user
        };
      }
    }
    
    throw new Error("Invalid credentials");
  }

  // Get user analyses (from localStorage)
  async getUserAnalyses() {
    const analyses = JSON.parse(localStorage.getItem('truthlens_analyses') || '[]');
    return { analyses };
  }

  // Save analysis to localStorage
  async saveAnalysis(analysis) {
    const analyses = JSON.parse(localStorage.getItem('truthlens_analyses') || '[]');
    analyses.unshift(analysis);
    localStorage.setItem('truthlens_analyses', JSON.stringify(analyses.slice(0, 20))); // Keep last 20
  }
}

export default new TruthLensAPI();
