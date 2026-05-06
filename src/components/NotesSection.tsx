import React, { useState, useEffect, useRef } from 'react';
import { AppData, StudyModule, MAIN_MODULES, ExamNote } from '../types';
import { storage } from '../lib/storage';
import { Plus, Search, X, Trash2, Edit2, FileText, ChevronRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const ALL_NOTE_MODULES = [...MAIN_MODULES, StudyModule.ESSAY];

export default function NotesSection({ data, onUpdate }: { data: AppData; onUpdate: () => void }) {
  const config = data.config || {
    essayTypes: ['金句', '文章结构', '首尾段'],
    essayTags: ['政治', '社会', '生态', '文化', '经济'],
    noteTags: ['公式', '技巧', '反例', '易错点', '口诀']
  };

  const [category, setCategory] = useState<'行测' | '申论'>('行测');
  const [editingNote, setEditingNote] = useState<ExamNote | null>(null);
  const [filter, setFilter] = useState<StudyModule | '全部'>('全部');
  
  // Essay specific filters
  const [essayTypeFilter, setEssayTypeFilter] = useState<string>('全部');
  const [essayTagFilter, setEssayTagFilter] = useState<string>('全部');
  
  const [isAdding, setIsAdding] = useState(false);

  // Refs for scrolling
  const scrollModuleRef = useRef<HTMLDivElement>(null);
  const activeModuleRef = useRef<HTMLButtonElement>(null);
  const scrollTypeRef = useRef<HTMLDivElement>(null);
  const activeTypeRef = useRef<HTMLButtonElement>(null);
  const scrollTagRef = useRef<HTMLDivElement>(null);
  const activeTagRef = useRef<HTMLButtonElement>(null);

  const scrollIntoView = (container: HTMLDivElement | null, item: HTMLButtonElement | null) => {
    if (container && item) {
      const scrollLeft = item.offsetLeft - container.offsetWidth / 2 + item.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  };

  useEffect(() => scrollIntoView(scrollModuleRef.current, activeModuleRef.current), [filter]);
  useEffect(() => scrollIntoView(scrollTypeRef.current, activeTypeRef.current), [essayTypeFilter]);
  useEffect(() => scrollIntoView(scrollTagRef.current, activeTagRef.current), [essayTagFilter]);

  const [newNote, setNewNote] = useState<Partial<ExamNote>>({
    moduleId: StudyModule.VERBAL,
    title: '',
    content: '',
    tags: []
  });

  const saveNote = async () => {
    if (!newNote.title?.trim()) {
      alert('请填写笔记标题');
      return;
    }
    if (!newNote.moduleId) {
      alert('请选择所属模块');
      return;
    }
    
    // Validation for ESSAY
    if (newNote.moduleId === StudyModule.ESSAY) {
      if (!newNote.essayType || !newNote.essayTag) {
        alert('请选择类型和专题标签');
        return;
      }
    }
    
    try {
      if (editingNote) {
        await storage.updateNote({
          ...editingNote,
          moduleId: newNote.moduleId as StudyModule,
          title: newNote.title,
          content: newNote.content || '',
          essayType: newNote.essayType,
          essayTag: newNote.essayTag,
          tags: newNote.tags || [],
          updatedAt: Date.now()
        });
      } else {
        await storage.addNote({
          id: uuidv4(),
          moduleId: newNote.moduleId as StudyModule,
          title: newNote.title,
          content: newNote.content || '',
          updatedAt: Date.now(),
          essayType: newNote.essayType,
          essayTag: newNote.essayTag,
          tags: newNote.tags || []
        });
      }
      
      closeModal();
      onUpdate();
    } catch (error) {
      console.error('Save note failed:', error);
      alert('保存失败，请重试');
    }
  };

  const closeModal = () => {
    setIsAdding(false);
    setEditingNote(null);
    setNewNote({ moduleId: category === '行测' ? StudyModule.VERBAL : StudyModule.ESSAY, title: '', content: '' });
  };

  const handleEdit = (note: ExamNote) => {
    setEditingNote(note);
    setCategory(note.moduleId === StudyModule.ESSAY ? '申论' : '行测');
    setNewNote({
      moduleId: note.moduleId,
      title: note.title,
      content: note.content,
      essayType: note.essayType,
      essayTag: note.essayTag,
      tags: note.tags || []
    });
    setIsAdding(true);
  };

  const deleteNote = async (id: string) => {
    if (window.confirm('确定要删除这条笔记吗？')) {
      await storage.deleteNote(id);
      onUpdate();
    }
  };

  const currentModules = category === '行测' ? MAIN_MODULES : [StudyModule.ESSAY];
  
  // Reset filter when switching category
  const handleCategorySwitch = (cat: '行测' | '申论') => {
    setCategory(cat);
    setFilter('全部');
    setEssayTypeFilter('全部');
    setEssayTagFilter('全部');
  };

  const filteredNotes = data.notes
    .filter(n => {
      // First filter by category
      const isEssay = n.moduleId === StudyModule.ESSAY;
      if (category === '行测' && isEssay) return false;
      if (category === '申论' && !isEssay) return false;
      
      // Then filter by specific module (for 行测)
      if (category === '行测') {
        return filter === '全部' || n.moduleId === filter;
      }
      
      // For 申论, filter by type and tag
      if (category === '申论') {
        const typeMatch = essayTypeFilter === '全部' || n.essayType === essayTypeFilter;
        const tagMatch = essayTagFilter === '全部' || n.essayTag === essayTagFilter;
        return typeMatch && tagMatch;
      }
      
      return true;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="space-y-6 pb-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-slate-50 pt-2 -mx-4 px-4 pb-4 space-y-4">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">知识笔记</h1>
            <p className="text-sm text-slate-500">
              {category === '行测' ? '行测考点：积少成多' : '申论金句：妙笔生花'}
            </p>
          </div>
          <button 
            onClick={() => {
              setNewNote(prev => ({ ...prev, moduleId: category === '行测' ? StudyModule.VERBAL : StudyModule.ESSAY }));
              setIsAdding(true);
            }}
            className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-100"
          >
            <Plus size={24} />
          </button>
        </header>

        {/* Category Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => handleCategorySwitch('行测')}
            className={cn(
              "flex-1 py-2 text-sm font-bold rounded-xl transition-all",
              category === '行测' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
            )}
          >
            行测笔记
          </button>
          <button
            onClick={() => handleCategorySwitch('申论')}
            className={cn(
              "flex-1 py-2 text-sm font-bold rounded-xl transition-all",
              category === '申论' ? "bg-white text-amber-600 shadow-sm" : "text-slate-500"
            )}
          >
            申论专属
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {category === '行测' && (
            <div 
              ref={scrollModuleRef}
              className="-mx-4 px-4 overflow-x-auto no-scrollbar"
            >
              <div className="flex gap-2 pb-1 min-w-max">
                {['全部', ...currentModules].map(m => (
                  <button
                    key={m}
                    ref={filter === m ? activeModuleRef : null}
                    onClick={() => setFilter(m as any)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border",
                      filter === m 
                        ? "bg-slate-800 text-white border-slate-800" 
                        : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {category === '申论' && (
            <div className="space-y-2">
                <div 
                  ref={scrollTypeRef}
                  className="-mx-4 px-4 overflow-x-auto no-scrollbar"
                >
                    <div className="flex gap-2 pb-1 items-center min-w-max">
                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">类型:</span>
                        {['全部', ...config.essayTypes].map(t => (
                            <button
                                key={t}
                                ref={essayTypeFilter === t ? activeTypeRef : null}
                                onClick={() => setEssayTypeFilter(t)}
                                className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors border",
                                    essayTypeFilter === t ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-100"
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
                <div 
                  ref={scrollTagRef}
                  className="-mx-4 px-4 overflow-x-auto no-scrollbar"
                >
                    <div className="flex gap-2 pb-1 items-center min-w-max">
                        <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">标签:</span>
                        {['全部', ...config.essayTags].map(t => (
                            <button
                                key={t}
                                ref={essayTagFilter === t ? activeTagRef : null}
                                onClick={() => setEssayTagFilter(t)}
                                className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors border",
                                    essayTagFilter === t ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-500 border-slate-100"
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid of Notes */}
      <div className="grid grid-cols-1 gap-3">
        {filteredNotes.length > 0 ? (
          filteredNotes.map(n => (
            <motion.div 
              layout
              key={n.id} 
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative active:bg-slate-50 transition-colors group"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex flex-wrap gap-1.5 items-center">
                    <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        n.moduleId === StudyModule.ESSAY ? "bg-amber-100 text-amber-700" : "bg-indigo-50 text-indigo-600"
                    )}>
                    {n.moduleId}
                    </span>
                    {n.essayType && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500">
                            {n.essayType}
                        </span>
                    )}
                    {n.essayTag && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600">
                            #{n.essayTag}
                        </span>
                    )}
                    {n.tags && n.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500">
                            #{tag}
                        </span>
                    ))}
                </div>
                <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(n)} className="text-slate-400 p-2 active:bg-indigo-50 active:text-indigo-600 rounded-full">
                        <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteNote(n.id)} className="text-slate-400 p-2 active:bg-rose-50 active:text-rose-500 rounded-full">
                        <Trash2 size={14} />
                    </button>
                </div>
              </div>
              <h3 className="font-bold text-slate-800 mb-2">{n.title}</h3>
              <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                {n.content}
              </p>
              <div className="mt-4 text-[9px] text-slate-300 font-medium font-mono">
                UP: {new Date(n.updatedAt).toLocaleString()}
              </div>
            </motion.div>
          ))
        ) : (
          <div className="py-20 text-center space-y-3">
             <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-slate-300">
               <FileText size={32} />
            </div>
            <p className="text-slate-400 text-sm italic">空空如也，点右上角开始记录吧。</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
            <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
               className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col h-[80vh]"
            >
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-800">{editingNote ? '编辑笔记' : '新建笔记'}</h3>
                    <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">分类专区</label>
                        <div className="flex flex-wrap gap-2">
                            {currentModules.map(m => (
                            <button
                                key={m}
                                onClick={() => setNewNote(prev => ({ ...prev, moduleId: m }))}
                                className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                                newNote.moduleId === m 
                                    ? "bg-indigo-600 text-white border-indigo-600" 
                                    : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                                )}
                            >
                                {m}
                            </button>
                            ))}
                        </div>
                    </div>

                    {newNote.moduleId === StudyModule.ESSAY && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                    类型 <span className="text-rose-500">*</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {config.essayTypes.map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setNewNote(prev => ({ ...prev, essayType: t }))}
                                            className={cn(
                                                "px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                                                newNote.essayType === t ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-100"
                                            )}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                    专题标签 <span className="text-rose-500">*</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {config.essayTags.map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setNewNote(prev => ({ ...prev, essayTag: t }))}
                                            className={cn(
                                                "px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                                                newNote.essayTag === t ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-500 border-slate-100"
                                            )}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {newNote.moduleId !== StudyModule.ESSAY && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">标签 (多选)</label>
                            <div className="flex flex-wrap gap-2">
                                {config.noteTags.map(t => {
                                    const isSelected = newNote.tags?.includes(t);
                                    return (
                                        <button
                                            key={t}
                                            onClick={() => {
                                                const current = newNote.tags || [];
                                                const next = isSelected 
                                                    ? current.filter(tag => tag !== t)
                                                    : [...current, t];
                                                setNewNote(prev => ({ ...prev, tags: next }));
                                            }}
                                            className={cn(
                                                "px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                                                isSelected ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-100"
                                            )}
                                        >
                                            {t}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">标题</label>
                        <input 
                            type="text"
                            value={newNote.title}
                            onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                            placeholder="核心考点名称/金句主题..."
                        />
                    </div>

                    <div className="space-y-2 flex-1 flex flex-col min-h-[300px]">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">笔记正文</label>
                        <textarea 
                            value={newNote.content}
                            onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                            className="w-full flex-1 px-4 py-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none leading-relaxed"
                            placeholder="在此输入公考要点、口诀或写作框架..."
                        />
                    </div>
                </div>
                <div className="p-6 bg-slate-50/50 border-t border-slate-100">
                    <button 
                        onClick={saveNote}
                        disabled={!newNote.title}
                        className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-bold shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                    >
                        保存笔记
                    </button>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
