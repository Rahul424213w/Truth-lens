#!/usr/bin/env python3
"""
Debug script to test Gemini API response for misinformation detection
"""

import requests
import json

BACKEND_URL = "https://truthlens-10.preview.emergentagent.com/api"
TEST_USER_EMAIL = "sarah.johnson@example.com"
TEST_USER_PASSWORD = "SecurePass123!"

MISINFORMATION_TEXT = """
BREAKING: Scientists have discovered that drinking bleach can cure COVID-19! 
A new study from the University of Alternative Medicine shows that household bleach 
contains powerful antiviral properties that can eliminate the coronavirus from your body. 
Dr. John Smith, who has 30 years of experience in natural healing, recommends 
drinking 2 tablespoons of bleach mixed with water every morning. 
The mainstream media doesn't want you to know this because Big Pharma would lose billions!
Share this before it gets censored!
"""

def debug_text_analysis():
    session = requests.Session()
    
    # Login first
    login_data = {
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    }
    
    response = session.post(f"{BACKEND_URL}/auth/login", json=login_data)
    if response.status_code != 200:
        print("Login failed:", response.text)
        return
    
    token = response.json()["token"]
    session.headers.update({"Authorization": f"Bearer {token}"})
    
    # Test text analysis
    request_data = {"content": MISINFORMATION_TEXT}
    
    print("🔍 Testing misinformation text analysis...")
    print("Text content:", MISINFORMATION_TEXT[:100] + "...")
    
    response = session.post(f"{BACKEND_URL}/analyze/text", json=request_data, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        print("\n📊 Analysis Results:")
        print(f"Credibility Score: {data['credibility_score']}")
        print(f"Risk Level: {data['risk_level']}")
        print(f"Summary: {data['summary']}")
        
        print("\n🔍 Detailed Analysis:")
        detailed = data['detailed_analysis']
        for key, value in detailed.items():
            print(f"{key}: {value}")
            
        print("\n📚 Educational Tips:")
        for tip in data['educational_tips']:
            print(f"- {tip}")
    else:
        print("Analysis failed:", response.status_code, response.text)

if __name__ == "__main__":
    debug_text_analysis()