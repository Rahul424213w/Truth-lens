/* ═══════════════════════════════════════════════
   TruthLens — script.js
═══════════════════════════════════════════════ */

const API = 'http://localhost:5000/api';

// ── Page navigation ────────────────────────────────────────────────────────

function enterApp() {
  document.getElementById('landing-page').classList.remove('active');
  document.getElementById('app-page').classList.add('active');
  checkBackendStatus();
  loadHistory();
  loadStats();
}

function exitApp() {
  document.getElementById('app-page').classList.remove('active');
  document.getElementById('landing-page').classList.add('active');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── Tab switching ──────────────────────────────────────────────────────────

function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  if (btn) btn.classList.add('active');
  closeResults();

  if (name === 'history') loadHistory();
  if (name === 'stats') loadStats();

  if (window.innerWidth < 700) document.getElementById('sidebar').classList.remove('open');
}

// ── Backend status ─────────────────────────────────────────────────────────

async function checkBackendStatus() {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  try {
    const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      dot.className = 'status-dot online';
      text.textContent = 'Backend online';
      loadLandingStat();
    } else throw new Error();
  } catch {
    dot.className = 'status-dot offline';
    text.textContent = 'Backend offline';
    toast('Backend not running — run: cd backend && npm start', 'error', 6000);
  }
}

async function loadLandingStat() {
  try {
    const r = await fetch(`${API}/stats`);
    const d = await r.json();
    const el = document.getElementById('stat-total');
    if (el && d.data) el.textContent = d.data.totalAnalyses || 0;
  } catch {}
}

// ── Toast notifications ────────────────────────────────────────────────────

function toast(msg, type = 'info', duration = 3500) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// ── Loading helpers ────────────────────────────────────────────────────────

const BTN_LABELS = {
  'text-btn': 'Analyze Now →',
  'image-btn': 'Analyze Image →',
  'article-btn': 'Analyze Article →',
  'compare-btn': 'Compare Sources →',
  'factcheck-btn': 'Check →'
};

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.querySelector('.btn-inner').innerHTML = loading
    ? '<span class="spinner"></span> Analyzing...'
    : BTN_LABELS[btnId] || 'Analyze →';
}

// ── Init ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Char counter
  const ti = document.getElementById('text-input');
  if (ti) ti.addEventListener('input', () => {
    document.getElementById('text-char-count').textContent = `${ti.value.length} characters`;
  });

  // Image input
  const ii = document.getElementById('image-input');
  if (ii) ii.addEventListener('change', handleImageSelect);

  // Drag & drop
  const zone = document.getElementById('upload-zone');
  if (zone) {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'rgba(79,255,176,0.6)'; });
    zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith('image/')) {
        const dt = new DataTransfer();
        dt.items.add(file);
        document.getElementById('image-input').files = dt.files;
        handleImageSelect({ target: { files: [file] } });
      }
    });
  }

  // Keyboard shortcuts
  const fi = document.getElementById('factcheck-input');
  if (fi) fi.addEventListener('keypress', e => { if (e.key === 'Enter') quickFactCheck(); });
  if (ti) ti.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') analyzeText(); });

  loadLandingStat();
});

// ── Text Analysis ──────────────────────────────────────────────────────────

async function analyzeText() {
  const text = document.getElementById('text-input').value.trim();
  if (!text || text.length < 10) return toast('Please enter at least 10 characters', 'error');

  setLoading('text-btn', true);
  try {
    const r = await fetch(`${API}/analyze/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const d = await r.json();
    if (d.success) displayResults(d.data, 'text');
    else showError(d.error || "Analysis failed");
  } catch {
    toast('Could not connect to backend. Make sure it is running.', 'error');
  } finally {
    setLoading('text-btn', false);
  }
}

// ── Image Analysis ─────────────────────────────────────────────────────────

function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast('Image too large — max 5MB', 'error');
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('upload-placeholder').style.display = 'none';
    const wrap = document.getElementById('image-preview-wrap');
    wrap.style.display = 'flex';
    document.getElementById('image-preview-img').src = ev.target.result;
    document.getElementById('img-name').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

async function analyzeImage() {
  const file = document.getElementById('image-input').files[0];
  if (!file) return toast('Please select an image first', 'error');

  setLoading('image-btn', true);
  try {
    const base64 = await fileToBase64(file);
    const r = await fetch(`${API}/analyze/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 })
    });
    const d = await r.json();
    if (d.success) displayResults(d.data, 'image');
    else showError(d.error || "Analysis failed");
  } catch {
    toast('Could not connect to backend', 'error');
  } finally {
    setLoading('image-btn', false);
  }
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ── Article Analysis ───────────────────────────────────────────────────────

