import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Plus, Trash2, Calendar, Clock, Target, ChevronRight, X, Play, StopCircle, SkipForward, Timer, Edit2 } from 'lucide-react';
import { AppData, MAIN_MODULES, StudyModule, ExamRecord, ExamModuleScore, StudySession } from '../types';
import { storage } from '../lib/storage';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';

export default function ExamBank({ data, onUpdate }: { data: AppData; onUpdate: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newExam, setNewExam] = useState<Partial<ExamRecord>>({
    title: '',
    date: Date.now(),
    moduleScores: MAIN_MODULES.map(m => ({
      moduleId: m as StudyModule,
      duration: 0,
      correctCount: 0,
      totalCount: 0
    }))
  });

  // 保存考试记录，并同时创建学习记录
  const saveExam = async () => {
    if (!newExam.title) {
      alert('请输入考试名称');
      return;
    }
    
    const record: ExamRecord = {
      id: editingId || Date.now().toString(),
      title: newExam.title,
      date: newExam.date || Date.now(),
      moduleScores: (newExam.moduleScores || []) as ExamModuleScore[],
      note: newExam.note
    };

    // 创建各模块的学习记录
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const newSessions: StudySession[] = [];
    for (const ms of record.moduleScores) {
      if (ms.duration > 5000) { // 只记录超过5秒的模块
        newSessions.push({
          id: uuidv4(),
          moduleId: ms.moduleId,
          startTime: record.date,
          duration: ms.duration,
          date: localDate
        });
      }
    }

    if (editingId) {
      await storage.updateExamRecord(record);
    } else {
      await storage.addExamRecord(record);
    }
    
    // 保存学习记录
    for (const session of newSessions) {
      await storage.addSession(session);
    }
    
    setIsAdding(false);
    setEditingId(null);
    onUpdate();
    setNewExam({
      title: '',
      date: Date.now(),
      moduleScores: MAIN_MODULES.map(m => ({
        moduleId: m as StudyModule,
        duration: 0,
        correctCount: 0,
        totalCount: 0
      }))
    });
  };

  const deleteRecord = async (id: string) => {
    if (window.confirm('确定要删除这条考试记录吗？')) {
      await storage.deleteExamRecord(id);
      onUpdate();
    }
  };

  const updateModuleScore = (moduleId: StudyModule, field: keyof ExamModuleScore, value: number) => {
    setNewExam(prev => ({
      ...prev,
      moduleScores: prev.moduleScores?.map(ms => 
        ms.moduleId === moduleId ? { ...ms, [field]: value } : ms
      )
    }));
  };

  const handleLiveFinish = (results: { title: string, scores: { moduleId: StudyModule, duration: number }[] }) => {
    setEditingId(null);
    setNewExam({
      title: results.title,
      date: Date.now(),
      moduleScores: MAIN_MODULES.map(m => {
        const score = results.scores.find(s => s.moduleId === m);
        return {
          moduleId: m as StudyModule,
          duration: score ? score.duration : 0,
          correctCount: 0,
          totalCount: 0
        };
      })
    });
    setIsLiveMode(false);
    setIsAdding(true);
  };

  return (
    <div className="space-y-6 pb-24">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">考试录入</h1>
          <p className="text-xs text-slate-400 mt-1">各模块时间自动计入学习时长</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsLiveMode(true)}
            className="bg-rose-500 text-white px-4 py-2 rounded-2xl shadow-lg shadow-rose-100 active:scale-95 transition-all text-xs font-bold flex items-center gap-2"
          >
            <Timer size={16} /> 进入模考
          </button>
          <button 
            onClick={() => {
              setEditingId(null);
              setNewExam({
                title: '',
                date: Date.now(),
                moduleScores: MAIN_MODULES.map(m => ({
                  moduleId: m as StudyModule,
                  duration: 0,
                  correctCount: 0,
                  totalCount: 0
                }))
              });
              setIsAdding(true);
            }}
            className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-100 active:scale-90 transition-all font-bold"
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">累计录入</div>
          <div className="text-xl font-bold text-slate-800">{data.examRecords?.length || 0} <span className="text-xs font-normal">次</span></div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm text-right">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">平均正确率</div>
          <div className="text-xl font-bold text-indigo-600">
            {data.examRecords && data.examRecords.length > 0 
              ? Math.round(data.examRecords.reduce((acc, r) => {
                  const total = r.moduleScores.reduce((sum, ms) => sum + ms.totalCount, 0);
                  const correct = r.moduleScores.reduce((sum, ms) => sum + ms.correctCount, 0);
                  return acc + (total > 0 ? (correct / total) : 0);
                }, 0) / data.examRecords.length * 100)
              : 0}%
          </div>
        </div>
      </div>

      {/* Record List */}
      <div className="space-y-3">
        {data.examRecords && data.examRecords.length > 0 ? (
          data.examRecords.sort((a, b) => b.date - a.date).map(record => (
            <div key={record.id}>
              <RecordCard 
                record={record} 
                onDelete={() => deleteRecord(record.id)} 
                onEdit={() => {
                  setEditingId(record.id);
                  setNewExam(record);
                  setIsAdding(true);
                }}
              />
            </div>
          ))
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-slate-300 gap-3 grayscale opacity-50">
            <Trophy size={48} strokeWidth={1.5} />
            <p className="text-sm">暂无考试记录，开始第一次模考吧</p>
          </div>
        )}
      </div>

      {/* Live Mode Modal */}
      <AnimatePresence>
        {isLiveMode && (
          <ExamLiveMode onFinish={handleLiveFinish} onClose={() => setIsLiveMode(false)} />
        )}
      </AnimatePresence>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative bg-white rounded-t-[40px] px-6 pt-8 pb-20 shadow-2xl max-h-[85vh] overflow-y-auto w-full max-w-md mx-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">{editingId ? '编辑考试记录' : '考试数据录入'}</h2>
                <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="bg-slate-50 p-2 rounded-full text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 px-1 uppercase tracking-wider">考试名称</label>
                  <input 
                    type="text"
                    value={newExam.title}
                    onChange={(e) => setNewExam(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="如：2024国考 A类 模拟"
                    className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold text-slate-500 px-1 uppercase tracking-wider">各模块数据</label>
                  {MAIN_MODULES.map(m => {
                    const score = newExam.moduleScores?.find(ms => ms.moduleId === m);
                    return (
                      <div key={m} className="bg-slate-50/50 border border-slate-100 p-4 rounded-3xl space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          <span className="text-xs font-bold text-slate-700">{m}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold block ml-1">耗时(分)</label>
                            <input 
                              type="number"
                              value={score ? Math.round(score.duration / 60000) : 0}
                              onChange={(e) => updateModuleScore(m as StudyModule, 'duration', Number(e.target.value) * 60000)}
                              className="w-full bg-white border border-slate-100 rounded-xl px-2 py-1.5 text-xs text-center outline-none focus:ring-1 focus:ring-indigo-100"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold block ml-1">正确题数</label>
                            <input 
                              type="number"
                              value={score ? score.correctCount : 0}
                              onChange={(e) => updateModuleScore(m as StudyModule, 'correctCount', Number(e.target.value))}
                              className="w-full bg-white border border-slate-100 rounded-xl px-2 py-1.5 text-xs text-center outline-none focus:ring-1 focus:ring-indigo-100"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold block ml-1">总题数</label>
                            <input 
                              type="number"
                              value={score ? score.totalCount : 0}
                              onChange={(e) => updateModuleScore(m as StudyModule, 'totalCount', Number(e.target.value))}
                              className="w-full bg-white border border-slate-100 rounded-xl px-2 py-1.5 text-xs text-center outline-none focus:ring-1 focus:ring-indigo-100"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button 
                  onClick={saveExam}
                  className="w-full bg-indigo-600 text-white py-4 rounded-3xl font-bold text-sm shadow-xl shadow-indigo-100 active:scale-95 transition-all mt-4"
                >
                  保存记录
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExamLiveMode({ onFinish, onClose }: { onFinish: (res: any) => void, onClose: () => void }) {
  const [examTitle, setExamTitle] = useState('新模拟记录');
  const [totalMinutes, setTotalMinutes] = useState(120);
  const [isStarted, setIsStarted] = useState(false);
  const [currentModule, setCurrentModule] = useState<StudyModule>(MAIN_MODULES[0] as StudyModule);
  
  const [elapsed, setElapsed] = useState(0); // Total elapsed ms
  const [moduleDurations, setModuleDurations] = useState<Record<string, number>>(
    MAIN_MODULES.reduce((acc, m) => ({ ...acc, [m]: 0 }), {})
  );

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(0);
  const activeModuleRef = useRef<StudyModule>(currentModule);

  // Sync ref with state
  useEffect(() => {
    activeModuleRef.current = currentModule;
  }, [currentModule]);

  const startExam = () => {
    setIsStarted(true);
    lastTickRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      setElapsed(prev => prev + delta);
      setModuleDurations(prev => ({
        ...prev,
        [activeModuleRef.current]: (prev[activeModuleRef.current] || 0) + delta
      }));
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const finishExam = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onFinish({
      title: examTitle,
      scores: Object.entries(moduleDurations).map(([id, duration]) => ({
        moduleId: id as StudyModule,
        duration
      }))
    });
  };

  const remainingMs = Math.max(0, totalMinutes * 60000 - elapsed);
  const isTimeUp = remainingMs === 0;

  if (!isStarted) {
    return (
      <div className="fixed inset-0 z-[110] bg-slate-900 flex flex-col items-center justify-center p-6 pb-24 text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="space-y-2">
            <div className="bg-indigo-500/20 w-20 h-20 rounded-[30px] flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
               <Trophy className="text-indigo-400" size={40} />
            </div>
            <h2 className="text-2xl font-black text-white">全真模考模式</h2>
            <p className="text-slate-400 text-sm">系统将精准记录每个模块的用时</p>
          </div>

          <div className="space-y-4">
             <div className="bg-slate-800/50 p-6 rounded-[32px] border border-slate-700/50 space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase px-1">考试名称</label>
                  <input 
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    className="w-full bg-slate-900 border-none rounded-2xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase px-1">总考试时长 (分钟)</label>
                  <input 
                    type="number"
                    value={totalMinutes}
                    onChange={(e) => setTotalMinutes(Number(e.target.value))}
                    className="w-full bg-slate-900 border-none rounded-2xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  />
                </div>
             </div>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={startExam}
              className="w-full bg-indigo-500 text-white py-4 rounded-[24px] font-bold shadow-2xl shadow-indigo-500/20 active:scale-95 transition-all text-lg flex items-center justify-center gap-3"
            >
              <Play size={20} fill="currentColor" /> 开始模拟
            </button>
            <button 
              onClick={onClose}
              className="w-full bg-transparent text-slate-500 py-3 font-bold text-sm"
            >
              取消
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900 flex flex-col text-white">
      {/* Header Info */}
      <div className="p-6 pt-12 text-center space-y-4">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">{examTitle}</div>
        
        <div className="flex flex-col items-center">
           <div className={cn(
             "text-5xl font-black tabular-nums tracking-tight",
             remainingMs < 300000 ? "text-rose-500 animate-pulse" : "text-white"
           )}>
             {Math.floor(remainingMs / 60000)}:
             {String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0')}
           </div>
           <div className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">剩余考试时间</div>
        </div>
      </div>

      {/* Main Stats Card */}
      <div className="flex-1 px-4 flex flex-col justify-center">
         <div className="bg-slate-800/50 rounded-[40px] p-8 border border-slate-700/30 space-y-8 backdrop-blur-md">
            <div className="text-center">
               <div className="text-xs font-bold text-indigo-400 mb-1">当前正在进行</div>
               <div className="text-3xl font-black">{currentModule}</div>
            </div>

            <div className="flex items-center justify-center text-6xl font-black tabular-nums tracking-tighter text-indigo-100">
               {Math.floor((moduleDurations[currentModule] || 0) / 60000)}:
               {String(Math.floor(((moduleDurations[currentModule] || 0) % 60000) / 1000)).padStart(2, '0')}
            </div>

            <div className="grid grid-cols-3 gap-2">
                {MAIN_MODULES.map(m => (
                  <button 
                    key={m}
                    onClick={() => setCurrentModule(m as StudyModule)}
                    className={cn(
                      "border p-3 rounded-2xl flex flex-col items-center gap-1 active:scale-95 transition-all",
                      currentModule === m 
                        ? "bg-indigo-500 border-indigo-400 shadow-lg shadow-indigo-500/20" 
                        : "bg-slate-900/50 border-slate-700/50"
                    )}
                  >
                    <span className={cn(
                      "text-[9px] font-bold",
                      currentModule === m ? "text-white" : "text-slate-500"
                    )}>{m}</span>
                    <span className={cn(
                      "text-xs font-bold",
                      currentModule === m ? "text-white" : "text-slate-300"
                    )}>
                      {Math.floor((moduleDurations[m] || 0) / 60000)} min
                    </span>
                  </button>
                ))}
            </div>
         </div>
      </div>

      {/* Footer Actions */}
      <div className="p-8 pb-20 flex flex-col gap-4">
         <button 
           onClick={finishExam}
           className="w-full bg-rose-500 text-white py-5 rounded-[28px] font-bold text-lg flex items-center justify-center gap-3 shadow-2xl shadow-rose-500/20 active:scale-95 transition-all"
         >
           <StopCircle size={24} /> 结束并交卷
         </button>
         
         <div className="flex items-center justify-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
            <SkipForward size={12} /> 点击上方模块卡片可自动切换计时
         </div>
      </div>
    </div>
  );
}

function formatTimeWithSeconds(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes}分`;
}

function RecordCard({ 
  record, 
  onDelete, 
  onEdit 
}: { 
  record: ExamRecord; 
  onDelete: () => void | Promise<void>; 
  onEdit: () => void;
}) {
  const totalCorrect = record.moduleScores.reduce((sum, ms) => sum + ms.correctCount, 0);
  const totalQuestions = record.moduleScores.reduce((sum, ms) => sum + ms.totalCount, 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const totalTime = record.moduleScores.reduce((sum, ms) => sum + ms.duration, 0);

  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden transition-all">
      <div className="p-4 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2 mb-1">
             <Calendar size={12} className="text-slate-300" />
             <span className="text-[10px] font-bold text-slate-400">{new Date(record.date).toLocaleDateString()}</span>
          </div>
          <h3 className="text-sm font-bold text-slate-800 truncate mb-2">{record.title}</h3>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1">
               <Target size={14} className="text-emerald-500" />
               <span className="text-xs font-bold text-emerald-600">{accuracy}%</span>
             </div>
             <div className="flex items-center gap-1">
               <Clock size={14} className="text-indigo-500" />
               <span className="text-xs font-bold text-slate-500">{formatTimeWithSeconds(totalTime)}</span>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={onEdit}
            className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"
          >
            <Edit2 size={16} />
          </button>
          <button 
            onClick={onDelete}
            className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
          >
            <Trash2 size={16} />
          </button>
          <button 
            onClick={() => setExpanded(!expanded)}
            className={cn("p-2 text-slate-300 transition-transform", expanded && "rotate-90")}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-slate-50/50 border-t border-slate-50"
          >
            <div className="p-4 space-y-3">
              {record.moduleScores.map(ms => {
                const modAcc = ms.totalCount > 0 ? Math.round((ms.correctCount / ms.totalCount) * 100) : 0;
                const wrongCount = ms.totalCount - ms.correctCount;
                return (
                  <div key={ms.moduleId} className="flex items-center justify-between bg-white px-3 py-2.5 rounded-2xl border border-slate-100/50">
                    <div>
                      <div className="text-[10px] font-bold text-slate-700">{ms.moduleId}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">耗时: {formatTimeWithSeconds(ms.duration)} | 正确: {ms.correctCount}/{ms.totalCount}</div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className={cn(
                        "text-xs font-bold",
                        modAcc >= 80 ? "text-emerald-500" : modAcc >= 60 ? "text-amber-500" : "text-rose-500"
                      )}>{modAcc}%</div>
                      {wrongCount > 0 && <div className="text-[9px] text-rose-400 font-medium">错 {wrongCount} 题</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
