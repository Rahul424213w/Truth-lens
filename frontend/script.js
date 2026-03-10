/* TruthLens v4 — script.js */
const API = window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1'?'http://localhost:5000/api':'/api';
let currentUser=null,authToken=localStorage.getItem('tl_token')||null,isGuestMode=false;

document.addEventListener('DOMContentLoaded',async()=>{
  const ti=document.getElementById('text-input');
  if(ti){ti.addEventListener('input',()=>{document.getElementById('text-char-count').textContent=`${ti.value.length} characters`;});ti.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key==='Enter')analyzeText();});}
  const ii=document.getElementById('image-input');if(ii)ii.addEventListener('change',handleImageSelect);
  const zone=document.getElementById('upload-zone');
  if(zone){zone.addEventListener('dragover',e=>{e.preventDefault();zone.style.borderColor='rgba(79,255,176,0.6)';});zone.addEventListener('dragleave',()=>{zone.style.borderColor='';});zone.addEventListener('drop',e=>{e.preventDefault();zone.style.borderColor='';const f=e.dataTransfer.files[0];if(f?.type.startsWith('image/')){const dt=new DataTransfer();dt.items.add(f);document.getElementById('image-input').files=dt.files;handleImageSelect({target:{files:[f]}});}});}
  const fi=document.getElementById('factcheck-input');if(fi)fi.addEventListener('keypress',e=>{if(e.key==='Enter')quickFactCheck();});
  document.getElementById('login-password')?.addEventListener('keypress',e=>{if(e.key==='Enter')handleLogin();});
  document.getElementById('register-password')?.addEventListener('keypress',e=>{if(e.key==='Enter')handleRegister();});
  if(authToken){const ok=await verifyToken();if(ok){showLanding();return;}}
  showPage('auth-page');
});

async function verifyToken(){try{const r=await fetch(`${API}/auth/me`,{headers:{Authorization:`Bearer ${authToken}`}});const d=await r.json();if(d.success){currentUser=d.user;updateUserUI();return true;}}catch{}authToken=null;localStorage.removeItem('tl_token');return false;}

function updateUserUI(){
  if(currentUser&&!isGuestMode){
    const el=document.getElementById('sb-user-info');if(el)el.style.display='flex';
    const av=document.getElementById('sb-avatar');if(av)av.textContent=(currentUser.name||'U')[0].toUpperCase();
    const nm=document.getElementById('sb-user-name');if(nm)nm.textContent=currentUser.name||'User';
    const em=document.getElementById('sb-user-email');if(em)em.textContent=currentUser.email||'';
    const lb=document.getElementById('sb-logout-btn');if(lb)lb.style.display='block';
    const tu=document.getElementById('topbar-user');if(tu)tu.textContent=`Hi, ${currentUser.name?.split(' ')[0]||'User'}`;
    const nua=document.getElementById('nav-user-area');if(nua)nua.innerHTML=`<span style="font-size:0.85rem;color:var(--text2)">${currentUser.name}</span><button class="nav-cta" onclick="enterApp()">Dashboard →</button>`;
  }
}

function handleLogout(){authToken=null;currentUser=null;isGuestMode=false;localStorage.removeItem('tl_token');showPage('auth-page');showLogin();toast('Signed out','info');}

function showLogin(){document.getElementById('login-form').style.display='block';document.getElementById('register-form').style.display='none';document.getElementById('login-error').style.display='none';}
function showRegister(){document.getElementById('login-form').style.display='none';document.getElementById('register-form').style.display='block';document.getElementById('register-error').style.display='none';}
function togglePw(id,btn){const inp=document.getElementById(id);if(inp.type==='password'){inp.type='text';btn.textContent='🙈';}else{inp.type='password';btn.textContent='👁';}}

