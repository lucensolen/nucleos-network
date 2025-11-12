(function(){
  const BACKEND = (window.opener && window.opener.LUCEN_CORE_API) ? window.opener.LUCEN_CORE_API : (window.LUCEN_CORE_API || "https://lucen17-inflo-backend.onrender.com");
  const NAME_KEY="beam.name"; const BEAM_KEY="lucen.beam.id"; const SYNC_KEY="lucen.sync";
  const STORE_KEY="learnlume.store";
  const $=s=>document.querySelector(s);
  const syncToggle=$("#syncToggle"), syncLabel=$("#syncLabel"), bridgeDot=$("#bridgeDot");
  const hello=$("#hello"), subjectSelect=$("#subjectSelect"), openSubjectBtn=$("#openSubjectBtn");
  const quickAddSubject=$("#quickAddSubject"), logText=$("#logText"), fileInput=$("#fileInput"), logBtn=$("#logBtn");
  const recentList=$("#recentList"), exportBtn=$("#exportBtn");

  function load(){ try{ const s=JSON.parse(localStorage.getItem(STORE_KEY)||"{}"); if(!s.subjects) s.subjects={"Nature":[],"Numbers":[],"Words":[]}; return s; }catch{ return {subjects:{"Nature":[],"Numbers":[],"Words":[]}}; } }
  function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  let state = load();

  function setSyncUI(on){ syncToggle.checked=on; syncLabel.textContent=on?"Sync On":"Sync Off"; document.body.classList.toggle("love-on", on); }
  function pulse(type){ bridgeDot.classList.remove("green","cyan"); if(type==="green") bridgeDot.classList.add("green"); if(type==="cyan") bridgeDot.classList.add("cyan"); setTimeout(()=>bridgeDot.classList.remove("green","cyan"), 1000); }
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function inferTone(t){ t=(t||'').toLowerCase(); if(/(plan|build|fix|schedule|commit|merge|ship)/.test(t)) return "Directive"; if(/(idea|imagine|design|create|vision|dream|invent|sketch)/.test(t)) return "Creative"; return "Reflective"; }

  window.addEventListener("message", (ev)=>{
    if(!ev.data || ev.data.type!=="lucenUpdate") return;
    const beam = ev.data.payload && ev.data.payload.beam;
    if(beam && !localStorage.getItem(BEAM_KEY)) localStorage.setItem(BEAM_KEY, beam);
    pulse("cyan");
  });

  (function init(){
    setSyncUI((localStorage.getItem(SYNC_KEY)||"off")==="on");
    const name = localStorage.getItem(NAME_KEY)||"Friend";
    hello.textContent = `Hello ${name} — let’s learn by living.`;
    renderSubjectsSelect(); renderRecent();
  })();

  function renderSubjectsSelect(){
    subjectSelect.innerHTML = Object.keys(state.subjects).map(s=>`<option>${escapeHtml(s)}</option>`).join("");
  }
  function openSubject(title){
    const items = (state.subjects[title]||[]).slice().reverse().map(entryHtml).join("");
    recentList.innerHTML = items || "<p class='muted'>No entries yet.</p>";
  }
  function entryHtml(e){
    const files = (e.files||[]).map((d,i)=>`<div><a download="ll-file-${i}.bin" href="${d}">Attachment ${i+1}</a></div>`).join("");
    return `<div class="entry">
      <time>${new Date(e.ts).toLocaleString()}</time>
      <div>${escapeHtml(e.text||"")}</div>
      ${files}
    </div>`;
  }

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
    state.subjects[subj]=state.subjects[subj]||[]; state.subjects[subj].push(entry); save();
    logText.value=""; fileInput.value=""; openSubject(subj);
    pulse("green");
    try{ LucenSignal.returnToCore(entry); }catch{}
    if((localStorage.getItem(SYNC_KEY)||"off")==="on"){
      try{ await fetch(BACKEND+"/memory",{method:"POST",headers:{"Content-Type":"application/json"}, body: JSON.stringify(entry)}); }catch(e){}
    }
  });

  exportBtn.addEventListener("click", ()=>{
    const beam = localStorage.getItem(BEAM_KEY);
    const data = JSON.stringify({ beam, ...state }, null, 2);
    const blob = new Blob([data], {type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="learnlume-evidence.json"; a.click(); URL.revokeObjectURL(a.href);
  });

  syncToggle.addEventListener("change", ()=>{
    const on = syncToggle.checked; localStorage.setItem(SYNC_KEY, on?"on":"off"); setSyncUI(on);
  });

  function readAsDataURL(file){ return new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(file); }); }

function renderRecent() {
  const list = document.getElementById("recentList");
  if (!list) return;
  // Gather all reflections from all subjects
  const subjects = Object.entries(state.subjects || {});
  const entries = subjects.flatMap(([subject, arr]) =>
    (arr || []).map(r => ({...r, subject}))
  );
  // Render last 5 reflections, newest first
  const recent = entries.sort((a,b)=>b.ts - a.ts).slice(0,5);
  list.innerHTML = recent.length
    ? recent.map(e => `
        <div class="entry">
          <strong>${escapeHtml(e.subject)}</strong> —
          ${new Date(e.ts).toLocaleString()}<br>
          ${escapeHtml(e.text || '')}
        </div>
      `).join("")
    : "<p class='muted'>No reflections yet.</p>";
}

})();