async function analyzeArticle() {
  const url = document.getElementById('article-url').value.trim();
  const content = document.getElementById('article-content').value.trim();
  if (!url) return toast('Please enter the article URL', 'error');
  if (!content || content.length < 20) return toast('Please paste the article content', 'error');

  setLoading('article-btn', true);
  try {
    const r = await fetch(`${API}/analyze/article`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, content })
    });
    const d = await r.json();
    if (d.success) displayResults(d.data, 'article');
    else showError(d.error || "Analysis failed");
  } catch {
    toast('Could not connect to backend', 'error');
  } finally {
    setLoading('article-btn', false);
  }
}

// ── Source Comparison ──────────────────────────────────────────────────────

function addSource() {
  const container = document.getElementById('sources-container');
  const count = container.querySelectorAll('.source-row').length + 1;
  if (count > 6) return toast('Maximum 6 sources', 'info');
  const div = document.createElement('div');
  div.className = 'source-row';
  div.innerHTML = `
    <span class="source-label">Source ${count}</span>
    <textarea class="source-input" placeholder="Paste claim or excerpt..." rows="3"></textarea>
  `;
  container.appendChild(div);
}

async function compareSources() {
  const inputs = document.querySelectorAll('.source-input');
  const sources = Array.from(inputs).map(i => i.value.trim()).filter(v => v.length > 0);
  if (sources.length < 2) return toast('Please enter at least 2 sources', 'error');

  setLoading('compare-btn', true);
  try {
    const r = await fetch(`${API}/analyze/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources })
    });
    const d = await r.json();
    if (d.success) displayResults(d.data, 'compare');
    else showError(d.error || "Comparison failed");
  } catch {
    toast('Could not connect to backend', 'error');
  } finally {
    setLoading('compare-btn', false);
  }
}

// ── Quick Fact Check ───────────────────────────────────────────────────────

function setFactCheck(claim) {
  document.getElementById('factcheck-input').value = claim;
}

async function quickFactCheck() {
  const claim = document.getElementById('factcheck-input').value.trim();
  if (!claim) return toast('Please enter a claim to check', 'error');

  setLoading('factcheck-btn', true);
  try {
    const r = await fetch(`${API}/factcheck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim })
    });
    const d = await r.json();
    if (d.success) displayFactCheckResult(d.data, claim);
    else showError(d.error || "Fact check failed");
  } catch {
    toast('Could not connect to backend', 'error');
  } finally {
    setLoading('factcheck-btn', false);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// DISPLAY RESULTS — handles all analysis types
// ════════════════════════════════════════════════════════════════════════════

function displayResults(data, type) {
  const panel = document.getElementById('results-panel');
  const score = data.credibilityScore || data.consistencyScore || 0;
  const category = (data.category || 'unclear').toLowerCase();

  // Score ring
  document.getElementById('score-num').textContent = score;
  const offset = 326.7 - (score / 100) * 326.7;
  const ring = document.getElementById('ring-fill');
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = score >= 70 ? '#22c55e' : score >= 45 ? '#eab308' : '#ef4444';

  // Verdict badge
  const badge = document.getElementById('verdict-badge');
  badge.textContent = category.toUpperCase();
  badge.className = 'verdict-badge ' + category;

  document.getElementById('verdict-text').textContent = data.verdict || data.analysis || '';
  document.getElementById('category-tag').textContent = `🏷️ ${type.toUpperCase()} ANALYSIS`;
  document.getElementById('result-timestamp').textContent = new Date().toLocaleString();

  document.getElementById('report-cards').innerHTML = buildReportCards(data, type);

  panel.style.display = 'block';
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  toast('Analysis complete', 'success');
}

function buildReportCards(data, type) {
  let html = '';

  // ── Contextual background (text type)
  if (data.contextualBackground) {
    html += rcard('🌐', 'Background Context', `<p>${data.contextualBackground}</p>`);
  }

  // ── Main analysis
  if (data.analysis) {
    html += rcard('📊', 'Full Analysis', `<p>${data.analysis}</p>`);
  }

  // ── Specific claims + verdicts (the most important part)
  const claims = data.specificClaims || data.factualClaims || [];
  const verdicts = data.claimVerdict || data.claimAccuracy || [];
  if (claims.length) {
    let claimHtml = '<ul class="numbered-list">';
    claims.forEach((claim, i) => {
      const v = verdicts[i] || '';
      const vClass = v.toLowerCase().includes('true') ? 'tag--green'
        : v.toLowerCase().includes('false') ? 'tag--red'
        : 'tag--yellow';
      claimHtml += `<li>
        <span class="nl-num">${String(i+1).padStart(2,'0')}</span>
        <span>
          <strong>${claim}</strong>
          ${v ? `<br><span class="tag ${vClass}" style="margin-top:0.3rem;display:inline-block">${v}</span>` : ''}
        </span>
      </li>`;
    });
    claimHtml += '</ul>';
    html += rcard('🔍', 'Specific Claims & Verdicts', claimHtml);
  }

  // ── Red flags
  if ((data.redFlags || []).length) {
    html += rcard('🚩', 'Red Flags', tagList(data.redFlags, 'red'));
  }

  // ── Positive signals
  const pos = data.positiveSignals || data.authenticitySignals || [];
  if (pos.length) {
    html += rcard('✅', 'Credibility Signals', tagList(pos, 'green'));
  }

  // ── Language analysis (text)
  if (data.languageAnalysis) {
    const la = data.languageAnalysis;
    html += rcard('🗣️', 'Language Analysis', `
      <div class="kv-grid">
        <div class="kv-item"><div class="kv-label">Tone</div>
          <div class="kv-value ${['neutral','balanced','matter-of-fact'].includes(la.tone) ? 'good' : 'warn'}">${la.tone || '—'}</div></div>
        <div class="kv-item"><div class="kv-label">Sensationalism</div>
          <div class="kv-value ${la.sensationalism === 'low' ? 'good' : la.sensationalism === 'high' ? 'bad' : 'warn'}">${la.sensationalism || '—'}</div></div>
        <div class="kv-item"><div class="kv-label">Reading Level</div>
          <div class="kv-value neutral">${la.readabilityLevel || '—'}</div></div>
        <div class="kv-item"><div class="kv-label">Loaded Words</div>
          <div class="kv-value neutral">${(la.emotionalWords || []).slice(0,5).join(', ') || 'None detected'}</div></div>
      </div>
    `);
  }

  // ── Source assessment (article)
  if (data.sourceAssessment) {
    const sa = data.sourceAssessment;
    html += rcard('🌐', 'Source Assessment', `
      <div class="kv-grid">
        <div class="kv-item"><div class="kv-label">Domain</div><div class="kv-value neutral">${sa.domain || '—'}</div></div>
        <div class="kv-item"><div class="kv-label">Type</div><div class="kv-value neutral">${sa.domainType || '—'}</div></div>
        <div class="kv-item"><div class="kv-label">Reliability</div>
          <div class="kv-value ${sa.reliabilityRating === 'high' ? 'good' : sa.reliabilityRating === 'low' ? 'bad' : 'warn'}">${sa.reliabilityRating || '—'}</div></div>
        <div class="kv-item"><div class="kv-label">Political Bias</div><div class="kv-value neutral">${sa.knownBias || 'unknown'}</div></div>
      </div>
      ${sa.notes ? `<p style="margin-top:0.85rem;font-size:0.85rem;color:var(--text2);line-height:1.6">${sa.notes}</p>` : ''}
    `);
  }

  // ── Journalistic standards
  if (data.journalisticStandards) {
    const js = data.journalisticStandards;
    const checks = [
      { label: 'Has Author', val: js.hasAuthor },
      { label: 'Has Date', val: js.hasDate },
      { label: 'Cites Sources', val: js.hasSources },
      { label: 'Uses Quotes', val: js.hasQuotes },
    ];
    html += rcard('📋', 'Journalistic Standards', `
      <div class="tag-list">
        ${checks.map(c => `<span class="tag ${c.val ? 'tag--green' : 'tag--red'}">${c.val ? '✓' : '✗'} ${c.label}</span>`).join('')}
        ${js.editorialStandards ? `<span class="tag tag--gray">Editorial: ${js.editorialStandards}</span>` : ''}
      </div>
    `);
  }

  // ── Technical forensics (image)
  if (data.technicalAnalysis) {
    const ta = data.technicalAnalysis;
    const colorVal = (k, v) => {
      const good = { compressionArtifacts: 'none', lightingConsistency: 'consistent', shadowAnalysis: 'natural', edgeAnalysis: 'clean', noisePattern: 'uniform' };
      const bad =  { compressionArtifacts: 'significant', lightingConsistency: 'inconsistent', shadowAnalysis: 'unnatural', edgeAnalysis: 'suspicious', noisePattern: 'inconsistent' };
      if (v === good[k]) return 'good';
      if (v === bad[k]) return 'bad';
      return 'neutral';
    };
    html += rcard('🔬', 'Technical Forensics', `
      <div class="kv-grid">
        ${Object.entries(ta).map(([k, v]) => `
          <div class="kv-item">
            <div class="kv-label">${k.replace(/([A-Z])/g, ' $1').trim()}</div>
            <div class="kv-value ${colorVal(k, v)}">${v}</div>
          </div>`).join('')}
      </div>
    `);
  }

  // ── AI generation indicators (image)
  if ((data.aiGenerationIndicators || []).filter(Boolean).length) {
    html += rcard('🤖', 'AI Generation Indicators', tagList(data.aiGenerationIndicators, 'blue'));
  }

  // ── Text in image
  if (data.textInImage && data.textInImage !== 'none' && data.textInImage !== 'unknown') {
    html += rcard('📝', 'Text Found in Image', `<p style="font-style:italic;color:var(--text2)">"${data.textInImage}"</p>`);
  }

  // ── Context clues (image)
  if ((data.contextClues || []).filter(Boolean).length) {
    html += rcard('🗺️', 'Context Clues', tagList(data.contextClues, 'gray'));
  }

  // ── Compare: agreements & disagreements
  if ((data.agreements || []).length) {
    html += rcard('🤝', 'What Sources Agree On', tagList(data.agreements, 'green'));
  }
  if ((data.disagreements || []).length) {
    html += rcard('⚡', 'Key Disagreements', tagList(data.disagreements, 'red'));
  }
  if (data.factualConsistency) {
    const fc = data.factualConsistency;
    let body = '';
    if (fc.consistentFacts?.length) body += `<p class="fc-sublabel">Consistent facts</p>${tagList(fc.consistentFacts, 'green')}`;
    if (fc.conflictingFacts?.length) body += `<p class="fc-sublabel" style="margin-top:0.75rem">Conflicting facts</p>${tagList(fc.conflictingFacts, 'red')}`;
    if (fc.uniqueClaims?.length) body += `<p class="fc-sublabel" style="margin-top:0.75rem">Unique claims (only one source)</p>${tagList(fc.uniqueClaims, 'yellow')}`;
    if (body) html += rcard('🧮', 'Factual Consistency Breakdown', body);
  }
  if (data.mostReliableSource) {
    html += rcard('🏆', 'Most Reliable Source', `<p>${data.mostReliableSource}</p>`);
  }
  if (data.truthLikelihood) {
    html += rcard('🎯', 'Truth Assessment', `<p>${data.truthLikelihood}</p>`);
  }
  if ((data.narrativeDifferences || []).length) {
    html += rcard('📖', 'Narrative Framing Differences', numberedList(data.narrativeDifferences));
  }
  if ((data.biasComparison || []).length) {
    html += rcard('⚖️', 'Bias Comparison', tagList(data.biasComparison, 'yellow'));
  }

  // ── Bias indicators (article)
  if ((data.biasIndicators || []).length) {
    html += rcard('📡', 'Bias Indicators', tagList(data.biasIndicators, 'yellow'));
  }

  // ── Misinformation patterns
  if ((data.similarFakePatterns || []).filter(Boolean).length) {
    html += rcard('🔗', 'Known Misinformation Patterns', tagList(data.similarFakePatterns, 'yellow'));
  }

  // ── Trustworthiness badges
  const badges = data.trustworthinessBadges || data.forensicBadges || [];
  if (badges.filter(Boolean).length) {
    html += rcard('🛡️', 'Credibility Badges', tagList(badges, 'blue'));
  }

  // ── Verification steps
  const steps = data.verificationSteps || data.recommendations || [];
  if (steps.length) {
    html += rcard('📌', 'How to Verify', numberedList(steps));
  }

  // ── Related credible sources
  if ((data.relatedCredibleSources || []).length) {
    html += rcard('🌍', 'Credible Sources to Check', tagList(data.relatedCredibleSources, 'blue'));
  }

  // ── Suggestions (always last)
  if ((data.suggestions || []).length) {
    html += rcard('💡', 'Next Steps', numberedList(data.suggestions));
  }

  return html;
}

// ── Fact check display ─────────────────────────────────────────────────────

function displayFactCheckResult(data, claim) {
  const panel = document.getElementById('results-panel');
  const score = data.confidence || 0;
  const verdict = (data.verdict || 'UNVERIFIABLE').toUpperCase();

  // Score ring
  document.getElementById('score-num').textContent = score;
  const offset = 326.7 - (score / 100) * 326.7;
  const ring = document.getElementById('ring-fill');
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = ['TRUE','MOSTLY TRUE'].includes(verdict) ? '#22c55e'
    : ['FALSE','MOSTLY FALSE'].includes(verdict) ? '#ef4444'
    : '#eab308';

  // Verdict
  const badge = document.getElementById('verdict-badge');
  badge.textContent = verdict;
  badge.className = `verdict-badge ${verdict.toLowerCase().replace(/\s+/g, '-')}`;

  document.getElementById('verdict-text').textContent = data.shortVerdict || `Claim: "${claim}"`;
  document.getElementById('category-tag').textContent = '⚡ QUICK FACT CHECK';
  document.getElementById('result-timestamp').textContent = new Date().toLocaleString();

  let html = '';

  // Short verdict callout
  if (data.shortVerdict) {
    const color = ['TRUE','MOSTLY TRUE'].includes(verdict) ? 'var(--green)'
      : ['FALSE','MOSTLY FALSE'].includes(verdict) ? 'var(--red)' : 'var(--yellow)';
    html += `<div class="rcard" style="border-color:${color};background:rgba(0,0,0,0.2)">
      <div style="padding:0.5rem 0;font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:700;color:${color}">${data.shortVerdict}</div>
    </div>`;
  }

  if (data.explanation) {
    html += rcard('📋', 'Verdict Explanation', `<p>${data.explanation}</p>`);
  }
  if (data.expertConsensus) {
    html += rcard('🔬', 'Expert / Scientific Consensus', `<p>${data.expertConsensus}</p>`);
  }
  if ((data.keyFacts || []).length) {
    html += rcard('📌', 'Key Facts', numberedList(data.keyFacts));
  }
  if (data.context) {
    html += rcard('🔍', 'Important Context', `<p>${data.context}</p>`);
  }
  if (data.originOfClaim) {
    html += rcard('📡', 'Origin of this Claim', `<p>${data.originOfClaim}</p>`);
  }
  if ((data.specificSources || data.sources || []).length) {
    const srcs = data.specificSources || data.sources || [];
    html += rcard('🌐', 'Verify At These Sources', tagList(srcs, 'blue'));
  }
  if ((data.relatedMisconceptions || []).length) {
    html += rcard('⚠️', 'Related Misconceptions', tagList(data.relatedMisconceptions, 'yellow'));
  }

  document.getElementById('report-cards').innerHTML = html;
  panel.style.display = 'block';
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  toast('Fact check complete', 'success');
}

// ── Helpers ────────────────────────────────────────────────────────────────

function rcard(icon, title, bodyHtml) {
  return `
    <div class="rcard">
      <div class="rcard-header" onclick="toggleCard(this)">
        <div class="rcard-title">
          <span class="rcard-icon">${icon}</span>
          <span>${title}</span>
        </div>
        <span class="rcard-toggle">▾</span>
      </div>
      <div class="rcard-body">${bodyHtml}</div>
    </div>`;
}

function toggleCard(header) {
  const body = header.nextElementSibling;
  const toggle = header.querySelector('.rcard-toggle');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    toggle.style.transform = 'rotate(0deg)';
  } else {
    body.style.display = 'none';
    toggle.style.transform = 'rotate(-90deg)';
  }
}

