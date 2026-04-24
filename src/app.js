import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import "./style.css";

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
let notes = [];
let noteSearchQuery = '';
let authMode = 'login';
let currentEventId = null;
let currentNoteId = null;
let notificationShown = false;
const noteColors = ['#FFF9C4', '#F1F8E9', '#E3F2FD', '#FCE4EC', '#F3E5F5', '#E0F7FA', '#FFF3E0'];

// --- Elementos DOM ---
document.addEventListener('DOMContentLoaded', () => {
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
    const btnDeleteEvent = document.getElementById('btn-delete-event');
    const campoBusca = document.getElementById('campoBusca');
    const searchResults = document.getElementById('search-results');
    const eventModal = document.getElementById('event-modal');
    const eventForm = document.getElementById('event-form');
    const eventDateInput = document.getElementById('event-date');
    const eventTitleInput = document.getElementById('event-title');
    const eventTimeInput = document.getElementById('event-time');
    const eventDescriptionInput = document.getElementById('event-description');
    const eventPdfInput = document.getElementById('event-pdf');
    const pdfUploadContainer = document.getElementById('pdf-upload-container');
    const pdfViewContainer = document.getElementById('pdf-view-container');
    const pdfLink = document.getElementById('pdf-link');
    const uploadProgress = document.getElementById('upload-progress');
    const selectedDateText = document.getElementById('selected-date-text');
    const notificationModal = document.getElementById('notification-modal');
    const btnCloseNotification = document.getElementById('btn-close-notification');
    const closeModalBtns = document.querySelectorAll('.close-modal, .modal-overlay');

    // Elementos do Bloco de Notas
    const tabCalendar = document.getElementById('tab-calendar');
    const tabNotes = document.getElementById('tab-notes');
    const sectionCalendar = document.getElementById('section-calendar');
    const sectionNotes = document.getElementById('section-notes');
    const noteDateInput = document.getElementById('note-date');
    const noteContentInput = document.getElementById('note-content');
    const btnSaveNote = document.getElementById('btn-save-note');
    const notesGrid = document.getElementById('notes-grid');
    const searchNotesInput = document.getElementById('search-notes');

    if (noteDateInput) noteDateInput.valueAsDate = new Date();

    // --- Autenticação ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            if (userDisplay) userDisplay.textContent = user.email;
            if (loginScreen) loginScreen.classList.add('hidden');
            if (calendarScreen) calendarScreen.classList.remove('hidden');
            loadEvents();
            loadNotes();
        } else {
            currentUser = null;
            if (loginScreen) loginScreen.classList.remove('hidden');
            if (calendarScreen) calendarScreen.classList.add('hidden');
        }
    });

    if (btnToggleAuth) {
        btnToggleAuth.addEventListener('click', () => {
            authMode = authMode === 'login' ? 'signup' : 'login';
            if (btnLoginSubmit) btnLoginSubmit.textContent = authMode === 'login' ? 'Entrar' : 'Cadastrar';
            if (btnToggleAuth) btnToggleAuth.textContent = authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre';
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!loginEmailInput || !loginPasswordInput) return;
            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;
            try {
                if (authMode === 'login') {
                    await signInWithEmailAndPassword(auth, email, password);
                } else {
                    await createUserWithEmailAndPassword(auth, email, password);
                }
            } catch (error) {
                if (loginError) {
                    loginError.textContent = error.message;
                    loginError.classList.remove('hidden');
                }
            }
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', () => signOut(auth));
    }

    // --- Calendário ---
    function renderCalendar() {
        if (!calendarGrid || !monthYearText) return;
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
                <button class="add-event-btn opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded-full transition-all text-slate-400 hover:text-blue-600">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                </button>
            </div>
            <div class="space-y-1 overflow-y-auto max-h-[80px]" id="ev-${dateStr}"></div>
        `;
        
        dayDiv.classList.add('group'); // Add group class for hover effect on button

        const container = dayDiv.querySelector(`#ev-${dateStr}`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dayEvents = events.filter(e => e.date === dateStr);
        const evDate = new Date(dateStr + 'T00:00:00');
        const isPast = evDate < today;

        if (dayEvents.length > 0) {
            if (isPast) {
                dayDiv.classList.add('bg-orange-100/50');
                dayDiv.classList.remove('hover:bg-blue-50/30');
                dayDiv.classList.add('hover:bg-orange-100/80');
            } else {
                dayDiv.classList.add('bg-green-100/50');
                dayDiv.classList.remove('hover:bg-blue-50/30');
                dayDiv.classList.add('hover:bg-green-100/80');
            }
        }

        dayEvents.forEach(event => {
            const evEl = document.createElement('div');
            const colorClass = isPast 
                ? 'bg-orange-600 text-white border-orange-700' 
                : 'bg-green-600 text-white border-green-700';
            
            evEl.className = `text-[10px] p-1 rounded border truncate flex items-center gap-1 shadow-sm font-medium ${colorClass}`;
            evEl.innerHTML = `${event.pdfUrl ? '📄' : ''} <span>${event.time || ''} ${event.title}</span>`;
            evEl.onclick = (e) => { e.stopPropagation(); openModal(date, event); };
            container.appendChild(evEl);
        });

        dayDiv.onclick = () => openModal(date);
        const addBtn = dayDiv.querySelector('.add-event-btn');
        if (addBtn) addBtn.onclick = (e) => { e.stopPropagation(); openModal(date); };
        if (calendarGrid) calendarGrid.appendChild(dayDiv);
    }

    function openModal(date, event = null) {
        selectedDate = date;
        currentEventId = event ? event.id : null;
        const modalTitle = document.querySelector('#event-modal h3');
        if (modalTitle) modalTitle.textContent = event ? 'Editar Evento' : 'Novo Evento';
        
        if (eventDateInput) {
            const dateStr = date.toISOString().split('T')[0];
            eventDateInput.value = dateStr;
        }
        
        if (selectedDateText) selectedDateText.textContent = date.toLocaleDateString('pt-BR', { dateStyle: 'full' });
        if (eventForm) eventForm.reset();
        if (pdfUploadContainer) pdfUploadContainer.classList.remove('hidden');
        if (pdfViewContainer) pdfViewContainer.classList.add('hidden');
        
        if (btnDeleteEvent) {
            if (event) {
                btnDeleteEvent.classList.remove('hidden');
            } else {
                btnDeleteEvent.classList.add('hidden');
            }
        }
        
        if (event) {
            if (eventTitleInput) eventTitleInput.value = event.title;
            if (eventTimeInput) eventTimeInput.value = event.time;
            if (eventDescriptionInput) eventDescriptionInput.value = event.description || '';
            if (event.pdfUrl) {
                if (pdfViewContainer) pdfViewContainer.classList.remove('hidden');
                if (pdfUploadContainer) pdfUploadContainer.classList.add('hidden');
                if (pdfLink) {
                    pdfLink.onclick = (e) => {
                        e.preventDefault();
                        window.open(event.pdfUrl, '_blank');
                    };
                }
            }
        }
        if (eventModal) eventModal.classList.remove('hidden');
    }

    function loadEvents() {
        if (!currentUser) return;
        const q = query(collection(db, "events"), where("userId", "==", currentUser.uid));
        onSnapshot(q, (snap) => {
            events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderCalendar();
            checkTodayEvents();
        });
    }

    function loadNotes() {
        if (!currentUser) return;
        const q = query(collection(db, "notes"), where("userId", "==", currentUser.uid));
        onSnapshot(q, (snap) => {
            notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderNotes();
        });
    }

    function renderNotes() {
        if (!notesGrid) return;
        notesGrid.innerHTML = '';

        const filtered = notes.filter(n => n.content.toLowerCase().includes(noteSearchQuery.toLowerCase()));
        
        // Ordenar por data (mais recente primeiro)
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        filtered.forEach(note => {
            const card = document.createElement('div');
            card.className = 'group p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-xl hover:-translate-y-1 flex flex-col min-h-[180px]';
            card.style.backgroundColor = note.color || '#F1F8E9';

            const displayDate = new Date(note.date + 'T00:00:00').toLocaleDateString('pt-BR');

            card.innerHTML = `
                <div class="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-3 opacity-60">${displayDate}</div>
                <div class="flex-1 text-slate-800 font-medium leading-relaxed whitespace-pre-wrap mb-4">${note.content}</div>
                <div class="flex items-center justify-end gap-3 pt-4 border-t border-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="btn-edit-note text-blue-600 hover:text-blue-800 text-xs font-bold uppercase tracking-wider" data-id="${note.id}">Editar</button>
                    <button class="btn-delete-note text-red-600 hover:text-red-800 text-xs font-bold uppercase tracking-wider" data-id="${note.id}">Excluir</button>
                </div>
            `;

            const btnEdit = card.querySelector('.btn-edit-note');
            const btnDelete = card.querySelector('.btn-delete-note');

            btnEdit.onclick = () => editNote(note.id);
            btnDelete.onclick = () => deleteNote(note.id);

            notesGrid.appendChild(card);
        });
    }

    async function saveNote() {
        if (!currentUser || !noteContentInput || !noteDateInput) return;
        const content = noteContentInput.value.trim();
        const date = noteDateInput.value;

        if (!content) {
            alert("O conteúdo da nota não pode estar vazio!");
            return;
        }

        try {
            if (currentNoteId) {
                // Atualizar nota existente
                await updateDoc(doc(db, "notes", currentNoteId), {
                    content,
                    date,
                    updatedAt: serverTimestamp()
                });
                currentNoteId = null;
                if (btnSaveNote) btnSaveNote.textContent = "Salvar Nota";
            } else {
                // Criar nova nota
                const randomColor = noteColors[Math.floor(Math.random() * noteColors.length)];
                await addDoc(collection(db, "notes"), {
                    userId: currentUser.uid,
                    content,
                    date,
                    color: randomColor,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }
            noteContentInput.value = '';
            noteDateInput.valueAsDate = new Date();
        } catch (error) {
            console.error("Erro ao salvar nota:", error);
            alert("Erro ao salvar nota. Tente novamente.");
        }
    }

    async function deleteNote(id) {
        if (!confirm("Deseja realmente excluir esta nota?")) return;
        try {
            await deleteDoc(doc(db, "notes", id));
        } catch (error) {
            console.error("Erro ao excluir nota:", error);
        }
    }

    function editNote(id) {
        const note = notes.find(n => n.id === id);
        if (!note || !noteContentInput || !noteDateInput || !btnSaveNote) return;

        noteContentInput.value = note.content;
        noteDateInput.value = note.date;
        currentNoteId = id;
        btnSaveNote.textContent = "Atualizar Nota";
        
        // Scroll para o topo para facilitar a edição
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function checkTodayEvents() {
        if (notificationShown) return;
        
        const todayStr = new Date().toISOString().split('T')[0];
        const hasEventsToday = events.some(e => e.date === todayStr);
        
        if (hasEventsToday && notificationModal) {
            notificationModal.classList.remove('hidden');
            notificationShown = true;
        }
    }

    // --- Eventos de UI ---
    if (prevMonthBtn) prevMonthBtn.onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); renderCalendar(); };
    if (nextMonthBtn) nextMonthBtn.onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); renderCalendar(); };
    if (todayBtn) todayBtn.onclick = () => { currentViewDate = new Date(); renderCalendar(); };

    // --- Listeners do Bloco de Notas ---
    if (tabCalendar && tabNotes && sectionCalendar && sectionNotes) {
        tabCalendar.onclick = () => {
            sectionCalendar.classList.remove('hidden');
            sectionNotes.classList.add('hidden');
            tabCalendar.className = 'px-6 py-2 rounded-lg text-sm font-bold transition-all bg-white text-blue-600 shadow-sm';
            tabNotes.className = 'px-6 py-2 rounded-lg text-sm font-bold transition-all text-slate-500 hover:text-slate-700';
        };

        tabNotes.onclick = () => {
            sectionCalendar.classList.add('hidden');
            sectionNotes.classList.remove('hidden');
            tabNotes.className = 'px-6 py-2 rounded-lg text-sm font-bold transition-all bg-white text-blue-600 shadow-sm';
            tabCalendar.className = 'px-6 py-2 rounded-lg text-sm font-bold transition-all text-slate-500 hover:text-slate-700';
            renderNotes();
        };
    }

    if (btnSaveNote) {
        btnSaveNote.onclick = saveNote;
    }

    if (searchNotesInput) {
        searchNotesInput.oninput = (e) => {
            noteSearchQuery = e.target.value;
            renderNotes();
        };
    }
    if (btnNewEvent) btnNewEvent.onclick = () => {
        const now = new Date();
        // Garantindo que usamos a data local correta
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        openModal(today);
    };
    
    if (btnCloseNotification) {
        btnCloseNotification.onclick = () => {
            if (notificationModal) notificationModal.classList.add('hidden');
        };
    }

    if (btnDeleteEvent) {
        btnDeleteEvent.onclick = async () => {
            if (!currentEventId || !confirm("Tem certeza que deseja excluir este evento?")) return;
            
            try {
                const eventToDelete = events.find(e => e.id === currentEventId);
                
                // Se houver PDF, tenta excluir do Storage também
                if (eventToDelete && eventToDelete.pdfUrl) {
                    try {
                        const pdfRef = ref(storage, eventToDelete.pdfUrl);
                        await deleteObject(pdfRef);
                    } catch (storageErr) {
                        console.error("Erro ao excluir PDF:", storageErr);
                        // Continua a exclusão do documento mesmo se o PDF falhar (ex: já excluído)
                    }
                }

                await deleteDoc(doc(db, "events", currentEventId));
                if (eventModal) eventModal.classList.add('hidden');
            } catch (err) {
                alert("Erro ao excluir: " + err.message);
            }
        };
    }

    closeModalBtns.forEach(b => b.onclick = () => { if (eventModal) eventModal.classList.add('hidden'); });

    if (eventDateInput) {
        eventDateInput.onchange = (e) => {
            const newDate = new Date(e.target.value + 'T00:00:00');
            if (selectedDateText) selectedDateText.textContent = newDate.toLocaleDateString('pt-BR', { dateStyle: 'full' });
        };
    }

    if (eventForm) {
        eventForm.onsubmit = async (e) => {
            e.preventDefault();
            if (!eventPdfInput || !eventTitleInput || !eventTimeInput) return;
            const pdfFile = eventPdfInput.files[0];
            if (uploadProgress) uploadProgress.classList.remove('hidden');
            
            try {
                let pdfUrl = null;
                const existingEvent = currentEventId ? events.find(e => e.id === currentEventId) : null;
                
                if (pdfFile) {
                    const storageRef = ref(storage, `comprovantes/${currentUser.uid}/${Date.now()}_${pdfFile.name}`);
                    const snap = await uploadBytes(storageRef, pdfFile);
                    pdfUrl = await getDownloadURL(snap.ref);
                } else if (existingEvent) {
                    pdfUrl = existingEvent.pdfUrl;
                }

                const eventData = {
                    title: eventTitleInput.value,
                    time: eventTimeInput.value,
                    description: eventDescriptionInput ? eventDescriptionInput.value : '',
                    date: eventDateInput ? eventDateInput.value : selectedDate.toISOString().split('T')[0],
                    userId: currentUser.uid,
                    pdfUrl: pdfUrl,
                    updatedAt: serverTimestamp()
                };

                if (currentEventId) {
                    await updateDoc(doc(db, "events", currentEventId), eventData);
                } else {
                    eventData.createdAt = serverTimestamp();
                    await addDoc(collection(db, "events"), eventData);
                }
                
                if (eventModal) eventModal.classList.add('hidden');
            } catch (err) {
                alert("Erro: " + err.message);
            } finally {
                if (uploadProgress) uploadProgress.classList.add('hidden');
            }
        };
    }

    // --- Eventos de Busca ---
    if (campoBusca) {
        campoBusca.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            if (!term) {
                if (searchResults) searchResults.classList.add('hidden');
                return;
            }

            const filtered = events.filter(event => 
                event.title.toLowerCase().includes(term) || 
                (event.description && event.description.toLowerCase().includes(term))
            );

            if (searchResults) {
                if (filtered.length === 0) {
                    searchResults.innerHTML = '<div class="p-4 text-slate-500 text-sm text-center">Nenhum resultado encontrado</div>';
                } else {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    searchResults.innerHTML = filtered.map(event => {
                        const evDate = new Date(event.date + 'T00:00:00');
                        const isPast = evDate < today;
                        const colorClass = isPast ? 'bg-orange-50/50' : 'bg-green-50/50';
                        const badgeClass = isPast ? 'bg-orange-600 text-white' : 'bg-green-600 text-white';

                        return `
                        <div class="p-4 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${colorClass}" onclick="window.openSearchResult('${event.id}')">
                            <div class="flex items-center justify-between mb-1">
                                <span class="font-bold text-slate-800">${event.title}</span>
                                <span class="text-[10px] ${badgeClass} px-2 py-0.5 rounded-full font-bold">${event.date.split('-').reverse().join('/')}</span>
                            </div>
                            <div class="flex items-center gap-3 text-xs text-slate-500">
                                <span class="flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    ${event.time || '--:--'}
                                </span>
                                ${event.pdfUrl ? `
                                <span class="flex items-center gap-1 text-blue-600 font-medium">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    PDF
                                </span>` : ''}
                            </div>
                            ${event.description ? `<div class="mt-1 text-[10px] text-slate-400 truncate">${event.description}</div>` : ''}
                        </div>
                    `; }).join('');
                }
                searchResults.classList.remove('hidden');
            }
        });
    }

    // Fechar busca ao clicar fora
    document.addEventListener('click', (e) => {
        if (campoBusca && searchResults) {
            if (!campoBusca.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.add('hidden');
            }
        }
    });

    // Função global para abrir resultado da busca
    window.openSearchResult = (eventId) => {
        const event = events.find(e => e.id === eventId);
        if (event) {
            const [y, m, d] = event.date.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            openModal(date, event);
            if (searchResults) searchResults.classList.add('hidden');
            if (campoBusca) campoBusca.value = '';
        }
    };

    renderCalendar();
});