async function handleLogin(){
  const email=document.getElementById('login-email').value.trim(),password=document.getElementById('login-password').value,errEl=document.getElementById('login-error'),btn=document.getElementById('login-btn');
  if(!email||!password){showAuthError(errEl,'Please enter email and password');return;}
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Signing in...';
  try{const r=await fetch(`${API}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const d=await r.json();
    if(d.success){authToken=d.token;currentUser=d.user;isGuestMode=false;localStorage.setItem('tl_token',authToken);updateUserUI();showLanding();toast(`Welcome back, ${d.user.name}!`,'success');}
    else showAuthError(errEl,d.error||'Login failed');
  }catch{showAuthError(errEl,'Could not connect to server');}
  finally{btn.disabled=false;btn.innerHTML='<span>Sign in</span>';}
}

async function handleRegister(){
  const name=document.getElementById('register-name').value.trim(),email=document.getElementById('register-email').value.trim(),password=document.getElementById('register-password').value,errEl=document.getElementById('register-error'),btn=document.getElementById('register-btn');
  if(!name||!email||!password){showAuthError(errEl,'All fields are required');return;}
  if(password.length<6){showAuthError(errEl,'Password must be at least 6 characters');return;}
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Creating account...';
  try{const r=await fetch(`${API}/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password})});const d=await r.json();
    if(d.success){authToken=d.token;currentUser=d.user;isGuestMode=false;localStorage.setItem('tl_token',authToken);updateUserUI();showLanding();toast(`Welcome to TruthLens, ${d.user.name}!`,'success');}
    else showAuthError(errEl,d.error||'Registration failed');
  }catch{showAuthError(errEl,'Could not connect to server');}
  finally{btn.disabled=false;btn.innerHTML='<span>Create account</span>';}
}

