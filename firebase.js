// === FIREBASE CONFIG (your provided keys) ===
const firebaseConfig = {
  apiKey: "AIzaSyDT9zKU_VPhdI7ePluufEIBQgcZlx78j1s",
  authDomain: "relationship-timeline-d0ffa.firebaseapp.com",
  projectId: "relationship-timeline-d0ffa",
  storageBucket: "relationship-timeline-d0ffa.firebasestorage.app",
  messagingSenderId: "285290324596",
  appId: "1:285290324596:web:d08d009d9bded43c84e721",
  measurementId: "G-9FXQQ5H244"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Export (for safety)
window._firebase = { auth, db, firebase };
