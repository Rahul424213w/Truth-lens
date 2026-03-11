'use strict';

const fs   = require('fs');
const path = require('path');

// Patch mime-db if missing (Render fix)
const mimeDbDir  = path.join(__dirname, 'node_modules', 'mime-db');
const mimeDbJson = path.join(mimeDbDir, 'db.json');
if (!fs.existsSync(mimeDbJson)) {
  if (!fs.existsSync(mimeDbDir)) fs.mkdirSync(mimeDbDir, { recursive: true });
  const minimalDb = {
    "application/json":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["json","map"]},
    "application/octet-stream":{"source":"iana","compressible":false,"extensions":["bin","exe","dll"]},
    "application/x-www-form-urlencoded":{"source":"iana","compressible":true},
    "multipart/form-data":{"source":"iana"},
    "text/css":{"source":"iana","charset":"UTF-8","compressible":true,"extensions":["css"]},
    "text/html":{"source":"iana","compressible":true,"extensions":["html","htm"]},
    "text/javascript":{"source":"iana","compressible":true,"extensions":["js","mjs"]},
    "text/plain":{"source":"iana","compressible":true,"extensions":["txt"]},
    "image/gif":{"source":"iana","compressible":false,"extensions":["gif"]},
    "image/jpeg":{"source":"iana","compressible":false,"extensions":["jpeg","jpg"]},
    "image/png":{"source":"iana","compressible":false,"extensions":["png"]},
    "image/svg+xml":{"source":"iana","compressible":true,"extensions":["svg"]},
    "image/webp":{"source":"iana","compressible":false,"extensions":["webp"]},
    "font/woff":{"source":"iana","compressible":false,"extensions":["woff"]},
    "font/woff2":{"source":"iana","compressible":false,"extensions":["woff2"]}
  };
  fs.writeFileSync(mimeDbJson, JSON.stringify(minimalDb));
}

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const crypto    = require('crypto');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const Groq      = require('groq-sdk');

const app  = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'truthlens-secret-change-in-prod';

if (!process.env.GROQ_API_KEY) { console.error('❌ GROQ_API_KEY not set'); process.exit(1); }
if (!process.env.MONGODB_URI)  { console.error('❌ MONGODB_URI not set');  process.exit(1); }

let db;
const client = new MongoClient(process.env.MONGODB_URI);
async function connectDB() {
  await client.connect();
  db = client.db(process.env.DB_NAME || 'truthlens');
  console.log('✅  MongoDB connected');
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('analyses').createIndex({ userId: 1, createdAt: -1 });
  await db.collection('factChecks').createIndex({ userId: 1, createdAt: -1 });
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Model rotation with cooldowns ───────────────────────────────────────────
const TEXT_MODELS = ['llama-3.3-70b-versatile','llama-3.1-8b-instant','gemma2-9b-it','mixtral-8x7b-32768'];
// Vision models supported by Groq (check current availability)
const VISION_MODELS = ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview'];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const modelCooldowns = {};
function isCD(m) { const e=modelCooldowns[m]; if(!e)return false; if(Date.now()>e){delete modelCooldowns[m];return false;} return true; }
function setCD(m,ms=60000) { modelCooldowns[m]=Date.now()+ms; }
function isRL(e) { const m=(e.message||'').toLowerCase(); return e.status===429||m.includes('rate limit')||m.includes('429')||m.includes('quota'); }

// ─── Response cache ────────────────────────────────────────────────────────
const CACHE_TTL=30*60*1000; const responseCache=new Map();
function ck(p){return crypto.createHash('sha256').update(p).digest('hex').slice(0,32);}
function cGet(k){const e=responseCache.get(k);if(!e)return null;if(Date.now()-e.ts>CACHE_TTL){responseCache.delete(k);return null;}return e.v;}
function cSet(k,v){if(responseCache.size>=200)responseCache.delete(responseCache.keys().next().value);responseCache.set(k,{v,ts:Date.now()});}

async function callGroq(prompt) {
  const key=ck(prompt); const hit=cGet(key); if(hit)return hit;
  const trimmed=prompt.replace(/\s+/g,' ').trim();
  for(const model of TEXT_MODELS){
    if(isCD(model))continue;
    for(let a=0;a<3;a++){
      try{
        if(a>0)await sleep(1500*a);
        const res=await groq.chat.completions.create({model,messages:[{role:'system',content:'Respond with valid JSON only, no markdown, no preamble.'},{role:'user',content:trimmed}],temperature:0.1,max_tokens:2048});
        const text=res.choices?.[0]?.message?.content||'';
        if(!text.trim())continue;
        const r={success:true,text,model}; cSet(key,r); return r;
      }catch(e){
        if(isRL(e)){setCD(model);break;}
        await sleep(1000*(a+1));
      }
    }
  }
  return {success:false,text:'',model:null};
}

// ─── Vision call with model fallback ──────────────────────────────────────
async function callGroqVision(prompt, imageUrl) {
  for (const model of VISION_MODELS) {
    if (isCD(model)) continue;
    for (let a = 0; a < 2; a++) {
      try {
        if (a > 0) await sleep(2000 * a);
        const res = await groq.chat.completions.create({
          model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }],
          temperature: 0.1,
          max_tokens: 2048,
        });
        const text = res.choices?.[0]?.message?.content || '';
        if (!text.trim()) continue;
        return { success: true, text, model };
      } catch(e) {
        console.error(`Vision model ${model} error:`, e.message);
        if (isRL(e)) { setCD(model, 120000); break; }
        // If model not found or not supported, mark as cooldown and try next
        if (e.status === 404 || e.status === 400 || (e.message||'').includes('not supported') || (e.message||'').includes('does not exist')) {
          setCD(model, 3600000); // 1 hour cooldown for unsupported models
          break;
        }
        await sleep(1500 * (a + 1));
      }
    }
  }
  return { success: false, text: '', model: null };
}

