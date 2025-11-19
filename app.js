// app.js - main logic
(function(){
  const firebaseAvailable = !!(window._firebase && window._firebase.auth && window._firebase.db);
  const auth = firebaseAvailable ? window._firebase.auth : null;
  const db = firebaseAvailable ? window._firebase.db : null;

  const LS_KEY = 'romantic.timeline.entries.v1';
  let entries = [
    {emoji:'❤️', title:'Start', date:'19.06.2024'},
    {emoji:'🕓', title:'Talked for 5 hours', date:'02.10.2024'},
    {emoji:'😌', title:'1st meet — cycled to school together', date:'21.10.2024'},
    {emoji:'🫴', title:\"Held each other's hand for the 1st time\", date:'09.06.2025'},
    {emoji:'💋', title:'1st kiss (lips & cheeks)', date:'25.08.2025'},
    {emoji:'😙', title:'2nd kiss', date:'03.11.2025'},
    {emoji:'🫂', title:'1st hug', date:'__________'}
  ];

  // DOM refs
  const timelineEl = document.getElementById('timeline');
  const previewText = document.getElementById('previewText');
  const entryModal = document.getElementById('entryModal');
  const topStatus = document.getElementById('topStatus');
  const authStatusEl = document.getElementById('authStatus');
  const signOutBtn = document.getElementById('signOutBtn');

  // local helpers
  function loadLocal(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(raw){
        const p = JSON.parse(raw);
        if(Array.isArray(p)) entries = p;
      }
    }catch(e){ console.warn('loadLocal', e) }
  }
  function saveLocal(){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(entries)); }catch(e){ console.warn('saveLocal', e) }
  }

  // render
  function render(){
    timelineEl.innerHTML = '';
    entries.forEach((e,i)=>{
      const row = document.createElement('div');
      row.className = 'entry';
      row.draggable = true;
      row.dataset.index = i;
      row.innerHTML = `<div class="dot">${e.emoji}</div>
        <div class="meta">
          <div contenteditable="true" class="title editable" data-i="${i}" data-field="title">${escapeHtml(e.title)}</div>
          <div contenteditable="true" class="date editable" data-i="${i}" data-field="date">${escapeHtml(e.date)}</div>
        </div>`;
      // drag handlers
      row.addEventListener('dragstart', ev => { ev.dataTransfer.setData('text/plain', i); row.style.opacity='0.5' });
      row.addEventListener('dragend', ()=>{ row.style.opacity='1' });
      row.addEventListener('dragover', ev => ev.preventDefault());
      row.addEventListener('drop', ev => {
        ev.preventDefault();
        const from = parseInt(ev.dataTransfer.getData('text/plain'));
        const to = parseInt(row.dataset.index);
        if(from !== to){
          const moved = entries.splice(from,1)[0];
          entries.splice(to,0,moved);
          render();
          persist();
        }
      });
      timelineEl.appendChild(row);
    });
    attachEditListeners();
    updatePreview();
  }

  function attachEditListeners(){
    document.querySelectorAll('.editable').forEach(el=>{
      el.removeEventListener('input', onEditableInput);
      el.addEventListener('input', onEditableInput);
    });
  }
  function onEditableInput(ev){
    const el = ev.target;
    const i = parseInt(el.dataset.i);
    const field = el.dataset.field;
    entries[i][field] = el.innerText.trim();
    persist();
  }
  function updatePreview(){
    previewText.textContent = entries.slice(0,3).map(e=>`${e.title} — ${e.date}`).join('  •  ');
  }
  function escapeHtml(str){ return String(str||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

  // modal
  document.getElementById('addEntryBtn').addEventListener('click', ()=> openModal());
  document.getElementById('closeModalBtn').addEventListener('click', ()=> closeModal());
  document.getElementById('saveModalBtn').addEventListener('click', ()=>{
    const emoji = document.getElementById('modalEmoji').value.trim();
    const title = document.getElementById('modalTitle').value.trim();
    const date = document.getElementById('modalDate').value.trim();
    if(!emoji || !title || !date){ alert('Please fill all fields'); return; }
    entries.push({emoji,title,date});
    render();
    persist();
    document.getElementById('modalEmoji').value=''; document.getElementById('modalTitle').value=''; document.getElementById('modalDate').value='';
    closeModal();
  });
  function openModal(){ entryModal.style.display = 'flex'; entryModal.setAttribute('aria-hidden','false'); }
  function closeModal(){ entryModal.style.display = 'none'; entryModal.setAttribute('aria-hidden','true'); }

  // persist (local + firestore)
  let saveTimer = null;
  function persist(){
    saveLocal();
    if(firebaseAvailable() && auth && auth.currentUser){
      clearTimeout(saveTimer);
      saveTimer = setTimeout(()=> saveToFirestore(), 600);
    }
  }

  async function saveToFirestore(){
    try{
      if(!firebaseAvailable() || !auth.currentUser) return;
      const uid = auth.currentUser.uid;
      await db.collection('timelines').doc(uid).set({ entries, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }catch(e){ console.error('saveToFirestore', e); showTop('Could not save to cloud', false); }
  }

  // realtime listener
  let unsubscribe = null;
  function startListening(uid){
    if(!firebaseAvailable()) return;
    if(unsubscribe){ unsubscribe(); unsubscribe=null; }
    unsubscribe = db.collection('timelines').doc(uid).onSnapshot(doc=>{
      if(!doc.exists) return;
      const data = doc.data();
      if(data && Array.isArray(data.entries)){
        entries = data.entries;
        saveLocal();
        render();
        showTop('Loaded timeline from cloud (real-time).', true);
      }
    }, err => {
      console.error('onSnapshot', err);
      showTop('Realtime listener error (see console)', false);
    });
  }
  function stopListening(){ if(unsubscribe){ unsubscribe(); unsubscribe=null; } }

  // show top status
  function showTop(msg, ok=true){
    if(!topStatus) return;
    topStatus.innerHTML = `<div class="status ${ok ? 'ok' : 'error'}" style="margin:10px 0;padding:8px;border-radius:8px;background:${ok? '#f6fffb' : '#fff0f0'};color:${ok? '#0a6a3a' : '#8a1a1a'};border:1px solid ${ok? '#c9f1db' : '#ffd3d3'}">${msg}</div>`;
  }

  // quick availability check
  function firebaseAvailable(){ return !!(window._firebase && window._firebase.auth && window._firebase.db); }
  const dbRef = firebaseAvailable() ? window._firebase.db : null;

  // ensure user is signed in - if not redirect to login
  if(firebaseAvailable() && auth){
    auth.onAuthStateChanged(user => {
      if(!user){
        // not signed in -> go to login
        window.location.href = 'login.html';
      } else {
        // signed in, update UI and start listening
        authStatusEl.innerHTML = `<div style="padding:8px;border-radius:8px;background:#f6fffb;border:1px solid #c9f1db;color:#0a6a3a">Signed in as ${user.email}</div>`;
        startListening(user.uid);
      }
    });
  } else {
    // if firebase not available, ensure we still render local-only
    showTop('Cloud unavailable. Local-only mode.', false);
  }

  // sign out
  signOutBtn.addEventListener('click', async ()=>{
    if(firebaseAvailable() && auth){
      try{
        await auth.signOut();
      }catch(e){ console.error(e); }
    }
    // redirect to login
    window.location.href = 'login.html';
  });

  // share
  document.getElementById('shareBtn').addEventListener('click', async ()=>{
    const email = document.getElementById('shareEmail').value.trim().toLowerCase();
    if(!email){ alert('Enter partner email'); return; }
    if(!(firebaseAvailable() && auth && auth.currentUser)){ alert('Sign in first to share'); return; }
    try{
      await db.collection('shares').doc(email).set({
        ownerUid: auth.currentUser.uid,
        ownerEmail: auth.currentUser.email,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert('Shared with ' + email + '. Tell them to visit the site and use Load.');
    }catch(e){ console.error(e); alert('Share failed: ' + (e.message||e)); }
  });

  // load shared
  document.getElementById('loadSharedBtn').addEventListener('click', async ()=>{
    const ownerEmail = document.getElementById('loadEmail').value.trim().toLowerCase();
    if(!ownerEmail){ alert('Enter owner email'); return; }
    if(!firebaseAvailable()) return alert('Cloud not available');
    try{
      const doc = await db.collection('shares').doc(ownerEmail).get();
      if(!doc.exists){ alert('No timeline shared for that email'); return; }
      const data = doc.data();
      if(data && data.ownerUid){ stopListening(); startListening(data.ownerUid); alert('Loaded timeline shared by ' + ownerEmail); }
    }catch(e){ console.error(e); alert('Load failed: ' + (e.message||e)); }
  });

  // reset
  document.getElementById('resetBtn').addEventListener('click', ()=>{
    if(confirm('Reset to defaults and clear local storage?')){
      localStorage.removeItem(LS_KEY);
      entries = [
        {emoji:'❤️', title:'Start', date:'19.06.2024'},
        {emoji:'🕓', title:'Talked for 5 hours', date:'02.10.2024'},
        {emoji:'😌', title:'1st meet — cycled to school together', date:'21.10.2024'},
        {emoji:'🫴', title:"Held each other's hand for the 1st time", date:'09.06.2025'},
        {emoji:'💋', title:'1st kiss (lips & cheeks)', date:'25.08.2025'},
        {emoji:'😙', title:'2nd kiss', date:'03.11.2025'},
        {emoji:'🫂', title:'1st hug', date:'__________'}
      ];
      saveLocal(); render();
    }
  });

  // print & download
  document.getElementById('printBtn').addEventListener('click', ()=> window.print());

  (function(){
    const dlBtn = document.getElementById('downloadBtn');
    dlBtn.addEventListener('click', async ()=>{
      if(!window.html2canvas){
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        document.body.appendChild(s);
        s.onload = take;
      } else take();

      function take(){
        html2canvas(document.querySelector('.wrap'), {scale:2, backgroundColor:null}).then(canvas=>{
          const a = document.createElement('a');
          a.href = canvas.toDataURL('image/png');
          a.download = 'romantic-timeline.png';
          a.click();
        }).catch(err=>alert('Could not generate image: '+err));
      }
    });
  })();

  // startup
  loadLocal();
  render();

  // expose debug
  window._romanticTimeline = { entries, render, persist };
})();

