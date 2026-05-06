import React from 'react';
import { AppData, MAIN_MODULES, StudyModule } from '../types';
import { cn, formatTimeFriendly } from '../lib/utils';
import { motion } from 'motion/react';
import {
  BarChart3, TrendingUp, AlertTriangle, Clock, Target,
  BookOpen, Brain, ChevronRight, Sparkles
} from 'lucide-react';
import { AIAssistantInline } from './AIAssistant';
import KnowledgePointRanking from './KnowledgePointRanking';
import { differenceInDays, startOfWeek, endOfWeek, isWithinInterval, subDays, format } from 'date-fns';

export default function AnalysisPage({ data, onUpdate }: { data: AppData; onUpdate: () => void }) {
  const [showKnowledgePoints, setShowKnowledgePoints] = React.useState(false);
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // ========== 考试数据 ==========
  const examRecords = data.examRecords || [];
  const lastExam = examRecords.length > 0 ? [...examRecords].sort((a, b) => b.date - a.date)[0] : null;
  const prevExam = examRecords.length > 1 ? [...examRecords].sort((a, b) => b.date - a.date)[1] : null;

  // 各模块考试正确率 - 所有历史平均（用于薄弱度排序）
  const moduleExamStats = MAIN_MODULES.map(m => {
    const scores = examRecords
      .map(r => r.moduleScores.find(ms => ms.moduleId === m))
      .filter((s): s is NonNullable<typeof s> => !!s && s.totalCount > 0);
    
    const avgAcc = scores.length > 0
      ? scores.reduce((acc, s) => acc + s.correctCount / s.totalCount, 0) / scores.length
      : 0;
    
    const recentScores = scores.slice(-3);
    const trend = recentScores.length >= 2
      ? (recentScores[recentScores.length - 1].correctCount / recentScores[recentScores.length - 1].totalCount) -
        (recentScores[0].correctCount / recentScores[0].totalCount)
      : 0;

    return {
      moduleId: m,
      examCount: scores.length,
      avgAccuracy: Math.round(avgAcc * 100),
      trend: Math.round(trend * 100),
      lastAcc: scores.length > 0
        ? Math.round(scores[scores.length - 1].correctCount / scores[scores.length - 1].totalCount * 100)
        : null,
      avgDuration: scores.length > 0
        ? Math.round(scores.reduce((acc, s) => acc + s.duration, 0) / scores.length / 60000)
        : 0
    };
  });

  // 各模块考试正确率 - 最近3次平均（用于考试趋势显示）
  const moduleRecentStats = MAIN_MODULES.map(m => {
    const sortedRecords = [...examRecords].sort((a, b) => b.date - a.date).slice(0, 3);
    const scores = sortedRecords
      .map(r => r.moduleScores.find(ms => ms.moduleId === m))
      .filter((s): s is NonNullable<typeof s> => !!s && s.totalCount > 0);
    
    const avgAcc = scores.length > 0
      ? scores.reduce((acc, s) => acc + s.correctCount / s.totalCount, 0) / scores.length
      : 0;

    return {
      moduleId: m,
      examCount: scores.length,
      avgAccuracy: Math.round(avgAcc * 100)
    };
  });

  // ========== 错题数据 ==========
  const wrongQuestions = data.wrongQuestions || [];
  const totalWrong = wrongQuestions.length;
  const masteredWrong = wrongQuestions.filter(q => q.mastered).length;
  const unMasteredWrong = totalWrong - masteredWrong;

  // 各模块错题统计
  const moduleWrongStats = MAIN_MODULES.map(m => {
    const questions = wrongQuestions.filter(q => q.moduleId === m);
    const mastered = questions.filter(q => q.mastered).length;
    
    // 知识点统计
    const tagCount: Record<string, number> = {};
    questions.forEach(q => (q.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
    
    // 错误原因统计
    const reasonCount: Record<string, number> = {};
    questions.forEach(q => {
      if (q.errorReason) reasonCount[q.errorReason] = (reasonCount[q.errorReason] || 0) + 1;
    });
    const topReasons = Object.entries(reasonCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

    return {
      moduleId: m,
      total: questions.length,
      mastered,
      rate: questions.length > 0 ? Math.round(mastered / questions.length * 100) : 0,
      topTags,
      topReasons
    };
  });

  // 全局错误原因排行
  const globalReasons: Record<string, number> = {};
  wrongQuestions.forEach(q => {
    if (q.errorReason) globalReasons[q.errorReason] = (globalReasons[q.errorReason] || 0) + 1;
  });
  const topGlobalReasons = Object.entries(globalReasons).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ========== 学习时长 ==========
  const totalAllMs = data.sessions.reduce((acc, s) => acc + s.duration, 0);

  // 近7天学习时长（区分行测和申论）
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(now, 6 - i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const daySessions = data.sessions.filter(s => s.date === dateStr);
    const xingzhenMs = daySessions.filter(s => s.moduleId !== StudyModule.ESSAY).reduce((acc, s) => acc + s.duration, 0);
    const essayMs = daySessions.filter(s => s.moduleId === StudyModule.ESSAY).reduce((acc, s) => acc + s.duration, 0);
    return {
      date: dateStr,
      label: format(d, 'MM/dd'),
      totalMs: xingzhenMs + essayMs,
      xingzhenMs,
      essayMs,
      totalMinutes: Math.round((xingzhenMs + essayMs) / 60000),
      xingzhenMinutes: Math.round(xingzhenMs / 60000),
      essayMinutes: Math.round(essayMs / 60000)
    };
  });
  const maxDayMinutes = Math.max(...last7Days.map(d => d.totalMinutes), 30);

  // ========== 综合薄弱度排序 ==========
  const moduleAnalysis = MAIN_MODULES.map(m => {
    const exam = moduleExamStats.find(e => e.moduleId === m)!;
    const wrong = moduleWrongStats.find(w => w.moduleId === m)!;
    const studyMs = data.sessions.filter(s => s.moduleId === m).reduce((acc, s) => acc + s.duration, 0);

    // 薄弱度评分：考试正确率低 + 错题多 + 错误原因集中 = 更薄弱
    const weaknessScore =
      (100 - exam.avgAccuracy) * 0.4 +  // 考试正确率权重40%
      wrong.total * 5 * 0.3 +            // 错题数量权重30%
      (wrong.topReasons.length > 0 ? 20 : 0) * 0.3;  // 有错误原因权重30%

    return {
      moduleId: m,
      exam,
      wrong,
      studyMs,
      studyMinutes: Math.round(studyMs / 60000),
      weaknessScore,
      level: weaknessScore > 50 ? '薄弱' : weaknessScore > 25 ? '一般' : '良好'
    };
  }).sort((a, b) => b.weaknessScore - a.weaknessScore);

  // 知识点排行视图
  if (showKnowledgePoints) {
    return (
      <div className="space-y-6 pb-6">
        <KnowledgePointRanking data={data} onBack={() => setShowKnowledgePoints(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">学情分析</h1>
          <p className="text-xs text-slate-400 mt-1">基于考试+错题数据，精准定位薄弱环节</p>
        </div>
        <button
          onClick={() => setShowKnowledgePoints(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-md shadow-indigo-200"
        >
          <Sparkles size={14} />
          知识点细分
        </button>
      </header>

      {/* 综合得分概览 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">模考次数</div>
          <div className="text-xl font-black text-indigo-600">{examRecords.length}</div>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">待复习错题</div>
          <div className="text-xl font-black text-rose-500">{unMasteredWrong}</div>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">累计学习</div>
          <div className="text-xl font-black text-slate-700">{Math.round(totalAllMs / 3600000)}h</div>
        </div>
      </div>

      {/* 考试趋势 - 最近3次平均 */}
      {lastExam && (
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-500" /> 考试趋势
            </h2>
            <span className="text-[10px] text-slate-400">
              最近{Math.min(examRecords.length, 3)}次平均
            </span>
          </div>
          
          <div className="space-y-2.5">
            {MAIN_MODULES.map(m => {
              const stats = moduleRecentStats.find(s => s.moduleId === m)!;
              
              return (
                <div key={m} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-600 w-16 truncate">{m}</span>
                  <div className="flex-1 h-6 bg-slate-50 rounded-lg overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.avgAccuracy || 0}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={cn(
                        "h-full rounded-lg flex items-center justify-end pr-2",
                        (stats.avgAccuracy || 0) >= 80 ? "bg-emerald-400" :
                        (stats.avgAccuracy || 0) >= 60 ? "bg-amber-400" : "bg-rose-400"
                      )}
                    >
                      <span className="text-[10px] font-bold text-white">
                        {stats.avgAccuracy !== null ? `${stats.avgAccuracy}%` : '--'}
                      </span>
                    </motion.div>
                  </div>
                  <div className="text-[10px] text-slate-400 w-12 text-right">
                    {stats.examCount > 0 ? `${stats.examCount}次` : '--'}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 薄弱模块排序 */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 pb-3">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" /> 薄弱模块排序
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">综合考试正确率、错题数量、错误原因分析</p>
        </div>
        
        <div className="divide-y divide-slate-50">
          {moduleAnalysis.map((m, idx) => (
            <div key={m.moduleId} className="px-5 py-3.5 flex items-center gap-3">
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white",
                idx === 0 ? "bg-rose-500" : idx === 1 ? "bg-amber-500" : "bg-slate-300"
              )}>
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">{m.moduleId}</span>
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded",
                    m.level === '薄弱' ? "bg-rose-50 text-rose-500" :
                    m.level === '一般' ? "bg-amber-50 text-amber-500" : "bg-emerald-50 text-emerald-500"
                  )}>{m.level}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {m.exam.examCount > 0 && (
                    <span className="text-[10px] text-slate-400">
                      正确率 <span className={cn(
                        "font-bold",
                        m.exam.avgAccuracy >= 80 ? "text-emerald-500" :
                        m.exam.avgAccuracy >= 60 ? "text-amber-500" : "text-rose-500"
                      )}>{m.exam.avgAccuracy}%</span>
                    </span>
                  )}
                  {m.wrong.total > 0 && (
                    <span className="text-[10px] text-slate-400">
                      错题 <span className="font-bold text-rose-500">{m.wrong.total}</span> 题
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    学习 <span className="font-bold text-indigo-500">{m.studyMinutes}</span> 分钟
                  </span>
                </div>
                {/* 高频错误原因 */}
                {m.wrong.topReasons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {m.wrong.topReasons.map(([reason, count]) => (
                      <span key={reason} className="text-[9px] bg-rose-50 text-rose-500 px-1.5 py-0.5 rounded font-medium">
                        {reason}({count})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 错误原因排行 */}
      {topGlobalReasons.length > 0 && (
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Target size={16} className="text-rose-500" /> 错误原因排行
          </h2>
          <div className="space-y-3">
            {topGlobalReasons.map(([reason, count], idx) => {
              const maxCount = topGlobalReasons[0][1];
              const barWidth = Math.round(count / maxCount * 100);
              return (
                <div key={reason} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-600">{reason}</span>
                    <span className="text-[10px] font-bold text-slate-400">{count}次</span>
                  </div>
                  <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.1 }}
                      className="h-full bg-rose-400 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 近7天学习时长 */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <Clock size={16} className="text-indigo-500" /> 近7天学习
        </h2>
        {/* 图例 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-indigo-400" />
            <span className="text-[10px] text-slate-500">行测</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-400" />
            <span className="text-[10px] text-slate-500">申论</span>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-28">
          {last7Days.map(day => {
            const totalHeight = maxDayMinutes > 0 ? Math.max(day.totalMinutes / maxDayMinutes * 100, 4) : 4;
            const essayPct = day.totalMinutes > 0 ? (day.essayMinutes / day.totalMinutes) * totalHeight : 0;
            const xingzhenPct = totalHeight - essayPct;
            const isToday = day.date === todayStr;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-end gap-1 flex-wrap justify-center">
                  {day.totalMinutes > 0 && (
                    <span className="text-[9px] font-bold text-slate-500 leading-none">{day.totalMinutes}m</span>
                  )}
                </div>
                <div className="w-full rounded-t-lg relative overflow-hidden flex flex-col justify-end" style={{ height: '88px' }}>
                  {/* 申论部分（顶部，琥珀色） */}
                  {essayPct > 0 && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${essayPct}%` }}
                      transition={{ duration: 0.5 }}
                      className={cn(
                        "w-full rounded-t-sm",
                        isToday ? "bg-amber-400" : "bg-amber-200"
                      )}
                    />
                  )}
                  {/* 行测部分（底部，靛蓝色） */}
                  {xingzhenPct > 0 && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${xingzhenPct}%` }}
                      transition={{ duration: 0.5 }}
                      className={cn(
                        "w-full rounded-b-sm",
                        isToday ? "bg-indigo-500" : "bg-indigo-200"
                      )}
                    />
                  )}
                </div>
                <span className={cn(
                  "text-[8px] font-bold",
                  isToday ? "text-indigo-600" : "text-slate-400"
                )}>{day.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 各模块详细分析 */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <BarChart3 size={16} className="text-indigo-500" /> 模块详细分析
        </h2>
        {moduleAnalysis.map(m => (
          <div key={m.moduleId} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-700">{m.moduleId}</span>
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded",
                  m.level === '薄弱' ? "bg-rose-50 text-rose-500" :
                  m.level === '一般' ? "bg-amber-50 text-amber-500" : "bg-emerald-50 text-emerald-500"
                )}>{m.level}</span>
              </div>
              <div className="text-[10px] text-slate-400">
                学习 {m.studyMinutes}分钟 | 模考 {m.exam.examCount}次
              </div>
            </div>
            
            {/* 数据三指标 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                <div className="text-[9px] text-slate-400 font-bold">考试正确率</div>
                <div className={cn(
                  "text-lg font-black",
                  m.exam.avgAccuracy >= 80 ? "text-emerald-500" :
                  m.exam.avgAccuracy >= 60 ? "text-amber-500" : "text-rose-500"
                )}>
                  {m.exam.examCount > 0 ? `${m.exam.avgAccuracy}%` : '--'}
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                <div className="text-[9px] text-slate-400 font-bold">错题掌握率</div>
                <div className="text-lg font-black text-indigo-500">
                  {m.wrong.total > 0 ? `${m.wrong.rate}%` : '--'}
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                <div className="text-[9px] text-slate-400 font-bold">平均用时</div>
                <div className="text-lg font-black text-slate-600">
                  {m.exam.avgDuration > 0 ? `${m.exam.avgDuration}分` : '--'}
                </div>
              </div>
            </div>

            {/* 知识点弱点 */}
            {m.wrong.topTags.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-slate-400 mb-1.5">高频错点</div>
                <div className="flex flex-wrap gap-1.5">
                  {m.wrong.topTags.map(([tag, count]) => (
                    <span key={tag} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg font-medium">
                      {tag} <span className="text-indigo-400">({count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 错误原因 */}
            {m.wrong.topReasons.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-slate-400 mb-1.5">主要失分原因</div>
                <div className="flex flex-wrap gap-1.5">
                  {m.wrong.topReasons.map(([reason, count]) => (
                    <span key={reason} className="text-[10px] bg-rose-50 text-rose-500 px-2 py-1 rounded-lg font-medium">
                      {reason} <span className="text-rose-300">({count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* AI 智能建议 */}
      <section>
        <AIAssistantInline data={data} />
      </section>
    </div>
  );
}
