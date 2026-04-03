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

// Inicialização
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- Estado da Aplicação ---
let currentUser = null;
let currentViewDate = new Date();
let selectedDate = null;
let events = [];

// --- Elementos do DOM ---
const loginScreen = document.getElementById('login-screen');
const calendarScreen = document.getElementById('calendar-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const btnSignup = document.getElementById('btn-signup');
const btnLogout = document.getElementById('btn-logout');
const userDisplay = document.getElementById('user-display');
const monthYearText = document.getElementById('month-year');
const calendarGrid = document.getElementById('calendar-grid');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const todayBtn = document.getElementById('today-btn');
const eventModal = document.getElementById('event-modal');
const eventForm = document.getElementById('event-form');
const eventPdfInput = document.getElementById('event-pdf');
const pdfUploadContainer = document.getElementById('pdf-upload-container');
const pdfViewContainer = document.getElementById('pdf-view-container');
const pdfLink = document.getElementById('pdf-link');
const uploadProgress = document.getElementById('upload-progress');
const selectedDateText = document.getElementById('selected-date-text');
const closeModalBtns = document.querySelectorAll('.close-modal, .modal-overlay');

// --- Lógica de Autenticação ---

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        userDisplay.textContent = user.email;
        loginScreen.classList.add('hidden');
        calendarScreen.classList.remove('hidden');
        initEventsListener();
        renderCalendar();
    } else {
        currentUser = null;
        loginScreen.classList.remove('hidden');
        calendarScreen.classList.add('hidden');
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    loginError.classList.add('hidden');

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        loginError.textContent = "Erro ao entrar: " + error.message;
        loginError.classList.remove('hidden');
    }
});

btnSignup.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    if (!email || !password) {
        alert("Preencha email e senha para cadastrar.");
        return;
    }

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Conta criada com sucesso!");
    } catch (error) {
        alert("Erro ao cadastrar: " + error.message);
    }
});

btnLogout.addEventListener('click', () => signOut(auth));

// --- Lógica do Calendário ---

function renderCalendar() {
    calendarGrid.innerHTML = '';
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Nome do mês
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    monthYearText.textContent = `${monthNames[month]} ${year}`;

    // Dias do mês anterior (para preencher o grid)
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        createDayElement(day, false, new Date(year, month - 1, day));
    }

    // Dias do mês atual
    for (let i = 1; i <= daysInMonth; i++) {
        createDayElement(i, true, new Date(year, month, i));
    }

    // Dias do próximo mês
    const remainingCells = 42 - (firstDayOfMonth + daysInMonth);
    for (let i = 1; i <= remainingCells; i++) {
        createDayElement(i, false, new Date(year, month + 1, i));
    }
}

function createDayElement(day, isCurrentMonth, date) {
    const dayDiv = document.createElement('div');
    dayDiv.className = `calendar-day p-2 border-r border-b border-slate-100 relative cursor-pointer ${isCurrentMonth ? '' : 'not-current'}`;
    
    const isToday = new Date().toDateString() === date.toDateString();
    if (isToday) dayDiv.classList.add('today');

    const dateStr = date.toISOString().split('T')[0];
    
    dayDiv.innerHTML = `<div class="day-number">${day}</div><div class="events-container space-y-1"></div>`;
    
    // Renderizar eventos deste dia
    const container = dayDiv.querySelector('.events-container');
    const dayEvents = events.filter(e => e.date === dateStr);
    dayEvents.forEach(event => {
        const eventEl = document.createElement('div');
        eventEl.className = 'event-item';
        eventEl.textContent = `${event.time} ${event.title}`;
        
        // Clique no evento para visualizar
        eventEl.addEventListener('click', (e) => {
            e.stopPropagation();
            openEventModal(date, event);
        });
        
        container.appendChild(eventEl);
    });

    dayDiv.addEventListener('click', () => {
        openEventModal(date);
    });

    calendarGrid.appendChild(dayDiv);
}

function openEventModal(date, event = null) {
    selectedDate = date;
    selectedDateText.textContent = date.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // Resetar formulário
    eventForm.reset();
    pdfUploadContainer.classList.remove('hidden');
    pdfViewContainer.classList.add('hidden');
    uploadProgress.classList.add('hidden');
    
    if (event) {
        // Modo Visualização/Edição (Simplificado para visualização conforme pedido)
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-time').value = event.time;
        
        if (event.pdfUrl) {
            pdfViewContainer.classList.remove('hidden');
            pdfLink.href = event.pdfUrl;
            pdfUploadContainer.classList.add('hidden'); // Ocultar upload se já tem PDF (opcional)
        }
        
        document.querySelector('#event-modal h3').textContent = "Detalhes do Evento";
    } else {
        document.querySelector('#event-modal h3').textContent = "Novo Evento";
    }
    
    eventModal.classList.remove('hidden');
}

prevMonthBtn.addEventListener('click', () => {
    currentViewDate.setMonth(currentViewDate.getMonth() - 1);
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentViewDate.setMonth(currentViewDate.getMonth() + 1);
    renderCalendar();
});

todayBtn.addEventListener('click', () => {
    currentViewDate = new Date();
    renderCalendar();
});

// --- Lógica de Eventos (Firestore) ---

function initEventsListener() {
    if (!currentUser) return;
    const q = query(collection(db, "events"), where("userId", "==", currentUser.uid));
    onSnapshot(q, (snapshot) => {
        events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCalendar();
    });
}

eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('event-title').value;
    const time = document.getElementById('event-time').value;
    const dateStr = selectedDate.toISOString().split('T')[0];
    const pdfFile = eventPdfInput.files[0];

    try {
        let pdfUrl = null;

        // Upload do PDF se selecionado
        if (pdfFile) {
            uploadProgress.classList.remove('hidden');
            const fileName = `${Date.now()}_${pdfFile.name}`;
            const storageRef = ref(storage, `comprovantes/${currentUser.uid}/${fileName}`);
            
            const snapshot = await uploadBytes(storageRef, pdfFile);
            pdfUrl = await getDownloadURL(snapshot.ref);
            uploadProgress.classList.add('hidden');
        }

        await addDoc(collection(db, "events"), {
            title,
            time,
            date: dateStr,
            userId: currentUser.uid,
            pdfUrl: pdfUrl,
            createdAt: serverTimestamp()
        });
        
        eventModal.classList.add('hidden');
        eventForm.reset();
    } catch (error) {
        uploadProgress.classList.add('hidden');
        alert("Erro ao salvar evento: " + error.message);
    }
});

// --- Modais ---
closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => eventModal.classList.add('hidden'));
});
