import React, { useState } from 'react';
import { AppData, MAIN_MODULES, StudyModule, AppConfig } from '../types';
import { storage } from '../lib/storage';
import { FileDown, Database, Trash2, Calendar, AlertCircle, Info, ChevronRight, Check, Quote, BookOpen, Tag, X, Target, Brain, GitBranch, ClipboardList, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { cn, formatDuration } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function SettingsPage({ data, onUpdate, onNavigate }: { data: AppData; onUpdate: () => void; onNavigate: (tab: any) => void }) {
  const config = data.config || {
    essayTypes: ['金句', '文章结构', '首尾段'],
    essayTags: ['政治', '社会', '生态', '文化', '经济'],
    noteTags: ['公式', '技巧', '反例', '易错点', '口诀']
  };

  const [editingConfigType, setEditingConfigType] = useState<keyof AppConfig | null>(null);
  const [newTagValue, setNewTagValue] = useState('');

  const updateConfig = async (newConfig: AppConfig) => {
    await storage.saveData({
      ...data,
      config: newConfig
    });
    onUpdate();
  };

  const addTag = (type: keyof AppConfig) => {
    if (!newTagValue.trim()) return;
    
    const currentTags = (config[type] as string[]);
    if (currentTags.includes(newTagValue.trim())) {
        alert('标签已存在');
        return;
    }
    const updated = { ...config, [type]: [...currentTags, newTagValue.trim()] };
    updateConfig(updated);
    setNewTagValue('');
  };

  const removeTag = (type: keyof AppConfig, tag: string) => {
    const updated = { ...config, [type]: (config[type] as string[]).filter(t => t !== tag) };
    updateConfig(updated);
  };

  const ALL_NOTE_MODULES = [...MAIN_MODULES, StudyModule.ESSAY];
  const [exportOptions, setExportOptions] = useState({
    stats: true,
    wrong: true,
    notes: true
  });
  const [isExporting, setIsExporting] = useState<boolean | string>(false);

  const setExamDate = async (date: string) => {
    await storage.saveData({
      ...data,
      settings: { ...data.settings, examDate: date }
    });
    onUpdate();
  };

  const setModuleTarget = async (moduleId: string, value: number) => {
    const targets = { ...(data.settings.moduleTargets || {}) };
    targets[moduleId] = value;
    await storage.updateSettings({
      ...data.settings,
      moduleTargets: targets
    });
    onUpdate();
  };

  const exportPDF = async (type: 'xingce' | 'shenlun' = 'xingce') => {
    if (type === 'xingce' && !exportOptions.stats && !exportOptions.wrong && !exportOptions.notes) {
      alert('请至少选择一个导出项');
      return;
    }
    
    setIsExporting(type);
    
    // Crucial: Wait for React to re-render the template with the new 'isExporting' state
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const reportElement = document.getElementById('report-template');
      if (!reportElement) {
        throw new Error('Report template not found');
      }

      // Temporarily mark the template for the specific type
      reportElement.setAttribute('data-export-type', type);

      // Prepare template visibility
      reportElement.style.display = 'block';
      reportElement.style.position = 'fixed';
      reportElement.style.left = '0';
      reportElement.style.top = '0';
      reportElement.style.zIndex = '-9999';
      
      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true
      });

      reportElement.style.display = 'none';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 10;
      const imgWidth = pdfWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - (margin * 2));

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - (margin * 2));
      }

      const fileName = type === 'xingce' ? '行测备考个人总结' : '申论备考精华汇总';
      pdf.save(`${fileName}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      console.error('Export failed:', e);
      alert('导出 PDF 失败，请确保网络正常并重试');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          await storage.importData(content);
          onUpdate();
          alert('数据导入成功');
        } catch {
          alert('导入失败，不兼容的文件');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleBackup = () => {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfig, setResetConfig] = useState(false);

  const resetData = async () => {
    if (resetConfig) {
      await storage.resetAll();
    } else {
      const currentData = await storage.getData();
      await storage.saveData({
        sessions: [],
        wrongQuestions: [],
        notes: [],
        settings: currentData.settings,
        config: currentData.config
      });
    }
    window.location.reload();
  };

  return (
    <div className="space-y-6 pb-6 text-slate-800">
      {/* 快捷入口 */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase px-1">快捷入口</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('exam')}
            className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col gap-3 hover:border-indigo-200 transition-colors active:scale-95"
          >
            <div className="bg-indigo-50 w-fit p-2 rounded-xl text-indigo-500">
              <ClipboardList size={20} />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold">考试录入</div>
              <div className="text-[10px] text-slate-400">录入模考成绩</div>
            </div>
          </button>
          <button
            onClick={() => onNavigate('notes')}
            className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col gap-3 hover:border-amber-200 transition-colors active:scale-95"
          >
            <div className="bg-amber-50 w-fit p-2 rounded-xl text-amber-500">
              <FileText size={20} />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold">笔记管理</div>
              <div className="text-[10px] text-slate-400">查看学习笔记</div>
            </div>
          </button>
        </div>
      </div>

      {/* Hidden Report Template (Using basic hex colors to avoid oklch errors) */}
      <div id="report-template" style={{ display: 'none', width: '800px', padding: '60px', background: '#ffffff', color: '#1e293b', fontFamily: 'sans-serif', lineBreak: 'anywhere' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#0f172a', marginBottom: '10px' }}>
            {isExporting === 'shenlun' ? '申论备考精华汇总报告' : '行测备考阶段性总结报告'}
          </h1>
          <div style={{ height: '4px', width: '60px', background: '#4f46e5', margin: '0 auto', borderRadius: '2px' }}></div>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '15px' }}>生成时间: {new Date().toLocaleString()}</p>
        </div>
        
        {/* Stats Section */}
        {exportOptions.stats && (
          <section style={{ marginBottom: '50px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#334155', background: '#f8fafc', padding: '12px 20px', borderRadius: '12px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #f1f5f9' }}>
               <span style={{ width: '6px', height: '18px', background: '#4f46e5', borderRadius: '3px' }}></span>
               学习投入统计 ({isExporting === 'shenlun' ? '申论' : '行测'})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '0 10px' }}>
               {(isExporting === 'shenlun' ? [StudyModule.ESSAY] : MAIN_MODULES).map(m => {
                  const ms = data.sessions.filter(s => s.moduleId === m).reduce((acc, s) => acc + s.duration, 0);
                  const totalAll = data.sessions.reduce((acc, s) => acc + s.duration, 0);
                  const pct = totalAll > 0 ? Math.round((ms / totalAll) * 100) : 0;
                  
                  if (isExporting === 'shenlun' && ms === 0) {
                    return <p key={m} style={{ color: '#94a3b8', fontSize: '14px' }}>暂无申论学习记录</p>;
                  }

                  return (
                    <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ width: '80px', fontWeight: 'bold', fontSize: '14px', color: '#1e293b' }}>{m}</div>
                      <div style={{ flex: 1, background: '#f1f5f9', height: '16px', borderRadius: '8px', overflow: 'hidden' }}>
                         <div style={{ background: isExporting === 'shenlun' ? '#10b981' : '#4f46e5', height: '100%', width: `${Math.max(pct, 2)}%`, borderRadius: '8px' }}></div>
                      </div>
                      <div style={{ width: '120px', fontSize: '13px', color: '#64748b', textAlign: 'right', fontWeight: '500' }}>
                        {formatDuration(ms)} ({pct}%)
                      </div>
                    </div>
                  );
               })}
            </div>
          </section>
        )}

        {/* Wrong Questions Section */}
        {exportOptions.wrong && (
          <section style={{ marginBottom: '50px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#334155', background: '#f8fafc', padding: '12px 20px', borderRadius: '12px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #f1f5f9' }}>
               <span style={{ width: '6px', height: '18px', background: '#e11d48', borderRadius: '3px' }}></span>
               {isExporting === 'shenlun' ? '申论典型错案复盘' : '行测高频易错题集'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {(() => {
                const filteredWrong = data.wrongQuestions.filter(q => 
                  isExporting === 'shenlun' ? q.moduleId === StudyModule.ESSAY : MAIN_MODULES.includes(q.moduleId as any)
                ).slice(-50).reverse();

                if (filteredWrong.length === 0) return <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '20px' }}>暂无相关记录</p>;

                if (isExporting === 'xingce') {
                  return MAIN_MODULES.map(m => {
                    const moduleQs = filteredWrong.filter(q => q.moduleId === m);
                    if (moduleQs.length === 0) return null;

                    // Group by knowledge point (题型/知识点)
                    const groupedByTag: Record<string, typeof moduleQs> = {};
                    moduleQs.forEach(q => {
                      const tag = q.tags && q.tags.length > 0 ? q.tags[0] : '其他题型';
                      if (!groupedByTag[tag]) groupedByTag[tag] = [];
                      groupedByTag[tag].push(q);
                    });

                    // Sort tags alphabetically
                    const sortedEntries = Object.entries(groupedByTag).sort(([a], [b]) => a.localeCompare(b));

                    return (
                      <div key={m} style={{ marginBottom: '40px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', background: '#f1f5f9', padding: '10px 15px', borderRadius: '8px', marginBottom: '25px', borderLeft: '4px solid #4f46e5' }}>
                          {m} 模块
                        </h3>
                        {sortedEntries.map(([tagName, questions]) => (
                          <div key={tagName} style={{ marginBottom: '35px', paddingLeft: '10px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#4f46e5', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                               <span style={{ width: '4px', height: '14px', background: '#4f46e5', borderRadius: '2px' }}></span>
                               题型：{tagName}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', paddingLeft: '15px' }}>
                              {questions.map(q => (
                                <div key={q.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
                                  {/* Multi-image support */}
                                  {((q.imageUrls && q.imageUrls.length > 0) || q.imageUrl) && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '15px', background: '#f8fafc', padding: '10px', borderRadius: '12px', justifyContent: 'center' }}>
                                      {(q.imageUrls || (q.imageUrl ? [q.imageUrl] : [])).map((url, idx) => (
                                        <img 
                                          key={idx} 
                                          src={url} 
                                          alt={`Question image ${idx+1}`} 
                                          style={{ 
                                            maxWidth: (q.imageUrls?.length || 1) > 1 ? '48%' : '100%', 
                                            maxHeight: '300px', 
                                            objectFit: 'contain',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0'
                                          }} 
                                        />
                                      ))}
                                    </div>
                                  )}
                                  <div style={{ fontSize: '15px', color: '#1e293b', marginBottom: '12px', lineHeight: '1.6', fontWeight: '500', whiteSpace: 'pre-wrap' }}>{q.content}</div>
                                  {q.analysis && (
                                    <div style={{ background: '#fffbeb', padding: '15px', borderRadius: '12px', fontSize: '14px', color: '#475569', borderLeft: '4px solid #f59e0b' }}>
                                        <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#b45309' }}>复盘解析:</span>
                                        {q.analysis}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  });
                } else {
                  // Shenlun Grouping by Tags (申论专题)
                  const allTags = Array.from(new Set(filteredWrong.flatMap(q => q.tags || ['未分类'])));
                  
                  return allTags.map(tag => {
                    const tagQs = filteredWrong.filter(q => 
                      (tag === '未分类' ? (!q.tags || q.tags.length === 0) : q.tags?.includes(tag))
                    );
                    if (tagQs.length === 0) return null;

                    return (
                      <div key={tag} style={{ marginBottom: '40px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#b45309', background: '#fffbeb', padding: '8px 15px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #f59e0b' }}>
                          # {tag} 类型错案
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', paddingLeft: '10px' }}>
                          {tagQs.map(q => (
                            <div key={q.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
                              {q.imageUrl && (
                                <div style={{ marginBottom: '15px', background: '#f8fafc', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                                    <img src={q.imageUrl} alt="Wrong question" style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }} />
                                </div>
                              )}
                              <div style={{ fontSize: '15px', color: '#1e293b', marginBottom: '12px', lineHeight: '1.6', fontWeight: '500', whiteSpace: 'pre-wrap' }}>{q.content}</div>
                              {q.analysis && (
                                <div style={{ background: '#f0fdf4', padding: '15px', borderRadius: '12px', fontSize: '14px', color: '#166534', borderLeft: '4px solid #22c55e' }}>
                                    <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#15803d' }}>深度复盘解析:</span>
                                    {q.analysis}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                }
              })()}
            </div>
          </section>
        )}

        {/* Notes Section */}
        {exportOptions.notes && (
          <section>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#334155', background: '#f8fafc', padding: '12px 20px', borderRadius: '12px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #f1f5f9' }}>
               <span style={{ width: '6px', height: '18px', background: '#059669', borderRadius: '3px' }}></span>
               {isExporting === 'shenlun' ? '申论精华考点笔记' : '行测高频考点汇总'}
            </h2>
            
            {(isExporting === 'shenlun' ? [StudyModule.ESSAY] : MAIN_MODULES).map(module => {
              const moduleNotes = data.notes.filter(n => n.moduleId === module);
              if (moduleNotes.length === 0) return null;

              return (
                <div key={module} style={{ marginBottom: '40px', padding: '0 10px' }}>
                  <h3 style={{ fontSize: '17px', fontWeight: 'bold', borderLeft: '4px solid #4f46e5', paddingLeft: '12px', marginBottom: '20px', color: '#0f172a' }}>{module} 模块精华</h3>
                  
                  {module === StudyModule.ESSAY ? (
                    // Essay Categorization: Type -> Tag
                    config.essayTypes.concat('其他').map(type => {
                      const typeNotes = moduleNotes.filter(n => (type === '其他' ? !n.essayType : n.essayType === type));
                      if (typeNotes.length === 0) return null;
                      
                      const tags = config.essayTags;
                      
                      return (
                        <div key={type} style={{ marginBottom: '25px', paddingLeft: '15px' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: 'bold', color: '#6366f1', marginBottom: '12px', borderBottom: '2px solid #eef2ff', paddingBottom: '6px' }}>● {type}</h4>
                          
                          {tags.map(tag => {
                            const tagNotes = typeNotes.filter(n => n.essayTag === tag);
                            if (tagNotes.length === 0) return null;
                            return (
                              <div key={tag} style={{ marginBottom: '15px', paddingLeft: '12px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#d97706', marginBottom: '8px', opacity: 0.8 }}># {tag} 专题</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  {tagNotes.map(n => (
                                    <div key={n.id} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '6px' }}>{n.title}</div>
                                      <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{n.content}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Untagged Essay Notes */}
                          {(() => {
                            const untaggedNotes = typeNotes.filter(n => !n.essayTag);
                            if (untaggedNotes.length === 0) return null;
                            return (
                              <div style={{ marginBottom: '15px', paddingLeft: '12px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', marginBottom: '8px' }}># 其他专题</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  {untaggedNotes.map(n => (
                                    <div key={n.id} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', marginBottom: '6px' }}>{n.title}</div>
                                      <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{n.content}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })
                  ) : (
                    // Regular Module Notes - Group by tags
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '15px' }}>
                      {config.noteTags.concat('未分类').map(tag => {
                        const tagNotes = moduleNotes.filter(n => (tag === '未分类' ? (!n.tags || n.tags.length === 0) : n.tags?.includes(tag)));
                        if (tagNotes.length === 0) return null;
                        return (
                          <div key={tag} style={{ marginBottom: '15px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tag !== '未分类' ? `[ ${tag} ]` : '[ 基础记录 ]'}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {tagNotes.map(n => (
                                <div key={n.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                                  <h4 style={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '6px', fontSize: '14px' }}>{n.title}</h4>
                                  <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{n.content}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        <div style={{ marginTop: '60px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
          报告由「公考助手」APP 自动生成 • 专注备考，功不唐捐。
        </div>
      </div>
      <header>
        <h1 className="text-2xl font-bold">系统设置</h1>
        <p className="text-sm text-slate-500">管理备份、导出及基本设置。</p>
      </header>

      {/* Exam Date */}
      <section className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
          <Calendar size={14} /> 考试倒计时设置
        </h3>
        <div className="flex gap-3">
          <input 
            type="date"
            value={data.settings.examDate || ''}
            onChange={(e) => setExamDate(e.target.value)}
            className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </section>

      {/* Module Targets Extension */}
      <section className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
          <Target size={14} /> 模块目标正确率设置
        </h3>
        <div className="space-y-4">
          {MAIN_MODULES.map(m => (
            <div key={m} className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-slate-700">{m}</span>
                <span className="text-xs font-black text-indigo-600">
                  {Math.round((data.settings.moduleTargets?.[m] || 0.8) * 100)}%
                </span>
              </div>
              <input 
                type="range"
                min="0"
                max="100"
                step="5"
                value={(data.settings.moduleTargets?.[m] || 0.8) * 100}
                onChange={(e) => setModuleTarget(m, Number(e.target.value) / 100)}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          ))}
          <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-2xl">
            <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              智能建议会根据您的实时表现与这些目标值的差距，动态调整复习优先级和改进提示。
            </p>
          </div>
        </div>
      </section>

      {/* Export Options */}
      <section className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
          <FileDown size={14} /> 备考报告分流导出
        </h3>
        
        <div className="grid grid-cols-2 gap-3 mb-2">
          <button 
            onClick={() => exportPDF('xingce')}
            disabled={!!isExporting}
            className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex flex-col items-center gap-2 active:scale-95 transition-all text-indigo-600 disabled:opacity-50"
          >
            {isExporting === 'xingce' ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent" /> : <FileDown size={24} />}
            <span className="text-[11px] font-bold">导出行测报告</span>
          </button>
          
          <button 
            onClick={() => exportPDF('shenlun')}
            disabled={!!isExporting}
            className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex flex-col items-center gap-2 active:scale-95 transition-all text-emerald-600 disabled:opacity-50"
          >
            {isExporting === 'shenlun' ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-600 border-t-transparent" /> : <BookOpen size={24} />}
            <span className="text-[11px] font-bold">导出申论精华</span>
          </button>
        </div>

        <div className="pt-4 border-t border-slate-50 space-y-3">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">导出报告包含内容</h4>
          <div className="grid grid-cols-3 gap-2">
              <button 
                  onClick={() => setExportOptions(prev => ({...prev, stats: !prev.stats}))}
                  className={cn(
                      "py-2.5 rounded-xl border text-[10px] font-bold transition-all flex items-center justify-center gap-1.5",
                      exportOptions.stats ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white border-slate-200 text-slate-400"
                  )}
              >
                  {exportOptions.stats && <Check size={10} />} 学习统计
              </button>
              <button 
                  onClick={() => setExportOptions(prev => ({...prev, wrong: !prev.wrong}))}
                  className={cn(
                      "py-2.5 rounded-xl border text-[10px] font-bold transition-all flex items-center justify-center gap-1.5",
                      exportOptions.wrong ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white border-slate-200 text-slate-400"
                  )}
              >
                  {exportOptions.wrong && <Check size={10} />} 错题复盘
              </button>
              <button 
                  onClick={() => setExportOptions(prev => ({...prev, notes: !prev.notes}))}
                  className={cn(
                      "py-2.5 rounded-xl border text-[10px] font-bold transition-all flex items-center justify-center gap-1.5",
                      exportOptions.notes ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white border-slate-200 text-slate-400"
                  )}
              >
                  {exportOptions.notes && <Check size={10} />} 备考笔记
              </button>
          </div>
        </div>
      </section>

      {/* Quotes Management Link */}
      <section className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
        <button 
          onClick={() => onNavigate('quotes')}
          className="w-full flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
              <Quote size={20} />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-slate-800">语录池管理</h3>
              <p className="text-[10px] text-slate-400">目前已有 {data.settings.quotes?.length || 0} 条语录</p>
            </div>
          </div>
          <div className="text-slate-300 group-active:text-indigo-500 transition-colors">
            <ChevronRight size={20} />
          </div>
        </button>
      </section>

      {/* Tag Management */}
      <section className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
          <Tag size={14} /> 标签与分类管理
        </h3>
        
        <div className="space-y-3">
          {[
            { id: 'essayTypes', label: '申论内容分类', color: 'indigo' },
            { id: 'essayTags', label: '申论专题标签', color: 'emerald' },
            { id: 'noteTags', label: '行测笔记标签', color: 'blue' }
          ].map(group => (
            <div key={group.id} className="border border-slate-50 rounded-2xl overflow-hidden">
              <button 
                onClick={() => setEditingConfigType(editingConfigType === group.id as any ? null : group.id as any)}
                className="w-full px-4 py-3 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-1.5 h-3 rounded-full",
                    group.color === 'indigo' ? "bg-indigo-500" :
                    group.color === 'emerald' ? "bg-emerald-500" : "bg-blue-500"
                  )} />
                  <span className="text-sm font-bold text-slate-700">{group.label}</span>
                  <span className="text-[10px] bg-white border border-slate-100 text-slate-400 px-1.5 py-0.5 rounded-md">
                    {(config[group.id as keyof AppConfig] as string[]).length} 个
                  </span>
                </div>
                <ChevronRight size={16} className={cn("text-slate-300 transition-transform", editingConfigType === group.id && "rotate-90")} />
              </button>
              
              <AnimatePresence>
                {editingConfigType === group.id && (
                  <motion.div 
                    initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="overflow-hidden bg-white"
                  >
                    <div className="p-4 space-y-4">
                      {/* Add New Tag */}
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={newTagValue}
                          onChange={(e) => setNewTagValue(e.target.value)}
                          placeholder={`添加新${group.label.slice(-2)}...`}
                          className="flex-1 bg-slate-50 border-none rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-slate-200 outline-none"
                          onKeyDown={(e) => e.key === 'Enter' && addTag(group.id as any)}
                        />
                        <button 
                          onClick={() => addTag(group.id as any)}
                          className="bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
                        >
                          添加
                        </button>
                      </div>
                      
                      {/* Tag List */}
                      <div className="flex flex-wrap gap-2">
                        {(config[group.id as keyof AppConfig] as string[]).map(tag => (
                          <div 
                            key={tag}
                            className="bg-slate-50 text-slate-600 px-2.5 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border border-slate-100 group"
                          >
                            {tag}
                            <button 
                              onClick={() => removeTag(group.id as any, tag)}
                              className="text-slate-300 hover:text-rose-500 transition-colors"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* Backup & Restore */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase px-1">数据备份</h3>
        <div className="grid grid-cols-2 gap-3">
            <button 
                onClick={handleBackup}
                className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col gap-3 hover:border-slate-200 transition-colors"
            >
                <div className="bg-slate-50 w-fit p-2 rounded-xl text-slate-500">
                    <Database size={20} />
                </div>
                <div className="text-left">
                    <div className="text-sm font-bold">备份数据</div>
                    <div className="text-[10px] text-slate-400">导出 .json 文件</div>
                </div>
            </button>
            <label className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col gap-3 hover:border-slate-200 transition-colors cursor-pointer">
                <div className="bg-slate-50 w-fit p-2 rounded-xl text-slate-500">
                    <FileDown size={20} className="rotate-180" />
                </div>
                <div className="text-left">
                    <div className="text-sm font-bold">恢复数据</div>
                    <div className="text-[10px] text-slate-400">从文件导入</div>
                </div>
                <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
        </div>
      </div>

      {/* Safety */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase px-1">危险区域</h3>
        {!showResetConfirm ? (
          <button 
            onClick={() => setShowResetConfirm(true)}
            className="w-full bg-rose-50 text-rose-600 p-4 rounded-2xl border border-rose-100 flex items-center justify-between group active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <Trash2 size={20} />
              <div className="text-left">
                <div className="text-sm font-bold">重置全部数据</div>
                <div className="text-[10px] opacity-70">不可撤销，请谨慎操作</div>
              </div>
            </div>
            <ChevronRight size={16} className="opacity-30" />
          </button>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-rose-50 border border-rose-200 p-5 rounded-3xl space-y-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="text-rose-600 shrink-0" size={24} />
              <div>
                <h4 className="text-sm font-bold text-rose-900">确定要重置吗？</h4>
                <p className="text-xs text-rose-700 mt-1">此操作将永久删除您的学习记录、错题和笔记。</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-white/50 rounded-xl">
              <input 
                type="checkbox" 
                id="resetConfig"
                checked={resetConfig}
                onChange={(e) => setResetConfig(e.target.checked)}
                className="w-4 h-4 rounded border-rose-200 text-rose-600 focus:ring-rose-500"
              />
              <label htmlFor="resetConfig" className="text-xs font-bold text-rose-800">
                同时重置自定义标签配置 (恢复默认)
              </label>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={resetData}
                className="flex-1 bg-rose-600 text-white py-3 rounded-2xl text-xs font-bold shadow-lg shadow-rose-200 active:scale-95 transition-all"
              >
                确认重置
              </button>
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 bg-white text-slate-600 py-3 rounded-2xl text-xs font-bold border border-rose-100 active:scale-95 transition-all"
              >
                取消
              </button>
            </div>
          </motion.div>
        )}
      </section>

      {/* About */}
      <div className="p-8 text-center space-y-2 opacity-50">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400">
          <Info size={12} /> 公考个人自用版 v1.0
        </div>
        <p className="text-[10px]">纯本地存储 • 无广告 • 极简备考</p>
      </div>
    </div>
  );
}