function tagList(items, color) {
  if (!items || !items.length) return '<p style="color:var(--text3);font-size:0.85rem">None detected</p>';
  return `<div class="tag-list">${items.filter(Boolean).map(i => `<span class="tag tag--${color}">${i}</span>`).join('')}</div>`;
}

function numberedList(items) {
  if (!items || !items.length) return '<p style="color:var(--text3);font-size:0.85rem">None</p>';
  return `<ul class="numbered-list">${items.filter(Boolean).map((item, i) =>
    `<li><span class="nl-num">${String(i+1).padStart(2,'0')}</span><span>${item}</span></li>`
  ).join('')}</ul>`;
}

// ── Results controls ───────────────────────────────────────────────────────

function closeResults() {
  document.getElementById('results-panel').style.display = 'none';
}

function exportReport() {
  const score = document.getElementById('score-num').textContent;
  const verdict = document.getElementById('verdict-badge').textContent;
  const cards = document.getElementById('report-cards').innerText;
  const ts = document.getElementById('result-timestamp').textContent;

  const text = `TRUTHLENS CREDIBILITY REPORT
Generated: ${ts}
SCORE: ${score}/100
VERDICT: ${verdict}

${'─'.repeat(50)}
${cards}
${'─'.repeat(50)}
Generated by TruthLens — AI Credibility Intelligence
`;

  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `truthlens-report-${Date.now()}.txt`;
  a.click();
  toast('Report downloaded', 'success');
}

