/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO
} from 'date-fns';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  LogOut, 
  Calendar as CalendarIcon,
  Clock,
  FileText,
  X
} from 'lucide-react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  time?: string;
  date: string;
  userId: string;
}

// --- Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Event Form State
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [notifiedEvents, setNotifiedEvents] = useState<Set<string>>(new Set());

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Events Listener
  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }

    const q = query(collection(db, 'events'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEvents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CalendarEvent[];
      setEvents(fetchedEvents);
    }, (err) => {
      console.error("Firestore Error:", err);
    });

    return unsubscribe;
  }, [user]);

  // Notification Permission Request
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  };

  // Check for today's events and notify
  useEffect(() => {
    if (!user || events.length === 0) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayEvents = events.filter(e => e.date === todayStr);

    if (todayEvents.length > 0 && Notification.permission === 'granted') {
      todayEvents.forEach(event => {
        if (!notifiedEvents.has(event.id)) {
          // Show notification
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('Lembrete de Evento', {
              body: `Hoje: ${event.title}${event.time ? ` às ${event.time}` : ''}`,
              icon: 'https://picsum.photos/seed/calendar/192/192',
              badge: 'https://picsum.photos/seed/calendar/192/192',
              vibrate: [200, 100, 200],
              tag: event.id
            } as any);
          });
          
          setNotifiedEvents(prev => new Set(prev).add(event.id));
        }
      });
    }
  }, [events, user, notifiedEvents]);

  // Calendar Logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    console.log(`Attempting ${authMode} for ${email}`);
    try {
      if (authMode === 'login') {
        const result = await signInWithEmailAndPassword(auth, email, password);
        console.log("Login success:", result.user.uid);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Signup success:", result.user.uid);
      }
      setIsAuthModalOpen(false);
    } catch (err: any) {
      console.error("Auth Error:", err.code, err.message);
      setError(err.message);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDate) return;

    // Request notification permission when adding an event
    await requestNotificationPermission();

    try {
      await addDoc(collection(db, 'events'), {
        title: eventTitle,
        description: eventDescription,
        time: eventTime,
        date: format(selectedDate, 'yyyy-MM-dd'),
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      
      // Reset form
      setEventTitle('');
      setEventDescription('');
      setEventTime('');
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Error adding event:", err);
      alert("Erro ao adicionar evento. Verifique as permissões.");
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteDoc(doc(db, 'events', eventId));
    } catch (err) {
      console.error("Error deleting event:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-blue-600 tracking-tighter">RD Calendário</h1>
            <p className="text-slate-500 mt-2">
              {authMode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta gratuita'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Senha</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                {error}
              </p>
            )}

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 mt-4"
            >
              {authMode === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <button 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setError('');
              }}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {authMode === 'login' ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-black text-blue-600 tracking-tighter">RD Calendário</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-sm text-slate-600 font-medium">
                  {user.email}
                </span>
                <button 
                  onClick={() => signOut(auth)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                  title="Sair"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => {
                  setAuthMode('login');
                  setIsAuthModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all shadow-sm active:scale-95"
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Calendar Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-800 min-w-[180px]">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <button 
                onClick={prevMonth}
                className="p-2 hover:bg-slate-50 border-r border-slate-200 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setCurrentMonth(new Date())}
                className="px-4 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Hoje
              </button>
              <button 
                onClick={nextMonth}
                className="p-2 hover:bg-slate-50 border-l border-slate-200 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {user && (
            <button 
              onClick={() => {
                setSelectedDate(new Date());
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Novo Evento
            </button>
          )}
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Weekdays */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const dayEvents = events.filter(e => e.date === format(day, 'yyyy-MM-dd'));
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, monthStart);

              return (
                <div 
                  key={day.toString()}
                  onClick={() => {
                    if (!user) {
                      setAuthMode('login');
                      setIsAuthModalOpen(true);
                    } else {
                      setSelectedDate(day);
                      setIsModalOpen(true);
                    }
                  }}
                  className={cn(
                    "min-h-[100px] sm:min-h-[140px] p-2 border-r border-b border-slate-100 relative cursor-pointer transition-all hover:bg-blue-50/30 group",
                    !isCurrentMonth && "bg-slate-50/50 text-slate-400",
                    i % 7 === 6 && "border-r-0"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-sm font-semibold w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                      isToday ? "bg-blue-600 text-white shadow-md" : "text-slate-700 group-hover:text-blue-600"
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-[80px] sm:max-h-[100px] custom-scrollbar">
                    {dayEvents.map(event => (
                      <div 
                        key={event.id}
                        className="text-[10px] sm:text-xs p-1.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100 truncate font-medium shadow-sm flex items-center justify-between group/event"
                      >
                        <span className="truncate">{event.time && <span className="font-bold mr-1">{event.time}</span>}{event.title}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(event.id);
                          }}
                          className="opacity-0 group-hover/event:opacity-100 hover:text-red-600 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600" />
              <button 
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>

              <h3 className="text-2xl font-bold text-slate-800 mb-2">
                {authMode === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}
              </h3>
              <p className="text-slate-500 mb-8">
                {authMode === 'login' ? 'Entre para gerenciar seus eventos.' : 'Comece a organizar seu tempo agora.'}
              </p>

              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="seu@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Senha</label>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <p className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                    {error}
                  </p>
                )}

                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 mt-4"
                >
                  {authMode === 'login' ? 'Entrar' : 'Cadastrar'}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                <button 
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {authMode === 'login' ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Event Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Plus className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">Novo Evento</h3>
                  <p className="text-slate-500 text-sm">
                    {selectedDate && format(selectedDate, "EEEE, d 'de' MMMM")}
                  </p>
                </div>
              </div>

              <form onSubmit={handleAddEvent} className="space-y-5">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                    <FileText className="w-4 h-4 text-slate-400" />
                    Título
                  </label>
                  <input 
                    type="text" 
                    required
                    autoFocus
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="Ex: Reunião de Planejamento"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      Hora
                    </label>
                    <input 
                      type="time" 
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <CalendarIcon className="w-4 h-4 text-slate-400" />
                      Data
                    </label>
                    <input 
                      type="date" 
                      required
                      value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setSelectedDate(parseISO(e.target.value))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                    <FileText className="w-4 h-4 text-slate-400" />
                    Descrição (Opcional)
                  </label>
                  <textarea 
                    rows={3}
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                    placeholder="Adicione detalhes sobre o evento..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3.5 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg active:scale-95"
                  >
                    Salvar Evento
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
