import React from 'react';
import { AppData, MAIN_MODULES, StudyModule } from '../types';
import { cn, formatTimeFriendly } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Clock, AlertTriangle, Calendar, RotateCw, Brain, ChevronRight } from 'lucide-react';
import { differenceInDays, startOfDay, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import { storage } from '../lib/storage';
import ReviewSession from './ReviewSession';
import { AIAssistantInline } from './AIAssistant';

export default function Dashboard({ data, onUpdate }: { data: AppData; onUpdate: () => void }) {
  const now = new Date();
  const [isReviewOpen, setIsReviewOpen] = React.useState(false);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const [isEditingQuote, setIsEditingQuote] = React.useState(false);
  const [editQuoteValue, setEditQuoteValue] = React.useState('');

  const quotes = data.settings.quotes || [];
  const dailyIndex = Math.floor(new Date(todayStr).getTime() / 86400000) % (quotes.length || 1);
  const [tempIndex, setTempIndex] = React.useState<number | null>(null);
  
  const displayIndex = tempIndex !== null ? tempIndex : dailyIndex;
  const currentQuote = quotes[displayIndex] || "积跬步，以至千里。";

  const handleShuffle = () => {
    if (quotes.length <= 1) return;
    let next = Math.floor(Math.random() * quotes.length);
    while (next === displayIndex && quotes.length > 1) {
      next = Math.floor(Math.random() * quotes.length);
    }
    setTempIndex(next);
  };

  const handleUpdateQuote = async () => {
    if (!editQuoteValue.trim()) {
      setIsEditingQuote(false);
      return;
    }
    const newQuotes = [...quotes];
    newQuotes[dailyIndex] = editQuoteValue;
    await storage.saveData({
      ...data,
      settings: {
        ...data.settings,
        quotes: newQuotes
      }
    });
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

  // 申论学习时间统计
  const todayEssayMs = todaySessions.filter(s => s.moduleId === StudyModule.ESSAY).reduce((acc, s) => acc + s.duration, 0);
  const totalEssayMs = data.sessions.filter(s => s.moduleId === StudyModule.ESSAY).reduce((acc, s) => acc + s.duration, 0);

  const [timeLeft, setTimeLeft] = React.useState<{days:number, hours:number, minutes:number, seconds:number} | null>(null);

  React.useEffect(() => {
    if (!data.settings.examDate) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(data.settings.examDate!).getTime();
      const distance = target - now;

      if (distance < 0) {
        setTimeLeft(null);
        return false;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
      return true;
    };

    // Calculate immediately
    calculateTimeLeft();

    const timer = setInterval(() => {
      const isOngoing = calculateTimeLeft();
      if (!isOngoing) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [data.settings.examDate]);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">备考主页</h1>
          <p className="text-sm text-slate-500">积跬步，以至千里。</p>
        </div>
      </header>

      {/* Daily Quote (Top) */}
      <div className="bg-white px-5 py-4 rounded-3xl shadow-sm border border-slate-100 group">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">今日箴言</h3>
          {!isEditingQuote && (
            <div className="flex items-center gap-3 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <button 
                onClick={handleShuffle}
                className="text-[10px] text-slate-500 flex items-center gap-1 active:text-indigo-600 md:hover:text-indigo-500 bg-slate-50 md:bg-transparent px-2 py-0.5 rounded-full md:p-0"
                title="随机切换查看"
              >
                <RotateCw size={10} /> 换一条
              </button>
              <button 
                onClick={() => {
                  setEditQuoteValue(currentQuote);
                  setIsEditingQuote(true);
                }}
                className="text-[10px] text-indigo-500 font-bold px-1"
              >
                编辑
              </button>
            </div>
          )}
        </div>
        {isEditingQuote ? (
          <div className="flex gap-2">
            <input 
              autoFocus
              className="flex-1 text-xs border-b border-indigo-200 outline-none pb-1"
              value={editQuoteValue}
              onChange={e => setEditQuoteValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdateQuote()}
              onBlur={handleUpdateQuote}
            />
          </div>
        ) : (
          <p 
            className="text-xs text-slate-600 leading-relaxed italic cursor-pointer"
            onClick={() => {
              setEditQuoteValue(currentQuote);
              setIsEditingQuote(true);
            }}
          >
            "{currentQuote}"
          </p>
        )}
      </div>

      {/* Real-time Countdown Card */}
      {data.settings.examDate && (
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-5">
             <Calendar size={64} />
          </div>
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
            <div className="py-2 text-center text-slate-400 text-sm italic">
              考试已开始或已结束，请前往设置更新日期。
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1">
          <div className="text-indigo-500 mb-1">
            <Clock size={20} />
          </div>
          <span className="text-xs text-slate-500 font-medium">今日学习</span>
          <span className="text-xl font-bold text-slate-800">{formatTimeFriendly(totalTodayMs)}</span>
        </div>
        <button 
          onClick={() => setIsReviewOpen(true)}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1 text-left relative overflow-hidden group active:scale-95 transition-all"
        >
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:scale-110 transition-transform">
             <Brain size={40} />
          </div>
          <div className="text-rose-500 mb-1">
            <Brain size={20} />
          </div>
          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">开启错题复盘</span>
          <span className="text-sm font-bold text-slate-800 flex items-center gap-1">
             剩余 {data.wrongQuestions.filter(q => !q.mastered).length} 题 <ChevronRight size={14} className="text-slate-300" />
          </span>
        </button>
      </div>

      {/* Essay Study Time Card */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-2xl border border-amber-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm">
              论
            </div>
            <div>
              <span className="text-xs text-amber-600 font-medium">申论学习</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-slate-800">
                  {todayEssayMs > 0 ? formatTimeFriendly(todayEssayMs) : '--'}
                </span>
                <span className="text-xs text-slate-400">今日</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400">累计</span>
            <div className="text-sm font-semibold text-slate-600">
              {totalEssayMs > 0 ? formatTimeFriendly(totalEssayMs) : '暂无记录'}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Exam Highlighting */}
      {(() => {
        const lastExam = data.examRecords && data.examRecords.length > 0 
          ? [...data.examRecords].sort((a, b) => b.date - a.date)[0]
          : null;
        
        if (!lastExam) return null;

        const totalCorrect = lastExam.moduleScores.reduce((sum, ms) => sum + ms.correctCount, 0);
        const totalQuestions = lastExam.moduleScores.reduce((sum, ms) => sum + ms.totalCount, 0);
        const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        return (
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-3">
             <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-400 uppercase">最近模考表现</h3>
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{new Date(lastExam.date).toLocaleDateString()}</span>
             </div>
             <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full border-[6px] border-emerald-50 flex items-center justify-center relative">
                  <span className="text-sm font-black text-emerald-600">{accuracy}%</span>
                  <svg className="absolute inset-[-6px] w-[calc(100%+12px)] h-[calc(100%+12px)] -rotate-90">
                    <circle 
                      cx="38" cy="38" r="32" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="6" 
                      className="text-emerald-500" 
                      strokeDasharray="201"
                      strokeDashoffset={201 - (201 * accuracy / 100)}
                    />
                  </svg>
                </div>
                <div className="flex-1">
                   <h4 className="text-sm font-bold text-slate-800 truncate">{lastExam.title}</h4>
                   <div className="flex gap-4 mt-1">
                      <div>
                        <div className="text-[9px] text-slate-400 font-bold">总用时</div>
                        <div className="text-xs font-bold text-slate-600">
                          {(() => {
                            const ms = lastExam.moduleScores.reduce((s, m) => s + m.duration, 0);
                            const totalSeconds = Math.floor(ms / 1000);
                            const mins = Math.floor(totalSeconds / 60);
                            const secs = totalSeconds % 60;
                            return secs > 0 ? `${mins}分${secs}秒` : `${mins}分`;
                          })()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400 font-bold">正确数</div>
                        <div className="text-xs font-bold text-slate-600">{totalCorrect}/{totalQuestions}</div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        );
      })()}

      {/* Smart Advice Container */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Trophy size={16} className="text-amber-500" /> 智能备考建议
        </h2>
        <motion.div 
          animate={totalTodayMs < 900000 ? { 
            boxShadow: ["0 0 0px rgba(99, 102, 241, 0)", "0 0 20px rgba(99, 102, 241, 0.4)", "0 0 0px rgba(99, 102, 241, 0)"] 
          } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className={cn(
            "bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-3xl shadow-lg shadow-indigo-100 text-white space-y-4",
            totalTodayMs < 900000 && "ring-2 ring-indigo-400 ring-offset-2 ring-offset-white"
          )}
        >
          {(() => {
            // Re-calculate statistics properly
            const stats = [...MAIN_MODULES, StudyModule.ESSAY].map(m => {
              const ms = data.sessions.filter(s => s.moduleId === m).reduce((acc, s) => acc + s.duration, 0);
              const wrongCount = data.wrongQuestions.filter(q => q.moduleId === m).length;
              
              // Exam scores for this module
              const examWeights = (data.examRecords || []).map(r => r.moduleScores.find(ms => ms.moduleId === m)).filter(Boolean);
              
              // Recent accuracy from exams (last 3 exams)
              const recentExams = examWeights.slice(-3);
              const avgExamAcc = recentExams.length > 0 
                ? recentExams.reduce((acc, w) => acc + (w!.totalCount > 0 ? w!.correctCount / w!.totalCount : 0), 0) / recentExams.length
                : 1; 

              // Target accuracy from settings
              const targetAcc = data.settings.moduleTargets?.[m] || 0.8;
              const gap = Math.max(0, targetAcc - avgExamAcc);

              return { 
                name: m, 
                ms, 
                wrongCount,
                avgExamAcc,
                targetAcc,
                gap,
                examCount: examWeights.length,
                // Scoring strength of weakness based on gap and density
                // If it's Common Sense, we reduce its weight in 'weakest' logic if no target is set
                weaknessScore: (ms > 0 ? (wrongCount / (ms / 3600000)) : (wrongCount > 0 ? 50 : 0)) * (1 + gap * 3)
              };
            });

            const sortedByTime = [...stats].filter(s => s.name !== StudyModule.COMMON_SENSE).sort((a, b) => a.ms - b.ms);
            const sortedByWeakness = [...stats].sort((a, b) => b.weaknessScore - a.weaknessScore);
            
            const neglected = sortedByTime[0];
            const weakest = sortedByWeakness[0];

            // Deep dive into weakest module's specific topics
            const weakSubTopics = data.wrongQuestions
              .filter(q => q.moduleId === weakest.name)
              .reduce((acc, q) => {
                q.tags.forEach(tag => {
                  acc[tag] = (acc[tag] || 0) + 1;
                });
                return acc;
              }, {} as Record<string, number>);
            
            const topWeakTag = Object.entries(weakSubTopics)
              .sort((a, b) => b[1] - a[1])[0];

            const hasData = totalAllMs > 0 || (data.examRecords && data.examRecords.length > 0);

            if (!hasData) {
              return (
                <div className="flex flex-col items-center py-4 text-center">
                  <div className="bg-white/20 p-3 rounded-2xl mb-3">
                    <RotateCw className="animate-spin-slow" size={24} />
                  </div>
                  <p className="text-sm font-medium opacity-90">开始模考或练习，我将为你分析强弱项</p>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="text-[10px] uppercase font-bold opacity-70">重点攻关</div>
                    <div className="text-sm font-bold flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-300" /> {weakest.name}
                    </div>
                    <p className="text-[10px] opacity-80 leading-relaxed">
                      {weakest.gap > 0 
                        ? `距目标正确率(${Math.round(weakest.targetAcc * 100)}%)还有 ${Math.round(weakest.gap * 100)}% 的落后。` 
                        : "该模块已达标，建议保持题感。"}
                      {topWeakTag && (
                        <span className="text-amber-200 block mt-0.5 font-medium">
                          深层痛点：{topWeakTag[0]} (累计错题 {topWeakTag[1]} 次)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="w-px bg-white/10" />
                  <div className="flex-1 space-y-1">
                    <div className="text-[10px] uppercase font-bold opacity-70">学习缺口</div>
                    <div className="text-sm font-bold flex items-center gap-1.5">
                      <Clock size={14} className="text-sky-300" /> {neglected.name}
                    </div>
                    <p className="text-[10px] opacity-80 leading-relaxed">该模块近期投入时长较少。如果该项是提分核心，建议每天至少分配30分钟。</p>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-white/10">
                  <div className="bg-white/10 rounded-2xl p-3 flex items-center gap-3">
                    <div className="bg-white text-indigo-600 p-2 rounded-xl">
                      <Trophy size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold">综合建议</div>
                      <p className="text-[10px] opacity-90 mt-0.5">
                        {totalTodayMs < 900000 
                          ? "今日学习时长还不到15分钟，快去刷几道题进入状态吧！"
                          : data.wrongQuestions.length > 20 
                          ? "错题库已积累一定数量，建议开启一次“错题专项复盘”。" 
                          : "状态不错！建议继续保持当前的模考与练习强度。"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </motion.div>
      </section>

      {/* AI 助手入口 */}
      <section>
        <AIAssistantInline data={data} />
      </section>

      {/* Module Breakdown */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Calendar size={16} /> 模块投入统计
        </h2>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-50">
          {[...MAIN_MODULES, StudyModule.ESSAY].map((module, idx) => {
            const moduleSessions = data.sessions.filter(s => s.moduleId === module);
            const moduleMs = moduleSessions.reduce((acc, s) => acc + s.duration, 0);
            const moduleWrongCount = data.wrongQuestions.filter(q => q.moduleId === module).length;
            const progress = totalAllMs > 0 ? (moduleMs / totalAllMs) * 100 : 0;

            return (
              <div key={module} className="p-4 items-center">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <span className="text-sm font-medium text-slate-700">{module}</span>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        累计 {formatTimeFriendly(moduleMs)}
                       </span>
                       <span className={cn(
                         "text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5",
                         module === StudyModule.ESSAY ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                       )}>
                        <AlertTriangle size={10} /> {module === StudyModule.ESSAY ? '错案' : '错题'} {moduleWrongCount}
                       </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-400">{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className={cn("h-full", module === StudyModule.ESSAY ? "bg-emerald-500" : "bg-indigo-500")} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
      
      <AnimatePresence>
        {isReviewOpen && (
          <ReviewSession 
            data={data} 
            onClose={() => setIsReviewOpen(false)} 
            onUpdate={onUpdate} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TimeUnit({ value, label, color }: { value: number, label: string, color: string }) {
  return (
    <div className="flex flex-col items-center flex-1">
      <div className={cn("text-2xl font-black tabular-nums tracking-tighter", color)}>
        {value.toString().padStart(2, '0')}
      </div>
      <div className="text-[10px] text-slate-400 font-bold">{label}</div>
    </div>
  );
}
