import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const motorRef = ref(db, '/motor/state');
const cyclesRef = ref(db, '/motor/cycles');

let cycles = 0;
let currentState = false;

const badge = document.getElementById('connectionBadge');
const badgeDot = badge.querySelector('.badge-dot');
const connectionText = document.getElementById('connectionText');
const statusTitle = document.getElementById('statusTitle');
const statusSub = document.getElementById('statusSub');
const motorCard = document.getElementById('motorCard');
const motorIcon = document.getElementById('motorIcon');
const cardStatus = document.getElementById('cardStatus');
const powerBtn = document.getElementById('powerBtn');
const lastTriggered = document.getElementById('lastTriggered');
const triggerSource = document.getElementById('triggerSource');
const totalCycles = document.getElementById('totalCycles');

function updateUI(state, source = 'Web') {
  currentState = state;

  statusTitle.textContent = state ? 'Running' : 'Stopped';
  statusTitle.className = 'hero-title ' + (state ? 'on' : 'off');
  statusSub.textContent = state ? 'Motor is active and running' : 'Motor is idle';

  motorCard.className = 'motor-card ' + (state ? 'on' : 'off');
  motorIcon.className = 'motor-icon ' + (state ? 'on' : 'off-state');
  cardStatus.textContent = state ? 'Active' : 'Stopped';
  cardStatus.style.color = state ? 'var(--green)' : 'var(--red)';

  powerBtn.className = 'power-btn ' + (state ? 'on' : 'off');

  const now = new Date();
  lastTriggered.textContent = now.toLocaleTimeString();
  triggerSource.textContent = source;
}

function setConnected() {
  badgeDot.classList.add('live');
  connectionText.textContent = 'Live';
  badge.style.color = 'var(--green)';
}

get(cyclesRef).then(snap => {
  cycles = snap.val() || 0;
  totalCycles.textContent = cycles;
});

onValue(motorRef, (snapshot) => {
  const state = snapshot.val();
  setConnected();
  if (state !== null) {
    updateUI(state, 'ESP32 / Web');
  }
});

window.handleToggle = function () {
  const newState = !currentState;
  set(motorRef, newState);

  if (newState) {
    cycles++;
    set(cyclesRef, cycles);
    totalCycles.textContent = cycles;
  }

  updateUI(newState, 'Web');
};