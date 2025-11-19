// firebase.js
// Initialize Firebase (compat)
const firebaseConfig = {
  apiKey: "AIzaSyDT9zKU_VPhdI7ePluufEIBQgcZlx78j1s",
  authDomain: "relationship-timeline-d0ffa.firebaseapp.com",
  projectId: "relationship-timeline-d0ffa",
  storageBucket: "relationship-timeline-d0ffa.firebasestorage.app",
  messagingSenderId: "285290324596",
  appId: "1:285290324596:web:d08d009d9bded43c84e721",
  measurementId: "G-9FXQQ5H244"
};

try {
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  // expose
  window._firebase = { firebase, auth, db };
  // also expose top-level names for backward compatibility
  window.auth = auth;
  window.db = db;
} catch (e) {
  console.error('Firebase initialization error', e);
  // keep page functional (local only)
}
