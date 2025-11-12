(function(){
  const BACKEND = window.LUCEN_CORE_API || "https://lucen17-inflo-backend.onrender.com";
  const NAME_KEY="beam.name"; const BEAM_KEY="lucen.beam.id"; const SYNC_KEY="lucen.sync";
  const $=s=>document.querySelector(s);

  const intro=$("#intro"), app=$("#app");
  const nameInput=$("#nameInput"), genBeamBtn=$("#genBeamBtn"), beamId=$("#beamId"), copyBeamBtn=$("#copyBeamBtn"), enterBtn=$("#enterBtn");
  const orbSmall=$("#orbSmall"), syncToggle=$("#syncToggle"), syncLabel=$("#syncLabel"), bridgeDot=$("#bridgeDot");
  const openLearnLume=$("#openLearnLume");

  function uuid8(){return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)).slice(0,8).toUpperCase();}
  function ensureBeam(){let id=localStorage.getItem(BEAM_KEY); if(!id){id=uuid8(); localStorage.setItem(BEAM_KEY,id);} return id;}
  function pulse(type){bridgeDot.classList.remove("green","cyan"); if(type==="green") bridgeDot.classList.add("green"); if(type==="cyan") bridgeDot.classList.add("cyan"); setTimeout(()=>bridgeDot.classList.remove("green","cyan"), 1000);}

  function onIntro(){ nameInput.value=localStorage.getItem(NAME_KEY)||""; beamId.value=localStorage.getItem(BEAM_KEY)||""; }
  genBeamBtn.addEventListener("click", ()=>{ beamId.value=ensureBeam(); });
  copyBeamBtn.addEventListener("click", async ()=>{ try{ await navigator.clipboard.writeText(beamId.value); copyBeamBtn.textContent="Copied"; setTimeout(()=>copyBeamBtn.textContent="Copy",900);}catch{} });
  enterBtn.addEventListener("click", ()=>{ const n=(nameInput.value||"").trim(); if(n) localStorage.setItem(NAME_KEY,n); if(!localStorage.getItem(BEAM_KEY)) ensureBeam(); showApp(); });

  function setSyncUI(on){ syncToggle.checked=on; syncLabel.textContent=on?"Sync On":"Sync Off"; if(orbSmall) orbSmall.style.animationDuration = on ? "2.8s":"5s"; document.body.classList.toggle("love-on", on); }

  async function heartbeat(){
    if((localStorage.getItem(SYNC_KEY)||"off")!=="on") return;
    const beam=localStorage.getItem(BEAM_KEY);
    try{
      await fetch(BACKEND+"/sync/heartbeat",{ method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ beam, apps:["learnlume"], sync:true, ts: Date.now() }) });
      pulse("green");
    }catch(e){}
  }
  setInterval(heartbeat, 120000);

  syncToggle.addEventListener("change", ()=>{ const on = syncToggle.checked; localStorage.setItem(SYNC_KEY, on?"on":"off"); setSyncUI(on); heartbeat(); });

  openLearnLume.addEventListener("click", ()=>{
    const url = "./learnlume/index.html";
    const win = window.open(url, "_blank");
    setTimeout(()=>{
      const beam = localStorage.getItem(BEAM_KEY);
      win && win.postMessage({ type:"lucenUpdate", payload:{ beam, source:"BeamShell" } }, "*");
    },900);
  });

  window.addEventListener("message",(e)=>{
    if(!e.data) return;
    if(e.data.type==="lucenReturn"){
      const entry=e.data.payload||{};
      if((localStorage.getItem(SYNC_KEY)||"off")==="on"){
        fetch(BACKEND+"/memory",{ method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(entry) }).catch(()=>{});
      }
      pulse("cyan");
    }
  });

  (function init(){ if(localStorage.getItem(BEAM_KEY)){ showApp(); } else { onIntro(); } })();
  function showApp(){ intro.classList.remove("active"); app.classList.add("active"); setSyncUI((localStorage.getItem(SYNC_KEY)||"off")==="on"); heartbeat(); }
})();