function continueAsGuest(){isGuestMode=true;currentUser=null;authToken=null;showLanding();}
function showAuthError(el,msg){el.textContent=msg;el.style.display='block';}
function showPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(id)?.classList.add('active');}
function showLanding(){showPage('landing-page');loadLandingStat();}
function enterApp(){showPage('app-page');updateUserUI();loadHistory();loadStats();}
function exitApp(){showLanding();}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');}
function switchTab(tab,btn){document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.sb-btn').forEach(b=>b.classList.remove('active'));document.getElementById(`tab-${tab}`)?.classList.add('active');btn.classList.add('active');document.getElementById('topbar-title').textContent=btn.textContent.trim().replace(/^[^\s]+\s/,'');document.getElementById('sidebar').classList.remove('open');if(tab==='history')loadHistory();if(tab==='stats')loadStats();}

const BTN_LABELS={'text-btn':'Analyze Text →','image-btn':'Analyze Image →','article-btn':'Analyze Article →','compare-btn':'Compare Sources →','factcheck-btn':'Fact Check →'};
function setLoading(id,l){const b=document.getElementById(id);if(!b)return;b.disabled=l;b.innerHTML=l?'<span class="spinner"></span> Analyzing...':(BTN_LABELS[id]||'Analyze →');}
function authHeaders(){const h={'Content-Type':'application/json'};if(authToken)h['Authorization']=`Bearer ${authToken}`;return h;}

async function loadLandingStat(){try{const r=await fetch(`${API}/stats`);const d=await r.json();const el=document.getElementById('stat-total');if(el&&d.data)el.textContent=d.data.totalAnalyses||0;}catch{}}

async function analyzeText(){
  const text=document.getElementById('text-input').value.trim();
  if(!text||text.length<10)return toast('Please enter at least 10 characters','error');
  setLoading('text-btn',true);
  try{const r=await fetch(`${API}/analyze/text`,{method:'POST',headers:authHeaders(),body:JSON.stringify({text})});const d=await r.json();
    if(d.success){displayResults(d.data,'text');if(d.warning)toast('⚠️ '+d.warning,'info',8000);}else showError(d.error||'Analysis failed');
  }catch{toast('Could not connect to backend','error');}
  finally{setLoading('text-btn',false);}
}

let imageBase64=null;
function handleImageSelect(e){const file=e.target.files[0];if(!file)return;if(file.size>5*1024*1024)return toast('Image too large — max 5MB','error');const reader=new FileReader();reader.onload=ev=>{imageBase64=ev.target.result;const wrap=document.getElementById('image-preview-wrap');document.getElementById('image-preview').src=imageBase64;wrap.style.display='block';document.getElementById('upload-zone').style.display='none';};reader.readAsDataURL(file);}
function clearImage(){imageBase64=null;document.getElementById('image-preview-wrap').style.display='none';document.getElementById('upload-zone').style.display='block';document.getElementById('image-input').value='';}
async function analyzeImage(){if(!imageBase64)return toast('Please select an image first','error');setLoading('image-btn',true);try{const r=await fetch(`${API}/analyze/image`,{method:'POST',headers:authHeaders(),body:JSON.stringify({image:imageBase64})});const d=await r.json();if(d.success){displayResults(d.data,'image');if(d.warning)toast('⚠️ '+d.warning,'info',8000);}else showError(d.error||'Analysis failed');}catch{toast('Could not connect to backend','error');}finally{setLoading('image-btn',false);}}

async function analyzeArticle(){const url=document.getElementById('article-url').value.trim(),content=document.getElementById('article-content').value.trim();if(!url)return toast('Please enter the article URL','error');if(!content||content.length<20)return toast('Please paste the article content','error');setLoading('article-btn',true);try{const r=await fetch(`${API}/analyze/article`,{method:'POST',headers:authHeaders(),body:JSON.stringify({url,content})});const d=await r.json();if(d.success){displayResults(d.data,'article');if(d.warning)toast('⚠️ '+d.warning,'info',8000);}else showError(d.error||'Analysis failed');}catch{toast('Could not connect to backend','error');}finally{setLoading('article-btn',false);}}

function addSource(){const list=document.getElementById('sources-list');const count=list.querySelectorAll('.source-item').length+1;const div=document.createElement('div');div.className='source-item';div.innerHTML=`<label>Source ${count}</label><textarea class="source-input" placeholder="Paste source ${count} text..." rows="4"></textarea>`;list.appendChild(div);}
async function compareSources(){const inputs=document.querySelectorAll('.source-input');const sources=Array.from(inputs).map(i=>i.value.trim()).filter(Boolean);if(sources.length<2)return toast('Please enter at least 2 sources','error');setLoading('compare-btn',true);try{const r=await fetch(`${API}/analyze/compare`,{method:'POST',headers:authHeaders(),body:JSON.stringify({sources})});const d=await r.json();if(d.success){displayResults(d.data,'compare');if(d.warning)toast('⚠️ '+d.warning,'info',8000);}else showError(d.error||'Comparison failed');}catch{toast('Could not connect to backend','error');}finally{setLoading('compare-btn',false);}}

function setFactCheck(c){document.getElementById('factcheck-input').value=c;}
async function quickFactCheck(){const claim=document.getElementById('factcheck-input').value.trim();if(!claim)return toast('Please enter a claim','error');setLoading('factcheck-btn',true);try{const r=await fetch(`${API}/factcheck`,{method:'POST',headers:authHeaders(),body:JSON.stringify({claim})});const d=await r.json();if(d.success){displayFactCheckResult(d.data,claim);if(d.warning)toast('⚠️ '+d.warning,'info',8000);}else showError(d.error||'Fact check failed');}catch{toast('Could not connect to backend','error');}finally{setLoading('factcheck-btn',false);}}

let allHistory=[];
async function loadHistory(){try{const r=await fetch(`${API}/history?limit=100`,{headers:authHeaders()});const d=await r.json();allHistory=d.data||[];renderHistory(allHistory,null);const sub=document.getElementById('history-subtitle');if(sub)sub.textContent=isGuestMode?'Sign in to save your history':`${allHistory.length} analyses saved`;}catch{}}
function filterHistory(type,btn){document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderHistory(type?allHistory.filter(i=>i.type===type):allHistory,type);}
function renderHistory(items){const list=document.getElementById('history-list');if(!list)return;if(!items.length){list.innerHTML=`<div style="text-align:center;padding:3rem;color:var(--text3)">${isGuestMode?'🔒 Sign in to save and view your history':'No analyses yet!'}</div>`;return;}list.innerHTML=items.map(item=>{const score=item.credibilityScore||item.consistencyScore||0;const sc=score>=70?'score-hi':score>=40?'score-med':'score-lo';const cat=item.category||item.type||'analysis';const preview=item.inputPreview||item.claim||item.input_preview||'—';const date=new Date(item.createdAt||item.created_at).toLocaleDateString();return`<div class="history-item" onclick="restoreFromHistory('${item._id||item.id}')"><div class="hi-score ${sc}">${score}</div><div class="hi-body"><div class="hi-preview">${escHtml(preview.substring(0,80))}</div><div class="hi-meta">${item.type||'analysis'} · ${date}</div></div><div class="hi-cat verdict-badge ${cat}">${cat}</div></div>`;}).join('');}
async function restoreFromHistory(id){const item=allHistory.find(i=>(i._id||i.id)==id);if(!item)return;displayResults(item.full_result||item,item.type);}

async function loadStats(){try{const r=await fetch(`${API}/stats`,{headers:authHeaders()});const d=await r.json();const grid=document.getElementById('stats-grid');if(!grid||!d.data)return;if(isGuestMode){grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text3)">🔒 Sign in to see your personal stats</div>`;return;}const{totalAnalyses,byType,byCategory,averageCredibilityScore}=d.data;const tm=(byType||[]).reduce((a,x)=>{a[x.type]=x.count;return a;},{});grid.innerHTML=`<div class="stat-card"><div class="stat-card-num">${totalAnalyses}</div><div class="stat-card-label">Total Analyses</div></div><div class="stat-card"><div class="stat-card-num">${averageCredibilityScore}%</div><div class="stat-card-label">Avg Credibility Score</div></div><div class="stat-card"><div class="stat-card-num">${tm.text||0}</div><div class="stat-card-label">Text Analyses</div></div><div class="stat-card"><div class="stat-card-num">${tm.article||0}</div><div class="stat-card-label">Articles Analyzed</div></div><div class="stat-card"><div class="stat-card-num">${tm.compare||0}</div><div class="stat-card-label">Comparisons</div></div><div class="stat-card"><div class="stat-card-num">${tm.image||0}</div><div class="stat-card-label">Images Checked</div></div>`;}catch{}}

function displayResults(data,type){
  const panel=document.getElementById('results-panel');
  const score=data.credibilityScore??data.consistencyScore??50;
  const ring=document.getElementById('ring-fill');
  ring.style.strokeDashoffset=326.7-(score/100)*326.7;
  ring.style.stroke=score>=70?'var(--green)':score>=40?'var(--warn)':'var(--red)';
  document.getElementById('score-num').textContent=score;
  document.getElementById('verdict-text').textContent=data.verdict||data.shortVerdict||'';
  document.getElementById('result-timestamp').textContent=new Date().toLocaleString();
  const cat=data.category||'unclear';
  const badge=document.getElementById('verdict-badge');badge.textContent=cat.toUpperCase();badge.className=`verdict-badge ${cat}`;
  document.getElementById('category-tag').textContent=type?`${type} analysis`:'';
  let html='';
  if(data.analysis)html+=card('🔍 Analysis',`<p class="prose">${escHtml(data.analysis)}</p>`);
  const flags=data.redFlags||data.manipulationSigns||[];const pos=data.positiveSignals||data.authenticitySignals||[];
  if(flags.length||pos.length){let inner='';if(flags.length)inner+=`<div style="margin-bottom:0.75rem"><div style="font-size:0.75rem;color:var(--red);font-weight:600;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:1px">🚩 Red Flags</div><div class="tag-list">${flags.map(f=>`<span class="tag red">${escHtml(f)}</span>`).join('')}</div></div>`;if(pos.length)inner+=`<div><div style="font-size:0.75rem;color:var(--green);font-weight:600;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:1px">✅ Positive Signals</div><div class="tag-list">${pos.map(p=>`<span class="tag green">${escHtml(p)}</span>`).join('')}</div></div>`;html+=card('🏷️ Signals',inner);}
  if(data.specificClaims?.length){const rows=data.specificClaims.map((c,i)=>`<div class="kv-row"><div class="kv-key">${escHtml(c)}</div><div class="kv-val">${escHtml(data.claimVerdict?.[i]||data.claimAccuracy?.[i]||'')}</div></div>`).join('');html+=card('📋 Claims',rows);}
  if(data.languageAnalysis){const la=data.languageAnalysis;let inner=`<div class="kv-row"><div class="kv-key">Tone</div><div class="kv-val">${escHtml(la.tone||'—')}</div></div><div class="kv-row"><div class="kv-key">Sensationalism</div><div class="kv-val">${escHtml(la.sensationalism||'—')}</div></div><div class="kv-row"><div class="kv-key">Readability</div><div class="kv-val">${escHtml(la.readabilityLevel||'—')}</div></div>`;if(la.emotionalWords?.length)inner+=`<div style="margin-top:0.5rem"><div style="font-size:0.72rem;color:var(--text3);margin-bottom:0.35rem">Emotional words</div><div class="tag-list">${la.emotionalWords.map(w=>`<span class="tag">${escHtml(w)}</span>`).join('')}</div></div>`;html+=card('💬 Language',inner);}
  if(data.sourceAssessment){const sa=data.sourceAssessment;html+=card('🏢 Source',`<div class="kv-row"><div class="kv-key">Domain</div><div class="kv-val">${escHtml(sa.domain||'—')}</div></div><div class="kv-row"><div class="kv-key">Type</div><div class="kv-val">${escHtml(sa.domainType||'—')}</div></div><div class="kv-row"><div class="kv-key">Bias</div><div class="kv-val">${escHtml(sa.knownBias||'—')}</div></div><div class="kv-row"><div class="kv-key">Reliability</div><div class="kv-val">${escHtml(sa.reliabilityRating||'—')}</div></div>${sa.notes?`<p class="prose" style="margin-top:0.5rem">${escHtml(sa.notes)}</p>`:''}`); }
  if(data.journalisticStandards){const js=data.journalisticStandards;const t=v=>v?'✅':'❌';html+=card('📐 Standards',`<div class="kv-row"><div class="kv-key">Has Author</div><div class="kv-val">${t(js.hasAuthor)}</div></div><div class="kv-row"><div class="kv-key">Has Date</div><div class="kv-val">${t(js.hasDate)}</div></div><div class="kv-row"><div class="kv-key">Has Sources</div><div class="kv-val">${t(js.hasSources)}</div></div><div class="kv-row"><div class="kv-key">Has Quotes</div><div class="kv-val">${t(js.hasQuotes)}</div></div><div class="kv-row"><div class="kv-key">Editorial</div><div class="kv-val">${escHtml(js.editorialStandards||'—')}</div></div>`);}
  if(data.agreements?.length||data.disagreements?.length){let inner='';if(data.agreements?.length)inner+=`<div style="margin-bottom:0.75rem"><div style="font-size:0.72rem;color:var(--green);font-weight:600;margin-bottom:0.4rem">AGREEMENTS</div><div class="tag-list">${data.agreements.map(a=>`<span class="tag green">${escHtml(a)}</span>`).join('')}</div></div>`;if(data.disagreements?.length)inner+=`<div><div style="font-size:0.72rem;color:var(--red);font-weight:600;margin-bottom:0.4rem">CONFLICTS</div><div class="tag-list">${data.disagreements.map(a=>`<span class="tag red">${escHtml(a)}</span>`).join('')}</div></div>`;html+=card('🔀 Consistency',inner);}
  if(data.verificationSteps?.length)html+=card('🔎 How to Verify',`<ol class="ol-list">${data.verificationSteps.map(s=>`<li>${escHtml(s)}</li>`).join('')}</ol>`);
  if(data.suggestions?.length)html+=card('💡 Suggestions',`<div class="tag-list">${data.suggestions.map(s=>`<span class="tag blue">${escHtml(s)}</span>`).join('')}</div>`);
  if(data.contextualBackground)html+=card('📚 Context',`<p class="prose">${escHtml(data.contextualBackground)}</p>`);
  if(data.truthLikelihood)html+=card('⚖️ Truth Assessment',`<p class="prose">${escHtml(data.truthLikelihood)}</p>`);
  document.getElementById('report-cards').innerHTML=html;
  panel.style.display='block';
  setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}),100);
}

