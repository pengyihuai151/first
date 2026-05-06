import React, { useState, useEffect, useRef } from 'react';
import { AppData, StudyModule, MAIN_MODULES } from '../types';
import { storage } from '../lib/storage';
import { formatDuration, cn } from '../lib/utils';
import { Play, Square, Timer, History, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { motion } from 'motion/react';

export default function StudyRoom({ data, onUpdate }: { data: AppData; onUpdate: () => void }) {
  const [activeModule, setActiveModule] = useState<StudyModule>(MAIN_MODULES[0]);
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<any>(null);
  const accumulatedTimeRef = useRef(0); // 累积时间，用于中断后继续
  const timeRef = useRef(0); // 用于在闭包中获取最新时间

  // 同步 time 到 ref
  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  // 监听页面切换（切换 Tab 时暂停计时，但不归0）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRunning) {
        // 页面隐藏时，保存当前时间并暂停
        accumulatedTimeRef.current = timeRef.current;
        setIsRunning(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning]);

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now() - accumulatedTimeRef.current;
      intervalRef.current = setInterval(() => {
        setTime(Date.now() - (startTimeRef.current || 0));
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const handleStart = () => {
    // 如果有累积时间，继续计时
    if (accumulatedTimeRef.current > 0) {
      startTimeRef.current = Date.now() - accumulatedTimeRef.current;
    }
    setIsRunning(true);
  };
  
  const handleStop = async () => {
    setIsRunning(false);
    
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    if (time > 1000) { // Only save if more than 1 second
      const session = {
        id: uuidv4(),
        moduleId: activeModule,
        startTime: startTimeRef.current || Date.now(),
        duration: time,
        date: localDate
      };
      await storage.addSession(session);
      onUpdate();
    }
    // 归0
    accumulatedTimeRef.current = 0;
    setTime(0);
  };

  // 切换模块时，如果正在计时则暂停，但不归0
  const handleModuleChange = (module: StudyModule) => {
    if (isRunning) {
      accumulatedTimeRef.current = time;
      setIsRunning(false);
    }
    setActiveModule(module);
  };

  const deleteSession = async (id: string) => {
    const newData = { ...data, sessions: data.sessions.filter(s => s.id !== id) };
    await storage.saveData(newData);
    onUpdate();
  };

  const sortedSessions = [...data.sessions].sort((a, b) => b.startTime - a.startTime).slice(0, 5);

  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">学习计划</h1>
        <p className="text-sm text-slate-500">专注当前，记录每一分钟。</p>
      </header>

      {/* Timer Section */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col items-center gap-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-50">
            {isRunning && (
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
            {isRunning ? '正在计时...' : '准备就绪'}
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
          ) : (
            <button
              onClick={handleStop}
              className="w-16 h-16 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-100 hover:scale-105 active:scale-95 transition-transform"
            >
              <Square size={28} fill="currentColor" />
            </button>
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
    </div>
  );
}
