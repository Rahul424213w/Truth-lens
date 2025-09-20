import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';
import api from './services/api';

// Context for authentication
const AuthContext = createContext();

// Custom hook to use auth context
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// AuthProvider component
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const data = await api.login(email, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const register = async (username, email, password) => {
    try {
      const data = await api.register(username, email, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Auth components
const AuthModal = ({ isOpen, onClose, mode, onSwitchMode }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    let result;
    if (mode === 'login') {
      result = await login(formData.email, formData.password);
    } else {
      result = await register(formData.username, formData.email, formData.password);
    }

    if (result.success) {
      onClose();
      setFormData({ username: '', email: '', password: '' });
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-6 text-center">
          {mode === 'login' ? 'Sign In' : 'Sign Up'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          )}
          
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          
          {error && <p className="text-red-500 text-sm">{error}</p>}
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Sign Up')}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-gray-600">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={onSwitchMode}
              className="text-blue-600 hover:text-blue-700 underline"
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// Main Analysis Components
const AnalysisCard = ({ title, description, icon, onClick, disabled = false }) => (
  <div
    onClick={disabled ? undefined : onClick}
    className={`p-6 bg-white rounded-xl shadow-lg border hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105 ${
      disabled ? 'opacity-50 cursor-not-allowed' : ''
    }`}
  >
    <div className="flex items-center mb-4">
      <div className="text-3xl mr-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
    </div>
    <p className="text-gray-600 mb-4">{description}</p>
    <div className="text-blue-600 font-medium">
      {disabled ? 'Coming Soon' : 'Analyze Now →'}
    </div>
  </div>
);

const ResultCard = ({ result, onClose }) => {
  const getRiskColor = (risk) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 0.7) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    if (score >= 0.3) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Analysis Results</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Score and Risk Level */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Credibility Score</h3>
              <div className={`text-3xl font-bold ${getScoreColor(result.credibility_score)}`}>
                {(result.credibility_score * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Risk Level</h3>
              <span className={`px-3 py-1 rounded-full font-medium uppercase text-sm ${getRiskColor(result.risk_level)}`}>
                {result.risk_level}
              </span>
            </div>
          </div>
          
          {/* Summary */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Summary</h3>
            <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{result.summary}</p>
          </div>
          
          {/* Detailed Analysis */}
          {result.detailed_analysis && (
            <div className="space-y-4">
              {result.detailed_analysis.red_flags && result.detailed_analysis.red_flags.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-red-600">⚠️ Red Flags</h3>
                  <ul className="list-disc list-inside space-y-1 bg-red-50 p-4 rounded-lg">
                    {result.detailed_analysis.red_flags.map((flag, index) => (
                      <li key={index} className="text-red-800">{flag}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {result.detailed_analysis.positive_indicators && result.detailed_analysis.positive_indicators.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-green-600">✅ Positive Indicators</h3>
                  <ul className="list-disc list-inside space-y-1 bg-green-50 p-4 rounded-lg">
                    {result.detailed_analysis.positive_indicators.map((indicator, index) => (
                      <li key={index} className="text-green-800">{indicator}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {result.detailed_analysis.manipulation_techniques && result.detailed_analysis.manipulation_techniques.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-purple-600">🎭 Manipulation Techniques Detected</h3>
                  <ul className="list-disc list-inside space-y-1 bg-purple-50 p-4 rounded-lg">
                    {result.detailed_analysis.manipulation_techniques.map((technique, index) => (
                      <li key={index} className="text-purple-800">{technique}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {result.detailed_analysis.source_analysis && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">📊 Source Analysis</h3>
                  <p className="text-gray-700 bg-blue-50 p-4 rounded-lg">{result.detailed_analysis.source_analysis}</p>
                </div>
              )}
            </div>
          )}
          
          {/* Educational Tips */}
          {result.educational_tips && result.educational_tips.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2 text-blue-600">💡 Educational Tips</h3>
              <div className="space-y-2">
                {result.educational_tips.map((tip, index) => (
                  <div key={index} className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
                    <p className="text-blue-800">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TextAnalyzer = ({ onResult, onBack }) => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!content.trim()) return;
    
    setIsLoading(true);
    try {
      const result = await api.analyzeText(content);
      await api.saveAnalysis({
        id: Date.now().toString(),
        content_type: 'text',
        content: content.substring(0, 100) + '...',
        credibility_score: result.credibility_score,
        risk_level: result.risk_level,
        created_at: new Date().toISOString()
      });
      onResult(result);
    } catch (error) {
      alert('Analysis failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button
        onClick={onBack}
        className="mb-6 flex items-center text-blue-600 hover:text-blue-700"
      >
        ← Back to Dashboard
      </button>
      
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Text Content Analysis</h2>
        
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Enter text content to analyze for misinformation:
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste the text content you want to analyze here..."
            className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          
          <button
            onClick={handleAnalyze}
            disabled={!content.trim() || isLoading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Analyzing...' : 'Analyze Content'}
          </button>
        </div>
      </div>
    </div>
  );
};

const URLAnalyzer = ({ onResult, onBack }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    
    setIsLoading(true);
    try {
      const result = await api.analyzeURL(url);
      await api.saveAnalysis({
        id: Date.now().toString(),
        content_type: 'url',
        content: url,
        credibility_score: result.credibility_score,
        risk_level: result.risk_level,
        created_at: new Date().toISOString()
      });
      onResult(result);
    } catch (error) {
      alert('Analysis failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button
        onClick={onBack}
        className="mb-6 flex items-center text-blue-600 hover:text-blue-700"
      >
        ← Back to Dashboard
      </button>
      
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">URL Credibility Analysis</h2>
        
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Enter URL to analyze for credibility and misinformation:
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          
          <button
            onClick={handleAnalyze}
            disabled={!url.trim() || isLoading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Analyzing...' : 'Analyze URL'}
          </button>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">What we analyze:</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• Source credibility and reputation</li>
            <li>• Content accuracy and potential bias</li>
            <li>• Signs of manipulation or misinformation</li>
            <li>• Domain authority and trustworthiness</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const ImageAnalyzer = ({ onResult, onBack }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    
    setIsLoading(true);
    try {
      const result = await api.analyzeImage(file);
      await api.saveAnalysis({
        id: Date.now().toString(),
        content_type: 'image',
        content: `Image: ${file.name}`,
        credibility_score: result.credibility_score,
        risk_level: result.risk_level,
        created_at: new Date().toISOString()
      });
      onResult(result);
    } catch (error) {
      alert('Analysis failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button
        onClick={onBack}
        className="mb-6 flex items-center text-blue-600 hover:text-blue-700"
      >
        ← Back to Dashboard
      </button>
      
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Image Analysis</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload an image to analyze for manipulation or misinformation:
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {preview && (
            <div className="flex justify-center">
              <img
                src={preview}
                alt="Preview"
                className="max-w-full max-h-64 rounded-lg shadow-md"
              />
            </div>
          )}
          
          <button
            onClick={handleAnalyze}
            disabled={!file || isLoading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Analyzing...' : 'Analyze Image'}
          </button>
        </div>
        
        <div className="mt-6 p-4 bg-purple-50 rounded-lg">
          <h3 className="font-semibold text-purple-800 mb-2">What we analyze:</h3>
          <ul className="text-purple-700 text-sm space-y-1">
            <li>• Signs of digital manipulation or deepfakes</li>
            <li>• Misleading context or misattribution</li>
            <li>• Visual propaganda techniques</li>
            <li>• Image authenticity indicators</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ onAnalyzeText, onAnalyzeURL, onAnalyzeImage }) => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="text-3xl mr-3">🔍</div>
              <h1 className="text-2xl font-bold text-gray-900">TruthLens</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user.username}!</span>
              <button
                onClick={logout}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Combat Misinformation with AI
          </h2>
          <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto">
            Detect fake news, analyze source credibility, and learn to identify misleading content. 
            Powered by advanced AI to help you navigate the digital information landscape.
          </p>
        </div>
      </section>

      {/* Analysis Options */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Choose Your Analysis Type
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <AnalysisCard
              title="Text Analysis"
              description="Analyze text content for misinformation, bias, and manipulation techniques"
              icon="📝"
              onClick={onAnalyzeText}
            />
            
            <AnalysisCard
              title="URL Credibility Check"
              description="Verify source credibility and analyze web content for trustworthiness"
              icon="🌐"
              onClick={onAnalyzeURL}
            />
            
            <AnalysisCard
              title="Image Analysis"
              description="Detect manipulated images and visual misinformation"
              icon="🖼️"
              onClick={onAnalyzeImage}
            />
          </div>
        </div>
      </section>

      {/* Educational Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Media Literacy Tips
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-6 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Check the Source</h4>
              <p className="text-blue-700">Always verify the credibility and reputation of the information source.</p>
            </div>
            
            <div className="bg-green-50 p-6 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">Cross-Reference</h4>
              <p className="text-green-700">Look for corroboration from multiple reliable sources.</p>
            </div>
            
            <div className="bg-purple-50 p-6 rounded-lg">
              <h4 className="font-semibold text-purple-800 mb-2">Analyze Language</h4>
              <p className="text-purple-700">Be wary of emotional or sensational language that may indicate bias.</p>
            </div>
            
            <div className="bg-yellow-50 p-6 rounded-lg">
              <h4 className="font-semibold text-yellow-800 mb-2">Check Dates</h4>
              <p className="text-yellow-700">Ensure content is current and hasn't been taken out of context.</p>
            </div>
            
            <div className="bg-red-50 p-6 rounded-lg">
              <h4 className="font-semibold text-red-800 mb-2">Reverse Image Search</h4>
              <p className="text-red-700">Verify images haven't been manipulated or misused.</p>
            </div>
            
            <div className="bg-indigo-50 p-6 rounded-lg">
              <h4 className="font-semibold text-indigo-800 mb-2">Question Extraordinary Claims</h4>
              <p className="text-indigo-700">Extraordinary claims require extraordinary evidence.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

// Main App Component
function App() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [currentView, setCurrentView] = useState('dashboard');
  const [analysisResult, setAnalysisResult] = useState(null);

  const { user, loading } = useAuth();

  const handleAnalysisResult = (result) => {
    setAnalysisResult(result);
  };

  const handleCloseResult = () => {
    setAnalysisResult(null);
    setCurrentView('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Landing Page for Non-Authenticated Users */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <div className="text-3xl mr-3">🔍</div>
                <h1 className="text-2xl font-bold text-gray-900">TruthLens</h1>
              </div>
              
              <div className="space-x-4">
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setShowAuthModal(true);
                  }}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthMode('register');
                    setShowAuthModal(true);
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              Combat Misinformation with AI
            </h2>
            <p className="text-xl text-gray-700 mb-12 max-w-3xl mx-auto">
              TruthLens uses advanced AI to help you identify fake news, analyze source credibility, 
              and learn to spot misleading content. Join the fight against misinformation.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="bg-white p-8 rounded-xl shadow-lg">
                <div className="text-4xl mb-4">🧠</div>
                <h3 className="text-xl font-semibold mb-4">AI-Powered Analysis</h3>
                <p className="text-gray-600">Advanced machine learning algorithms analyze content for misinformation patterns.</p>
              </div>
              
              <div className="bg-white p-8 rounded-xl shadow-lg">
                <div className="text-4xl mb-4">📚</div>
                <h3 className="text-xl font-semibold mb-4">Educational Insights</h3>
                <p className="text-gray-600">Learn to identify manipulation techniques and improve your media literacy skills.</p>
              </div>
              
              <div className="bg-white p-8 rounded-xl shadow-lg">
                <div className="text-4xl mb-4">🔒</div>
                <h3 className="text-xl font-semibold mb-4">Secure & Private</h3>
                <p className="text-gray-600">Your data is protected with enterprise-grade security and privacy measures.</p>
              </div>
            </div>
            
            <button
              onClick={() => {
                setAuthMode('register');
                setShowAuthModal(true);
              }}
              className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Get Started - It's Free
            </button>
          </div>
        </main>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          mode={authMode}
          onSwitchMode={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
        />
      </div>
    );
  }

  return (
    <div className="App">
      {currentView === 'dashboard' && (
        <Dashboard
          onAnalyzeText={() => setCurrentView('text')}
          onAnalyzeURL={() => setCurrentView('url')}
          onAnalyzeImage={() => setCurrentView('image')}
        />
      )}
      
      {currentView === 'text' && (
        <TextAnalyzer
          onResult={handleAnalysisResult}
          onBack={() => setCurrentView('dashboard')}
        />
      )}
      
      {currentView === 'url' && (
        <URLAnalyzer
          onResult={handleAnalysisResult}
          onBack={() => setCurrentView('dashboard')}
        />
      )}
      
      {currentView === 'image' && (
        <ImageAnalyzer
          onResult={handleAnalysisResult}
          onBack={() => setCurrentView('dashboard')}
        />
      )}
      
      {analysisResult && (
        <ResultCard
          result={analysisResult}
          onClose={handleCloseResult}
        />
      )}
    </div>
  );
}

// Wrap App with AuthProvider
export default function AppWithAuth() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}