function displayFactCheckResult(data,claim){
  const panel=document.getElementById('results-panel');
  const score=data.confidence||50;
  const vc={'TRUE':'var(--green)','FALSE':'var(--red)','MOSTLY TRUE':'var(--green)','MOSTLY FALSE':'var(--red)','MIXED':'var(--warn)','UNVERIFIABLE':'#94a3b8','OUTDATED':'var(--warn)'};
  const color=vc[data.verdict]||'#94a3b8';
  const ring=document.getElementById('ring-fill');ring.style.strokeDashoffset=326.7-(score/100)*326.7;ring.style.stroke=color;
  document.getElementById('score-num').textContent=score;
  const badge=document.getElementById('verdict-badge');badge.textContent=data.verdict||'UNVERIFIABLE';badge.className='verdict-badge '+(data.verdict==='TRUE'||data.verdict==='MOSTLY TRUE'?'real':data.verdict==='FALSE'||data.verdict==='MOSTLY FALSE'?'fake':'misleading');
  document.getElementById('verdict-text').textContent=data.shortVerdict||'';
  document.getElementById('category-tag').textContent='fact check';
  document.getElementById('result-timestamp').textContent=new Date().toLocaleString();
  let html=`<div class="rcard" style="border-color:${color}20"><div class="rcard-body open" style="padding-top:1rem"><div class="fact-verdict" style="background:${color}18;color:${color};border:1px solid ${color}30">${data.verdict}</div><p class="prose">${escHtml(data.explanation||'')}</p></div></div>`;
  if(data.keyFacts?.length)html+=card('📌 Key Facts',`<ol class="ol-list">${data.keyFacts.map(f=>`<li>${escHtml(f)}</li>`).join('')}</ol>`);
  if(data.context)html+=card('📚 Context',`<p class="prose">${escHtml(data.context)}</p>`);
  if(data.specificSources?.length)html+=card('🔗 Verify At',`<ol class="ol-list">${data.specificSources.map(s=>`<li>${escHtml(s)}</li>`).join('')}</ol>`);
  if(data.relatedMisconceptions?.length)html+=card('⚠️ Related Myths',`<div class="tag-list">${data.relatedMisconceptions.map(m=>`<span class="tag red">${escHtml(m)}</span>`).join('')}</div>`);
  if(data.expertConsensus)html+=card('🎓 Expert Consensus',`<p class="prose">${escHtml(data.expertConsensus)}</p>`);
  document.getElementById('report-cards').innerHTML=html;
  panel.style.display='block';
  setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}),100);
}

