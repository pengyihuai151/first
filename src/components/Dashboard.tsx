import React from 'react';
import { AppData, MAIN_MODULES, StudyModule, ExamNote } from '../types';
import { cn, formatTimeFriendly } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Clock, AlertTriangle, Calendar, RotateCw, ChevronRight, BarChart3, BookOpen, CheckCircle2, Flame, Eye, X, Edit2, Trash2 } from 'lucide-react';
import { startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { storage } from '../lib/storage';

export default function Dashboard({ data, onUpdate, onNavigate }: { data: AppData; onUpdate: () => void; onNavigate: (tab: string) => void }) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [isEditingQuote, setIsEditingQuote] = React.useState(false);
  const [editQuoteValue, setEditQuoteValue] = React.useState('');

  const quotes = data.settings.quotes || [];
  const dailyIndex = Math.floor(new Date(todayStr).getTime() / 86400000) % (quotes.length || 1);
  const [tempIndex, setTempIndex] = React.useState<number | null>(null);
  const [selectedNote, setSelectedNote] = React.useState<ExamNote | null>(null);
  const displayIndex = tempIndex !== null ? tempIndex : dailyIndex;
  const currentQuote = quotes[displayIndex] || "积跬步，以至千里。";

  const handleShuffle = () => {
    if (quotes.length <= 1) return;
    let next = Math.floor(Math.random() * quotes.length);
    while (next === displayIndex && quotes.length > 1) next = Math.floor(Math.random() * quotes.length);
    setTempIndex(next);
  };

  const handleUpdateQuote = async () => {
    if (!editQuoteValue.trim()) { setIsEditingQuote(false); return; }
    const newQuotes = [...quotes];
    newQuotes[dailyIndex] = editQuoteValue;
    await storage.saveData({ ...data, settings: { ...data.settings, quotes: newQuotes } });
    setIsEditingQuote(false);
    onUpdate();
  };

  const todaySessions = data.sessions.filter(s => s.date === todayStr);
  const totalTodayMs = todaySessions.reduce((acc, s) => acc + s.duration, 0);

  const thisWeekStart = startOfWeek(new Date());
  const thisWeekEnd = endOfWeek(new Date());
  const weekSessions = data.sessions.filter(s => {
    const d = new Date(s.date);
    return isWithinInterval(d, { start: thisWeekStart, end: thisWeekEnd });
  });
  const totalWeekMs = weekSessions.reduce((acc, s) => acc + s.duration, 0);
  const totalAllMs = data.sessions.reduce((acc, s) => acc + s.duration, 0);

  const todayEssayMs = todaySessions.filter(s => s.moduleId === StudyModule.ESSAY).reduce((acc, s) => acc + s.duration, 0);

  const [timeLeft, setTimeLeft] = React.useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  React.useEffect(() => {
    if (!data.settings.examDate) { setTimeLeft(null); return; }
    const calculateTimeLeft = () => {
      const distance = new Date(data.settings.examDate!).getTime() - Date.now();
      if (distance < 0) { setTimeLeft(null); return false; }
      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
      return true;
    };
    calculateTimeLeft();
    const timer = setInterval(() => { if (!calculateTimeLeft()) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [data.settings.examDate]);

  const unMasteredWrong = data.wrongQuestions.filter(q => !q.mastered).length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">备考主页</h1>
        <p className="text-sm text-slate-500">积跬步，以至千里。</p>
      </header>

      {/* 今日箴言 */}
      <div className="bg-white px-5 py-4 rounded-3xl shadow-sm border border-slate-100 group">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">今日箴言</h3>
          {!isEditingQuote && (
            <div className="flex items-center gap-3 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <button onClick={handleShuffle} className="text-[10px] text-slate-500 flex items-center gap-1 active:text-indigo-600 bg-slate-50 px-2 py-0.5 rounded-full">
                <RotateCw size={10} /> 换一条
              </button>
              <button onClick={() => { setEditQuoteValue(currentQuote); setIsEditingQuote(true); }} className="text-[10px] text-indigo-500 font-bold px-1">编辑</button>
            </div>
          )}
        </div>
        {isEditingQuote ? (
          <div className="flex gap-2">
            <input autoFocus className="flex-1 text-xs border-b border-indigo-200 outline-none pb-1" value={editQuoteValue} onChange={e => setEditQuoteValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUpdateQuote()} onBlur={handleUpdateQuote} />
          </div>
        ) : (
          <p className="text-xs text-slate-600 leading-relaxed italic cursor-pointer" onClick={() => { setEditQuoteValue(currentQuote); setIsEditingQuote(true); }}>
            "{currentQuote}"
          </p>
        )}
      </div>

      {/* 倒计时 */}
      {data.settings.examDate && (
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-5"><Calendar size={64} /></div>
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
            <Calendar size={14} className="text-indigo-500" /> 目标考试倒计时
          </h3>
          {timeLeft ? (
            <div className="flex justify-between items-center gap-2">
              <TimeUnit value={timeLeft.days} label="天" color="text-indigo-600" />
              <div className="text-slate-300 font-bold">:</div>
              <TimeUnit value={timeLeft.hours} label="时" color="text-slate-700" />
              <div className="text-slate-300 font-bold">:</div>
              <TimeUnit value={timeLeft.minutes} label="分" color="text-slate-700" />
              <div className="text-slate-300 font-bold">:</div>
              <TimeUnit value={timeLeft.seconds} label="秒" color="text-rose-500" />
            </div>
          ) : (
            <div className="py-2 text-center text-slate-400 text-sm italic">考试已开始或已结束，请前往设置更新日期。</div>
          )}
        </div>
      )}

      {/* 核心数据卡 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1">
          <div className="text-indigo-500 mb-1"><Clock size={20} /></div>
          <span className="text-xs text-slate-500 font-medium">今日学习</span>
          <span className="text-xl font-bold text-slate-800">{formatTimeFriendly(totalTodayMs)}</span>
          <span className="text-[10px] text-slate-400">本周 {formatTimeFriendly(totalWeekMs)}</span>
        </div>
        <button
          onClick={() => onNavigate('analysis')}
          className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl shadow-lg shadow-indigo-100 flex flex-col gap-1 text-left active:scale-95 transition-all"
        >
          <div className="text-white/70 mb-1"><BarChart3 size={20} /></div>
          <span className="text-xs text-white/80 font-medium">学情分析</span>
          <span className="text-sm font-bold text-white flex items-center gap-1">
            {unMasteredWrong > 0 ? `${unMasteredWrong}题待复习` : '查看详情'} <ChevronRight size={14} className="text-white/50" />
          </span>
        </button>
      </div>

      {/* 申论学习 */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-2xl border border-amber-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm">论</div>
            <div>
              <span className="text-xs text-amber-600 font-medium">申论学习</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-slate-800">{todayEssayMs > 0 ? formatTimeFriendly(todayEssayMs) : '--'}</span>
                <span className="text-xs text-slate-400">今日</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400">累计</span>
            <div className="text-sm font-semibold text-slate-600">
              {data.sessions.filter(s => s.moduleId === StudyModule.ESSAY).reduce((acc, s) => acc + s.duration, 0) > 0
                ? formatTimeFriendly(data.sessions.filter(s => s.moduleId === StudyModule.ESSAY).reduce((acc, s) => acc + s.duration, 0))
                : '暂无记录'}
            </div>
          </div>
        </div>
      </div>

      {/* 每日阅读积累打卡 */}
      {(() => {
        const essayNotes = data.notes?.filter(n => n.moduleId === StudyModule.ESSAY) || [];
        if (essayNotes.length === 0) return null;

        const [shuffleKey, setShuffleKey] = React.useState(0);
        const todayReadIds = data.readingCheckIns?.[todayStr] || [];

        // 展示列表：默认最新3条，点击换一批则随机3条（基于shuffleKey种子稳定）
        const shuffled = React.useMemo(() => {
          const list = [...essayNotes].sort((a, b) => b.updatedAt - a.updatedAt);
          if (shuffleKey === 0) return list.slice(0, 3);
          // 基于shuffleKey的伪随机打乱（同key每次结果一致）
          const arr = [...list];
          let seed = shuffleKey * 9973;
          const rand = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return (seed / 0x7fffffff); };
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr.slice(0, 3);
        }, [essayNotes, shuffleKey]);

        // 计算连续打卡天数
        let streak = 0;
        const checkIns = data.readingCheckIns || {};
        if (Object.keys(checkIns).length > 0) {
          let d = new Date();
          // 从今天往前推算连续天数
          while (true) {
            const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (checkIns[ds] && checkIns[ds].length > 0) {
              streak++;
              d.setDate(d.getDate() - 1);
            } else {
              break;
            }
          }
        }

        const handleCheckIn = async (noteId: string) => {
          const newCheckIns = { ...(data.readingCheckIns || {}) };
          if (!newCheckIns[todayStr]) newCheckIns[todayStr] = [];
          if (!newCheckIns[todayStr].includes(noteId)) {
            newCheckIns[todayStr].push(noteId);
          }
          await storage.saveData({ ...data, readingCheckIns: newCheckIns });
          onUpdate();
        };

        return (
          <>
          <section className="bg-gradient-to-br from-violet-50 via-indigo-50 to-purple-50 rounded-3xl border border-indigo-100/60 p-5 space-y-3.5 overflow-hidden relative">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-indigo-200/20 rounded-full blur-xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-indigo-700 flex items-center gap-1.5">
                  <BookOpen size={15} /> 每日阅读积累
                </h3>
                {streak > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                    <Flame size={12} /> 连续{streak}天
                  </span>
                )}
              </div>

              {essayNotes.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] text-indigo-400/80">点击阅读，完成后「已读」打卡</p>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      已读 {todayReadIds.length}/{essayNotes.length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {shuffled.map((note, idx) => {
                      const isRead = todayReadIds.includes(note.id);
                      return (
                        <motion.div
                          key={note.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          onClick={() => setSelectedNote(note)}
                          className={cn(
                            "bg-white/80 backdrop-blur-sm rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer active:bg-white transition-colors",
                            isRead && "opacity-70"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs",
                            isRead ? "bg-emerald-100 text-emerald-500" : "bg-amber-100 text-amber-600"
                          )}>
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-slate-700 truncate block">{note.title}</span>
                            <div className="flex items-center gap-1.5 mt-1">
                              {note.essayType && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">{note.essayType}</span>
                              )}
                              {note.essayTag && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">#{note.essayTag}</span>
                              )}
                              <Eye size={10} className="text-indigo-300 shrink-0" />
                              <span className="text-[9px] text-indigo-300 shrink-0">{note.content?.length || 0}字</span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCheckIn(note.id); }}
                            className={cn(
                              "shrink-0 self-center w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-all shadow-md",
                              isRead
                                ? "bg-emerald-100 text-emerald-500 shadow-emerald-100"
                                : "bg-indigo-500 text-white shadow-indigo-200 active:bg-indigo-600"
                            )}
                            title={isRead ? "已打卡" : "标记已读"}
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setShuffleKey(k => k + 1)}
                    className="w-full mt-2 py-2 rounded-xl border border-dashed border-indigo-200 text-[11px] text-indigo-400 font-medium hover:bg-indigo-50 transition-colors active:scale-98"
                  >
                    随机换一批
                  </button>
                </>
              ) : (
                <div className="py-3 text-center space-y-2">
                  <BookOpen size={28} className="text-indigo-200 mx-auto" />
                  <p className="text-sm text-slate-400">暂无申论笔记</p>
                  <p className="text-[11px] text-slate-300">前往笔记管理添加申论笔记吧</p>
                </div>
              )}
            </div>
          </section>

          {/* 笔记详情弹层 */}
          <AnimatePresence>
            {selectedNote && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center px-4 pb-6"
              >
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedNote(null)} />
                <motion.div
                  initial={{ y: '100%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: '100%', opacity: 0 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  className="bg-white w-full max-w-sm rounded-3xl relative z-10 flex flex-col shadow-2xl max-h-[80dvh]"
                >
                  <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen size={16} className="shrink-0 text-amber-500" />
                      <h3 className="font-bold text-slate-800 truncate">{selectedNote.title}</h3>
                    </div>
                    <button onClick={() => setSelectedNote(null)} className="text-slate-400 hover:text-slate-600 shrink-0 ml-2 p-1">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 custom-scrollbar">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700">{selectedNote.moduleId}</span>
                      {selectedNote.essayType && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-500">{selectedNote.essayType}</span>
                      )}
                      {selectedNote.essayTag && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-600">#{selectedNote.essayTag}</span>
                      )}
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4 min-h-[100px]">
                      <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words font-sans">
                        {selectedNote.content}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-300 font-medium space-y-1 pt-2 border-t border-slate-100 pb-safe">
                      <div>更新时间：{new Date(selectedNote.updatedAt).toLocaleString()}</div>
                      {selectedNote.content && (<div>字数约：{selectedNote.content.length}</div>)}
                    </div>
                  </div>

                  <div className="px-5 py-3 border-t border-slate-100 flex gap-3 shrink-0 pb-safe">
                    <button
                      onClick={() => handleCheckIn(selectedNote.id)}
                      disabled={todayReadIds.includes(selectedNote.id)}
                      className={cn(
                        "flex-1 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md",
                        todayReadIds.includes(selectedNote.id)
                          ? "bg-emerald-100 text-emerald-500 shadow-emerald-100"
                          : "bg-indigo-500 text-white active:bg-indigo-600 active:scale-97 shadow-indigo-200"
                      )}
                    >
                      <CheckCircle2 size={16} />
                      {todayReadIds.includes(selectedNote.id) ? '已打卡' : '标记已读'}
                    </button>
                    <button
                      onClick={() => onNavigate('notes')}
                      className="py-3 px-4 rounded-2xl border border-slate-200 text-slate-600 text-sm font-bold active:bg-slate-50 transition-colors"
                    >笔记</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          </>
        );
      })()}

      {/* 最近模考 */}
      {(() => {
        const lastExam = data.examRecords && data.examRecords.length > 0
          ? [...data.examRecords].sort((a, b) => b.date - a.date)[0] : null;
        if (!lastExam) return null;

        const totalCorrect = lastExam.moduleScores.reduce((sum, ms) => sum + ms.correctCount, 0);
        const totalQuestions = lastExam.moduleScores.reduce((sum, ms) => sum + ms.totalCount, 0);
        const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        return (
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase">最近模考</h3>
              <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{new Date(lastExam.date).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full border-[6px] border-emerald-50 flex items-center justify-center relative">
                <span className="text-sm font-black text-emerald-600">{accuracy}%</span>
                <svg className="absolute inset-[-6px] w-[calc(100%+12px)] h-[calc(100%+12px)] -rotate-90">
                  <circle cx="38" cy="38" r="32" fill="none" stroke="currentColor" className="text-emerald-500" strokeWidth="6" strokeDasharray="201" strokeDashoffset={201 - (201 * accuracy / 100)} />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-800 truncate">{lastExam.title}</h4>
                <div className="flex gap-4 mt-1">
                  <div>
                    <div className="text-[9px] text-slate-400 font-bold">正确数</div>
                    <div className="text-xs font-bold text-slate-600">{totalCorrect}/{totalQuestions}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-400 font-bold">总用时</div>
                    <div className="text-xs font-bold text-slate-600">
                      {(() => {
                        const ms = lastExam.moduleScores.reduce((s, m) => s + m.duration, 0);
                        const totalSec = Math.floor(ms / 1000);
                        const mins = Math.floor(totalSec / 60);
                        const secs = totalSec % 60;
                        return secs > 0 ? `${mins}分${secs}秒` : `${mins}分`;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 模块投入统计 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Trophy size={16} className="text-amber-500" /> 模块投入统计
        </h2>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-50">
          {[...MAIN_MODULES, StudyModule.ESSAY].map((module) => {
            const moduleMs = data.sessions.filter(s => s.moduleId === module).reduce((acc, s) => acc + s.duration, 0);
            const moduleWrongCount = data.wrongQuestions.filter(q => q.moduleId === module).length;
            const progress = totalAllMs > 0 ? (moduleMs / totalAllMs) * 100 : 0;

            return (
              <div key={module} className="p-4">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <span className="text-sm font-medium text-slate-700">{module}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">累计 {formatTimeFriendly(moduleMs)}</span>
                      <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <AlertTriangle size={10} /> 错题 {moduleWrongCount}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-400">{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className={cn("h-full", module === StudyModule.ESSAY ? "bg-emerald-500" : "bg-indigo-500")} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TimeUnit({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center flex-1">
      <div className={cn("text-2xl font-black tabular-nums tracking-tighter", color)}>{value.toString().padStart(2, '0')}</div>
      <div className="text-[10px] text-slate-400 font-bold">{label}</div>
    </div>
  );
}
