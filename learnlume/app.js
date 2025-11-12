(() => {
  const CORE_PREFIX = 'lucen.core.';
  const apiKey = CORE_PREFIX + 'api';
  const BUS = window.LucenSignal;

  // Profile
  const profileKey = 'learnlume.profile';
  const subjectsKey = 'learnlume.subjects';
  const queueKey = 'learnlume.queue';
  const evidenceKey = 'learnlume.evidence';

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const welcomeCard = $('#welcomeCard');
  const tabs = $('#tabs');
  const onlineBadge = $('#onlineBadge');
  const beam = $('#beam');

  const lens = $('#lens');
  const photo = $('#photo');
  const saveBtn = $('#saveEntry');
  const saveHint = $('#saveHint');

  const subjectChips = $('#subjectChips');
  const addSubjectInput = $('#addSubjectInput');
  const addSubjectBtn = $('#addSubjectBtn');
  const subjectList = $('#subjectList');
  const filterSubject = $('#filterSubject');
  const filterTone = $('#filterTone');
  const evidenceGrid = $('#evidenceGrid');
  const adviceList = $('#adviceList');

  // Tabs
  $$('.tabs button').forEach(b => b.addEventListener('click', () => {
    $$('.tabs button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === b.dataset.tab));
  }));

  // State
  let profile = loadJSON(profileKey) || null;
  let subjects = loadJSON(subjectsKey) || ['Math','Literacy','Science','Art','Nature','Movement','Projects','Life Skills'];
  let evidence = loadJSON(evidenceKey) || []; // local cache of saved entries
  let queue = loadJSON(queueKey) || []; // pending uploads

  init();

  function init(){
    renderBeam();
    renderSubjects();
    renderEvidence();
    if (profile) showApp(); else showWelcome();
    updateOnline();
    setInterval(updateOnline, 4000);
    suggestAdvice();
  }

  function showWelcome(){
    welcomeCard.hidden = false;
    tabs.hidden = true;
    $$('.panel').forEach(p => p.classList.remove('active'));
    $('#log').classList.add('active');
    $('#createProfile').onclick = createProfile;
    $('#syncToggle').addEventListener('change', ev => {
      $('#syncHint').textContent = ev.target.checked ? 'Cloud sync enabled' : 'Local-only (private)';
    });
  }

  function showApp(){
    welcomeCard.hidden = true;
    tabs.hidden = false;
    $('#profileName').value = '';
    $('#learnerName').value = '';
  }

  function createProfile(){
    const name = $('#profileName').value.trim() || 'Parent';
    const learner = $('#learnerName').value.trim() || 'Learner';
    const sync = $('#syncToggle').checked;
    profile = {
      userId: uid(), name, learners: [{id:'l1', name: learner}],
      mode: sync ? 'sync' : 'local', created: Date.now()
    };
    saveJSON(profileKey, profile);
    showApp();
  }

  function renderBeam(){
    try{
      const s = BUS?.read?.() || {};
      // s could include tone or RC/GE; we just animate visually here
      beam.style.animationDuration = (s?.mode === 'Creation') ? '1.5s' : '3s';
    } catch {}
  }

  function updateOnline(){
    getJSON(apiBase() + '/health').then(r => {
      onlineBadge.textContent = 'Online';
      onlineBadge.style.background = '#dff6ea';
      onlineBadge.style.color = '#0b5c3b';
      if (queue.length) flushQueue();
    }).catch(_ => {
      onlineBadge.textContent = 'Offline';
      onlineBadge.style.background = '#dde7f2';
      onlineBadge.style.color = '#335';
    });
  }

  // Subjects
  function renderSubjects(){
    subjectChips.innerHTML = '';
    subjects.forEach(s => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = s;
      b.onclick = () => b.classList.toggle('active');
      subjectChips.appendChild(b);
    });
    subjectList.innerHTML = '';
    subjects.forEach((s, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${s}</span><button data-i="${i}">Remove</button>`;
      li.querySelector('button').onclick = () => {
        subjects.splice(i,1); saveJSON(subjectsKey, subjects); renderSubjects();
      };
      subjectList.appendChild(li);
    });
    // filters
    filterSubject.innerHTML = '<option value="">All subjects</option>' + subjects.map(s=>`<option>${s}</option>`).join('');
  }
  addSubjectBtn.onclick = () => {
    const v = addSubjectInput.value.trim(); if (!v) return;
    if (!subjects.includes(v)) subjects.push(v);
    saveJSON(subjectsKey, subjects); addSubjectInput.value=''; renderSubjects();
  };

  // Logging
  saveBtn.onclick = async () => {
    const text = lens.value.trim();
    if (!text) return hint('Write a reflection first.');
    const selSubjects = [...subjectChips.querySelectorAll('.chip.active')].map(x=>x.textContent);
    const tone = inferTone(text);
    const entry = {
      id: uid(), text, tone, subjects: selSubjects, learnerId: profile?.learners?.[0]?.id || 'l1',
      ts: Date.now(), division: 'educationFlow'
    };

    let fileUrl = null;
    const file = photo.files?.[0] || null;

    if (file) {
      try {
        const b64 = await fileToBase64(file);
        // queue file upload first
        queue.push({ type:'file', data:b64, linkTo: entry.id });
      } catch {}
    }
    // queue reflection
    queue.push({ type:'reflection', entry });

    // local evidence immediately
    evidence.unshift({ ...entry, fileUrl });
    saveJSON(evidenceKey, evidence);
    saveJSON(queueKey, queue);
    lens.value=''; photo.value=''; subjectChips.querySelectorAll('.chip.active').forEach(c=>c.classList.remove('active'));
    hint('Saved locally. Syncing…');
    flushQueue(); renderEvidence();

    // Pulse back to cockpit
    try { BUS?.returnToCore?.({ type:'LearnLume', entry }); } catch {}
  };

  async function flushQueue(){
    if (!queue.length) return;
    try {
      const health = await getJSON(apiBase() + '/health');
    } catch { return; }
    const next = [];
    for (const item of queue){
      if (item.type === 'file'){
        try {
          const r = await postJSON(apiBase() + '/files', { data: item.data, userId: profile?.userId || 'anon' });
          // attach url to local evidence item
          evidence = evidence.map(ev => ev.id === item.linkTo ? { ...ev, fileUrl: r.url } : ev);
          saveJSON(evidenceKey, evidence);
        } catch { next.push(item); }
      } else if (item.type === 'reflection'){
        try {
          await postJSON(apiBase() + '/learnlume/reflection', { ...item.entry, userId: profile?.userId || 'anon' });
        } catch { next.push(item); }
      }
    }
    queue = next;
    saveJSON(queueKey, queue);
    if (!queue.length) hint('Synced.');
  }

  // Evidence
  function renderEvidence(){
    const fSub = filterSubject.value || '';
    const fTone = filterTone.value || '';
    const list = evidence.filter(e => (!fSub || e.subjects.includes(fSub)) && (!fTone || e.tone===fTone));
    evidenceGrid.innerHTML = '';
    list.forEach(e => {
      const tile = document.createElement('div'); tile.className = 'tile';
      tile.innerHTML = `
        ${e.fileUrl ? `<img src="${e.fileUrl}" alt="evidence">` : `<img alt="placeholder">`}
        <div class="meta">
          <div>${new Date(e.ts).toLocaleString()}</div>
          <div>${e.tone} — ${e.subjects.join(', ')||'No subjects'}</div>
          <div>${escapeHTML(e.text).slice(0,120)}</div>
        </div>`;
      evidenceGrid.appendChild(tile);
    });
  }
  filterSubject.onchange = renderEvidence;
  filterTone.onchange = renderEvidence;

  // Advice (simple rules)
  function suggestAdvice(){
    const now = Date.now();
    const last7 = evidence.filter(e => (now - e.ts) < 7*86400e3);
    const counts = {};
    last7.forEach(e => e.subjects.forEach(s => counts[s]=(counts[s]||0)+1));
    const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    const missing = subjects.filter(s => !counts[s]);
    const items = [];

    if (missing.length){
      items.push({ title: 'Balance the week', text: `You haven’t touched ${missing.slice(0,3).join(', ')} recently. Try a 20‑minute mini‑activity.` });
    }
    if (sorted[0]?.[0]){
      items.push({ title: 'Go deeper', text: `Lean into "${sorted[0][0]}": extend with a simple project or a field trip.` });
    }
    if (!last7.length){
      items.push({ title: 'Start gentle', text: 'Capture one small observation today. A sentence is enough.' });
    }

    adviceList.innerHTML = items.map(i => `<div class="item"><strong>${i.title}</strong><div>${i.text}</div></div>`).join('');
  }

  // Export
  $('#exportBtn').onclick = () => {
    const blob = new Blob([JSON.stringify({ profile, evidence, subjects }, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='learnlume-export.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  };

  // Utils
  function apiBase(){ return (localStorage.getItem(apiKey) || 'http://localhost:3000'); }
  function loadJSON(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch{return null;} }
  function saveJSON(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
  function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
  function inferTone(t){
    const s = String(t).toLowerCase();
    if (/(do|today|plan|next|build|fix|schedule|homework|exercise)/.test(s)) return 'Directive';
    if (/(idea|imagine|design|create|dream|invent|draw|paint)/.test(s)) return 'Creative';
    return 'Reflective';
  }
  function fileToBase64(file){
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  function getJSON(u){ return fetch(u).then(r => { if(!r.ok) throw new Error('HTTP'); return r.json(); }); }
  function postJSON(u,d){ return fetch(u,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(d)}).then(r=>{ if(!r.ok) throw new Error('HTTP'); return r.json(); }); }
  function escapeHTML(s){ return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

})();