// ── History ────────────────────────────────────────────────────────────────

async function loadHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;
  const type = document.getElementById('history-filter')?.value || '';

  container.innerHTML = '<div class="loading-state">Loading...</div>';
  try {
    const url = `${API}/history?limit=50${type ? `&type=${type}` : ''}`;
    const r = await fetch(url);
    const d = await r.json();
    if (!d.success || !d.data.length) {
      container.innerHTML = '<div class="loading-state">No analyses yet — run your first check!</div>';
      return;
    }
    container.innerHTML = d.data.map(historyItem).join('');
  } catch {
    container.innerHTML = '<div class="loading-state">Could not load history — backend offline?</div>';
  }
}

function historyItem(item) {
  const score = item.credibility_score || 0;
  const scoreClass = score >= 70 ? 'high' : score >= 45 ? 'mid' : 'low';
  const catClass = (item.category || 'unclear').toLowerCase();
  const date = new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return `
    <div class="history-item" onclick="restoreFromHistory(${item.id})">
      <div class="hi-score ${scoreClass}">${score}%</div>
      <div class="hi-body">
        <div class="hi-preview">${item.input_preview || '[image or upload]'}</div>
        <div class="hi-meta">
          <span class="hi-type">${item.type}</span>
          <span class="hi-cat ${catClass}">${(item.category || 'unclear').toUpperCase()}</span>
          <span class="hi-date">${date}</span>
        </div>
      </div>
    </div>`;
}

