// DOM elements
const timelineEl = document.getElementById("timeline");
const previewText = document.getElementById("previewText");

// Local storage key
const LS_KEY = "romantic.timeline.entries.v1";

// Default entries
let entries = [
  {emoji:'❤️', title:'Start', date:'19.06.2024'},
  {emoji:'🕓', title:'Talked for 5 hours', date:'02.10.2024'},
  {emoji:'😌', title:'1st meet — cycled together', date:'21.10.2024'},
  {emoji:'🫴', title:"Held hands", date:'09.06.2025'},
  {emoji:'💋', title:'1st kiss', date:'25.08.2025'},
];

// Load local data
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if(raw) entries = JSON.parse(raw);
  } catch(e) {}
}

function saveLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

// Render timeline
function render() {
  timelineEl.innerHTML = "";

  entries.forEach((e, i) => {
    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `
      <div class="dot">${e.emoji}</div>
      <div class="meta">
        <div contenteditable class="title" data-i="${i}" data-field="title">${e.title}</div>
        <div contenteditable class="date" data-i="${i}" data-field="date">${e.date}</div>
      </div>
    `;

    timelineEl.appendChild(div);
  });

  updatePreview();
  attachEditListeners();
}

function attachEditListeners() {
  document.querySelectorAll("[contenteditable]").forEach(el => {
    el.oninput = () => {
      let i = el.dataset.i;
      let field = el.dataset.field;
      entries[i][field] = el.innerText.trim();
      persist();
    };
  });
}

function updatePreview() {
  previewText.textContent = entries.slice(0,3).map(e => `${e.title} — ${e.date}`).join(" • ");
}

// --- Modal ---
const modal = document.getElementById("entryModal");
document.getElementById("addEntryBtn").onclick = () => modal.style.display = "flex";
document.getElementById("closeModalBtn").onclick = () => modal.style.display = "none";

document.getElementById("saveModalBtn").onclick = () => {
  const emoji = document.getElementById("modalEmoji").value.trim();
  const title = document.getElementById("modalTitle").value.trim();
  const date = document.getElementById("modalDate").value.trim();

  if(!emoji || !title || !date) return alert("Fill all fields!");

  entries.push({emoji,title,date});
  persist();
  render();

  modal.style.display = "none";
};

// --- Firestore Sync ---
let saveTimer = null;

function persist() {
  saveLocal();

  if(auth.currentUser) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(syncFirestore, 700);
  }
}

async function syncFirestore() {
  if(!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  await db.collection("timelines").doc(uid).set({
    entries,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Real-time updates
let unsubscribe = null;

function listen(uid) {
  if(unsubscribe) unsubscribe();

  unsubscribe = db.collection("timelines").doc(uid)
    .onSnapshot(doc => {
      if(doc.exists) {
        entries = doc.data().entries;
        saveLocal();
        render();
      }
    });
}

function stopListen() {
  if(unsubscribe) unsubscribe();
}

// --- Google Sign-in ---
const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");

signInBtn.onclick = async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);

    signInBtn.style.display = "none";
    signOutBtn.style.display = "inline-block";

    listen(result.user.uid);

    const ref = await db.collection("timelines").doc(result.user.uid).get();
    if(!ref.exists) syncFirestore();

    alert("Signed in: " + result.user.email);
  } catch(e) {
    alert("Sign-in failed: " + e.message);
  }
};

signOutBtn.onclick = async () => {
  await auth.signOut();
  signInBtn.style.display = "inline-block";
  signOutBtn.style.display = "none";
  stopListen();
  alert("Signed out");
};

// --- Sharing ---
document.getElementById("shareBtn").onclick = async () => {
  if(!auth.currentUser) return alert("Sign in first!");

  const email = document.getElementById("shareEmail").value.trim().toLowerCase();
  if(!email) return alert("Enter email");

  await db.collection("shares").doc(email).set({
    ownerUid: auth.currentUser.uid,
    ownerEmail: auth.currentUser.email,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("Shared with " + email);
};

document.getElementById("loadSharedBtn").onclick = async () => {
  const email = document.getElementById("loadEmail").value.trim().toLowerCase();
  if(!email) return alert("Enter email");

  const docSnap = await db.collection("shares").doc(email).get();
  if(!docSnap.exists) return alert("No shared timeline found");

  const { ownerUid } = docSnap.data();
  listen(ownerUid);

  alert("Loaded timeline from " + email);
};

// Reset
document.getElementById("resetBtn").onclick = () => {
  if(confirm("Reset entire timeline?")) {
    localStorage.removeItem(LS_KEY);
    location.reload();
  }
};

// Download PNG
document.getElementById("downloadBtn").onclick = () => {
  if(!window.html2canvas) {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    document.body.appendChild(s);
    s.onload = capture;
  } else capture();

  function capture() {
    html2canvas(document.querySelector(".card"), {scale:2}).then(canvas => {
      const a = document.createElement("a");
      a.href = canvas.toDataURL();
      a.download = "timeline.png";
      a.click();
    });
  }
};

document.getElementById("printBtn").onclick = () => window.print();

// Load and render on start
loadLocal();
render();

// Auto update sign-in UI
auth.onAuthStateChanged(user => {
  if(user) {
    signInBtn.style.display = "none";
    signOutBtn.style.display = "inline-block";
    listen(user.uid);
  } else {
    signInBtn.style.display = "inline-block";
    signOutBtn.style.display = "none";
    stopListen();
  }
});
