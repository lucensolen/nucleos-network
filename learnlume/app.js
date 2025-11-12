(function(){
  // --- Bridge + backend resolution (works standalone or via cockpit) ---
  const BACKEND = (window.opener && window.opener.LUCEN_CORE_API)
    ? window.opener.LUCEN_CORE_API
    : (window.LUCEN_CORE_API || "https://lucen17-inflo-backend.onrender.com");

  // --- Keys ---
  const NAME_KEY="beam.name";           // optional (not shown in this build)
  const BEAM_KEY="lucen.beam.id";       // set by cockpit or generated elsewhere
  const SYNC_KEY="lucen.sync";          // 'on' | 'off'
  const STORE_KEY="learnlume.store";    // local content

  // --- DOM ---
  const $=s=>document.querySelector(s);
  const tabs=[...document.querySelectorAll('.tab')];
  const panels={ home:$('#home'), advice:$('#advice'), evidence:$('#evidence') };

  const syncToggle=$("#syncToggle"), syncLabel=$("#syncLabel"), bridgeDot=$("#bridgeDot");
  const subjectSelect=$("#subjectSelect"), openSubjectBtn=$("#openSubjectBtn");
  const quickAddSubject=$("#quickAddSubject"), logText=$("#logText"), fileInput=$("#fileInput"), logBtn=$("#logBtn");
  const recentList=$("#recentList"), exportBtn=$("#exportBtn");

  // --- State ---
  function load(){ try{ const s=JSON.parse(localStorage.getItem(STORE_KEY)||"{}"); if(!s.subjects) s.subjects={"Nature":[],"Numbers":[],"Words":[]}; return s; }catch{ return {subjects:{"Nature":[],"Numbers":[],"Words":[]}}; } }
  function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  let state = load();

  // --- UI helpers ---
  function setSyncUI(on){ syncToggle.checked=on; syncLabel.textContent=on?"Sync On":"Sync Off"; document.body.classList.toggle("love-on", on); }
  function pulse(type){ bridgeDot.classList.remove("green","cyan"); if(type==="green") bridgeDot.classList.add("green"); if(type==="cyan") bridgeDot.classList.add("cyan"); setTimeout(()=>bridgeDot.classList.remove("green","cyan"), 1000); }
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function inferTone(t){ t=(t||'').toLowerCase(); if(/(plan|build|fix|schedule|commit|merge|ship)/.test(t)) return "Directive"; if(/(idea|imagine|design|create|vision|dream|invent|sketch)/.test(t)) return "Creative"; return "Reflective"; }
  async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

  // --- Tabs (old layout preserved) ---
  tabs.forEach(btn=>btn.addEventListener('click', ()=>{
    tabs.forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    Object.keys(panels).forEach(k => panels[k].style.display = (btn.dataset.tab===k?'block':'none'));
  }));
  // default
  Object.keys(panels).forEach((k,i)=> panels[k].style.display = (i===0?'block':'none'));

  // --- Subjects (old behavior) ---
  function renderSubjectsSelect(){
    subjectSelect.innerHTML = Object.keys(state.subjects).map(s=>`<option>${escapeHtml(s)}</option>`).join("");
  }
  function openSubject(title){
    const items = (state.subjects[title]||[]).slice().reverse().map(entryHtml).join("");
    recentList.innerHTML = items || "<p class='muted'>No entries yet.</p>";
  }
  function entryHtml(e){
    const files = (e.files||[]).map((d,i)=>`<div><a download="ll-file-${i+1}.bin" href="${d}">Attachment ${i+1}</a></div>`).join("");
    return `<div class="entry">
      <time>${new Date(e.ts).toLocaleString()}</time>
      <div>${escapeHtml(e.text||"")}</div>
      ${files}
    </div>`;
  }
  function renderRecent(){
    // 5 latest across all subjects
    const entries = Object.entries(state.subjects||{}).flatMap(([subject,arr])=> (arr||[]).map(r=>({...r,subject})));
    const recent = entries.sort((a,b)=>b.ts-a.ts).slice(0,5);
    recentList.innerHTML = recent.length ? recent.map(e=>`
      <div class="entry">
        <strong>${escapeHtml(e.subject)}</strong> — ${new Date(e.ts).toLocaleString()}<br>${escapeHtml(e.text||'')}
      </div>`).join("") : "<p class='muted'>No reflections yet.</p>";
  }

  // --- Init ---
  (function init(){
    setSyncUI((localStorage.getItem(SYNC_KEY)||"off")==="on");
    renderSubjectsSelect();
    if (subjectSelect.value) openSubject(subjectSelect.value); else renderRecent();
    heartbeat(); // initial backend check
  })();

  // --- Actions ---
  quickAddSubject.addEventListener("click", ()=>{
    const name = prompt("New subject name?"); if(!name) return;
    if(!state.subjects[name]) state.subjects[name]=[]; save(); renderSubjectsSelect();
  });
  openSubjectBtn.addEventListener("click", ()=> openSubject(subjectSelect.value));

  logBtn.addEventListener("click", async ()=>{
    const subj = subjectSelect.value;
    const text = (logText.value||"").trim();
    if(!subj){ alert("Choose a subject first."); return; }
    if(!text && !fileInput.files.length){ alert("Write a note or attach a file."); return; }
    const files = await Promise.all([...fileInput.files].map(readAsDataURL));
    const entry = { subject:subj, text, files, ts:Date.now(), tone:inferTone(text), division:"educationFlow", deviceId: localStorage.getItem(BEAM_KEY)||"unknown", gate:"learn" };

    // local persist
    state.subjects[subj]=state.subjects[subj]||[]; state.subjects[subj].push(entry); save();
    logText.value=""; fileInput.value="";
    openSubject(subj); // reflect into recent
    pulse("green");

    // Bridge → Core (inbound at your cockpit)
    try { if (window.LucenSignal && typeof LucenSignal.returnToCore === 'function') LucenSignal.returnToCore(entry); } catch {}

    // Global sync (optional)
    if((localStorage.getItem(SYNC_KEY)||"off")==="on"){
      try{
        const r = await fetch(BACKEND+"/memory",{method:"POST",headers:{"Content-Type":"application/json"}, body: JSON.stringify(entry)});
        if (r.ok) { /* could mark as synced */ }
      }catch(e){ /* queue later if needed */ }
    }
  });

  exportBtn.addEventListener("click", ()=>{
    const beam = localStorage.getItem(BEAM_KEY) || "anonymous";
    const data = JSON.stringify({ beam, ...state }, null, 2);
    const blob = new Blob([data], {type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="learnlume-evidence.json"; a.click(); URL.revokeObjectURL(a.href);
  });

  syncToggle.addEventListener("change", ()=>{
    const on = syncToggle.checked; localStorage.setItem(SYNC_KEY, on?"on":"off"); setSyncUI(on);
    if (on) heartbeat(); // confirm backend link quickly
  });

  // --- Bridge sensing (cyan when cockpit pings back) ---
  window.addEventListener("message", ev => {
    if (!ev.data || ev.data.type !== "lucenUpdate") return;
    pulse("cyan");
    // if a beam id is shared by opener, store once
    const beam = ev.data.payload && ev.data.payload.beam;
    if (beam && !localStorage.getItem(BEAM_KEY)) localStorage.setItem(BEAM_KEY, beam);
  });

  // --- Heartbeat check (lights cyan if backend alive) ---
  async function heartbeat(){
    try{
      const r = await fetch(BACKEND + "/health", {cache:"no-store"});
      const d = await r.json();
      if (d && d.ok) { bridgeDot.classList.add("cyan"); setTimeout(()=>bridgeDot.classList.remove("cyan"), 800); }
    }catch(_){ /* ignore */ }
  }
  setInterval(heartbeat, 15000);

  // --- Utils ---
  function readAsDataURL(file){ return new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(file); }); }
})();