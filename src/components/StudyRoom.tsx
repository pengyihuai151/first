import React, { useState, useEffect, useRef } from 'react';
import { AppData, StudyModule, MAIN_MODULES } from '../types';
import { storage } from '../lib/storage';
import { formatDuration, cn } from '../lib/utils';
import { Play, Square, Timer, History, Trash2, Bell, X, Pause } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';

export default function StudyRoom({ data, onUpdate }: { data: AppData; onUpdate: () => void }) {
  const [activeModule, setActiveModule] = useState<StudyModule>(MAIN_MODULES[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false); // 暂停状态
  const [time, setTime] = useState(0);
  const [showResume, setShowResume] = useState(false); // 显示继续计时提示
  const [showReminder, setShowReminder] = useState(false); // 显示久学提醒
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<any>(null);
  const timeRef = useRef(0);
  const pauseTimeRef = useRef<number>(0); // 暂停时的时间点
  const totalPausedDurationRef = useRef<number>(0); // 累计暂停时长
  const hasRemindedRef = useRef(false); // 是否已经提醒过

  // 同步 time 到 ref
  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  // 计算今天已保存的学习记录的总时长
  const getTodaySavedDuration = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    return data.sessions
      .filter(s => s.date === todayStr)
      .reduce((sum, s) => sum + s.duration, 0);
  };

  // 初始化：从 localStorage 恢复计时状态
  useEffect(() => {
    const savedState = localStorage.getItem('studyTimerState');
    if (savedState) {
      const { savedTime, savedModule, savedAt } = JSON.parse(savedState);
      // 计算经过的时间
      const elapsed = Date.now() - savedAt;
      const totalTime = savedTime + elapsed;
      
      // 如果超过 4 小时，认为过期，清理
      if (elapsed > 4 * 60 * 60 * 1000) {
        localStorage.removeItem('studyTimerState');
        return;
      }
      
      timeRef.current = totalTime;
      setTime(totalTime);
      setActiveModule(savedModule);
      setShowResume(true);
    }
  }, []);

  useEffect(() => {
    if (isRunning && !isPaused) {
      // 开始或继续计时
      const effectiveStartTime = pauseTimeRef.current 
        ? Date.now() - (timeRef.current - totalPausedDurationRef.current)
        : Date.now() - timeRef.current;
      startTimeRef.current = effectiveStartTime;
      
      intervalRef.current = setInterval(() => {
        const newTime = Date.now() - (startTimeRef.current || 0) + totalPausedDurationRef.current;
        timeRef.current = newTime;
        setTime(newTime);
        
        // 久学提醒检测：累计今天已保存 + 当前计时
        if (data.settings.longStudyReminderEnabled && !hasRemindedRef.current) {
          const todaySaved = getTodaySavedDuration();
          const reminderMs = (data.settings.longStudyReminderMinutes || 45) * 60 * 1000;
          if (todaySaved + timeRef.current >= reminderMs) {
            setShowReminder(true);
            hasRemindedRef.current = true;
          }
        }
      }, 100);
    } else if (isRunning && isPaused) {
      // 暂停
      if (intervalRef.current) clearInterval(intervalRef.current);
      pauseTimeRef.current = Date.now();
    } else {
      // 停止
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, isPaused, data.settings.longStudyReminderEnabled, data.settings.longStudyReminderMinutes, data.sessions]);

  // 页面隐藏时保存状态
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && time > 1000) {
        // 保存到 localStorage
        localStorage.setItem('studyTimerState', JSON.stringify({
          savedTime: time,
          savedModule: activeModule,
          savedAt: Date.now()
        }));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [time, activeModule]);

  const handleResume = () => {
    setShowResume(false);
    setIsRunning(true);
    setIsPaused(false);
    pauseTimeRef.current = 0;
    totalPausedDurationRef.current = 0;
  };

  const handleDiscard = () => {
    localStorage.removeItem('studyTimerState');
    setShowResume(false);
    setTime(0);
    timeRef.current = 0;
  };

  const handleStart = () => {
    localStorage.removeItem('studyTimerState');
    hasRemindedRef.current = false;
    setIsRunning(true);
    setIsPaused(false);
    pauseTimeRef.current = 0;
    totalPausedDurationRef.current = 0;
  };
  
  const handlePause = () => {
    setIsPaused(true);
    pauseTimeRef.current = Date.now();
  };

  const handleContinue = () => {
    if (pauseTimeRef.current) {
      totalPausedDurationRef.current += Date.now() - pauseTimeRef.current;
    }
    setIsPaused(false);
    pauseTimeRef.current = 0;
  };

  const handleStop = async () => {
    setIsRunning(false);
    setIsPaused(false);
    localStorage.removeItem('studyTimerState');
    hasRemindedRef.current = false;
    pauseTimeRef.current = 0;
    totalPausedDurationRef.current = 0;
    
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    if (time > 1000) {
      const session = {
        id: uuidv4(),
        moduleId: activeModule,
        startTime: Date.now() - time,
        duration: time,
        date: localDate
      };
      await storage.addSession(session);
      onUpdate();
    }
    setTime(0);
    timeRef.current = 0;
  };

  const handleModuleChange = (module: StudyModule) => {
    // 保存当前计时状态
    if (time > 1000) {
      localStorage.setItem('studyTimerState', JSON.stringify({
        savedTime: time,
        savedModule: module,
        savedAt: Date.now()
      }));
    }
    setActiveModule(module);
    setIsRunning(false);
    setIsPaused(false);
  };

  const deleteSession = async (id: string) => {
    const newData = { ...data, sessions: data.sessions.filter(s => s.id !== id) };
    await storage.saveData(newData);
    onUpdate();
  };

  const sortedSessions = [...data.sessions].sort((a, b) => b.startTime - a.startTime).slice(0, 5);

  // 计算总累计时长（今天已保存 + 当前计时）用于显示
  const getTotalDurationForDisplay = () => {
    return getTodaySavedDuration() + time;
  };

  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">学习计划</h1>
        <p className="text-sm text-slate-500">专注当前，记录每一分钟。</p>
      </header>

      {/* Resume Timer Prompt */}
      {showResume && !isRunning && time > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-800">检测到未保存的计时记录</p>
            <p className="text-xs text-amber-600 mt-1">
              {activeModule} • {formatDuration(time)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDiscard}
              className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              放弃
            </button>
            <button
              onClick={handleResume}
              className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600"
            >
              继续计时
            </button>
          </div>
        </div>
      )}

      {/* Timer Section */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col items-center gap-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-50">
            {isRunning && !isPaused && (
                 <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="h-full bg-indigo-500 w-1/3"
                 />
            )}
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {[...MAIN_MODULES, StudyModule.ESSAY].map(m => (
            <button
              key={m}
              disabled={isRunning}
              onClick={() => handleModuleChange(m)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                activeModule === m 
                  ? "bg-indigo-600 text-white shadow-indigo-200 shadow-lg" 
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100",
                isRunning && "opacity-50 cursor-not-allowed"
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl font-mono font-bold text-slate-800 tracking-tighter">
            {formatDuration(time)}
          </span>
          <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">
            {isPaused ? '已暂停' : isRunning ? '正在计时...' : '准备就绪'}
          </span>
        </div>

        <div className="flex gap-4">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-transform"
            >
              <Play size={28} fill="currentColor" />
            </button>
          ) : isPaused ? (
            <>
              <button
                onClick={handleContinue}
                className="w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-transform"
              >
                <Play size={28} fill="currentColor" />
              </button>
              <button
                onClick={handleStop}
                className="w-16 h-16 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-100 hover:scale-105 active:scale-95 transition-transform"
              >
                <Square size={28} fill="currentColor" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handlePause}
                className="w-16 h-16 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xl shadow-amber-100 hover:scale-105 active:scale-95 transition-transform"
              >
                <Pause size={28} fill="currentColor" />
              </button>
              <button
                onClick={handleStop}
                className="w-16 h-16 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-100 hover:scale-105 active:scale-95 transition-transform"
              >
                <Square size={28} fill="currentColor" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* History */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <History size={16} /> 最近学习记录
        </h2>
        <div className="space-y-2">
          {sortedSessions.length > 0 ? (
            sortedSessions.map(session => (
              <div key={session.id} className="bg-white p-3 rounded-2xl border border-slate-100 flex justify-between items-center">
                <div>
                  <div className="text-sm font-semibold text-slate-700">{session.moduleId}</div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {session.date} • {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-indigo-600 mr-2">
                    {Math.round(session.duration / 60000)} min
                  </span>
                  <button 
                    onClick={() => deleteSession(session.id)}
                    className="p-3 text-slate-300 active:text-rose-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
             <div className="p-8 text-center text-slate-400 text-sm italic">
                暂无记录，开始你的第一次学习吧！
             </div>
          )}
        </div>
      </section>

      {/* 久学提醒弹窗 */}
      <AnimatePresence>
        {showReminder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowReminder(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                  <Bell size={24} className="text-amber-600" />
                </div>
                <button
                  onClick={() => setShowReminder(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-800 mb-2">该休息了！</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  你今天已经累计学习了 {formatDuration(getTotalDurationForDisplay())}。建议休息一下，保护眼睛，活动活动身体。
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowReminder(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm active:scale-95 transition-all"
                >
                  知道了
                </button>
                <button
                  onClick={() => {
                    setShowReminder(false);
                    setIsRunning(false);
                    setIsPaused(false);
                    hasRemindedRef.current = false;
                    setTime(0);
                    timeRef.current = 0;
                  }}
                  className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm active:scale-95 transition-all"
                >
                  结束计时
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
