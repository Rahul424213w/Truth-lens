const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── JSON File Database ──────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'db.json');

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const empty = { analyses: [], factChecks: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2));
      return empty;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch { return { analyses: [], factChecks: [] }; }
}

function writeDB(data) {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }
  catch (e) { console.error('DB write error:', e.message); }
}

function saveAnalysis(type, inputPreview, data) {
  const db = readDB();
  db.analyses.unshift({
    id: Date.now(), type,
    input_preview: (inputPreview || '').substring(0, 200),
    credibility_score: data.credibilityScore || data.consistencyScore || 0,
    category: data.category || 'unknown',
    analysis: data.analysis || '',
    red_flags: data.redFlags || data.manipulationSigns || [],
    full_result: data,
    created_at: new Date().toISOString()
  });
  if (db.analyses.length > 200) db.analyses = db.analyses.slice(0, 200);
  writeDB(db);
}

function saveFactCheck(claim, data) {
  const db = readDB();
  db.factChecks.unshift({
    id: Date.now(), claim,
    verdict: data.verdict, explanation: data.explanation,
    sources: data.sources || [],
    created_at: new Date().toISOString()
  });
  if (db.factChecks.length > 200) db.factChecks = db.factChecks.slice(0, 200);
  writeDB(db);
}

// ── Gemini Setup ─────────────────────────────────────────────────────────────
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not set in .env'); process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use((req, res, next) => { console.log(`${req.method} ${req.url}`); next(); });

// ── Core AI call ──────────────────────────────────────────────────────────────
// Free-tier confirmed models in priority order
const MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

