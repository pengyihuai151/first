import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Plus, Trash2, Calendar, Clock, Target, ChevronRight, X, Play, StopCircle, Timer, Edit2, ChevronDown, BookOpen } from 'lucide-react';
import { AppData, MAIN_MODULES, StudyModule, ExamRecord, ExamModuleScore, ExamSubScore, StudySession } from '../types';
import { hasSubModules, getSubTopics } from '../types';
import { storage } from '../lib/storage';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';

/** 创建空的模块成绩（含子模块） */
function createEmptyModuleScore(moduleId: StudyModule): ExamModuleScore {
  const subs = getSubTopics(moduleId);
  return {
    moduleId,
    subScores: subs.length > 0 ? subs.map(s => ({
      subTopic: s,
      correctCount: 0,
      totalCount: 0,
      duration: 0
    })) : undefined,
    correctCount: 0,
    totalCount: 0,
    duration: 0
  };
}

export default function ExamBank({
  data,
  onUpdate,
  onNavigate
}: {
  data: AppData;
  onUpdate: () => void;
  onNavigate?: (tab: string, examId?: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newExam, setNewExam] = useState<Partial<ExamRecord>>({
    title: '',
    date: Date.now(),
    moduleScores: MAIN_MODULES.map(m => createEmptyModuleScore(m)),
    reflection: ''
  });

  // 汇总子模块到父级
  function aggregateScores(scores: ExamModuleScore[]): ExamModuleScore[] {
    return scores.map(ms => {
      if (!ms.subScores || ms.subScores.length === 0) return ms;
      return {
        ...ms,
        correctCount: ms.subScores.reduce((s, sub) => s + sub.correctCount, 0),
        totalCount: ms.subScores.reduce((s, sub) => s + sub.totalCount, 0),
        duration: ms.subScores.reduce((s, sub) => s + sub.duration, 0)
      };
    });
  }

  const saveExam = async () => {
    if (!newExam.title) {
      alert('请输入考试名称');
      return;
    }

    const record: ExamRecord = {
      id: editingId || Date.now().toString(),
      title: newExam.title,
      date: newExam.date || Date.now(),
      moduleScores: aggregateScores((newExam.moduleScores || []) as ExamModuleScore[]),
      reflection: newExam.reflection
    };

    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const newSessions: StudySession[] = [];
    for (const ms of record.moduleScores) {
      if (ms.duration > 5000) {
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
    for (const session of newSessions) {
      await storage.addSession(session);
    }

    setIsAdding(false);
    setEditingId(null);
    onUpdate();
    setNewExam({
      title: '',
      date: Date.now(),
      moduleScores: MAIN_MODULES.map(m => createEmptyModuleScore(m))
    });
  };

  const deleteRecord = async (id: string) => {
    if (window.confirm('确定要删除这条考试记录吗？')) {
      await storage.deleteExamRecord(id);
      onUpdate();
    }
  };

  /** 更新大模块的某个字段 */
  const updateModuleScore = (moduleId: StudyModule, field: keyof ExamModuleScore, value: number) => {
    setNewExam(prev => ({
      ...prev,
      moduleScores: prev.moduleScores?.map(ms =>
        ms.moduleId === moduleId ? { ...ms, [field]: value } : ms
      )
    }));
  };

  /** 更新子模块的成绩 */
  const updateSubScore = (moduleId: StudyModule, subTopic: string, field: keyof ExamSubScore, value: number) => {
    setNewExam(prev => ({
      ...prev,
      moduleScores: prev.moduleScores?.map(ms =>
        ms.moduleId === moduleId
          ? {
              ...ms,
              subScores: (ms.subScores || []).map(sub =>
                sub.subTopic === subTopic ? { ...sub, [field]: value } : sub
              )
            }
          : ms
      )
    }));
  };

  const handleLiveFinish = (results: { title: string; scores: { moduleId: StudyModule; subTopic?: string; duration: number; subDurations?: Record<string, number> }[] }) => {
    setEditingId(null);
    setNewExam({
      title: results.title,
      date: Date.now(),
      moduleScores: MAIN_MODULES.map(m => {
        const score = results.scores.find(s => s.moduleId === m);
        const subs = getSubTopics(m);
        return {
          moduleId: m as StudyModule,
          duration: score?.duration || 0,
          subScores: subs.length > 0 && score?.subDurations
            ? subs.map(sub => ({
                subTopic: sub,
                correctCount: 0,
                totalCount: 0,
                duration: score.subDurations[sub] || 0
              }))
            : undefined,
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
          <button onClick={() => setIsLiveMode(true)}
            className="bg-rose-500 text-white px-4 py-2 rounded-2xl shadow-lg shadow-rose-100 active:scale-95 transition-all text-xs font-bold flex items-center gap-2">
            <Timer size={16} /> 进入模考
          </button>
          <button onClick={() => {
            setEditingId(null);
            setNewExam({
              title: '',
              date: Date.now(),
              moduleScores: MAIN_MODULES.map(m => createEmptyModuleScore(m))
            });
            setIsAdding(true);
          }} className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-100 active:scale-90 transition-all font-bold">
            <Plus size={20} />
          </button>
        </div>
      </header>

      {/* Stats */}
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
        {data.examRecords && data.examRecords.length > 0
          ? data.examRecords.sort((a, b) => b.date - a.date).map(record => (
              <RecordCard key={record.id} record={record}
                onDelete={() => deleteRecord(record.id)}
                onEdit={() => { setEditingId(record.id); setNewExam(record); setIsAdding(true); }}
                onViewWrong={() => {} /* TODO: 跳转错题 */ }
              />
            ))
          : (
            <div className="py-20 flex flex-col items-center justify-center text-slate-300 gap-3 grayscale opacity-50">
              <Trophy size={48} strokeWidth={1.5} />
              <p className="text-sm">暂无考试记录，开始第一次模考吧</p>
            </div>
          )}
      </div>

      {/* Live Mode Modal */}
      <AnimatePresence>{isLiveMode && <ExamLiveMode onFinish={handleLiveFinish} onClose={() => setIsLiveMode(false)} />}</AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>{isAdding && (
        <div className="fixed inset-0 z-[120] flex flex-col justify-end">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setIsAdding(false); setEditingId(null); }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative bg-white rounded-t-[40px] px-6 pt-8 pb-20 shadow-2xl max-h-[85vh] overflow-y-auto w-full max-w-md mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">{editingId ? '编辑考试记录' : '考试数据录入'}</h2>
              <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="bg-slate-50 p-2 rounded-full text-slate-400"><X size={20} /></button>
            </div>

            <div className="space-y-6">
              {/* 考试名称 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 px-1 uppercase tracking-wider">考试名称</label>
                <input type="text" value={newExam.title}
                  onChange={(e) => setNewExam(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="如：2024国考 A类 模拟"
                  className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" />
              </div>

              {/* 各模块数据（含子模块） */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-500 px-1 uppercase tracking-wider">各模块数据</label>

                {MAIN_MODULES.map(m => {
                  const score = newExam.moduleScores?.find(ms => ms.moduleId === m);
                  const subs = getSubTopics(m);
                  const [showSubs, setShowSubs] = useState(false);

                  return (
                    <div key={m} className="bg-slate-50/50 border border-slate-100 p-4 rounded-3xl space-y-3">
                      {/* 大模块标题 + 展开按钮 */}
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowSubs(!showSubs)}>
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${subs.length > 0 ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                          <span className="text-xs font-bold text-slate-700">{m}</span>
                        </div>
                        {subs.length > 0 && <ChevronDown size={14} className={cn("text-slate-400 transition-transform", showSubs && "rotate-180")} />}
                      </div>

                      {/* 大模块汇总输入 */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block ml-1">耗时(分)</label>
                          <input type="number"
                            value={score ? Math.round(score.duration / 60000) : 0}
                            onChange={(e) => updateModuleScore(m as StudyModule, 'duration', Number(e.target.value) * 60000)}
                            className="w-full bg-white border border-slate-100 rounded-xl px-2 py-1.5 text-xs text-center outline-none focus:ring-1 focus:ring-indigo-100" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block ml-1">正确题数</label>
                          <input type="number"
                            value={score ? score.correctCount : 0}
                            onChange={(e) => updateModuleScore(m as StudyModule, 'correctCount', Number(e.target.value))}
                            className="w-full bg-white border border-slate-100 rounded-xl px-2 py-1.5 text-xs text-center outline-none focus:ring-1 focus:ring-indigo-100" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block ml-1">总题数</label>
                          <input type="number"
                            value={score ? score.totalCount : 0}
                            onChange={(e) => updateModuleScore(m as StudyModule, 'totalCount', Number(e.target.value))}
                            className="w-full bg-white border border-slate-100 rounded-xl px-2 py-1.5 text-xs text-center outline-none focus:ring-1 focus:ring-indigo-100" />
                        </div>
                      </div>

                      {/* 子模块（可展开） */}
                      <AnimatePresence>
                        {showSubs && subs.length > 0 && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2 pl-2 border-l-2 border-indigo-200">
                            {subs.map(sub => {
                              const subSc = score?.subScores?.find(s => s.subTopic === sub);
                              return (
                                <div key={sub} className="grid grid-cols-3 gap-2 px-2 py-2 bg-white/80 rounded-xl">
                                  <span className="col-span-3 text-[10px] font-medium text-slate-600 mb-1">{sub}</span>
                                  <div className="space-y-0.5">
                                    <label className="text-[9px] text-slate-300 font-bold block">耗时(分)</label>
                                    <input type="number"
                                      value={subSc ? Math.round(subSc.duration / 60000) : 0}
                                      onChange={(e) => updateSubScore(m as StudyModule, sub, 'duration', Number(e.target.value) * 60000)}
                                      className="w-full bg-slate-50 border border-slate-100 rounded-lg px-1.5 py-1 text-[10px] text-center outline-none" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <label className="text-[9px] text-slate-300 font-bold block">正确</label>
                                    <input type="number"
                                      value={subSc ? subSc.correctCount : 0}
                                      onChange={(e) => updateSubScore(m as StudyModule, sub, 'correctCount', Number(e.target.value))}
                                      className="w-full bg-slate-50 border border-slate-100 rounded-lg px-1.5 py-1 text-[10px] text-center outline-none" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <label className="text-[9px] text-slate-300 font-bold block">总题</label>
                                    <input type="number"
                                      value={subSc ? subSc.totalCount : 0}
                                      onChange={(e) => updateSubScore(m as StudyModule, sub, 'totalCount', Number(e.target.value))}
                                      className="w-full bg-slate-50 border border-slate-100 rounded-lg px-1.5 py-1 text-[10px] text-center outline-none" />
                                  </div>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* 反思 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 px-1 uppercase tracking-wider flex items-center gap-1">
                  🖊️ 考试反思
                </label>
                <textarea value={newExam.reflection || ''}
                  onChange={(e) => setNewExam(prev => ({ ...prev, reflection: e.target.value }))}
                  placeholder="写完这场考试后，你的感受和反思是什么？哪里做得好，哪里需要改进？"
                  className="w-full bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none min-h-[120px] resize-none" />
              </div>

              <button onClick={saveExam}
                className="w-full bg-indigo-600 text-white py-4 rounded-3xl font-bold text-sm shadow-xl shadow-indigo-100 active:scale-95 transition-all mt-4">
                保存记录
              </button>
            </div>
          </motion.div>
        </div>
      )}</AnimatePresence>
    </div>
  );
}

// ==================== 模考计时器（重写版 - 子模块独立计时 + 两种录入模式） ====================
// 每个 target 有独立 timers[key]，切换只启动当前
// inputMode: auto/onlyMain/mustSub

interface TimerState {
  [key: string]: number; // 每个模块/子模块的累积时间（毫秒）
}

function ExamLiveMode({ onFinish, onClose }: { onFinish: (res: any) => void; onClose: () => void }) {
  const [examTitle, setExamTitle] = useState('新模拟记录');
  const [totalMinutes, setTotalMinutes] = useState(120);
  const [isStarted, setIsStarted] = useState(false);
  const [currentModule, setCurrentModule] = useState<StudyModule>(MAIN_MODULES[0]);
  const [currentSub, setCurrentSub] = useState<string | null>(null);
  const [showSubSelector, setShowSubSelector] = useState(false);

  // 总已用时间（毫秒）
  const [elapsed, setElapsed] = useState(0);

  // 每个模块/子模块的独立计时
  const [timers, setTimers] = useState<TimerState>(() => {
    const initial: TimerState = {};
    MAIN_MODULES.forEach(m => {
      initial[m] = 0;
      getSubTopics(m).forEach(sub => { initial[sub] = 0; });
    });
    return initial;
  });

  // 当前正在计时的目标key
  const activeTargetRef = useRef<string>(MAIN_MODULES[0]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(0);

  // 获取当前活跃目标的key
  const getActiveKey = () => {
    if (currentSub) return currentSub;
    return currentModule;
  };

  // 切换目标时：停止旧目标、开始新目标
  useEffect(() => {
    if (!isStarted) return;
    const newTarget = getActiveKey();
    if (activeTargetRef.current !== newTarget) {
      activeTargetRef.current = newTarget;
      lastTickRef.current = Date.now();
    }
  }, [currentModule, currentSub, isStarted]);

  // 核心计时器：每100ms给当前活跃目标+1tick
  useEffect(() => {
    if (!isStarted) return;

    lastTickRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      const target = activeTargetRef.current;
      setElapsed(prev => prev + delta);
      setTimers(prev => ({
        ...prev,
        [target]: (prev[target] || 0) + delta,
      }));
    }, 100);

    // 页面隐藏时停止计时器，显示时恢复
    const handleVisibilityChange = () => {
      if (document.hidden && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      } else if (!document.hidden && !timerRef.current && isStarted) {
        lastTickRef.current = Date.now();
        timerRef.current = setInterval(() => {
          const now = Date.now();
          const delta = now - lastTickRef.current;
          lastTickRef.current = now;
          const target = activeTargetRef.current;
          setElapsed(prev => prev + delta);
          setTimers(prev => ({
            ...prev,
            [target]: (prev[target] || 0) + delta,
          }));
        }, 100);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStarted]);

  const startExam = () => {
    setIsStarted(true);
    
    // 检查第一个模块是否有子模块，有就弹出子模块选择
    const firstModule = MAIN_MODULES[0];
    if (hasSubModules(firstModule)) {
      setCurrentModule(firstModule);
      setShowSubSelector(true);
      setCurrentSub(null);
    } else {
      setCurrentModule(firstModule);
      setCurrentSub(null);
      activeTargetRef.current = firstModule;
    }
    
    lastTickRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setElapsed(prev => prev + delta);
      const target = activeTargetRef.current;
      setTimers(prev => ({
        ...prev,
        [target]: (prev[target] || 0) + delta,
      }));
    }, 100);
  };

  const finishExam = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    // 构建层级成绩数据
    const scoresWithSubs = MAIN_MODULES.map(m => {
      const hasSub = hasSubModules(m);
      const subs = getSubTopics(m);

      // 大模块总时长 = 子模块之和（有子模块的）或 直接的大模块时长（无子模块的）
      let moduleDuration = timers[m] || 0;
      const subDurations: Record<string, number> = {};

      if (hasSub && subs.length > 0) {
        let subTotal = 0;
        subs.forEach(sub => {
          const subTime = timers[sub] || 0;
          subDurations[sub] = subTime;
          subTotal += subTime;
        });
        // 有子模块的大模块：时间 = 子模块总和
        moduleDuration = subTotal;
      }

      return {
        moduleId: m,
        duration: Math.round(moduleDuration / 1000), // 转为秒
        correctCount: 0,
        totalCount: 0,
        subDurations: hasSub ? subDurations : undefined,
      };
    });

    onFinish({ title: examTitle, scores: scoresWithSubs });
  };

  const remainingMs = Math.max(0, totalMinutes * 60000 - elapsed);
  const currentSubTopics = hasSubModules(currentModule) ? getSubTopics(currentModule) : [];

  // 格式化时间显示
  const fmt = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  // 当前显示的时长（优先子模块）
  const displayDuration = currentSub ? (timers[currentSub] || 0) : (timers[currentModule] || 0);

  if (!isStarted) {
    return (
      <div className="fixed inset-0 z-[110] bg-slate-900 flex flex-col items-center justify-center p-6 pb-24 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <div className="bg-indigo-500/20 w-20 h-20 rounded-[30px] flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
              <Trophy className="text-indigo-400" size={40} />
            </div>
            <h2 className="text-2xl font-black text-white">全真模考模式</h2>
            <p className="text-slate-400 text-sm">点击模块可展开子模块单独计时</p>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-800/50 p-6 rounded-[32px] border border-slate-700/50 space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase px-1">考试名称</label>
                <input type="text" value={examTitle} onChange={(e) => setExamTitle(e.target.value)}
                  className="w-full bg-slate-900 border-none rounded-2xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase px-1">总考试时长 (分钟)</label>
                <input type="number" value={totalMinutes} onChange={(e) => setTotalMinutes(Number(e.target.value))}
                  className="w-full bg-slate-900 border-none rounded-2xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={startExam}
              className="w-full bg-indigo-500 text-white py-4 rounded-[24px] font-bold shadow-2xl shadow-indigo-500/20 active:scale-95 transition-all text-lg flex items-center justify-center gap-3">
              <Play size={20} fill="currentColor" /> 开始模拟
            </button>
            <button onClick={onClose} className="w-full bg-transparent text-slate-500 py-3 font-bold text-sm">取消</button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900 flex flex-col text-white">
      <div className="p-6 pt-12 text-center space-y-4">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">{examTitle}</div>
        <div className="flex flex-col items-center">
           <div className={cn("text-5xl font-black tabular-nums tracking-tight", remainingMs < 300000 ? "text-rose-500 animate-pulse" : "text-white")}>
             {Math.floor(remainingMs / 60000)}:{String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0')}
           </div>
           <div className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">剩余考试时间</div>
        </div>
      </div>

      <div className="flex-1 px-4 flex flex-col justify-center">
         <div className="bg-slate-800/50 rounded-[40px] p-8 border border-slate-700/30 space-y-6 backdrop-blur-md">
            {/* 当前正在进行的模块 */}
            <div className="text-center space-y-1">
               <div className="text-xs font-bold text-indigo-400 mb-1">当前正在进行</div>
               <div className="text-2xl font-black">
                 {currentModule}{currentSub ? ` · ${currentSub}` : ''}
               </div>
               {/* 当前目标的时间 */}
               <div className="text-5xl font-black tabular-nums tracking-tighter text-indigo-100 mt-2">
                  {fmt(displayDuration)}
               </div>
            </div>

            {/* 大模块选择卡片 */}
            <div className="grid grid-cols-3 gap-2">
                {MAIN_MODULES.map(m => {
                  const hasSub = hasSubModules(m);
                  let isActive: boolean;
                  if (hasSub) {
                    // 有子模块的大模块：active = 当前模块是这个大模块（不管有没有子模块）
                    isActive = currentModule === m;
                  } else {
                    // 无子模块的大模块：active = 当前模块是它且没有子模块在计时
                    isActive = currentModule === m && !currentSub;
                  }

                  // 计算大模块的总时长
                  let totalTime: number;
                  if (hasSub) {
                    // 有子模块的大模块：时间 = 子模块总和
                    const subs = getSubTopics(m);
                    totalTime = subs.reduce((sum, sub) => sum + (timers[sub] || 0), 0);
                  } else {
                    // 无子模块的大模块：直接使用自身时间
                    totalTime = timers[m] || 0;
                  }

                  return (
                    <button key={m}
                        onClick={() => {
                          if (hasSub) {
                            // 有子模块的大模块：只弹出子模块选择器，不切换 activeTarget
                            setCurrentModule(m as StudyModule);
                            setShowSubSelector(true);
                            // 不清空 currentSub，保持当前正在计时的子模块继续
                          } else {
                            // 无子模块的大模块：直接计时
                            setCurrentModule(m as StudyModule);
                            setCurrentSub(null);
                            setShowSubSelector(false);
                            activeTargetRef.current = m;
                            lastTickRef.current = Date.now();
                          }
                        }}
                      className={cn("border p-3 rounded-2xl flex flex-col items-center gap-1 active:scale-95 transition-all",
                        isActive ? "bg-indigo-500 border-indigo-400 shadow-lg shadow-indigo-500/20" : "bg-slate-900/50 border-slate-700/50"
                      )}>
                      <span className={cn("text-[9px] font-bold", isActive ? "text-white" : "text-slate-500")}>{m}</span>
                      <span className={cn("text-xs font-bold", isActive ? "text-white" : "text-slate-300")}>
                        {fmt(totalTime)}
                      </span>
                      {hasSub && <span className="text-[8px] text-slate-500">🔒 需要选子模块</span>}
                    </button>
                  )
                })}
            </div>

            {/* 子模块选择器 */}
            <AnimatePresence>
              {showSubSelector && hasSubModules(currentModule) && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="bg-slate-800/80 border border-slate-600/50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">选择 {currentModule} 子模块</span>
                    <button onClick={() => setShowSubSelector(false)} className="text-slate-500 hover:text-slate-300"><X size={14} /></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getSubTopics(currentModule).map(sub => (
                      <button key={sub}
                        onClick={() => {
                          setCurrentSub(sub);
                          setShowSubSelector(false);
                          activeTargetRef.current = sub; // 切换到子模块计时
                          lastTickRef.current = Date.now(); // 重置tick防止跳变
                        }}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[11px] font-bold transition-all min-w-[80px]",
                          currentSub === sub
                            ? "bg-indigo-400 text-white"
                            : "bg-slate-900/70 text-slate-400 border border-slate-700/50"
                        )}>
                        <div>{sub}</div>
                        <div className="text-[10px] mt-0.5 opacity-70">{fmt(timers[sub] || 0)}</div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 说明文字 */}
            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-medium">
                🔒 言语理解、判断推理必须选子模块计时 · 大模块时间 = 子模块之和
              </p>
            </div>
         </div>
      </div>

      <div className="p-8 pb-20 flex flex-col gap-4">
         <button onClick={finishExam}
           className="w-full bg-rose-500 text-white py-5 rounded-[28px] font-bold text-lg flex items-center justify-center gap-3 shadow-2xl shadow-rose-500/20 active:scale-95 transition-all">
           <StopCircle size={24} /> 结束并交卷
         </button>
      </div>
    </div>
  );
}

// ==================== 考试录入主页面 ====================

// ==================== 记录卡片 ====================

function formatTimeWithSeconds(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes}分`;
}

function RecordCard({
  record, onDelete, onEdit, onViewWrong
}: {
  record: ExamRecord; onDelete: () => void; onEdit: () => void; onViewWrong?: () => void;
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
             <div className="flex items-center gap-1"><Target size={14} className="text-emerald-500" /><span className="text-xs font-bold text-emerald-600">{accuracy}%</span></div>
             <div className="flex items-center gap-1"><Clock size={14} className="text-indigo-500" /><span className="text-xs font-bold text-slate-500">{formatTimeWithSeconds(totalTime)}</span></div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"><Edit2 size={16} /></button>
          <button onClick={onDelete} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
          <button onClick={() => setExpanded(!expanded)} className={cn("p-2 text-slate-300 transition-transform", expanded && "rotate-90")}><ChevronRight size={18} /></button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-slate-50/50 border-t border-slate-50">
            <div className="p-4 space-y-3">
              {/* 反思区域 */}
              {record.reflection && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3">
                  <div className="text-[10px] font-bold text-yellow-700 mb-1">📝 考试反思</div>
                  <div className="text-xs text-yellow-900 whitespace-pre-wrap leading-relaxed">{record.reflection}</div>
                </div>
              )}

              {/* 各模块详情（可展开子模块） */}
              {record.moduleScores.map(ms => {
                const modAcc = ms.totalCount > 0 ? Math.round((ms.correctCount / ms.totalCount) * 100) : 0;
                const subs = getSubTopics(ms.moduleId);
                const [showSubs, setShowSubs] = useState(false);
                return (
                  <div key={ms.moduleId}>
                    <div className="flex items-center justify-between bg-white px-3 py-2.5 rounded-2xl border border-slate-100/50 cursor-pointer" onClick={() => setShowSubs(!showSubs)}>
                      <div>
                        <div className="text-[10px] font-bold text-slate-700">{ms.moduleId}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">耗时: {formatTimeWithSeconds(ms.duration)} | 正确: {ms.correctCount}/{ms.totalCount}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn("text-xs font-bold", modAcc >= 80 ? "text-emerald-500" : modAcc >= 60 ? "text-amber-500" : "text-rose-500")}>{modAcc}%</div>
                        {subs.length > 0 && <ChevronDown size={12} className={cn("text-slate-300 transition-transform", showSubs && "rotate-180")} />}
                      </div>
                    </div>

                    {/* 子模块详情 */}
                    <AnimatePresence>
                      {showSubs && ms.subScores && ms.subScores.length > 0 && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-4 pr-2 py-2 space-y-1.5">
                          {ms.subScores.map(sub => {
                            const subAcc = sub.totalCount > 0 ? Math.round((sub.correctCount / sub.totalCount) * 100) : 0;
                            return (
                              <div key={sub.subTopic} className="flex items-center justify-between bg-white/80 px-3 py-1.5 rounded-xl border border-slate-100/30">
                                <span className="text-[10px] text-slate-600">{sub.subTopic}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-slate-400">{formatTimeWithSeconds(sub.duration)}</span>
                                  <span className={cn("text-[10px] font-bold", subAcc >= 80 ? "text-emerald-500" : subAcc >= 60 ? "text-amber-500" : "text-rose-500")}>{subAcc}%</span>
                                  <span className="text-[9px] text-slate-400">{sub.correctCount}/{sub.totalCount}</span>
                                </div>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* 录入错题按钮 */}
              {onNavigate && (
                <button
                  onClick={() => onNavigate(record.id, 'examId')}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold py-2.5 rounded-xl border border-indigo-200 transition-colors active:scale-[0.98]"
                >
                  <BookOpen size={14} />
                  录入这场考试的错题
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { ExamLiveMode };
