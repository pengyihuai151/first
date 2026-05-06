import React, { useState, useEffect, useRef } from 'react';
import { AppData, StudyModule, MAIN_MODULES, MODULE_SUB_TOPICS, WrongQuestion, HierarchicalTag } from '../types';
import { storage } from '../lib/storage';
import { Plus, Search, Filter, Camera, X, Trash2, Edit2, Check, BookOpen, Tag, RotateCcw, FileDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import HierarchicalReasonSelector from './HierarchicalReasonSelector';
export default function WrongQuestionBank({ data, onUpdate }: { data: AppData; onUpdate: () => void }) {
  const config = data.config || {
    essayTypes: ['金句', '文章结构', '首尾段'],
    essayTags: ['政治', '社会', '生态', '文化', '经济'],
    noteTags: ['公式', '技巧', '反例', '易错点', '口诀'],
    reasonTags: {}
  };
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingQuestion, setViewingQuestion] = useState<WrongQuestion | null>(null);
  const [filter, setFilter] = useState<StudyModule | '全部'>('全部');
  const [tagFilter, setTagFilter] = useState<string | '全部'>('全部');
  const [reasonFilter, setReasonFilter] = useState<string | '全部'>('全部');
  const [search, setSearch] = useState('');
  const [masteredFilter, setMasteredFilter] = useState<'全部' | '未掌握' | '已掌握'>('未掌握');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const tagScrollRef = useRef<HTMLDivElement>(null);
  const activeTagRef = useRef<HTMLButtonElement>(null);
  const reasonScrollRef = useRef<HTMLDivElement>(null);
  const activeReasonRef = useRef<HTMLButtonElement>(null);

  const [lastUsedSettings, setLastUsedSettings] = useState<{
    moduleId: StudyModule;
    tags: string[];
    reasonTags: string[];
    imageUrls?: string[];
  }>({
    moduleId: MAIN_MODULES[0] as StudyModule,
    tags: [],
    reasonTags: [],
    imageUrls: []
  });

  useEffect(() => {
    setTagFilter('全部');
    setReasonFilter('全部');
  }, [filter]);

  useEffect(() => {
    if (activeTagRef.current && tagScrollRef.current) {
      const container = tagScrollRef.current;
      const item = activeTagRef.current;
      const scrollLeft = item.offsetLeft - container.offsetWidth / 2 + item.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [tagFilter]);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const item = activeRef.current;
      const scrollLeft = item.offsetLeft - container.offsetWidth / 2 + item.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [filter]);

  useEffect(() => {
    if (activeReasonRef.current && reasonScrollRef.current) {
      const container = reasonScrollRef.current;
      const item = activeReasonRef.current;
      const scrollLeft = item.offsetLeft - container.offsetWidth / 2 + item.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [reasonFilter]);

  const [newQuestion, setNewQuestion] = useState<Partial<WrongQuestion>>({
    moduleId: lastUsedSettings.moduleId,
    content: '',
    analysis: '',
    imageUrl: undefined,
    imageUrls: lastUsedSettings.imageUrls || [],
    tags: lastUsedSettings.tags,
    reasonTags: lastUsedSettings.reasonTags
  });

  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Helper to get first-level tag from hierarchical path
  const getFirstLevelTag = (tagPath: string): string => {
    const parts = tagPath.split('-');
    return parts.length > 1 ? parts[0] : tagPath;
  };

  // Get hierarchical reason options for current filter module
  const getHierarchicalReasons = (moduleId: string | StudyModule): HierarchicalTag[] => {
    return config.hierarchicalReasons?.[moduleId as string] || [];
  };

  // Get all reason tags (flattened) for current filter module
  const getAllReasonTags = (moduleId: string | StudyModule): string[] => {
    const hierarchical = getHierarchicalReasons(moduleId);
    return hierarchical.flatMap((t: HierarchicalTag) => 
      [t.name, ...t.children.map((c: HierarchicalTag) => c.name)]
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setNewQuestion(prev => ({ 
              ...prev, 
              imageUrls: [...(prev.imageUrls || []), reader.result as string] 
            }));
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const saveQuestion = async () => {
    if (!newQuestion.content && !(newQuestion.imageUrls?.length) && !newQuestion.imageUrl) {
      alert('请填写题目内容或上传图片');
      return;
    }
    
    try {
      if (editingId) {
        const existing = data.wrongQuestions.find(q => q.id === editingId);
        if (existing) {
          await storage.updateWrongQuestion({
            ...existing,
            moduleId: newQuestion.moduleId as StudyModule,
            content: newQuestion.content || '',
            analysis: newQuestion.analysis || '',
            imageUrl: newQuestion.imageUrls?.[0] || newQuestion.imageUrl,
            imageUrls: newQuestion.imageUrls || [],
            tags: newQuestion.tags || [],
            reasonTags: newQuestion.reasonTags || []
          });
        }
      } else {
        await storage.addWrongQuestion({
          id: uuidv4(),
          moduleId: newQuestion.moduleId as StudyModule,
          content: newQuestion.content || '',
          analysis: newQuestion.analysis || '',
          imageUrl: newQuestion.imageUrls?.[0] || newQuestion.imageUrl,
          imageUrls: newQuestion.imageUrls || [],
          tags: newQuestion.tags || [],
          reasonTags: newQuestion.reasonTags || [],
          createdAt: Date.now()
        });

        // Remember settings for next entry
        setLastUsedSettings({
          moduleId: newQuestion.moduleId as StudyModule,
          tags: newQuestion.tags || [],
          reasonTags: newQuestion.reasonTags || [],
          imageUrls: newQuestion.imageUrls || []
        });
      }
      
      setIsAdding(false);
      setEditingId(null);
      // Reset logic: if we just added, next one should inherit the tags we just saved
      const nextSettings = editingId ? lastUsedSettings : {
        moduleId: newQuestion.moduleId as StudyModule,
        tags: newQuestion.tags || [],
        reasonTags: newQuestion.reasonTags || []
      };

      setNewQuestion({ 
        moduleId: nextSettings.moduleId, 
        content: '', 
        analysis: '', 
        imageUrl: undefined, 
        imageUrls: (editingId ? [] : nextSettings.imageUrls) || [],
        tags: nextSettings.tags, 
        reasonTags: nextSettings.reasonTags 
      });
      onUpdate();
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleEdit = (q: WrongQuestion) => {
    setNewQuestion({
      moduleId: q.moduleId,
      content: q.content,
      analysis: q.analysis,
      imageUrl: q.imageUrl,
      imageUrls: q.imageUrls || (q.imageUrl ? [q.imageUrl] : []),
      tags: q.tags || [],
      reasonTags: q.reasonTags || []
    });
    setEditingId(q.id);
    setIsAdding(true);
  };

  const deleteQuestion = async (id: string) => {
    if (window.confirm('确定要删除这条错题吗？')) {
      await storage.deleteWrongQuestion(id);
      onUpdate();
    }
  };

  const filteredQuestions = data.wrongQuestions
    .filter(q => filter === '全部' || q.moduleId === filter)
    .filter(q => masteredFilter === '全部' || (masteredFilter === '已掌握' ? q.mastered : !q.mastered))
    .filter(q => tagFilter === '全部' || tagFilter === '全部知识点' || q.tags?.includes(tagFilter))
    .filter(q => {
      if (reasonFilter === '全部') return true;
      // Check if question's reason matches the selected filter (supports hierarchical)
      const allTags = getAllReasonTags(q.moduleId);
      if (allTags.includes(reasonFilter)) {
        // Filter by first-level category if selected tag is a child
        const firstLevel = getFirstLevelTag(reasonFilter);
        return q.reasonTags?.some(rt => {
          const rtFirstLevel = getFirstLevelTag(rt);
          return rtFirstLevel === firstLevel || rt === firstLevel;
        }) || false;
      }
      return true;
    })
    .filter(q => q.content.includes(search) || (q.analysis && q.analysis.includes(search)))
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-6 pb-6">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-40 bg-slate-50 pt-2 -mx-4 px-4 pb-4 space-y-4">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">错题复盘</h1>
            <p className="text-sm text-slate-500">温故而知新，攻克薄弱环节。</p>
          </div>
          <button 
            onClick={() => {
              setEditingId(null);
              setNewQuestion({ 
                moduleId: lastUsedSettings.moduleId, 
                content: '', 
                analysis: '', 
                imageUrl: undefined, 
                tags: [...lastUsedSettings.tags], 
                reasonTags: [...lastUsedSettings.reasonTags] 
              });
              setIsAdding(true);
            }}
            className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors"
          >
            <Plus size={24} />
          </button>
        </header>

        {/* Search & Filter */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="搜索内容或解析..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-100 rounded-2xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-shadow"
              />
            </div>
            <div className="flex bg-white rounded-2xl border border-slate-100 p-1">
              {(['未掌握', '已掌握', '全部'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setMasteredFilter(tab)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all",
                    masteredFilter === tab ? "bg-slate-800 text-white shadow-sm" : "text-slate-400"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div 
            ref={scrollRef}
            className="-mx-4 px-4 overflow-x-auto no-scrollbar"
          >
            <div className="flex gap-2 pb-1 min-w-max">
              {['全部', ...MAIN_MODULES].map(m => (
                <button
                  key={m}
                  ref={filter === m ? activeRef : null}
                  onClick={() => setFilter(m as any)}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
                    filter === m 
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100" 
                      : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-topic (Tag) Filter */}
          {filter !== '全部' && (MODULE_SUB_TOPICS[filter as string] || []).length > 0 && (
            <div ref={tagScrollRef} className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {['全部知识点', ...(MODULE_SUB_TOPICS[filter as string] || [])].map(tag => (
                <button
                  key={tag}
                  ref={tagFilter === tag ? activeTagRef : null}
                  onClick={() => setTagFilter(tag)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all border",
                    tagFilter === tag || (tag === '全部知识点' && tagFilter === '全部')
                      ? "bg-indigo-500 text-white border-indigo-500 shadow-sm" 
                      : "bg-white text-slate-400 border-slate-100"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Reason Tag Filter - Hierarchical */}
          {filter !== '全部' && (() => {
            const hierarchicalReasons = getHierarchicalReasons(filter as string);
            const flatTags = hierarchicalReasons.flatMap((t: HierarchicalTag) => 
              [t.name, ...t.children.map((c: HierarchicalTag) => c.name)]
            );
            
            if (flatTags.length === 0) return null;
            
            return (
              <div ref={reasonScrollRef} className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button
                  key="全部"
                  ref={reasonFilter === '全部' ? activeReasonRef : null}
                  onClick={() => setReasonFilter('全部')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all border shrink-0",
                    reasonFilter === '全部' 
                      ? "bg-rose-500 text-white border-rose-500 shadow-sm" 
                      : "bg-white text-slate-400 border-slate-100"
                  )}
                >
                  全部原因
                </button>
                {hierarchicalReasons.map(t => (
                  <button
                    key={t.name}
                    ref={reasonFilter === t.name ? activeReasonRef : null}
                    onClick={() => setReasonFilter(t.name)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all border shrink-0",
                      reasonFilter === t.name
                        ? "bg-rose-500 text-white border-rose-500 shadow-sm" 
                        : "bg-white text-slate-400 border-slate-100"
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* List Content */}
      <div className="space-y-4">
        {filteredQuestions.length > 0 ? (
          filteredQuestions.map(q => (
            <div key={q.id} className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm group">
              {(q.imageUrls && q.imageUrls.length > 0) ? (
                <div className="h-48 overflow-hidden bg-slate-50 border-b border-slate-50 flex gap-1 p-1">
                  {q.imageUrls.map((url, idx) => (
                    <div key={idx} className={cn("relative", q.imageUrls!.length === 1 ? "w-full" : "flex-1")}>
                      <img 
                        src={url} 
                        alt="Wrong question" 
                        className="w-full h-full object-contain cursor-pointer" 
                        onClick={(e) => { e.stopPropagation(); setActivePreviewImage(url); }} 
                      />
                    </div>
                  ))}
                </div>
              ) : q.imageUrl && (
                <div className="h-48 overflow-hidden bg-slate-50 border-b border-slate-50">
                  <img 
                    src={q.imageUrl} 
                    alt="Wrong question" 
                    className="w-full h-full object-contain cursor-pointer" 
                    onClick={(e) => { e.stopPropagation(); setActivePreviewImage(q.imageUrl || null); }}
                  />
                </div>
              )}
              <div 
                className="p-5 active:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => setViewingQuestion(q)}
              >
                <div className="flex justify-between items-start mb-3">
                   <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider">
                      {q.moduleId}
                    </span>
                    {q.mastered && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded uppercase">
                        <Check size={10} /> 已掌握
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => handleEdit(q)}
                      className="p-2 text-slate-300 hover:text-indigo-500 active:bg-indigo-50 active:text-indigo-500 rounded-full transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => deleteQuestion(q.id)}
                      className="p-2 text-slate-300 hover:text-rose-500 active:bg-rose-50 active:text-rose-500 rounded-full transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-1">题目/核心内容</h4>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{q.content}</p>
                  </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {q.tags?.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded-md text-[9px] font-bold">
                            # {tag}
                          </span>
                        ))}
                        {q.reasonTags?.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-rose-50 text-rose-500 rounded-md text-[9px] font-bold">
                            # {tag}
                          </span>
                        ))}
                      </div>
                  {q.analysis && (
                    <div className="pt-2">
                       <p className="text-[11px] text-slate-500 line-clamp-1 italic">解析: {q.analysis}</p>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center">
                  <span className="text-[10px] text-slate-300 font-medium">
                    添加于 {new Date(q.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-[10px] text-indigo-500 font-bold flex items-center gap-1 group-active:translate-x-1 transition-transform">
                    点击复习详情 →
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center space-y-3">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-slate-300">
               <BookOpen size={32} />
            </div>
            <p className="text-slate-400 text-sm italic">暂无对应错题，继续加油！</p>
          </div>
        )}
      </div>

      {/* View Details Modal */}
      <AnimatePresence>
        {viewingQuestion && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 pb-20"
          >
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setViewingQuestion(null)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-20">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase">
                    {viewingQuestion.moduleId}
                  </span>
                  <h3 className="font-bold text-slate-800">错题复盘详情</h3>
                </div>
                <button onClick={() => setViewingQuestion(null)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-full transition-colors">
                   <X size={20}/>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                {(viewingQuestion.imageUrls && viewingQuestion.imageUrls.length > 0) ? (
                  <div className="space-y-2">
                    {viewingQuestion.imageUrls.map((url, idx) => (
                      <div key={idx} className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 cursor-pointer" onClick={() => setActivePreviewImage(url)}>
                        <img src={url} alt={`Question image ${idx + 1}`} className="w-full h-auto max-h-96 object-contain" />
                      </div>
                    ))}
                  </div>
                ) : viewingQuestion.imageUrl && (
                  <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 cursor-pointer" onClick={() => setActivePreviewImage(viewingQuestion.imageUrl || null)}>
                    <img src={viewingQuestion.imageUrl} alt="Wrong question" className="w-full h-auto max-h-96 object-contain" />
                  </div>
                )}
                
                <div className="space-y-4">
                  <section>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                       <div className="w-1 h-3 bg-indigo-500 rounded-full" /> 题目/核心内容
                    </h4>
                    <p className="text-base text-slate-800 leading-relaxed font-medium whitespace-pre-wrap">
                      {viewingQuestion.content}
                    </p>
                  </section>

                  {((viewingQuestion.tags?.length || 0) > 0 || (viewingQuestion.reasonTags?.length || 0) > 0) && (
                    <section>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                         <Tag size={10} className="text-rose-500" /> 知识点与报错原因
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {viewingQuestion.tags?.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-indigo-50 text-indigo-500 rounded-lg text-[11px] font-bold border border-indigo-100">
                            # {tag}
                          </span>
                        ))}
                        {viewingQuestion.reasonTags?.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-rose-50 text-rose-500 rounded-lg text-[11px] font-bold border border-rose-100">
                            # {tag}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {viewingQuestion.analysis && (
                    <section className="bg-indigo-50/50 p-5 rounded-[24px] border border-indigo-100/50">
                      <h4 className="text-[10px] font-bold text-indigo-500 uppercase mb-3 flex items-center gap-2 leading-none">
                         <div className="w-1 h-3 bg-indigo-500 rounded-full" /> 复盘解析
                      </h4>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-white/50 p-3 rounded-xl border border-indigo-50 italic">
                        {viewingQuestion.analysis}
                      </p>
                    </section>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 bg-slate-50/30">
                <span>录入日期: {new Date(viewingQuestion.createdAt).toLocaleDateString()}</span>
                <button 
                  onClick={() => {
                    handleEdit(viewingQuestion);
                    setViewingQuestion(null);
                  }}
                  className="text-indigo-600 font-bold px-4 py-2 bg-indigo-50 rounded-full active:scale-95 transition-all"
                >
                  去编辑修改
                </button>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={async () => {
                    await storage.updateWrongQuestion({ ...viewingQuestion, mastered: !viewingQuestion.mastered });
                    setViewingQuestion(prev => prev ? { ...prev, mastered: !prev.mastered } : null);
                    onUpdate();
                  }}
                  className={cn(
                    "flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                    viewingQuestion.mastered 
                      ? "bg-slate-200 text-slate-500" 
                      : "bg-emerald-600 text-white shadow-lg shadow-emerald-100"
                  )}
                >
                  {viewingQuestion.mastered ? <RotateCcw size={16} /> : <Check size={16} />}
                  {viewingQuestion.mastered ? '标记为未掌握' : '标记为已掌握'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 pb-24"
          >
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAdding(false)} />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-800">{editingId ? '编辑错题' : '新增错题'}</h3>
                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 p-2"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">所属模块</label>
                  <div className="flex flex-wrap gap-2">
                    {MAIN_MODULES.map(m => (
                      <button
                        key={m}
                        onClick={() => setNewQuestion(prev => ({ ...prev, moduleId: m }))}
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                          newQuestion.moduleId === m 
                            ? "bg-indigo-600 text-white border-indigo-600" 
                            : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">题目/考点内容</label>
                  <textarea 
                    value={newQuestion.content}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 min-h-[100px] outline-none"
                    placeholder="请输入写错的题目或考点..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                     <Tag size={10} /> 细分知识点 (必选)
                  </label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(MODULE_SUB_TOPICS[newQuestion.moduleId as string] || []).map(tag => {
                      const isSelected = newQuestion.tags?.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            const current = newQuestion.tags || [];
                            const next = isSelected 
                              ? current.filter(t => t !== tag)
                              : [...current, tag];
                            setNewQuestion(prev => ({ ...prev, tags: next }));
                          }}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all border",
                            isSelected 
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                              : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                          )}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                     <Tag size={10} /> 错误诱因 (分级选择)
                  </label>
                  <HierarchicalReasonSelector 
                    options={config.hierarchicalReasons?.[newQuestion.moduleId as string] || []}
                    selectedTags={newQuestion.reasonTags || []}
                    onChange={(tags) => setNewQuestion(prev => ({ ...prev, reasonTags: tags }))}
                  />
                  {(!config.hierarchicalReasons?.[newQuestion.moduleId as string] || config.hierarchicalReasons?.[newQuestion.moduleId as string]?.length === 0) && (
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-50 mt-2">
                       <label className="text-[9px] font-bold text-slate-300 w-full mb-1">或选择基础标签：</label>
                       {(config.reasonTags[newQuestion.moduleId as string] || []).map(tag => {
                         const isSelected = newQuestion.reasonTags?.includes(tag);
                         return (
                           <button
                             key={tag}
                             onClick={() => {
                               const current = newQuestion.reasonTags || [];
                               const next = isSelected 
                                 ? current.filter(t => t !== tag)
                                 : [...current, tag];
                               setNewQuestion(prev => ({ ...prev, reasonTags: next }));
                             }}
                             className={cn(
                               "px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all border",
                               isSelected 
                                 ? "bg-rose-50 text-rose-500 border-rose-100 shadow-sm" 
                                 : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                             )}
                           >
                             {tag}
                           </button>
                         );
                       })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">个人复盘/思路</label>
                  <textarea 
                    value={newQuestion.analysis}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, analysis: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 min-h-[80px] outline-none"
                    placeholder="分析错误原因或解题步骤..."
                  />
                </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">添加配图（可多选）</label>
                    <div className="grid grid-cols-3 gap-3">
                       <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl h-24 cursor-pointer hover:border-indigo-400 transition-colors bg-slate-50">
                         <Camera className="text-slate-300" size={24} />
                         <span className="text-[10px] text-slate-400 font-bold mt-1">上传照片</span>
                         <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                       </label>
                       {(newQuestion.imageUrls || []).map((url, idx) => (
                         <div key={idx} className="relative group h-24">
                           <img src={url} className="w-full h-full object-cover rounded-2xl border border-slate-100" />
                           <button 
                             onClick={() => setNewQuestion(prev => ({ 
                               ...prev, 
                               imageUrls: (prev.imageUrls || []).filter((_, i) => i !== idx) 
                             }))}
                             className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-lg"
                           >
                             <X size={12} />
                           </button>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
              <div className="p-6 bg-slate-50/50 border-t border-slate-100 italic">
                <button 
                  onClick={saveQuestion}
                  disabled={!newQuestion.content}
                  className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-bold shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  <Check size={18} /> {editingId ? '保存修改' : '保存错题卡'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Image Preview Lightbox */}
      <AnimatePresence>
        {activePreviewImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-4"
            onClick={() => setActivePreviewImage(null)}
          >
            <button 
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              onClick={() => setActivePreviewImage(null)}
            >
              <X size={24} />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={activePreviewImage} 
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