async function restoreFromHistory(id) {
  try {
    const r = await fetch(`${API}/history?limit=200`);
    const d = await r.json();
    const item = d.data.find(i => i.id === id);
    if (item?.full_result) {
      displayResults(item.full_result, item.type);
    }
  } catch {}
}

// ── Stats ──────────────────────────────────────────────────────────────────

async function loadStats() {
  const container = document.getElementById('stats-content');
  if (!container) return;
  try {
    const r = await fetch(`${API}/stats`);
    const d = await r.json();
    if (!d.success) throw new Error();
    container.innerHTML = renderStats(d.data);
  } catch {
    container.innerHTML = '<div class="loading-state">Could not load stats — backend offline?</div>';
  }
}

function renderStats(data) {
  const byType = data.byType || [];
  const byCategory = data.byCategory || [];
  const total = data.totalAnalyses || 0;
  const typeIcons = { text: '📝', image: '🖼️', article: '📰', compare: '⚖️', factcheck: '⚡' };

  return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-num">${total}</div>
        <div class="stat-card-label">Total Analyses</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-num">${data.averageCredibilityScore || 0}%</div>
        <div class="stat-card-label">Avg. Credibility Score</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-num">${byCategory.find(c => c.category === 'fake')?.count || 0}</div>
        <div class="stat-card-label">Fake Detected</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-num">${byCategory.find(c => c.category === 'real')?.count || 0}</div>
        <div class="stat-card-label">Verified Real</div>
      </div>
    </div>
    <div class="rcard" style="margin-bottom:1rem">
      <div class="rcard-header"><div class="rcard-title"><span>📊</span><span>By Type</span></div></div>
      <div class="rcard-body">
        ${byType.map(t => `
          <div class="dist-row">
            <div class="dist-label">${typeIcons[t.type] || '📋'} ${t.type}</div>
            <div class="dist-bar-wrap"><div class="dist-bar"><div class="dist-bar-fill" style="width:${total ? Math.round((t.count/total)*100) : 0}%"></div></div></div>
            <div class="dist-count">${t.count}</div>
          </div>`).join('') || '<p style="color:var(--text3);font-size:0.85rem">No data yet</p>'}
      </div>
    </div>
    <div class="rcard">
      <div class="rcard-header"><div class="rcard-title"><span>🏷️</span><span>By Category</span></div></div>
      <div class="rcard-body">
        ${byCategory.map(c => `
          <div class="dist-row">
            <div class="dist-label" style="width:110px">${c.category}</div>
            <div class="dist-bar-wrap"><div class="dist-bar"><div class="dist-bar-fill" style="width:${total ? Math.round((c.count/total)*100) : 0}%;background:${catColor(c.category)}"></div></div></div>
            <div class="dist-count">${c.count}</div>
          </div>`).join('') || '<p style="color:var(--text3);font-size:0.85rem">No data yet</p>'}
      </div>
    </div>`;
}

function catColor(cat) {
  const m = { real: '#22c55e', authentic: '#22c55e', fake: '#ef4444', manipulated: '#ef4444', misleading: '#fb923c', clickbait: '#eab308', 'ai-generated': '#3b82f6', satire: '#8b5cf6' };
  return m[cat] || '#64748b';
}

// ── Error display ──────────────────────────────────────────────────────────
function showError(msg) {
  // Check if it's a quota error
  const isQuota = msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('429');
  const isKey = msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('aistudio');

  const panel = document.getElementById('results-panel');
  const icon = isQuota ? '⚠️' : '❌';
  const title = isQuota ? 'API Quota Exceeded' : 'Analysis Failed';
  const color = isQuota ? 'var(--warn)' : 'var(--red)';

  let html = `
    <div style="padding:2rem;text-align:center">
      <div style="font-size:3rem;margin-bottom:1rem">${icon}</div>
      <h3 style="font-family:'Syne',sans-serif;color:${color};margin-bottom:0.75rem;font-size:1.3rem">${title}</h3>
      <p style="color:var(--text2);line-height:1.7;margin-bottom:1.5rem;max-width:500px;margin-left:auto;margin-right:auto">${msg}</p>
  `;

  if (isQuota) {
    html += `
      <div style="background:rgba(251,146,60,0.08);border:1px solid rgba(251,146,60,0.2);border-radius:12px;padding:1.25rem;max-width:480px;margin:0 auto;text-align:left">
        <p style="font-weight:600;margin-bottom:0.75rem;color:var(--text)">🔑 Fix: Get a fresh API key</p>
        <ol style="color:var(--text2);font-size:0.88rem;line-height:1.8;padding-left:1.25rem">
          <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--accent)">aistudio.google.com/app/apikey</a></li>
          <li>Click <strong>"Create API key"</strong></li>
          <li>Copy the new key</li>
          <li>Open <code style="background:var(--bg3);padding:0.1rem 0.4rem;border-radius:4px">backend/.env</code></li>
          <li>Replace <code style="background:var(--bg3);padding:0.1rem 0.4rem;border-radius:4px">GEMINI_API_KEY=</code> with the new key</li>
          <li>Restart the server: <code style="background:var(--bg3);padding:0.1rem 0.4rem;border-radius:4px">npm run dev</code></li>
        </ol>
      </div>
      <p style="margin-top:1rem;font-size:0.8rem;color:var(--text3)">Free tier gives ~1,500 requests/day per key. Each new Google account = new quota.</p>
    `;
  }

  html += `<button class="btn-secondary" onclick="closeResults()" style="margin-top:1.5rem">Dismiss</button></div>`;

  // Update panel header simply
  document.getElementById('score-num').textContent = '—';
  document.getElementById('ring-fill').style.strokeDashoffset = 326.7;
  document.getElementById('ring-fill').style.stroke = 'var(--text3)';
  document.getElementById('verdict-badge').textContent = 'ERROR';
  document.getElementById('verdict-badge').className = 'verdict-badge unclear';
  document.getElementById('verdict-text').textContent = '';
  document.getElementById('category-tag').textContent = '';
  document.getElementById('result-timestamp').textContent = new Date().toLocaleString();
  document.getElementById('report-cards').innerHTML = html;

  panel.style.display = 'block';
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}