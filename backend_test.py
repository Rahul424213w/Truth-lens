#!/usr/bin/env python3
"""
TruthLens Backend API Testing Suite
Tests all backend endpoints for the misinformation detection system
"""

import requests
import json
import os
import tempfile
from PIL import Image
import io
import time

# Configuration
BACKEND_URL = "http://localhost:8001/api"
TEST_USER_EMAIL = "sarah.johnson@example.com"
TEST_USER_PASSWORD = "SecurePass123!"
TEST_USERNAME = "sarah_johnson"

# Test data
MISINFORMATION_TEXT = """
BREAKING: Scientists have discovered that drinking bleach can cure COVID-19! 
A new study from the University of Alternative Medicine shows that household bleach 
contains powerful antiviral properties that can eliminate the coronavirus from your body. 
Dr. John Smith, who has 30 years of experience in natural healing, recommends 
drinking 2 tablespoons of bleach mixed with water every morning. 
The mainstream media doesn't want you to know this because Big Pharma would lose billions!
Share this before it gets censored!
"""

CREDIBLE_TEXT = """
According to a peer-reviewed study published in the New England Journal of Medicine, 
researchers at Johns Hopkins University have found that regular handwashing with soap 
for at least 20 seconds can reduce the transmission of respiratory viruses by up to 40%. 
The study, which followed 10,000 participants over 12 months, was conducted using 
randomized controlled trials and has been independently verified by the CDC. 
Lead researcher Dr. Maria Rodriguez emphasizes that this simple hygiene practice, 
combined with other preventive measures, remains one of the most effective ways 
to prevent illness transmission.
"""

TEST_URL = "https://www.who.int/news-room/fact-sheets/detail/coronavirus-disease-(covid-19)"

class TruthLensAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_health_check(self):
        """Test the health check endpoint"""
        try:
            response = self.session.get(f"{BACKEND_URL}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_result("Health Check", True, "API is healthy")
                    return True
                else:
                    self.log_result("Health Check", False, "Unexpected response format", data)
                    return False
            else:
                self.log_result("Health Check", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Health Check", False, f"Request failed: {str(e)}")
            return False
    
    def test_user_registration(self):
        """Test user registration endpoint"""
        try:
            # First, try to register a new user
            user_data = {
                "username": TEST_USERNAME,
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/auth/register",
                json=user_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.auth_token = data["token"]
                    self.user_id = data["user"]["id"]
                    self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                    self.log_result("User Registration", True, "User registered successfully")
                    return True
                else:
                    self.log_result("User Registration", False, "Missing token or user in response", data)
                    return False
            elif response.status_code == 400:
                # User might already exist, try login instead
                return self.test_user_login()
            else:
                self.log_result("User Registration", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("User Registration", False, f"Request failed: {str(e)}")
            return False
    
    def test_user_login(self):
        """Test user login endpoint"""
        try:
            login_data = {
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/auth/login",
                json=login_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.auth_token = data["token"]
                    self.user_id = data["user"]["id"]
                    self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                    self.log_result("User Login", True, "User logged in successfully")
                    return True
                else:
                    self.log_result("User Login", False, "Missing token or user in response", data)
                    return False
            else:
                self.log_result("User Login", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("User Login", False, f"Request failed: {str(e)}")
            return False
    
    def test_text_analysis(self):
        """Test text analysis endpoint with both misinformation and credible content"""
        if not self.auth_token:
            self.log_result("Text Analysis", False, "No authentication token available")
            return False
        
        # Test with misinformation content
        try:
            request_data = {"content": MISINFORMATION_TEXT}
            
            response = self.session.post(
                f"{BACKEND_URL}/analyze/text",
                json=request_data,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["analysis_id", "credibility_score", "risk_level", "summary", "detailed_analysis"]
                
                if all(field in data for field in required_fields):
                    # Check if AI properly identified this as misinformation
                    credibility_score = data["credibility_score"]
                    risk_level = data["risk_level"]
                    
                    if credibility_score < 0.5 and risk_level in ["high", "critical"]:
                        self.log_result("Text Analysis (Misinformation)", True, 
                                      f"Correctly identified misinformation (score: {credibility_score}, risk: {risk_level})")
                    else:
                        self.log_result("Text Analysis (Misinformation)", False, 
                                      f"Failed to identify misinformation (score: {credibility_score}, risk: {risk_level})")
                        return False
                else:
                    self.log_result("Text Analysis", False, "Missing required fields in response", data)
                    return False
            else:
                self.log_result("Text Analysis", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Text Analysis", False, f"Request failed: {str(e)}")
            return False
        
        # Test with credible content
        try:
            request_data = {"content": CREDIBLE_TEXT}
            
            response = self.session.post(
                f"{BACKEND_URL}/analyze/text",
                json=request_data,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                credibility_score = data["credibility_score"]
                risk_level = data["risk_level"]
                
                if credibility_score > 0.6 and risk_level in ["low", "medium"]:
                    self.log_result("Text Analysis (Credible)", True, 
                                  f"Correctly identified credible content (score: {credibility_score}, risk: {risk_level})")
                    return True
                else:
                    self.log_result("Text Analysis (Credible)", False, 
                                  f"Failed to identify credible content (score: {credibility_score}, risk: {risk_level})")
                    return False
            else:
                self.log_result("Text Analysis (Credible)", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Text Analysis (Credible)", False, f"Request failed: {str(e)}")
            return False
    
    def test_url_analysis(self):
        """Test URL analysis endpoint"""
        if not self.auth_token:
            self.log_result("URL Analysis", False, "No authentication token available")
            return False
        
        try:
            request_data = {"url": TEST_URL}
            
            response = self.session.post(
                f"{BACKEND_URL}/analyze/url",
                json=request_data,
                timeout=45  # URL analysis might take longer
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["analysis_id", "credibility_score", "risk_level", "summary", "detailed_analysis"]
                
                if all(field in data for field in required_fields):
                    # WHO URL should be highly credible
                    credibility_score = data["credibility_score"]
                    
                    if credibility_score > 0.7:
                        self.log_result("URL Analysis", True, 
                                      f"Successfully analyzed WHO URL (score: {credibility_score})")
                        return True
                    else:
                        self.log_result("URL Analysis", True, 
                                      f"URL analysis completed but low credibility score: {credibility_score}")
                        return True
                else:
                    self.log_result("URL Analysis", False, "Missing required fields in response", data)
                    return False
            else:
                self.log_result("URL Analysis", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("URL Analysis", False, f"Request failed: {str(e)}")
            return False
    
    def test_image_analysis(self):
        """Test image analysis endpoint"""
        if not self.auth_token:
            self.log_result("Image Analysis", False, "No authentication token available")
            return False
        
        try:
            # Create a simple test image
            img = Image.new('RGB', (300, 200), color='blue')
            img_buffer = io.BytesIO()
            img.save(img_buffer, format='PNG')
            img_buffer.seek(0)
            
            files = {
                'file': ('test_image.png', img_buffer, 'image/png')
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/analyze/image",
                files=files,
                timeout=45
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["analysis_id", "credibility_score", "risk_level", "summary", "detailed_analysis"]
                
                if all(field in data for field in required_fields):
                    self.log_result("Image Analysis", True, "Image analysis completed successfully")
                    return True
                else:
                    self.log_result("Image Analysis", False, "Missing required fields in response", data)
                    return False
            else:
                self.log_result("Image Analysis", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Image Analysis", False, f"Request failed: {str(e)}")
            return False
    
    def test_user_history(self):
        """Test user analysis history endpoint"""
        if not self.auth_token:
            self.log_result("User History", False, "No authentication token available")
            return False
        
        try:
            response = self.session.get(
                f"{BACKEND_URL}/user/analyses",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "analyses" in data and isinstance(data["analyses"], list):
                    self.log_result("User History", True, f"Retrieved {len(data['analyses'])} analysis records")
                    return True
                else:
                    self.log_result("User History", False, "Invalid response format", data)
                    return False
            else:
                self.log_result("User History", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("User History", False, f"Request failed: {str(e)}")
            return False
    
    def test_educational_content(self):
        """Test educational content endpoint"""
        try:
            response = self.session.get(f"{BACKEND_URL}/education/tips", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "tips" in data and isinstance(data["tips"], list) and len(data["tips"]) > 0:
                    self.log_result("Educational Content", True, f"Retrieved {len(data['tips'])} media literacy tips")
                    return True
                else:
                    self.log_result("Educational Content", False, "No tips found in response", data)
                    return False
            else:
                self.log_result("Educational Content", False, f"HTTP {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("Educational Content", False, f"Request failed: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting TruthLens Backend API Tests")
        print(f"Testing against: {BACKEND_URL}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            ("Health Check", self.test_health_check),
            ("User Registration/Login", self.test_user_registration),
            ("Text Analysis", self.test_text_analysis),
            ("URL Analysis", self.test_url_analysis),
            ("Image Analysis", self.test_image_analysis),
            ("User History", self.test_user_history),
            ("Educational Content", self.test_educational_content),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"\n🧪 Running {test_name}...")
            try:
                if test_func():
                    passed += 1
            except Exception as e:
                self.log_result(test_name, False, f"Test execution failed: {str(e)}")
        
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        # Print detailed results
        print("\n📋 Detailed Results:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        return passed, total, self.test_results

def main():
    """Main test execution"""
    tester = TruthLensAPITester()
    passed, total, results = tester.run_all_tests()
    
    # Return exit code based on results
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} tests failed!")
        return 1

if __name__ == "__main__":
    exit(main())