import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, remove, update, query, limitToLast, onDisconnect } from 'firebase/database';

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

const el = id => document.getElementById(id);
let currentUser = "Unknown";
let lockState = false, pending = false, autoLockTimer = null, autoLockSeconds = 60;

const CREDENTIALS = {
    "yaseen@password.com": "password134",
    "vignesh@there.com": "passwordByMe"
};

// Toast logic
function toast(msg, dur = 2500) {
    const t = el('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.classList.remove('show'), dur);
}

// Tab Switching
window.switchTab = function (tabId) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
    el('tab-' + tabId).classList.add('active');
    document.querySelector(`.tab-btn[onclick="switchTab('${tabId}')"]`).classList.add('active');
};

// Expose switchTab to window if needed by inline onclick in HTML
// The original HTML had onclick="switchTab('dashboard')"

// Lock UI
function updateLockUI(open) {
    lockState = open;
    const c = el('lockCard'), t = el('statusTitle'), b = el('powerBtn');
    c.className = `card lock-card ${open ? 'open' : 'closed'}`;
    t.className = `hero-title ${open ? 'open' : 'closed'}`;
    b.className = `power-btn ${open ? 'open' : 'closed'}`;
    t.textContent = open ? 'UNLOCKED' : 'LOCKED';
    if (!pending) b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`;
    if (open && el('togAutoLock').checked) {
        el('autoLockTimerTxt').style.display = 'inline';
        autoLockSeconds = 60;
        clearInterval(autoLockTimer);
        autoLockTimer = setInterval(() => {
            autoLockSeconds--;
            el('autoLockTimerTxt').textContent = `| auto_lock: ${autoLockSeconds}s`;
            if (autoLockSeconds <= 0) clearInterval(autoLockTimer);
        }, 1000);
    } else {
        clearInterval(autoLockTimer);
        el('autoLockTimerTxt').style.display = 'none';
    }
}

// Connection State
function setConn(online) {
    el('cloudDot').className = `status-dot ${online ? 'online' : ''}`;
    el('valDevice').textContent = online ? 'connected' : 'disconnected';
    el('valDevice').className = `info-value mono ${online ? 'ok' : 'err'}`;
}

// Initialization
function initFirebase() {
    onValue(ref(db, '.info/connected'), s => setConn(s.val()));

    onValue(ref(db, '/motor/state'), s => {
        pending = false;
        updateLockUI(s.val());
    });

    onValue(ref(db, '/motor/lastUser'), s => el('lastUserTxt').textContent = `last_user: ${s.val() || '—'}`);
    onValue(ref(db, '/door/lastOpened'), s => el('valDoor').textContent = s.val() || '—');

    onValue(ref(db, '/settings/autoLock'), s => el('togAutoLock').checked = !!s.val());
    onValue(ref(db, '/settings/darkTheme'), s => el('togDarkTheme').checked = !!s.val());

    onValue(ref(db, '/device/uptime'), s => {
        const secs = s.val() || 0, h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
        el('valUptime').textContent = `${h}h ${m}m ${secs % 60}s`;
    });

    onValue(ref(db, '/alerts/message'), s => {
        const m = s.val();
        el('valError').textContent = m ? m : 'null';
        el('valError').className = `info-value mono ${m ? 'err' : 'ok'}`;
    });

    const historyQuery = query(ref(db, '/history'), limitToLast(50));
    onValue(historyQuery, s => {
        const list = el('historyList');
        list.innerHTML = '';
        const items = [];
        s.forEach(c => { items.unshift({ ...c.val(), key: c.key }) });
        if (items.length === 0) {
            list.innerHTML = '<div class="empty-state">no records found.</div>';
            return;
        }
        items.forEach(item => {
            const isUnlock = item.state === true;
            list.innerHTML += `<div class="log-item"><div class="log-left"><div class="log-dot ${isUnlock ? 'green' : 'red'}"></div><div><div class="log-title">${isUnlock ? 'Unlocked' : 'Locked'}</div><div class="log-sub">source: ${item.source || 'unknown'}</div></div></div><div class="log-time">${item.time || ''}</div></div>`;
        });
    });

    const errorsQuery = query(ref(db, '/errors'), limitToLast(50));
    onValue(errorsQuery, s => {
        const list = el('errorList');
        list.innerHTML = '';
        const items = [];
        s.forEach(c => { items.unshift(c.val()) });
        if (items.length === 0) {
            list.innerHTML = '<div class="empty-state">no errors logged.</div>';
            return;
        }
        items.forEach(err => {
            const msg = typeof err === 'string' ? err : JSON.stringify(err);
            list.innerHTML += `<div class="error-item">> ${msg}</div>`;
        });
    });
}

// Login handler
el('loginBtn').addEventListener('click', () => {
    const email = el('loginEmail').value.trim();
    const pass = el('loginPassword').value;

    if (CREDENTIALS[email] && CREDENTIALS[email] === pass) {
        currentUser = email.split('@')[0];
        el('userNameDisplay').textContent = currentUser;
        el('loginOverlay').classList.add('hidden');
        el('app').classList.add('visible');
        initFirebase();
    } else {
        el('loginError').textContent = "invalid credentials";
    }
});

// Logout handler
el('logoutBtn').addEventListener('click', () => {
    el('loginEmail').value = '';
    el('loginPassword').value = '';
    el('loginError').textContent = '';
    el('loginOverlay').classList.remove('hidden');
    el('app').classList.remove('visible');
});

el('powerBtn').addEventListener('click', async () => {
    if (pending) return;
    pending = true;
    el('powerBtn').innerHTML = `<svg class="spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>`;
    const newState = !lockState;
    updateLockUI(newState);
    try {
        const now = new Date().toLocaleTimeString();
        await push(ref(db, '/history'), { state: newState, source: 'Web Panel', time: now });
        await update(ref(db, '/motor'), { state: newState, lastUser: currentUser, via: 'website' });
        toast(newState ? 'Door Unlocked' : 'Door Locked');
    } catch (e) {
        toast('Error: ' + e.message);
        pending = false;
    }
});