function parseJSON(text){
  if(!text)return null;
  try{
    let c=text.replace(/^```json\s*/im,'').replace(/^```\s*/im,'').replace(/```\s*$/im,'').trim();
    const s=c.indexOf('{'),e=c.lastIndexOf('}');
    if(s===-1||e===-1)return null;
    return JSON.parse(c.substring(s,e+1));
  }catch(e){return null;}
}

// ─── Credibility score correction (more nuanced) ──────────────────────────
function correctScore(data, inputText) {
  const text = (inputText || '').toLowerCase();
  const cat  = (data.category || '').toLowerCase();

  // Hard overrides for obvious misinformation
  const deathClaim = /\b(is dead|has died|died today|found dead|passed away|was killed|was assassinated)\b/i;
  const knownFigure = /\b(modi|biden|trump|putin|obama|xi jinping|pope|musk|gates|zuckerberg|macron|zelensky|king charles|rahul gandhi|shah rukh|sachin tendulkar)\b/i;
  if (deathClaim.test(text) && knownFigure.test(text)) {
    data.credibilityScore = Math.floor(Math.random() * 8) + 1;
    data.category = 'fake';
    return data;
  }

  const conspiracies = /\b(flat earth|earth is flat|chemtrails|5g causes|vaccines cause autism|moon landing fake|illuminati|reptilian|covid is fake|microchip in vaccine)\b/i;
  if (conspiracies.test(text)) {
    data.credibilityScore = Math.floor(Math.random() * 10) + 1;
    data.category = 'fake';
    return data;
  }

  // Score band enforcement — allow some variance within bands
  const score = parseInt(data.credibilityScore) || 50;
  const variance = () => Math.floor(Math.random() * 8);

  if (cat === 'fake' && score > 25)
    data.credibilityScore = Math.max(1, Math.min(25, 8 + variance()));
  else if (cat === 'misleading' && (score < 26 || score > 44))
    data.credibilityScore = 28 + variance();
  else if (cat === 'unclear' && (score < 40 || score > 58))
    data.credibilityScore = 44 + variance();
  else if (cat === 'satire' && score > 45)
    data.credibilityScore = 15 + variance();
  else if (cat === 'clickbait' && score > 52)
    data.credibilityScore = 25 + variance();
  else if (cat === 'real' && score < 68)
    data.credibilityScore = 75 + variance();

  // Clamp
  data.credibilityScore = Math.min(100, Math.max(0, data.credibilityScore));
  return data;
}

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Not authenticated' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ success: false, error: 'Invalid or expired token' }); }
}
function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) { try { req.user = jwt.verify(token, JWT_SECRET); } catch {} }
  next();
}

// ─── Auth routes ──────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, error: 'Name, email and password required' });
    if (password.length < 6) return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const result = await db.collection('users').insertOne({ name, email: email.toLowerCase(), password: hash, createdAt: new Date(), analysisCount: 0 });
    const token = jwt.sign({ id: result.insertedId.toString(), email: email.toLowerCase(), name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: result.insertedId, name, email: email.toLowerCase() } });
  } catch(e) {
    if (e.code === 11000) return res.status(409).json({ success: false, error: 'Email already registered' });
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ success: false, error: 'Invalid email or password' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid email or password' });
    const token = jwt.sign({ id: user._id.toString(), email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, analysisCount: user.analysisCount } });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) }, { projection: { password: 0 } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/api/status', (req, res) => res.json({ provider: 'Groq', cacheSize: responseCache.size, visionModels: VISION_MODELS }));
app.delete('/api/cache', authMiddleware, (req, res) => { responseCache.clear(); res.json({ success: true }); });

// ─── Text Analysis ─────────────────────────────────────────────────────────
app.post('/api/analyze/text', optionalAuth, async (req, res) => {
  const { text } = req.body;
  if (!text || text.length < 10) return res.status(400).json({ success: false, error: 'Text must be at least 10 characters' });

  const prompt = `You are an expert fact-checker and misinformation analyst with 20+ years of experience.

Analyze the following text with precision and nuance.

SCORING RULES (NEVER output exactly 50):
- 0-10: Completely false, dangerous hoax, fabricated death/event
- 11-25: Mostly false, significant factual errors
- 26-40: Misleading, cherry-picked facts, missing critical context
- 41-55: Unclear, unverifiable, speculative
- 56-70: Mostly true, minor inaccuracies
- 71-85: Credible, well-supported claims
- 86-100: Highly credible, verifiable with authoritative sources

CRITICAL OVERRIDES:
- Unverified death claims of living public figures → score 2-8, category "fake"
- Debunked conspiracies (flat earth, 5G/COVID, etc.) → score 1-10, category "fake"
- Satire labeled as news → score 15-35, category "satire"

TEXT TO ANALYZE:
"""${text.substring(0, 3000)}"""

Respond ONLY with this exact JSON structure, no markdown:
{
  "credibilityScore": <integer 0-100, NEVER exactly 50>,
  "category": "<real|fake|misleading|clickbait|satire|unclear>",
  "verdict": "<one punchy sentence>",
  "analysis": "<3-4 sentences of substantive analysis>",
  "redFlags": ["<specific red flag>"],
  "positiveSignals": ["<specific positive signal>"],
  "languageAnalysis": {
    "tone": "<neutral|emotional|alarmist|balanced|sensational|matter-of-fact>",
    "emotionalWords": ["<word>"],
    "sensationalism": "<low|medium|high>",
    "readabilityLevel": "<basic|intermediate|advanced>"
  },
  "specificClaims": ["<claim>"],
  "claimVerdict": ["<verdict for each claim>"],
  "verificationSteps": ["<actionable step>"],
  "similarFakePatterns": ["<pattern>"],
  "trustworthinessBadges": ["<badge>"],
  "suggestions": ["<advice>"],
  "contextualBackground": "<2-3 sentences of context>"
}`;

  const result = await callGroq(prompt);
  if (!result.success) return res.json({ success: true, data: genericFallback(), warning: 'AI temporarily unavailable. Please try again.' });

  let data = parseJSON(result.text);
  if (!data) return res.json({ success: true, data: genericFallback(), warning: 'Could not parse AI response. Please retry.' });

  // Sanitize
  data.credibilityScore = Math.min(100, Math.max(0, parseInt(data.credibilityScore) || 50));
  if (data.credibilityScore === 50) data.credibilityScore = 49; // Never exactly 50
  data.category = data.category || 'unclear';
  data.redFlags = Array.isArray(data.redFlags) ? data.redFlags : [];
  data.positiveSignals = Array.isArray(data.positiveSignals) ? data.positiveSignals : [];
  data.verificationSteps = Array.isArray(data.verificationSteps) ? data.verificationSteps : [];
  data.suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
  data.specificClaims = Array.isArray(data.specificClaims) ? data.specificClaims : [];
  data.claimVerdict = Array.isArray(data.claimVerdict) ? data.claimVerdict : [];

  data = correctScore(data, text);

  const userId = req.user?.id || null;
  if (userId) {
    await db.collection('analyses').insertOne({ userId, type: 'text', inputPreview: text.substring(0, 200), ...data, createdAt: new Date() });
    await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $inc: { analysisCount: 1 } });
  }
  res.json({ success: true, data, model: result.model });
});

// ─── Image Analysis (FIXED) ───────────────────────────────────────────────
app.post('/api/analyze/image', optionalAuth, async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ success: false, error: 'Image data required' });

  // Validate base64 image format
  if (!image.startsWith('data:image/')) {
    return res.status(400).json({ success: false, error: 'Invalid image format. Must be a base64 data URL.' });
  }

  const prompt = `You are a forensic image analysis expert specializing in detecting manipulated, AI-generated, and misleading images.

Analyze this image thoroughly and provide a detailed credibility assessment.

ANALYSIS GUIDELINES:
- Look for signs of digital manipulation (inconsistent lighting, shadows, edges, metadata clues)
- Check for AI generation artifacts (unnatural textures, impossible details, repeating patterns)
- Assess if the image context seems authentic or staged
- Consider compositional elements and visual consistency

Respond ONLY with this JSON (no markdown, no explanation outside JSON):
{
  "credibilityScore": <integer 0-100>,
  "category": "<real|fake|misleading|unclear|ai-generated>",
  "verdict": "<one sentence summary>",
  "analysis": "<3-4 sentence detailed analysis>",
  "manipulationSigns": ["<specific sign of manipulation>"],
  "authenticitySignals": ["<signal supporting authenticity>"],
  "technicalAnalysis": {
    "compressionArtifacts": "<none|low|medium|high>",
    "lightingConsistency": "<consistent|inconsistent|unknown>",
    "shadowAnalysis": "<natural|unnatural|unknown>",
    "edgeAnalysis": "<clean|suspicious|unknown>",
    "noisePattern": "<natural|suspicious|unknown>"
  },
  "aiGenerationIndicators": ["<specific AI indicator>"],
  "contextClues": ["<contextual observation>"],
  "textInImage": "<any text visible in the image or 'none'>",
  "verificationSteps": ["<step to verify this image>"],
  "forensicBadges": ["<badge>"],
  "suggestions": ["<advice for verification>"]
}`;

  const visionResult = await callGroqVision(prompt, image);

  let data;
  if (visionResult.success) {
    data = parseJSON(visionResult.text);
    if (!data) {
      // Try to extract score from text if JSON failed
      console.warn('Vision JSON parse failed, using fallback');
    }
  }

  if (!data) {
    // If vision AI failed, do a text-based analysis of what we know about the image
    // (dimensions, file type, size) as a fallback
    const isLikelyAI = image.length > 500000; // Very rough heuristic
    data = {
      credibilityScore: 50,
      category: 'unclear',
      verdict: 'Image received but AI vision analysis is temporarily limited.',
      analysis: 'The image was uploaded successfully. For detailed forensic analysis, the AI vision service encountered a temporary limitation. Please use the manual verification tools below.',
      manipulationSigns: ['AI vision analysis unavailable — use manual tools'],
      authenticitySignals: ['Image successfully uploaded'],
      technicalAnalysis: {
        compressionArtifacts: 'unknown',
        lightingConsistency: 'unknown',
        shadowAnalysis: 'unknown',
        edgeAnalysis: 'unknown',
        noisePattern: 'unknown'
      },
      aiGenerationIndicators: [],
      contextClues: [],
      textInImage: 'unknown',
      verificationSteps: [
        'Upload to TinEye.com for reverse image search',
        'Try Google Images (images.google.com)',
        'Check FotoForensics.com for metadata and ELA analysis',
        'Use aiornot.com to detect AI generation',
        'Try Hive Moderation (hivemoderation.com) for deepfake detection'
      ],
      forensicBadges: [],
      suggestions: [
        'Start with TinEye or Google reverse image search',
        'Check original source and upload date',
        'Look for identical images with different captions',
        'Use FotoForensics for Error Level Analysis (ELA)'
      ]
    };
  }

  // Sanitize
  data.credibilityScore = Math.min(100, Math.max(0, parseInt(data.credibilityScore) || 50));
  data.category = data.category || 'unclear';
  data.manipulationSigns = Array.isArray(data.manipulationSigns) ? data.manipulationSigns : [];
  data.authenticitySignals = Array.isArray(data.authenticitySignals) ? data.authenticitySignals : [];
  data.verificationSteps = Array.isArray(data.verificationSteps) ? data.verificationSteps : [];
  data.suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
  data.aiGenerationIndicators = Array.isArray(data.aiGenerationIndicators) ? data.aiGenerationIndicators : [];

  // Score normalization for images
  if (data.category === 'fake' && data.credibilityScore > 25) data.credibilityScore = Math.floor(Math.random() * 18) + 5;
  else if (data.category === 'ai-generated' && data.credibilityScore > 40) data.credibilityScore = Math.floor(Math.random() * 25) + 10;
  else if (data.category === 'real' && data.credibilityScore < 70) data.credibilityScore = Math.floor(Math.random() * 20) + 72;

  const userId = req.user?.id || null;
  if (userId) {
    await db.collection('analyses').insertOne({ userId, type: 'image', inputPreview: '[image upload]', ...data, createdAt: new Date() });
    await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $inc: { analysisCount: 1 } });
  }

  res.json({ success: true, data, model: visionResult.model || 'fallback' });
});

// ─── Article Analysis ─────────────────────────────────────────────────────
app.post('/api/analyze/article', optionalAuth, async (req, res) => {
  const { url, content } = req.body;
  if (!url || !content) return res.status(400).json({ success: false, error: 'URL and content required' });

  const domain = (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } })();

  const prompt = `You are a senior journalist and media literacy expert with extensive fact-checking experience.

Analyze this article for credibility, bias, and journalistic standards.

Domain: ${domain}
Article Content:
"""${content.substring(0, 3500)}"""

SCORING: 0-20=fabricated, 21-40=misleading, 41-55=unclear, 56-75=mostly credible, 76-100=highly credible
NEVER default to exactly 50.

Respond ONLY with this JSON:
{
  "credibilityScore": <integer 0-100>,
  "category": "<real|fake|misleading|clickbait|satire|unclear>",
  "verdict": "<one sentence>",
  "analysis": "<5-6 sentences>",
  "sourceAssessment": {
    "domain": "${domain}",
    "domainType": "<mainstream-news|independent-news|tabloid|satire|blog|government|academic|unknown>",
    "knownBias": "<left|center-left|center|center-right|right|unknown>",
    "reliabilityRating": "<high|medium|low|unknown>",
    "notes": "<notes>"
  },
  "redFlags": ["<flag>"],
  "positiveSignals": ["<signal>"],
  "journalisticStandards": {
    "hasAuthor": false,
    "hasDate": false,
    "hasSources": false,
    "hasQuotes": false,
    "editorialStandards": "<professional|mixed|poor>"
  },
  "specificClaims": ["<claim>"],
  "claimAccuracy": ["<assessment>"],
  "biasIndicators": ["<indicator>"],
  "verificationSteps": ["<step>"],
  "suggestions": ["<advice>"],
  "relatedCredibleSources": ["<source>"]
}`;

  const result = await callGroq(prompt);
  let data = result.success ? parseJSON(result.text) : null;

  if (!data) data = {
    credibilityScore: 50, category: 'unclear', verdict: 'Could not analyze.',
    analysis: 'Manual review recommended.', sourceAssessment: { domain, domainType: 'unknown', knownBias: 'unknown', reliabilityRating: 'unknown', notes: '' },
    redFlags: ['Analysis failed'], positiveSignals: [], journalisticStandards: { hasAuthor: false, hasDate: false, hasSources: false, hasQuotes: false, editorialStandards: 'unknown' },
    specificClaims: [], claimAccuracy: [], biasIndicators: [], verificationSteps: ['MediaBiasFactCheck.com'], suggestions: ['Verify with Reuters'], relatedCredibleSources: ['Reuters', 'AP News', 'BBC']
  };

  data.credibilityScore = Math.min(100, Math.max(0, parseInt(data.credibilityScore) || 50));
  data = correctScore(data, content);

  const userId = req.user?.id || null;
  if (userId) {
    await db.collection('analyses').insertOne({ userId, type: 'article', inputPreview: url, ...data, createdAt: new Date() });
    await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $inc: { analysisCount: 1 } });
  }
  res.json({ success: true, data, model: result.model });
});

// ─── Source Compare ───────────────────────────────────────────────────────
app.post('/api/analyze/compare', optionalAuth, async (req, res) => {
  const { sources } = req.body;
  if (!sources || sources.length < 2) return res.status(400).json({ success: false, error: 'At least 2 sources required' });

  const formatted = sources.map((s, i) => `SOURCE ${i+1}:\n${s.substring(0, 1000)}`).join('\n\n');
  const prompt = `Compare these ${sources.length} news sources/reports about the same topic and assess consistency and credibility:

${formatted}

Respond ONLY with this JSON:
{
  "consistencyScore": <0-100>,
  "verdict": "<one sentence>",
  "analysis": "<4-5 sentences>",
  "agreements": ["<point>"],
  "disagreements": ["<conflict>"],
  "mostReliableSource": "<source and why>",
  "leastReliableSource": "<source and why>",
  "biasComparison": ["<difference>"],
  "factualConsistency": {
    "consistentFacts": ["<fact>"],
    "conflictingFacts": ["<fact>"],
    "uniqueClaims": ["<claim>"]
  },
  "narrativeDifferences": ["<difference>"],
  "recommendations": ["<advice>"],
  "truthLikelihood": "<assessment>"
}`;

  const result = await callGroq(prompt);
  let data = result.success ? parseJSON(result.text) : null;
  if (!data) data = { consistencyScore: 50, verdict: 'Could not compare.', analysis: 'Manual comparison recommended.', agreements: [], disagreements: [], mostReliableSource: 'Unknown', leastReliableSource: 'Unknown', biasComparison: [], factualConsistency: { consistentFacts: [], conflictingFacts: [], uniqueClaims: [] }, narrativeDifferences: [], recommendations: ['Check Reuters'], truthLikelihood: 'Manual verification required' };
  data.consistencyScore = Math.min(100, Math.max(0, parseInt(data.consistencyScore) || 50));

  const userId = req.user?.id || null;
  if (userId) {
    await db.collection('analyses').insertOne({ userId, type: 'compare', inputPreview: sources[0].substring(0, 200), ...data, createdAt: new Date() });
    await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $inc: { analysisCount: 1 } });
  }
  res.json({ success: true, data, model: result.model });
});

// ─── Fact Check ───────────────────────────────────────────────────────────
app.post('/api/factcheck', optionalAuth, async (req, res) => {
  const { claim } = req.body;
  if (!claim) return res.status(400).json({ success: false, error: 'Claim required' });

  const prompt = `You are a professional fact-checker with expert knowledge across science, history, politics, health, and culture.

Evaluate this claim with precision: "${claim}"

RULES:
- If this is a claim about a living public figure being dead and you have no knowledge of it → verdict FALSE, confidence 90+
- Debunked scientific consensus (flat earth, anti-vax, etc.) → FALSE, confidence 95+
- Well-established historical facts → TRUE, confidence 85+
- Be direct and specific, never wishy-washy

Respond ONLY with this JSON:
{
  "verdict": "<TRUE|FALSE|MOSTLY TRUE|MOSTLY FALSE|MIXED|UNVERIFIABLE|OUTDATED>",
  "confidence": <0-100>,
  "shortVerdict": "<punchy one-liner under 15 words>",
  "explanation": "<3-4 sentences with specific facts and evidence>",
  "keyFacts": ["<specific fact>"],
  "context": "<background context>",
  "specificSources": ["<source name>"],
  "relatedMisconceptions": ["<myth>"],
  "originOfClaim": "<where this claim originated>",
  "expertConsensus": "<scientific/expert consensus>"
}`;

  const result = await callGroq(prompt);
  if (!result.success) return res.json({ success: true, warning: 'AI unavailable.', data: { verdict: 'UNVERIFIABLE', confidence: 0, shortVerdict: 'AI unavailable.', explanation: 'Verify manually.', keyFacts: [], context: '', specificSources: ['Snopes.com', 'FactCheck.org', 'PolitiFact.com'], relatedMisconceptions: [], originOfClaim: '', expertConsensus: '' } });

  let data = parseJSON(result.text);
  if (!data) data = { verdict: 'UNVERIFIABLE', confidence: 30, shortVerdict: 'Could not parse.', explanation: result.text.substring(0, 400), keyFacts: [], context: '', specificSources: ['Snopes.com', 'FactCheck.org'], relatedMisconceptions: [], originOfClaim: '', expertConsensus: '' };

  data.confidence = Math.min(100, Math.max(0, parseInt(data.confidence) || 50));
  data.verdict = data.verdict || 'UNVERIFIABLE';
  // Boost confidence if verdict is definitive
  if (data.verdict === 'FALSE' && data.confidence < 70) data.confidence = 85;
  if (data.verdict === 'TRUE' && data.confidence < 70) data.confidence = 80;

  const userId = req.user?.id || null;
  if (userId) {
    await db.collection('factChecks').insertOne({ userId, claim, ...data, createdAt: new Date() });
    await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $inc: { analysisCount: 1 } });
  }
  res.json({ success: true, data, model: result.model });
});

// ─── History & Stats ──────────────────────────────────────────────────────
app.get('/api/history', optionalAuth, async (req, res) => {
  if (!req.user) return res.json({ success: true, data: [], guest: true });
  const limit = parseInt(req.query.limit) || 50;
  const type = req.query.type;
  const filter = { userId: req.user.id };
  if (type) filter.type = type;
  const data = await db.collection('analyses').find(filter).sort({ createdAt: -1 }).limit(limit).toArray();
  res.json({ success: true, data });
});

app.delete('/api/history/:id', authMiddleware, async (req, res) => {
  try { await db.collection('analyses').deleteOne({ _id: new ObjectId(req.params.id), userId: req.user.id }); } catch {}
  res.json({ success: true });
});

app.get('/api/stats', optionalAuth, async (req, res) => {
  if (!req.user) return res.json({ success: true, data: { totalAnalyses: 0, byType: [], byCategory: [], averageCredibilityScore: 0 }, guest: true });
  const analyses = await db.collection('analyses').find({ userId: req.user.id }).toArray();
  const total = analyses.length;
  const byType = Object.entries(analyses.reduce((a, x) => { a[x.type] = (a[x.type] || 0) + 1; return a; }, {})).map(([type, count]) => ({ type, count }));
  const byCategory = Object.entries(analyses.reduce((a, x) => { a[x.category] = (a[x.category] || 0) + 1; return a; }, {})).map(([category, count]) => ({ category, count }));
  const avgScore = total > 0 ? Math.round(analyses.reduce((s, x) => s + (x.credibilityScore || 0), 0) / total) : 0;
  res.json({ success: true, data: { totalAnalyses: total, byType, byCategory, averageCredibilityScore: avgScore } });
});

// Serve frontend for all non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use((err, req, res, next) => res.status(500).json({ success: false, error: err.message }));

function genericFallback() {
  return { credibilityScore: 48, category: 'unclear', verdict: 'AI temporarily unavailable — please retry.', analysis: 'The analysis service is temporarily unavailable. Please try again in a moment.', redFlags: ['Automated analysis failed'], positiveSignals: [], languageAnalysis: { tone: 'unknown', emotionalWords: [], sensationalism: 'unknown', readabilityLevel: 'unknown' }, specificClaims: [], claimVerdict: [], verificationSteps: ['Snopes.com', 'FactCheck.org', 'Reuters.com', 'PolitiFact.com'], similarFakePatterns: [], trustworthinessBadges: [], suggestions: ['Try again in a few seconds', 'Check your internet connection'], contextualBackground: '' };
}

connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅  TruthLens v5 running on port ${PORT}`);
    console.log(`   Vision models: ${VISION_MODELS.join(', ')}`);
  });
}).catch(e => { console.error('❌ Startup failed:', e.message); process.exit(1); });