async function callGemini(prompt, imageData = null) {
  for (const name of MODELS) {
    try {
      console.log(`Trying model: ${name}`);
      const model = genAI.getGenerativeModel({
        model: name,
        generationConfig: {
          temperature: 0.1,       // Low temp = more deterministic, less hallucination
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      });

      const parts = imageData
        ? [{ text: prompt }, { inlineData: imageData }]
        : [{ text: prompt }];

      const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
      const text = result.response.text();
      console.log(`✅ ${name} responded (${text.length} chars)`);
      console.log('Raw response preview:', text.substring(0, 300));
      return { success: true, text, model: name };
    } catch (e) {
      console.log(`❌ ${name}: ${e.message}`);
    }
  }
  return { success: false, text: '', model: null };
}

// ── JSON parser with robust fallback ─────────────────────────────────────────
function parseJSON(text) {
  if (!text) return null;
  try {
    // Strip markdown fences
    let clean = text
      .replace(/^```json\s*/im, '')
      .replace(/^```\s*/im, '')
      .replace(/```\s*$/im, '')
      .trim();

    // Find the outermost JSON object
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1 || end === -1) return null;

    clean = clean.substring(start, end + 1);
    return JSON.parse(clean);
  } catch (e) {
    console.error('JSON parse error:', e.message);
    console.error('Attempted to parse:', text.substring(0, 500));
    return null;
  }
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ════════════════════════════════════════════════════════════════════════════
// TEXT ANALYSIS
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/analyze/text', async (req, res) => {
  const { text } = req.body;
  if (!text || text.length < 10)
    return res.status(400).json({ success: false, error: 'Text must be at least 10 characters' });

  const prompt = `You are an expert fact-checker and misinformation analyst with deep knowledge of current events, scientific consensus, and journalism standards. Your job is to analyze the SPECIFIC content below — not give generic advice.

CRITICALLY IMPORTANT:
- Base your analysis on the ACTUAL TEXT provided, not on generic templates
- Identify the SPECIFIC claims made in this exact text
- Give a credibility score based on THIS content specifically
- If the text makes specific factual claims, evaluate those specific claims
- Do NOT give the same generic response for all texts

TEXT TO ANALYZE:
"""
${text}
"""

Analyze the above text thoroughly. Then respond with ONLY a JSON object (no markdown, no explanation, just the JSON):

{
  "credibilityScore": <integer 0-100 based on THIS specific text>,
  "category": "<one of: real|fake|misleading|clickbait|satire|unclear>",
  "verdict": "<specific one-sentence verdict about THIS text>",
  "analysis": "<3-4 sentences analyzing the SPECIFIC claims, language, and credibility signals found in THIS text>",
  "redFlags": [<specific red flags found IN THIS TEXT — be concrete, not generic>],
  "positiveSignals": [<specific credibility signals found IN THIS TEXT>],
  "languageAnalysis": {
    "tone": "<neutral|emotional|alarmist|balanced|sensational|matter-of-fact>",
    "emotionalWords": [<list of actual emotional/loaded words found in the text>],
    "sensationalism": "<low|medium|high>",
    "readabilityLevel": "<basic|intermediate|advanced>"
  },
  "specificClaims": [<list the exact factual claims made in this text that can be verified>],
  "claimVerdict": [<for each claim above, state if it is true/false/unverifiable based on your knowledge>],
  "verificationSteps": [<specific steps to verify the claims IN THIS text, mentioning relevant fact-check sites or primary sources>],
  "similarFakePatterns": [<if this resembles known misinformation patterns, name them specifically>],
  "trustworthinessBadges": [<specific positive markers present: e.g., "Cites specific date: March 2024", "Names a specific source: WHO">],
  "suggestions": [<specific actionable advice for THIS text>],
  "contextualBackground": "<1-2 sentences of relevant background context about the topic being discussed>"
}`;

  const result = await callGemini(prompt);

  if (!result.success) {
    return res.json({ success: true, data: genericFallback('text', text) });
  }

  const data = parseJSON(result.text);
  if (!data) {
    console.error('Failed to parse Gemini response for text analysis');
    return res.json({ success: true, data: genericFallback('text', text) });
  }

  // Ensure required fields exist
  data.credibilityScore = Math.min(100, Math.max(0, parseInt(data.credibilityScore) || 50));
  data.category = data.category || 'unclear';
  data.redFlags = Array.isArray(data.redFlags) ? data.redFlags : [];
  data.positiveSignals = Array.isArray(data.positiveSignals) ? data.positiveSignals : [];
  data.verificationSteps = Array.isArray(data.verificationSteps) ? data.verificationSteps : [];
  data.suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

  saveAnalysis('text', text, data);
  res.json({ success: true, data });
});

// ════════════════════════════════════════════════════════════════════════════
// IMAGE ANALYSIS
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/analyze/image', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ success: false, error: 'Image data required' });

  const base64Data = image.split(',')[1];
  const mimeType = image.split(';')[0].split(':')[1];

  const prompt = `You are a digital forensics expert. Carefully examine this image for signs of manipulation, AI generation, or misleading use.

Look for:
- Unnatural lighting or shadows
- Inconsistent noise patterns (signs of splicing)
- AI generation artifacts (perfect skin, weird fingers, blurred backgrounds, unnatural symmetry)
- Text in the image that may be fake
- Signs the image is taken out of context
- Compression artifacts from multiple re-saves
- Metadata inconsistencies visible from the content

Respond with ONLY a JSON object (no markdown):
{
  "credibilityScore": <0-100, where 100 = definitely authentic, 0 = definitely fake/manipulated>,
  "category": "<authentic|manipulated|ai-generated|unclear>",
  "verdict": "<specific one-sentence verdict about what you see>",
  "analysis": "<4-5 sentences describing EXACTLY what you observe in this image and why you reached your verdict>",
  "manipulationSigns": [<list specific visual artifacts or anomalies you notice>],
  "authenticitySignals": [<list specific signs that suggest it may be authentic>],
  "technicalAnalysis": {
    "compressionArtifacts": "<none|minor|significant>",
    "lightingConsistency": "<consistent|inconsistent|unknown>",
    "shadowAnalysis": "<natural|unnatural|absent|unknown>",
    "edgeAnalysis": "<clean|suspicious|blurred|unknown>",
    "noisePattern": "<uniform|inconsistent|unknown>"
  },
  "aiGenerationIndicators": [<specific signs of AI generation if present, e.g., "Fingers appear malformed", "Background has dreamy blur typical of diffusion models">],
  "contextClues": [<things you can infer about when/where/what this image shows>],
  "textInImage": "<any text visible in the image, or 'none'>",
  "verificationSteps": ["Try TinEye.com for reverse image search", "Use Google Images reverse search", "Upload to FotoForensics.com", "Check Hive Moderation AI detector"],
  "forensicBadges": [<positive authenticity markers you observe>],
  "suggestions": [<specific advice based on what you see>]
}`;

  const result = await callGemini(prompt, { data: base64Data, mimeType });

  let data = result.success ? parseJSON(result.text) : null;

  if (!data) {
    data = {
      credibilityScore: 50, category: 'unclear',
      verdict: 'Unable to perform automated forensic analysis on this image.',
      analysis: 'The image could not be automatically analyzed. Please use manual verification tools like FotoForensics, TinEye, and Google Reverse Image Search for a thorough check.',
      manipulationSigns: ['Automated analysis unavailable'],
      authenticitySignals: [],
      technicalAnalysis: { compressionArtifacts: 'unknown', lightingConsistency: 'unknown', shadowAnalysis: 'unknown', edgeAnalysis: 'unknown', noisePattern: 'unknown' },
      aiGenerationIndicators: [],
      contextClues: [],
      textInImage: 'unknown',
      verificationSteps: ['TinEye.com reverse image search', 'Google Images reverse search', 'FotoForensics.com ELA analysis', 'Hive Moderation AI detector'],
      forensicBadges: [],
      suggestions: ['Perform manual reverse image search', 'Check the EXIF metadata', 'Use AI image detection tools']
    };
  }

  data.credibilityScore = Math.min(100, Math.max(0, parseInt(data.credibilityScore) || 50));
  saveAnalysis('image', '[image upload]', data);
  res.json({ success: true, data });
});

// ════════════════════════════════════════════════════════════════════════════
// ARTICLE ANALYSIS
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/analyze/article', async (req, res) => {
  const { url, content } = req.body;
  if (!url || !content) return res.status(400).json({ success: false, error: 'URL and content required' });

  const domain = (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } })();

  const prompt = `You are a senior investigative journalist and fact-checker. Analyze this specific article for credibility.

Article URL: ${url}
Domain: ${domain}

Article Content:
"""
${content.substring(0, 4000)}
"""

IMPORTANT: Analyze the ACTUAL content above. Identify the specific claims made, evaluate the source domain based on your knowledge, check journalistic standards, and assess bias.

Respond with ONLY a JSON object (no markdown):
{
  "credibilityScore": <0-100 based on THIS article's actual content and source>,
  "category": "<real|fake|misleading|clickbait|satire|unclear>",
  "verdict": "<specific one-sentence verdict about this article>",
  "analysis": "<5-6 sentences analyzing the specific claims, journalistic quality, source reputation, and credibility of THIS article>",
  "sourceAssessment": {
    "domain": "${domain}",
    "domainType": "<mainstream-news|independent-news|tabloid|satire|blog|government|academic|unknown>",
    "knownBias": "<left|center-left|center|center-right|right|unknown>",
    "reliabilityRating": "<high|medium|low|unknown>",
    "notes": "<specific notes about this domain based on your knowledge>"
  },
  "redFlags": [<specific red flags found in THIS article>],
  "positiveSignals": [<specific credibility signals in THIS article>],
  "journalisticStandards": {
    "hasAuthor": <true|false>,
    "hasDate": <true|false>,
    "hasSources": <true|false>,
    "hasQuotes": <true|false>,
    "editorialStandards": "<professional|mixed|poor>"
  },
  "specificClaims": [<the main factual claims made in this article>],
  "claimAccuracy": [<assessment of each claim's accuracy based on your knowledge>],
  "biasIndicators": [<specific language or framing choices that indicate bias>],
  "verificationSteps": [<specific ways to verify the claims in THIS article, mentioning primary sources>],
  "suggestions": [<specific advice based on THIS article>],
  "relatedCredibleSources": [<specific credible sources that cover the same topic>]
}`;

  const result = await callGemini(prompt);
  let data = result.success ? parseJSON(result.text) : null;

  if (!data) {
    data = {
      credibilityScore: 50, category: 'unclear',
      verdict: 'Could not automatically analyze this article.',
      analysis: 'Manual review is recommended. Check the source domain, look for author credentials, verify all specific claims with primary sources.',
      sourceAssessment: { domain, domainType: 'unknown', knownBias: 'unknown', reliabilityRating: 'unknown', notes: 'Could not assess automatically.' },
      redFlags: ['Automated analysis failed — manual verification needed'],
      positiveSignals: [],
      journalisticStandards: { hasAuthor: false, hasDate: false, hasSources: false, hasQuotes: false, editorialStandards: 'unknown' },
      specificClaims: [], claimAccuracy: [],
      biasIndicators: [],
      verificationSteps: ['Search domain on MediaBiasFactCheck.com', 'Search main claims on Reuters', 'Check AP News for same story'],
      suggestions: ['Verify independently with Reuters or AP News'],
      relatedCredibleSources: ['Reuters', 'AP News', 'BBC News']
    };
  }

  data.credibilityScore = Math.min(100, Math.max(0, parseInt(data.credibilityScore) || 50));
  saveAnalysis('article', url, data);
  res.json({ success: true, data });
});

// ════════════════════════════════════════════════════════════════════════════
// SOURCE COMPARISON
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/analyze/compare', async (req, res) => {
  const { sources } = req.body;
  if (!sources || sources.length < 2) return res.status(400).json({ success: false, error: 'At least 2 sources required' });

  const sourcesFormatted = sources.map((s, i) => `--- SOURCE ${i + 1} ---\n${s}`).join('\n\n');

  const prompt = `You are a comparative media analyst. Compare these ${sources.length} news sources or claims about the same topic.

${sourcesFormatted}

Analyze what each source says, where they agree, where they conflict, and which appears more credible. Be specific about the actual content.

Respond with ONLY a JSON object (no markdown):
{
  "consistencyScore": <0-100, where 100 = sources are perfectly consistent>,
  "verdict": "<specific one sentence describing the level of consistency and key conflict>",
  "analysis": "<4-5 sentences comparing the SPECIFIC claims in each source, explaining key differences and assessing credibility>",
  "agreements": [<specific points all sources agree on>],
  "disagreements": [<specific factual conflicts between sources — be precise>],
  "mostReliableSource": "<which source (e.g. Source 1) seems most credible and specifically why>",
  "leastReliableSource": "<which source seems least credible and specifically why>",
  "biasComparison": [<how each source frames the same facts differently>],
  "factualConsistency": {
    "consistentFacts": [<facts all sources agree on>],
    "conflictingFacts": [<facts sources disagree on — give both versions>],
    "uniqueClaims": [<claims made by only one source>]
  },
  "narrativeDifferences": [<specific differences in how each source tells the story>],
  "recommendations": [<specific advice on how to verify the disputed claims>],
  "truthLikelihood": "<which version of events is more likely accurate based on the evidence, and why>"
}`;

  const result = await callGemini(prompt);
  let data = result.success ? parseJSON(result.text) : null;

  if (!data) {
    data = {
      consistencyScore: 50, verdict: 'Could not automatically compare sources.',
      analysis: 'Manual comparison recommended. Look for verifiable facts in each source and check primary sources.',
      agreements: [], disagreements: [],
      mostReliableSource: 'Unable to determine automatically',
      leastReliableSource: 'Unable to determine automatically',
      biasComparison: [], factualConsistency: { consistentFacts: [], conflictingFacts: [], uniqueClaims: [] },
      narrativeDifferences: [],
      recommendations: ['Cross-reference with Reuters', 'Check AP News', 'Look for primary source documents'],
      truthLikelihood: 'Manual verification required'
    };
  }

  data.consistencyScore = Math.min(100, Math.max(0, parseInt(data.consistencyScore) || 50));
  saveAnalysis('compare', sources[0], data);
  res.json({ success: true, data });
});

// ════════════════════════════════════════════════════════════════════════════
// QUICK FACT CHECK — uses Gemini's actual knowledge base
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/factcheck', async (req, res) => {
  const { claim } = req.body;
  if (!claim) return res.status(400).json({ success: false, error: 'Claim required' });

  const prompt = `You are a professional fact-checker with comprehensive knowledge of science, history, current events, medicine, politics, and world affairs. Your knowledge cutoff is early 2025.

CLAIM TO FACT-CHECK:
"${claim}"

CRITICAL INSTRUCTIONS:
1. Use your ACTUAL knowledge to evaluate this claim — do NOT give a generic response
2. If you know this claim is true or false, state it clearly and confidently
3. Cite SPECIFIC real-world facts, studies, statistics, or events that prove/disprove it
4. Give a real confidence score based on how certain you are
5. Name ACTUAL credible sources where this can be verified (real websites/institutions)
6. If the claim involves well-known misinformation (e.g., flat earth, anti-vax myths, conspiracy theories), call it out directly
7. Be SPECIFIC — mention actual numbers, dates, organizations, studies if relevant

Respond with ONLY a JSON object (no markdown):
{
  "verdict": "<TRUE|FALSE|MOSTLY TRUE|MOSTLY FALSE|MIXED|UNVERIFIABLE|OUTDATED>",
  "confidence": <0-100 — your confidence in this verdict>,
  "shortVerdict": "<one punchy sentence — e.g. 'This is FALSE. Vaccines do not cause autism.' or 'TRUE — NASA confirmed this in 2019.'>",
  "explanation": "<3-4 sentences using your actual knowledge. Include specific facts, figures, dates, or events that directly address the claim.>",
  "keyFacts": [<3-5 specific factual points that are directly relevant to this claim — cite real data, studies, or events>],
  "context": "<1-2 sentences of important background context that helps understand why this claim exists or why it's believed>",
  "specificSources": [<3-5 REAL, SPECIFIC sources to verify — e.g., 'CDC.gov/vaccines', 'WHO.int', 'The Lancet (2019 study)', 'NASA.gov', 'Snopes.com/fact-check/vaccine-autism'>],
  "relatedMisconceptions": [<other related myths or misconceptions people often believe alongside this one>],
  "originOfClaim": "<where/how this claim typically originates or spread, if known>",
  "expertConsensus": "<what the scientific/expert consensus is on this topic, if applicable>"
}`;

  const result = await callGemini(prompt);

  if (!result.success) {
    return res.json({
      success: true,
      data: {
        verdict: 'UNVERIFIABLE', confidence: 0,
        shortVerdict: 'Could not connect to AI service for verification.',
        explanation: 'The AI service is temporarily unavailable. Please verify this claim manually using the sources listed.',
        keyFacts: [],
        context: 'Manual verification recommended.',
        specificSources: ['Snopes.com', 'FactCheck.org', 'PolitiFact.com', 'AP Fact Check: apnews.com/hub/ap-fact-check'],
        relatedMisconceptions: [],
        originOfClaim: 'Unknown',
        expertConsensus: 'Unknown'
      }
    });
  }

  let data = parseJSON(result.text);

  if (!data) {
    // Try to extract useful info from the raw text if JSON parsing fails
    console.error('Fact check JSON parse failed. Raw:', result.text.substring(0, 500));
    data = {
      verdict: 'UNVERIFIABLE', confidence: 30,
      shortVerdict: 'AI responded but result could not be parsed.',
      explanation: result.text.substring(0, 400),
      keyFacts: [],
      context: '',
      specificSources: ['Snopes.com', 'FactCheck.org', 'PolitiFact.com'],
      relatedMisconceptions: [],
      originOfClaim: '',
      expertConsensus: ''
    };
  }

  data.confidence = Math.min(100, Math.max(0, parseInt(data.confidence) || 50));
  data.verdict = data.verdict || 'UNVERIFIABLE';

  saveFactCheck(claim, data);
  res.json({ success: true, data });
});

// ── History ───────────────────────────────────────────────────────────────────
app.get('/api/history', (req, res) => {
  const db = readDB();
  const limit = parseInt(req.query.limit) || 50;
  const type = req.query.type;
  let results = db.analyses;
  if (type) results = results.filter(a => a.type === type);
  res.json({ success: true, data: results.slice(0, limit) });
});

app.delete('/api/history/:id', (req, res) => {
  const db = readDB();
  db.analyses = db.analyses.filter(a => a.id !== parseInt(req.params.id));
  writeDB(db);
  res.json({ success: true });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const db = readDB();
  const analyses = db.analyses;
  const total = analyses.length;

  const byType = Object.entries(
    analyses.reduce((acc, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {})
  ).map(([type, count]) => ({ type, count }));

  const byCategory = Object.entries(
    analyses.reduce((acc, a) => { acc[a.category] = (acc[a.category] || 0) + 1; return acc; }, {})
  ).map(([category, count]) => ({ category, count }));

  const avgScore = total > 0
    ? Math.round(analyses.reduce((s, a) => s + (a.credibility_score || 0), 0) / total)
    : 0;

  res.json({ success: true, data: { totalAnalyses: total, byType, byCategory, averageCredibilityScore: avgScore } });
});

// ── Catch-all ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.use((err, req, res, next) => res.status(500).json({ success: false, error: err.message }));

// ── Fallback (only used if Gemini completely fails) ───────────────────────────
function genericFallback(type, input) {
  return {
    credibilityScore: 50, category: 'unclear',
    verdict: 'AI analysis temporarily unavailable — manual verification required.',
    analysis: 'The AI service could not process this request. Please try again in a moment or verify manually.',
    redFlags: ['Could not perform automated analysis'],
    positiveSignals: [],
    languageAnalysis: { tone: 'unknown', emotionalWords: [], sensationalism: 'unknown', readabilityLevel: 'unknown' },
    specificClaims: [], claimVerdict: [],
    verificationSteps: ['Search on Google News', 'Check Snopes.com', 'Check FactCheck.org', 'Check Reuters.com'],
    similarFakePatterns: [],
    trustworthinessBadges: [],
    suggestions: ['Try submitting again', 'Verify manually with fact-checking sites'],
    contextualBackground: 'Manual verification recommended.'
  };
}

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n✅ TruthLens running!');
  console.log(`🌐 http://localhost:${PORT}\n`);
});