el('togAutoLock').addEventListener('change', e => set(ref(db, '/settings/autoLock'), e.target.checked));
el('togDarkTheme').addEventListener('change', e => set(ref(db, '/settings/darkTheme'), e.target.checked));

el('btnSendAlert').addEventListener('click', async () => {
    const text = el('alertInput').value.trim();
    await set(ref(db, '/alerts/message'), text || null);
    toast(text ? 'Alert pushed' : 'Alert cleared');
    el('alertInput').value = '';
});

el('btnClearHistory').addEventListener('click', async () => {
    if (confirm('Clear all action history?')) {
        await remove(ref(db, '/history'));
        toast('History cleared');
    }
});

el('btnClearErrors').addEventListener('click', async () => {
    if (confirm('Clear all system errors?')) {
        await remove(ref(db, '/errors'));
        toast('Errors cleared');
    }
});

const msgInput = el('msgInput');
msgInput.addEventListener('input', () => el('msgCharCount').textContent = `${msgInput.value.length} / 200`);

el('btnSendMsg').addEventListener('click', async () => {
    const text = msgInput.value.trim();
    if (!text) return;
    el('btnSendMsg').disabled = true;
    try {
        await update(ref(db, '/display'), { message: text, new_message: true });
        toast('Message sent to LCD!');
        msgInput.value = '';
        el('msgCharCount').textContent = '0 / 200';
    } catch (e) {
        toast('Error: ' + e.message);
    }
    el('btnSendMsg').disabled = false;
});

// Canvas Drawing logic
const canvas = el('drawCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, 320, 240);
let drawing = false, lastX = 0, lastY = 0;

function getPos(e) {
    const r = canvas.getBoundingClientRect(), src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * (320 / r.width), y: (src.clientY - r.top) * (240 / r.height) };
}
function drawStart(e) { drawing = true; const p = getPos(e); lastX = p.x; lastY = p.y; }
function drawMove(e) {
    if (!drawing) return;
    const p = getPos(e);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = parseInt(el('brushSize').value);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x;
    lastY = p.y;
}
function drawEnd() { drawing = false; }

canvas.addEventListener('mousedown', drawStart);
canvas.addEventListener('mousemove', drawMove);
window.addEventListener('mouseup', drawEnd);
canvas.addEventListener('touchstart', e => { e.preventDefault(); drawStart(e); }, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); drawMove(e); }, { passive: false });
window.addEventListener('touchend', drawEnd);

el('btnClearCanvas').addEventListener('click', () => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 320, 240);
});

el('btnSendDraw').addEventListener('click', async () => {
    el('btnSendDraw').disabled = true;
    el('drawProgress').style.display = 'block';
    el('drawText').style.display = 'block';

    const pixels = ctx.getImageData(0, 0, 320, 240).data;
    const bytes = new Uint8Array(9600);
    for (let i = 0; i < 76800; i++) {
        if (pixels[i * 4] > 128) bytes[Math.floor(i / 8)] |= (0x80 >> (i % 8));
    }
    let hex = '';
    for (let i = 0; i < 9600; i++) hex += bytes[i].toString(16).padStart(2, '0');

    await remove(ref(db, '/display/chunks'));
    for (let c = 0; c < 20; c++) {
        el('drawFill').style.width = `${((c + 1) / 20) * 100}%`;
        el('drawText').textContent = `chunk ${c + 1}/20...`;
        await set(ref(db, `/display/chunks/${c}`), hex.slice(c * 960, (c + 1) * 960));
        await new Promise(r => setTimeout(r, 40));
    }

    await set(ref(db, '/display/new_image'), true);
    el('drawText').textContent = 'sent — awaiting ack...';

    const ackRef = ref(db, '/display/new_image');

    // Fallback timer
    const t = setTimeout(() => {
        // Note: we can't easily turn off a specific onValue listener here unless we capture the unsubscribe function
        doneSend('Sent (no device ack)');
    }, 15000);

    const unsubscribe = onValue(ackRef, s => {
        if (s.val() === false) {
            clearTimeout(t);
            unsubscribe();
            doneSend('Displayed on LCD!');
        }
    });
});

function doneSend(msg) {
    el('drawProgress').style.display = 'none';
    el('drawText').style.display = 'none';
    el('btnSendDraw').disabled = false;
    el('drawFill').style.width = '0%';
    toast(msg);
}