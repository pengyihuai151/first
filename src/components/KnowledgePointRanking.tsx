import React from 'react';
import { AppData, MAIN_MODULES, MODULE_SUB_TOPICS } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import {
  Brain, ChevronLeft, Lightbulb, TrendingUp, Target, BookOpen,
  ArrowUpRight, AlertTriangle, CheckCircle2
} from 'lucide-react';

interface KnowledgePointRankingProps {
  data: AppData;
  onBack: () => void;
}

// 知识点排行项
interface KnowledgePointItem {
  moduleId: string;
  point: string;
  count: number;
  masteredCount: number;
  errorReasons: Record<string, number>;
}

export default function KnowledgePointRanking({ data, onBack }: KnowledgePointRankingProps) {
  const wrongQuestions = data.wrongQuestions || [];

  // ========== 按模块统计知识点错题 ==========
  const moduleKnowledgePoints: Record<string, KnowledgePointItem[]> = {};

  MAIN_MODULES.forEach(mod => {
    const modQuestions = wrongQuestions.filter(q => q.moduleId === mod);

    // 统计每个知识点的错题
    const pointStats: Record<string, { count: number; masteredCount: number; errorReasons: Record<string, number> }> = {};
    modQuestions.forEach(q => {
      const tags = q.tags || [];
      if (tags.length === 0) {
        // 没有标签的归入"未分类"
        const key = '未分类知识点';
        if (!pointStats[key]) pointStats[key] = { count: 0, masteredCount: 0, errorReasons: {} };
        pointStats[key].count++;
        if (q.mastered) pointStats[key].masteredCount++;
        if (q.errorReason) {
          pointStats[key].errorReasons[q.errorReason] = (pointStats[key].errorReasons[q.errorReason] || 0) + 1;
        }
      } else {
        tags.forEach(tag => {
          if (!pointStats[tag]) pointStats[tag] = { count: 0, masteredCount: 0, errorReasons: {} };
          pointStats[tag].count++;
          if (q.mastered) pointStats[tag].masteredCount++;
          if (q.errorReason) {
            pointStats[tag].errorReasons[q.errorReason] = (pointStats[tag].errorReasons[q.errorReason] || 0) + 1;
          }
        });
      }
    });

    // 排序：按错题数降序
    moduleKnowledgePoints[mod] = Object.entries(pointStats)
      .map(([point, stats]) => ({
        moduleId: mod,
        point,
        count: stats.count,
        masteredCount: stats.masteredCount,
        errorReasons: stats.errorReasons
      }))
      .sort((a, b) => b.count - a.count);
  });

  // ========== 全局 Top10 知识点 ==========
  const allPoints = Object.values(moduleKnowledgePoints).flat().sort((a, b) => b.count - a.count);
  const top10Points = allPoints.slice(0, 10);

  // ========== 建议面板数据 ==========
  const suggestions = React.useMemo(() => {
    const result: string[] = [];

    // 1. 找出错题最多的模块
    const modCounts = MAIN_MODULES.map(mod => ({
      mod,
      total: (moduleKnowledgePoints[mod] || []).reduce((s, p) => s + p.count, 0)
    })).sort((a, b) => b.total - a.total);

    if (modCounts[0]?.total > 0) {
      result.push(`重点突破「${modCounts[0].mod}」，该模块累计 ${modCounts[0].total} 道错题，占总错题 ${(modCounts[0].total / Math.max(wrongQuestions.length, 1) * 100).toFixed(1)}%`);
    }

    // 2. 找出最高频的知识点
    if (top10Points.length > 0) {
      const topPoint = top10Points[0];
      result.push(`最高频错点：「${topPoint.point}」（${topPoint.moduleId}）共 ${topPoint.count} 题，建议优先复习`);
    }

    // 3. 找出掌握率低的知识点（>=3题但掌握率<30%）
    const weakPoints = allPoints.filter(p => p.count >= 3 && p.masteredCount / p.count < 0.3);
    if (weakPoints.length > 0) {
      result.push(`薄弱知识点：${weakPoints.slice(0, 3).map(p => `「${p.point}」(${p.count}题)`).join('、')}，掌握率不足30%，需集中攻克`);
    }

    // 4. 找出错误原因最集中的情况
    const reasonMap: Record<string, { count: number; points: string[] }> = {};
    allPoints.forEach(p => {
      Object.entries(p.errorReasons).forEach(([reason, cnt]) => {
        if (!reasonMap[reason]) reasonMap[reason] = { count: 0, points: [] };
        reasonMap[reason].count += cnt;
        if (!reasonMap[reason].points.includes(p.point)) reasonMap[reason].points.push(p.point);
      });
    });
    const topReasonEntry = Object.entries(reasonMap).sort((a, b) => b[1].count - a[1].count)[0];
    if (topReasonEntry) {
      result.push(`主要失分原因：「${topReasonEntry[0]}」出现 ${topReasonEntry[1].count} 次，涉及 ${topReasonEntry[1].points.slice(0, 3).join('、')} 等知识点`);
    }

    // 5. 找出有预设子知识点但完全没错题的（优势区域）
    const strongAreas: string[] = [];
    MAIN_MODULES.forEach(mod => {
      const subTopics = MODULE_SUB_TOPICS[mod] || [];
      const modPoints = moduleKnowledgePoints[mod] || [];
      const usedPoints = new Set(modPoints.map(p => p.point));
      const unusedTopics = subTopics.filter(t => !usedPoints.has(t));
      if (unusedTopics.length > 0 && modPoints.some(p => p.count > 0)) {
        strongAreas.push(`${mod}的${unusedTopics.slice(0, 2).join('、')}`);
      }
    });
    if (strongAreas.length > 0) {
      result.push(`相对稳定区域：${strongAreas.slice(0, 2).join('；')}，可保持当前节奏`);
    }

    return result;
  }, [wrongQuestions.length]);

  // ========== 导出数据（供AI使用）==========
  const exportData = React.useMemo(() => {
    const modules = MAIN_MODULES.filter(mod => (moduleKnowledgePoints[mod] || []).length > 0).map(mod => {
      const points = moduleKnowledgePoints[mod] || [];
      return {
        module: mod,
        totalWrong: points.reduce((s, p) => s + p.count, 0),
        topPoints: points.slice(0, 5).map(p => ({ name: p.point, count: p.count, rate: parseFloat((p.masteredCount / p.count * 100).toFixed(1)) }))
      };
    });
    return { modules, top10Global: top10Points.map(p => ({ name: p.point, module: p.moduleId, count: p.count })) };
  }, [wrongQuestions.length]);

  // 将数据挂载到 window 供 AI 调用
  React.useEffect(() => {
    (window as any).__knowledgePointRanking = exportData;
  }, [exportData]);

  const hasAnyData = wrongQuestions.length > 0;

  return (
    <div className="space-y-5 pb-6">
      {/* 顶部导航 */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:scale-95 transition-all"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-800">知识点错题排行</h1>
          <p className="text-[10px] text-slate-400 mt-0.5">按模块细分，精准定位薄弱知识点</p>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
          <Brain size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">暂无错题数据</p>
          <p className="text-[11px] text-slate-300 mt-1">录入错题后即可查看知识点排行</p>
        </div>
      ) : (
        <>
          {/* 总览卡片 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">总错题</div>
              <div className="text-xl font-black text-rose-500">{wrongQuestions.length}</div>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">涉及知识点</div>
              <div className="text-xl font-black text-indigo-600">{allPoints.length}</div>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">覆盖模块</div>
              <div className="text-xl font-black text-emerald-500">
                {MAIN_MODULES.filter(m => (moduleKnowledgePoints[m] || []).length > 0).length}
              </div>
            </div>
          </div>

          {/* 建议面板 */}
          <section className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-3xl border border-indigo-100/50 p-5 space-y-3">
            <h2 className="text-sm font-bold text-indigo-700 flex items-center gap-2">
              <Lightbulb size={15} /> 智能备考建议
            </h2>
            <div className="space-y-2.5">
              {suggestions.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-2.5 bg-white/70 backdrop-blur-sm rounded-xl p-3"
                >
                  <span className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5",
                    i === 0 ? "bg-rose-400" : i === 1 ? "bg-amber-400" : "bg-indigo-400"
                  )}>
                    {i + 1}
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">{s}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* 全局 Top10 知识点 */}
          {top10Points.length > 0 && (
            <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-4 pb-3">
                <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <TrendingUp size={15} className="text-rose-500" /> 错题 TOP10 知识点
                </h2>
              </div>
              <div className="divide-y divide-slate-50">
                {top10Points.map((item, idx) => {
                  const maxCount = top10Points[0].count;
                  const barPct = Math.round(item.count / maxCount * 100);
                  const masteryRate = item.count > 0 ? parseFloat((item.masteredCount / item.count * 100).toFixed(1)) : 0;

                  return (
                    <motion.div
                      key={`${item.moduleId}-${item.point}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="px-4 py-3 flex items-center gap-3"
                    >
                      <span className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0",
                        idx < 3 ? "bg-gradient-to-br from-rose-400 to-orange-400" : "bg-slate-300"
                      )}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-bold text-slate-700 truncate">{item.point}</span>
                          <span className="text-[9px] text-slate-400 shrink-0">{item.moduleId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${barPct}%` }}
                              transition={{ duration: 0.5, delay: idx * 0.05 }}
                              className="h-full bg-rose-400 rounded-full"
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 shrink-0">{item.count}题</span>
                          {masteryRate > 0 && (
                            <span className={cn(
                              "text-[9px] px-1 py-0.5 rounded font-medium",
                              masteryRate >= 60 ? "bg-emerald-50 text-emerald-500" :
                              masteryRate >= 30 ? "bg-amber-50 text-amber-500" : "bg-rose-50 text-rose-500"
                            )}>
                              掌握{masteryRate}%
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 各模块详细知识点排行 */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <BookOpen size={15} className="text-indigo-500" /> 各模块细分知识点
            </h2>

            {MAIN_MODULES.map(mod => {
              const points = moduleKnowledgePoints[mod] || [];
              if (points.length === 0) return null;

              const modTotal = points.reduce((s, p) => s + p.count, 0);

              return (
                <div key={mod} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700">{mod}</span>
                      <span className="text-[10px] bg-rose-50 text-rose-500 px-1.5 py-0.5 rounded-full font-medium">
                        {modTotal} 题
                      </span>
                      <span className="text-[10px] text-slate-400">{points.length} 个知识点</span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-50">
                    {points.map((item, idx) => {
                      const masteryRate = item.count > 0 ? parseFloat((item.masteredCount / item.count * 100).toFixed(1)) : 0;
                      const topReasons = Object.entries(item.errorReasons).sort((a, b) => b[1] - a[1]).slice(0, 2);

                      return (
                        <div key={item.point} className="px-4 py-2.5 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0",
                              idx === 0 ? "bg-rose-100 text-rose-500" : "bg-slate-100 text-slate-400"
                            )}>
                              {idx + 1}
                            </span>
                            <span className="text-xs font-medium text-slate-700 flex-1 truncate">{item.point}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-bold text-rose-500">{item.count}</span>
                              <span className="text-[9px] text-slate-300">题</span>
                              {masteryRate > 0 && (
                                <span className={cn(
                                  "text-[9px] px-1 py-0.5 rounded font-medium",
                                  masteryRate >= 60 ? "bg-emerald-50 text-emerald-500" :
                                  masteryRate >= 30 ? "bg-amber-50 text-amber-500" : "bg-rose-50 text-rose-500"
                                )}>
                                  {masteryRate}%
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 进度条 */}
                          <div class="ml-7 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.round(item.count / (points[0]?.count || 1) * 100)}%` }}
                              transition={{ duration: 0.4 }}
                              className="h-full bg-gradient-to-r from-rose-300 to-rose-400 rounded-full"
                            />
                          </div>

                          {/* 错误原因 */}
                          {topReasons.length > 0 && (
                            <div className="ml-7 flex flex-wrap gap-1">
                              {topReasons.map(([r, c]) => (
                                <span key={r} className="text-[9px] bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded">
                                  {r}({c})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
