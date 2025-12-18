
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Task, Settings, TimerStatus } from './types';

// --- Helper Components ---

interface PanelProps {
  title: string;
  children: React.ReactNode;
  isMinimized: boolean;
  onToggle: () => void;
  side: 'left' | 'right';
}

const Panel: React.FC<PanelProps> = ({ title, children, isMinimized, onToggle, side }) => (
  <div 
    className={`bg-[#2B2930] rounded-[28px] flex flex-col transition-all duration-300 ease-in-out shadow-xl overflow-hidden ${
      isMinimized ? 'w-[64px] h-[300px] md:h-full' : 'w-full md:w-[300px] h-full min-h-[400px]'
    }`}
  >
    <div className={`flex items-center p-4 ${isMinimized ? 'flex-col h-full' : 'justify-between'}`}>
      {!isMinimized && <h2 className="text-[#D0BCFE] text-lg font-normal truncate">{title}</h2>}
      <button 
        onClick={onToggle}
        className={`text-[#D0BCFE] hover:bg-[#4A4458] rounded-full p-2 transition-transform ${isMinimized ? 'mt-2' : ''}`}
        title={isMinimized ? "Expand" : "Collapse"}
      >
        <span className={`block transition-transform duration-300 ${isMinimized ? (side === 'left' ? 'rotate-180' : 'rotate-0') : (side === 'left' ? 'rotate-0' : 'rotate-180')}`}>
          {isMinimized ? '▶' : '◀'}
        </span>
      </button>
      {isMinimized && (
        <div className="flex-grow flex items-center justify-center">
          <h2 className="text-[#D0BCFE] text-sm font-medium uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
            {title}
          </h2>
        </div>
      )}
    </div>
    
    <div className={`flex-grow p-6 pt-0 flex flex-col overflow-hidden transition-opacity duration-200 ${isMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      {children}
    </div>
  </div>
);

const IconButton: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string }> = ({ onClick, children, className = "" }) => (
  <button 
    onClick={onClick}
    className={`bg-[#4A4458] text-[#E8DEF8] w-14 h-14 rounded-full flex items-center justify-center hover:brightness-110 active:scale-95 transition-all text-xl ${className}`}
  >
    {children}
  </button>
);

const App: React.FC = () => {
  // --- State ---
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('zen_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('zen_settings');
    return saved ? JSON.parse(saved) : { studyMin: 50, breakMin: 10, goalHrs: 10 };
  });

  const [brainDump, setBrainDump] = useState<string>(() => localStorage.getItem('zen_notes') || "");
  const [completedSessions, setCompletedSessions] = useState<number>(() => parseInt(localStorage.getItem('zen_sessions') || '0'));
  const [totalStudiedSec, setTotalStudiedSec] = useState<number>(() => parseInt(localStorage.getItem('zen_studiedSec') || '0'));
  
  const [isStudy, setIsStudy] = useState(true);
  const [isPaused, setIsPaused] = useState(true);
  const [hasStartedThisSession, setHasStartedThisSession] = useState(false);
  const [timeLeft, setTimeLeft] = useState(settings.studyMin * 60);
  
  const [showSettings, setShowSettings] = useState(false);
  const [newTaskInput, setNewTaskInput] = useState("");

  const [tasksMinimized, setTasksMinimized] = useState(false);
  const [brainDumpMinimized, setBrainDumpMinimized] = useState(false);

  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timeLeftRef = useRef(timeLeft);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // --- Audio ---
  const playChime = () => {
    if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    
    const g = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  };

  // --- Persistence ---
  useEffect(() => localStorage.setItem('zen_tasks', JSON.stringify(tasks)), [tasks]);
  useEffect(() => localStorage.setItem('zen_settings', JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem('zen_notes', brainDump), [brainDump]);
  useEffect(() => localStorage.setItem('zen_sessions', completedSessions.toString()), [completedSessions]);
  useEffect(() => localStorage.setItem('zen_studiedSec', totalStudiedSec.toString()), [totalStudiedSec]);

  // --- Session Logic ---
  const targetStudySessions = Math.ceil((settings.goalHrs * 60) / settings.studyMin);
  const totalGoalSessions = targetStudySessions * 2;
  const currentGlobalSession = isStudy ? (completedSessions * 2) + 1 : (completedSessions * 2);

  const resetSessionTimer = useCallback((study: boolean) => {
    setIsStudy(study);
    const newTime = (study ? settings.studyMin : settings.breakMin) * 60;
    setTimeLeft(newTime);
    setIsPaused(true);
    setHasStartedThisSession(false);
  }, [settings]);

  const handleNextSession = useCallback((manual: boolean = false) => {
    playChime();
    if (isStudy) {
      if (manual) {
        setTotalStudiedSec(prev => prev + timeLeftRef.current);
      }
      setCompletedSessions(prev => prev + 1);
      resetSessionTimer(false);
    } else {
      resetSessionTimer(true);
    }
  }, [isStudy, resetSessionTimer]);

  const handlePrevSession = useCallback(() => {
    if (isStudy) {
      if (completedSessions > 0) {
        resetSessionTimer(false);
      } else {
        resetSessionTimer(true);
      }
    } else {
      setTotalStudiedSec(prev => Math.max(0, prev - (settings.studyMin * 60)));
      setCompletedSessions(prev => Math.max(0, prev - 1));
      resetSessionTimer(true);
    }
  }, [isStudy, completedSessions, settings, resetSessionTimer]);

  // --- Timer Tick ---
  useEffect(() => {
    if (!isPaused) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setTimeout(() => handleNextSession(false), 0);
            return 0;
          }
          if (isStudy) setTotalStudiedSec(s => s + 1);
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, isStudy, handleNextSession]);

  // --- UI Handlers ---
  const addTask = () => {
    if (newTaskInput.trim()) {
      setTasks([...tasks, { id: Date.now().toString(), text: newTaskInput, done: false }]);
      setNewTaskInput("");
    }
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const hardReset = () => {
    if (confirm("Reset everything?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleStartPause = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    if (isPaused) {
      setHasStartedThisSession(true);
      setIsPaused(false);
    } else {
      setIsPaused(true);
    }
  };

  // Progress Circle Calc
  const circumference = 2 * Math.PI * 140;
  const maxTime = (isStudy ? settings.studyMin : settings.breakMin) * 60;
  const progressOffset = circumference - (timeLeft / maxTime) * circumference;
  
  const goalSec = settings.goalHrs * 3600;
  const goalPercent = Math.min((totalStudiedSec / goalSec) * 100, 100).toFixed(1);

  // Status Display
  let statusText = isStudy ? "STUDYING" : "BREAK";
  if (isPaused) statusText = "PAUSED";

  // Action Button Text
  let actionButtonText = "START";
  if (!isPaused) {
    actionButtonText = "PAUSE";
  } else if (hasStartedThisSession) {
    actionButtonText = "RESUME";
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full p-6 box-border bg-[#1C1B1F] overflow-hidden gap-6">
      
      {/* Left Panel: Tasks */}
      <Panel 
        title="Subject Tasks" 
        isMinimized={tasksMinimized} 
        onToggle={() => setTasksMinimized(!tasksMinimized)}
        side="left"
      >
        <div className="flex gap-2 mb-4">
          <input 
            type="text" 
            value={newTaskInput}
            onChange={(e) => setNewTaskInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            className="bg-transparent border border-[#938F99] rounded-lg text-white p-3 flex-grow focus:border-[#D0BCFE] outline-none text-sm"
            placeholder="New task..."
          />
          <button 
            onClick={addTask}
            className="bg-[#D0BCFE] text-[#381E72] w-12 h-12 rounded-lg font-bold flex items-center justify-center hover:opacity-90 active:scale-95 shrink-0"
          >
            +
          </button>
        </div>
        <div className="flex-grow overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {tasks.map(task => (
            <div 
              key={task.id} 
              className={`flex items-center p-3 border-b border-[#49454F] last:border-0 transition-opacity ${task.done ? 'opacity-50 line-through' : ''}`}
            >
              <input 
                type="checkbox" 
                checked={task.done} 
                onChange={() => toggleTask(task.id)}
                className="w-5 h-5 mr-3 accent-[#D0BCFE] cursor-pointer shrink-0"
              />
              <span className="text-sm break-words">{task.text}</span>
            </div>
          ))}
          {tasks.length === 0 && <p className="text-[#938F99] text-center mt-10 text-sm">No tasks added yet.</p>}
        </div>
      </Panel>

      {/* Center: Timer */}
      <div className="flex-grow flex flex-col items-center justify-center space-y-8 py-8 md:py-0 overflow-y-auto custom-scrollbar">
        <div className="relative w-[280px] h-[280px] sm:w-[340px] sm:h-[340px] flex items-center justify-center shrink-0">
          <svg viewBox="0 0 340 340" className="w-full h-full -rotate-90 absolute">
            <circle cx="170" cy="170" r="140" stroke="#49454F" strokeWidth="8" fill="none" />
            <circle 
              cx="170" cy="170" r="140" stroke="#D0BCFE" strokeWidth="8" fill="none" 
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
              strokeLinecap="round"
              className="transition-all duration-1000 linear"
            />
          </svg>
          <div className="text-center z-10 select-none">
            <div className="text-[#D0BCFE] text-xs sm:text-sm font-medium tracking-wide uppercase">
              Session {currentGlobalSession} of {totalGoalSessions}
            </div>
            <div className="text-[#938F99] uppercase text-[10px] sm:text-xs tracking-widest my-1 sm:my-2">
              {statusText}
            </div>
            <div className="text-5xl sm:text-7xl font-extralight tabular-nums my-1">
              {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
            <div className="text-[#938F99] text-xs sm:text-sm mt-2">
              Goal: {goalPercent}%
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <IconButton onClick={() => setShowSettings(true)}>⚙️</IconButton>
          <IconButton onClick={handlePrevSession}>⏮</IconButton>
          <button 
            onClick={handleStartPause}
            className="bg-[#D0BCFE] text-[#381E72] w-40 sm:w-48 py-4 rounded-full font-bold text-base sm:text-lg tracking-wider hover:brightness-110 active:scale-95 transition-all text-center shadow-lg"
          >
            {actionButtonText}
          </button>
          <IconButton onClick={() => handleNextSession(true)}>⏭</IconButton>
        </div>
      </div>

      {/* Right Panel: Brain Dump */}
      <Panel 
        title="Brain Dump" 
        isMinimized={brainDumpMinimized} 
        onToggle={() => setBrainDumpMinimized(!brainDumpMinimized)}
        side="right"
      >
        <textarea 
          className="flex-grow bg-transparent border border-[#938F99] rounded-[16px] p-4 text-[#E6E1E5] resize-none outline-none focus:border-[#D0BCFE] text-sm custom-scrollbar"
          placeholder="Distracting thoughts? Write them here..."
          value={brainDump}
          onChange={(e) => setBrainDump(e.target.value)}
        />
      </Panel>

      {/* Settings Dialog Overlay */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-[#2B2930] rounded-[28px] p-8 w-full max-w-sm shadow-2xl my-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-normal text-[#D0BCFE]">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-[#938F99] hover:text-white">✕</button>
            </div>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-xs text-[#938F99] block mb-1">Study Duration (min)</label>
                <input 
                  type="number" 
                  value={settings.studyMin}
                  onChange={(e) => setSettings({ ...settings, studyMin: Math.max(1, parseInt(e.target.value) || 0) })}
                  className="w-full bg-transparent border border-[#938F99] rounded-lg p-3 text-white focus:border-[#D0BCFE] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-[#938F99] block mb-1">Break Duration (min)</label>
                <input 
                  type="number" 
                  value={settings.breakMin}
                  onChange={(e) => setSettings({ ...settings, breakMin: Math.max(1, parseInt(e.target.value) || 0) })}
                  className="w-full bg-transparent border border-[#938F99] rounded-lg p-3 text-white focus:border-[#D0BCFE] outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-[#938F99] block mb-1">Daily Goal (hours)</label>
                <input 
                  type="number" 
                  value={settings.goalHrs}
                  onChange={(e) => setSettings({ ...settings, goalHrs: Math.max(0.1, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-transparent border border-[#938F99] rounded-lg p-3 text-white focus:border-[#D0BCFE] outline-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => { setShowSettings(false); resetSessionTimer(isStudy); }}
                className="w-full bg-[#D0BCFE] text-[#381E72] py-4 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all"
              >
                SAVE & APPLY
              </button>
              <button 
                onClick={() => { setShowSettings(false); hardReset(); }}
                className="w-full border border-[#938F99] text-[#F2B8B5] py-2 rounded-full text-sm font-medium hover:bg-red-500/10 active:scale-95 transition-all"
              >
                HARD RESET ALL
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4A4458;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D0BCFE;
        }
      `}</style>
    </div>
  );
};

export default App;
