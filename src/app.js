import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// --- Configuração do Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyCSNzR9XIR9Z1R3wd0CFHwZacJzcomkP9g",
  authDomain: "meucalendarioonline-4d02c.firebaseapp.com",
  projectId: "meucalendarioonline-4d02c",
  storageBucket: "meucalendarioonline-4d02c.firebasestorage.app",
  messagingSenderId: "1072312318914",
  appId: "1:1072312318914:web:f7120134c007a0900cf45b",
  measurementId: "G-MD6LVVQMGM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- Estado ---
let currentUser = null;
let currentViewDate = new Date();
let selectedDate = new Date();
let events = [];
let authMode = 'login';

// --- Elementos DOM ---
const loginScreen = document.getElementById('login-screen');
const calendarScreen = document.getElementById('calendar-screen');
const loginForm = document.getElementById('login-form');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const btnLoginSubmit = document.getElementById('btn-login-submit');
const btnToggleAuth = document.getElementById('btn-toggle-auth');
const userDisplay = document.getElementById('user-display');
const btnLogout = document.getElementById('btn-logout');
const monthYearText = document.getElementById('month-year');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const todayBtn = document.getElementById('today-btn');
const calendarGrid = document.getElementById('calendar-grid');
const btnNewEvent = document.getElementById('btn-new-event');
const eventModal = document.getElementById('event-modal');
const eventForm = document.getElementById('event-form');
const eventTitleInput = document.getElementById('event-title');
const eventTimeInput = document.getElementById('event-time');
const eventPdfInput = document.getElementById('event-pdf');
const pdfUploadContainer = document.getElementById('pdf-upload-container');
const pdfViewContainer = document.getElementById('pdf-view-container');
const pdfLink = document.getElementById('pdf-link');
const uploadProgress = document.getElementById('upload-progress');
const selectedDateText = document.getElementById('selected-date-text');
const closeModalBtns = document.querySelectorAll('.close-modal, .modal-overlay');

// --- Autenticação ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        userDisplay.textContent = user.email;
        loginScreen.classList.add('hidden');
        calendarScreen.classList.remove('hidden');
        loadEvents();
    } else {
        currentUser = null;
        loginScreen.classList.remove('hidden');
        calendarScreen.classList.add('hidden');
    }
});

btnToggleAuth.addEventListener('click', () => {
    authMode = authMode === 'login' ? 'signup' : 'login';
    btnLoginSubmit.textContent = authMode === 'login' ? 'Entrar' : 'Cadastrar';
    btnToggleAuth.textContent = authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre';
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    try {
        if (authMode === 'login') {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            await createUserWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        loginError.textContent = error.message;
        loginError.classList.remove('hidden');
    }
});

btnLogout.addEventListener('click', () => signOut(auth));

// --- Calendário ---
function renderCalendar() {
    calendarGrid.innerHTML = '';
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    monthYearText.textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentViewDate);

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    for (let i = firstDay; i > 0; i--) createDay(prevMonthDays - i + 1, false, true);
    for (let i = 1; i <= daysInMonth; i++) {
        const isToday = i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        createDay(i, true, false, isToday);
    }
    const remaining = 42 - (firstDay + daysInMonth);
    for (let i = 1; i <= remaining; i++) createDay(i, false, false);
}

function createDay(day, isCurrent, isPrev, isToday) {
    const dayDiv = document.createElement('div');
    dayDiv.className = `min-h-[100px] p-2 border-r border-b border-slate-100 relative cursor-pointer hover:bg-blue-50/30 ${!isCurrent ? 'bg-slate-50/50 text-slate-400' : ''}`;
    
    const date = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + (isPrev ? -1 : (isCurrent ? 0 : 1)), day);
    const dateStr = date.toISOString().split('T')[0];

    dayDiv.innerHTML = `
        <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : ''}">${day}</span>
        </div>
        <div class="space-y-1 overflow-y-auto max-h-[60px]" id="ev-${dateStr}"></div>
    `;

    const container = dayDiv.querySelector(`#ev-${dateStr}`);
    events.filter(e => e.date === dateStr).forEach(event => {
        const evEl = document.createElement('div');
        evEl.className = 'text-[10px] p-1 bg-blue-50 text-blue-700 rounded border border-blue-100 truncate flex items-center gap-1';
        evEl.innerHTML = `${event.pdfUrl ? '📄' : ''} <span>${event.time || ''} ${event.title}</span>`;
        evEl.onclick = (e) => { e.stopPropagation(); openModal(date, event); };
        container.appendChild(evEl);
    });

    dayDiv.onclick = () => openModal(date);
    calendarGrid.appendChild(dayDiv);
}

function openModal(date, event = null) {
    selectedDate = date;
    selectedDateText.textContent = date.toLocaleDateString('pt-BR', { dateStyle: 'full' });
    eventForm.reset();
    pdfUploadContainer.classList.remove('hidden');
    pdfViewContainer.classList.add('hidden');
    
    if (event) {
        eventTitleInput.value = event.title;
        eventTimeInput.value = event.time;
        if (event.pdfUrl) {
            pdfViewContainer.classList.remove('hidden');
            pdfUploadContainer.classList.add('hidden');
            pdfLink.onclick = (e) => {
                e.preventDefault();
                window.open(event.pdfUrl, '_blank');
            };
        }
    }
    eventModal.classList.remove('hidden');
}

function loadEvents() {
    const q = query(collection(db, "events"), where("userId", "==", currentUser.uid));
    onSnapshot(q, (snap) => {
        events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCalendar();
    });
}

// --- Eventos de UI ---
prevMonthBtn.onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); renderCalendar(); };
nextMonthBtn.onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); renderCalendar(); };
todayBtn.onclick = () => { currentViewDate = new Date(); renderCalendar(); };
btnNewEvent.onclick = () => openModal(new Date());
closeModalBtns.forEach(b => b.onclick = () => eventModal.classList.add('hidden'));

eventForm.onsubmit = async (e) => {
    e.preventDefault();
    const pdfFile = eventPdfInput.files[0];
    uploadProgress.classList.remove('hidden');
    
    try {
        let pdfUrl = null;
        if (pdfFile) {
            const storageRef = ref(storage, `comprovantes/${currentUser.uid}/${Date.now()}_${pdfFile.name}`);
            const snap = await uploadBytes(storageRef, pdfFile);
            pdfUrl = await getDownloadURL(snap.ref);
        }

        await addDoc(collection(db, "events"), {
            title: eventTitleInput.value,
            time: eventTimeInput.value,
            date: selectedDate.toISOString().split('T')[0],
            userId: currentUser.uid,
            pdfUrl: pdfUrl,
            createdAt: serverTimestamp()
        });
        
        eventModal.classList.add('hidden');
    } catch (err) {
        alert("Erro: " + err.message);
    } finally {
        uploadProgress.classList.add('hidden');
    }
};

renderCalendar();