function card(title,content){return`<div class="rcard"><div class="rcard-header" onclick="toggleCard(this)"><div class="rcard-title">${title}</div><div class="rcard-chevron">▼</div></div><div class="rcard-body open">${content}</div></div>`;}
function toggleCard(h){h.classList.toggle('open');h.nextElementSibling.classList.toggle('open');}
function closeResults(){document.getElementById('results-panel').style.display='none';}

function exportReport(){const score=document.getElementById('score-num').textContent,verdict=document.getElementById('verdict-text').textContent,cat=document.getElementById('verdict-badge').textContent,ts=document.getElementById('result-timestamp').textContent,cards=document.getElementById('report-cards').innerText;const text=`TruthLens Report\n${'='.repeat(40)}\nScore: ${score}/100\nCategory: ${cat}\nVerdict: ${verdict}\nDate: ${ts}\n\n${cards}`;const blob=new Blob([text],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`truthlens-report-${Date.now()}.txt`;a.click();}

function showError(msg){const isQ=msg.toLowerCase().includes('quota')||msg.toLowerCase().includes('429');const panel=document.getElementById('results-panel');document.getElementById('score-num').textContent='—';document.getElementById('ring-fill').style.strokeDashoffset=326.7;document.getElementById('ring-fill').style.stroke='var(--text3)';document.getElementById('verdict-badge').textContent='ERROR';document.getElementById('verdict-badge').className='verdict-badge unclear';document.getElementById('verdict-text').textContent='';document.getElementById('category-tag').textContent='';document.getElementById('result-timestamp').textContent=new Date().toLocaleString();document.getElementById('report-cards').innerHTML=`<div style="padding:2rem;text-align:center"><div style="font-size:3rem;margin-bottom:1rem">${isQ?'⚠️':'❌'}</div><h3 style="font-family:'Syne',sans-serif;color:${isQ?'var(--warn)':'var(--red)'};margin-bottom:0.75rem">${isQ?'Quota Exceeded':'Analysis Failed'}</h3><p style="color:var(--text2);line-height:1.7;max-width:500px;margin:0 auto 1.5rem">${escHtml(msg)}</p><button class="btn-secondary" onclick="closeResults()">Dismiss</button></div>`;panel.style.display='block';setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}),100);}

function toast(msg,type='info',duration=4000){const c=document.getElementById('toast-container');const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=msg;c.appendChild(el);setTimeout(()=>el.remove(),duration);}
function escHtml(str){if(!str)return'';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}