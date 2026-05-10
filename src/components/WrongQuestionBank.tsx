import React, { useState, useEffect, useRef } from 'react';
import { AppData, StudyModule, MAIN_MODULES, MODULE_SUB_TOPICS, WrongQuestion } from '../types';
import { storage } from '../lib/storage';
import { Plus, Search, Filter, X, Trash2, Edit2, Check, BookOpen, Tag, RotateCcw, ArrowLeft, Image as ImageIcon, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { cn, compressImage } from '../lib/utils';

export default function WrongQuestionBank({
  data,
  onUpdate,
  examId,
  onBack
}: {
  data: AppData;
  onUpdate: () => void;
  examId?: string;
  onBack?: () => void;
}) {
  const config = data.config || {
    essayTypes: ['金句', '文章结构', '首尾段'],
    essayTags: ['政治', '社会', '生态', '文化', '经济'],
    noteTags: ['公式', '技巧', '反例', '易错点', '口诀']
  };
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingQuestion, setViewingQuestion] = useState<WrongQuestion | null>(null);
  const [filter, setFilter] = useState<StudyModule | '全部'>('全部');
  const [tagFilter, setTagFilter] = useState<string | '全部'>('全部');
  const [search, setSearch] = useState('');
  const [masteredFilter, setMasteredFilter] = useState<'全部' | '未掌握' | '已掌握'>('未掌握');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const tagScrollRef = useRef<HTMLDivElement>(null);
  const activeTagRef = useRef<HTMLButtonElement>(null);

  // 记住上次使用的设置
  const [lastUsedSettings, setLastUsedSettings] = useState<{
    moduleId: StudyModule;
    tags: string[];
    errorReason: string;
  }>({
    moduleId: MAIN_MODULES[0] as StudyModule,
    tags: [],
    errorReason: ''
  });

  useEffect(() => {
    setTagFilter('全部');
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

  const [newQuestion, setNewQuestion] = useState<Partial<WrongQuestion>>({
    moduleId: lastUsedSettings.moduleId,
    analysis: '',
    tags: lastUsedSettings.tags,
    errorReason: lastUsedSettings.errorReason,
    images: []
  });
  const [customErrorReasonInput, setCustomErrorReasonInput] = useState('');
  
  // 图片相关状态
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // 大图预览
  const [viewerScale, setViewerScale] = useState(1); // 图片查看器缩放
  const [viewerPosition, setViewerPosition] = useState({ x: 0, y: 0 }); // 图片查看器位置
  const [viewerIsDragging, setViewerIsDragging] = useState(false); // 是否在拖拽
  const [viewerDragStart, setViewerDragStart] = useState({ x: 0, y: 0 }); // 拖拽起始位置
  const [viewerLastDistance, setViewerLastDistance] = useState(0); // 双指缩放上次距离
  const [cropperState, setCropperState] = useState<{ image: string; callback: (cropped: string) => void } | null>(null); // 裁剪状态

  // 获取当前选中的细分知识点（取第一个选中的，或者没有子模块就用模块名）
  // 图片查看器 - 重置状态
  const resetViewerState = () => {
    setViewerScale(1);
    setViewerPosition({ x: 0, y: 0 });
    setViewerIsDragging(false);
    setViewerLastDistance(0);
  };

  // 图片查看器 - 鼠标/触摸事件
  const viewerGetDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const viewerGetTouchPoint = (e: React.TouchEvent) => ({ x: e.touches[0].clientX, y: e.touches[0].clientY });

  const viewerMouseDown = (e: React.MouseEvent) => {
    if (viewerScale > 1) {
      setViewerIsDragging(true);
      setViewerDragStart({ x: e.clientX - viewerPosition.x, y: e.clientY - viewerPosition.y });
    }
  };

  const viewerMouseMove = (e: React.MouseEvent) => {
    if (viewerIsDragging) {
      setViewerPosition({ x: e.clientX - viewerDragStart.x, y: e.clientY - viewerDragStart.y });
    }
  };

  const viewerMouseUp = () => {
    setViewerIsDragging(false);
  };

  const viewerWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(1, Math.min(10, viewerScale * delta));
    setViewerScale(newScale);
    if (newScale === 1) {
      setViewerPosition({ x: 0, y: 0 });
    }
  };

  const viewerTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && viewerScale > 1) {
      setViewerIsDragging(true);
      setViewerDragStart({ x: e.touches[0].clientX - viewerPosition.x, y: e.touches[0].clientY - viewerPosition.y });
    } else if (e.touches.length === 2) {
      const p1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const p2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      setViewerLastDistance(viewerGetDistance(p1, p2));
    }
  };

  const viewerTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && viewerIsDragging) {
      setViewerPosition({ x: e.touches[0].clientX - viewerDragStart.x, y: e.touches[0].clientY - viewerDragStart.y });
    } else if (e.touches.length === 2) {
      const p1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const p2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      const distance = viewerGetDistance(p1, p2);
      if (viewerLastDistance > 0) {
        const delta = distance / viewerLastDistance;
        const newScale = Math.max(1, Math.min(10, viewerScale * delta));
        setViewerScale(newScale);
        if (newScale === 1) {
          setViewerPosition({ x: 0, y: 0 });
        }
      }
      setViewerLastDistance(distance);
    }
  };

  const viewerTouchEnd = () => {
    setViewerIsDragging(false);
    setViewerLastDistance(0);
  };

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 处理第一个文件
    const file = files[0];
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const imageDataUrl = e.target?.result as string;
      // 打开裁剪界面
      setCropperState({
        image: imageDataUrl,
        callback: async (croppedImage) => {
          try {
            // 裁剪后的图片再压缩
            // 将 base64 转为 File 对象以便压缩
            const response = await fetch(croppedImage);
            const blob = await response.blob();
            const croppedFile = new File([blob], 'cropped.jpg', { type: 'image/jpeg' });
            
            const compressed = await compressImage(croppedFile, 1000, 0.6);
            
            // 添加到现有图片数组
            setNewQuestion(prev => ({
              ...prev,
              images: [...(prev.images || []), compressed]
            }));
          } catch (error) {
            console.error('图片处理失败:', error);
            alert('图片处理失败，请重试');
          }
        }
      });
    };
    
    // 更新本地 config 立即生效
    setConfig(prev => ({
      ...prev,
      errorReasons: {
        ...(prev.errorReasons || {}),
        [moduleId]: {
          ...((prev.errorReasons || {})[moduleId] || {}),
          [subTopic]: reasons
        }
      }
    }));

    // 清空 input
    e.target.value = '';
  };

  // 删除图片
  const removeImage = (index: number) => {
    setNewQuestion(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index)
    }));
  };

  const getCurrentSubTopic = (): string => {
    if (newQuestion.tags && newQuestion.tags.length > 0) {
      return newQuestion.tags[0];
    }
    // 如果没有子模块，就用模块名作为 key
    return newQuestion.moduleId || 'default';
  };

  // 获取当前模块和细分知识点的错误原因列表（仅自定义，无默认）
  const getCurrentErrorReasons = (): string[] => {
    const moduleId = newQuestion.moduleId || 'default';
    const subTopic = getCurrentSubTopic();
    
    // 从 config 中获取该模块+知识点的自定义错误原因
    const customReasons = data.config?.errorReasons?.[moduleId]?.[subTopic] || [];
    
    return customReasons;
  };

  // 保存新的自定义错误原因
  const addCustomErrorReason = async () => {
    if (!customErrorReasonInput.trim()) {
      alert('请输入错误原因');
      return;
    }

    const moduleId = newQuestion.moduleId || 'default';
    const subTopic = getCurrentSubTopic();
    const newReason = customErrorReasonInput.trim();

    // 更新 config
    const newConfig = { ...data.config } || {};
    if (!newConfig.errorReasons) {
      newConfig.errorReasons = {};
    }
    if (!newConfig.errorReasons[moduleId]) {
      newConfig.errorReasons[moduleId] = {};
    }
    if (!newConfig.errorReasons[moduleId][subTopic]) {
      newConfig.errorReasons[moduleId][subTopic] = [];
    }
    
    // 添加新原因，去重
    if (!newConfig.errorReasons[moduleId][subTopic].includes(newReason)) {
      newConfig.errorReasons[moduleId][subTopic].push(newReason);
    }

    // 保存到 storage
    await storage.saveData({ ...data, config: newConfig });
    onUpdate();

    // 选中这个新原因
    setNewQuestion(prev => ({ ...prev, errorReason: newReason }));
    setCustomErrorReasonInput('');
  };

  const saveQuestion = async () => {
    if (!newQuestion.errorReason) {
      alert('请选择错误原因');
      return;
    }

    try {
      if (editingId) {
        const existing = data.wrongQuestions.find(q => q.id === editingId);
        if (existing) {
          await storage.updateWrongQuestion({
            ...existing,
            moduleId: newQuestion.moduleId as StudyModule,
            analysis: newQuestion.analysis || '',
            tags: newQuestion.tags || [],
            errorReason: newQuestion.errorReason || '',
            images: newQuestion.images || []
          });
        }
      } else {
        await storage.addWrongQuestion({
          id: uuidv4(),
          moduleId: newQuestion.moduleId as StudyModule,
          analysis: newQuestion.analysis || '',
          tags: newQuestion.tags || [],
          errorReason: newQuestion.errorReason || '',
          examId: examId || null,
          createdAt: Date.now(),
          images: newQuestion.images || []
        });
        
        setLastUsedSettings({
          moduleId: newQuestion.moduleId as StudyModule,
          tags: newQuestion.tags || [],
          errorReason: newQuestion.errorReason || ''
        });
      }

      setIsAdding(false);
      setEditingId(null);
      
      // 重置表单
      setNewQuestion({
        moduleId: newQuestion.moduleId as StudyModule,
        analysis: '',
        tags: [...(newQuestion.tags || [])],
        errorReason: '',
        images: []
      });
      setCustomErrorReasonInput('');
      onUpdate();
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleEdit = (q: WrongQuestion) => {
    setNewQuestion({
      moduleId: q.moduleId,
      analysis: q.analysis,
      tags: q.tags || [],
      errorReason: q.errorReason || '',
      images: q.images || []
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
    .filter(q => !examId || q.examId === examId)
    .filter(q => filter === '全部' || q.moduleId === filter)
    .filter(q => masteredFilter === '全部' || (masteredFilter === '已掌握' ? q.mastered : !q.mastered))
    .filter(q => tagFilter === '全部' || tagFilter === '全部知识点' || q.tags?.includes(tagFilter))
    .filter(q => q.analysis && q.analysis.includes(search))
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-6 pb-6">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-40 bg-slate-50 pt-2 -mx-4 px-4 pb-4 space-y-4">
        <header className="flex justify-between items-end">
          <div className="flex items-center gap-3">
            {examId && onBack && (
              <button onClick={onBack} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{examId ? '本场错题' : '错题录入'}</h1>
              <p className="text-sm text-slate-500">{examId ? '记录这场考试的错题' : '快速录入，精准复盘。'}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setEditingId(null);
              setNewQuestion({ 
                moduleId: lastUsedSettings.moduleId, 
                analysis: '',
                tags: [...lastUsedSettings.tags],
                errorReason: ''
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
        </div>
      </div>

      {/* List Content */}
      <div className="space-y-4">
        {filteredQuestions.length > 0 ? (
          filteredQuestions.map(q => (
            <div key={q.id} className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm group">
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
                    {q.errorReason && (
                      <span className="px-1.5 py-0.5 bg-rose-50 text-rose-500 text-[9px] font-bold rounded">
                        {q.errorReason}
                      </span>
                    )}
                    {q.images && q.images.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-500 text-[9px] font-bold rounded flex items-center gap-0.5">
                        <ImageIcon size={10} />
                        {q.images.length}
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
                  <div className="flex flex-wrap gap-1.5 pt-1">
                        {q.tags?.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded-md text-[9px] font-bold">
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
                <div className="space-y-4">
                  <section>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                       <div className="w-1 h-3 bg-indigo-500 rounded-full" /> 知识点标签
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {viewingQuestion.tags?.map(tag => (
                        <span key={tag} className="px-3 py-1 bg-indigo-50 text-indigo-500 rounded-full text-xs font-bold">
                          # {tag}
                        </span>
                      ))}
                    </div>
                  </section>

                  {/* 错误原因 */}
                  {viewingQuestion.errorReason && (
                    <section>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                         <div className="w-1 h-3 bg-rose-500 rounded-full" /> 错误原因
                      </h4>
                      <span className="inline-block px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-sm font-bold border border-rose-100">
                        {viewingQuestion.errorReason}
                      </span>
                    </section>
                  )}

                  {/* 图片显示 */}
                  {viewingQuestion.images && viewingQuestion.images.length > 0 && (
                    <section>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                         <ImageIcon size={10} className="text-indigo-500" /> 错题图片
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {viewingQuestion.images.map((img, index) => (
                          <div 
                            key={index} 
                            className="aspect-square rounded-xl overflow-hidden bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setSelectedImage(img)}
                          >
                            <img src={img} alt={`错题图片 ${index + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {(viewingQuestion.tags?.length || 0) > 0 && (
                    <section>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                         <Tag size={10} className="text-indigo-500" /> 知识点
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {viewingQuestion.tags?.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-indigo-50 text-indigo-500 rounded-lg text-[11px] font-bold border border-indigo-100">
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
                            // 单选：直接设置为这个 tag
                            setNewQuestion(prev => ({ ...prev, tags: [tag] }));
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

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">个人复盘/思路</label>
                  <textarea 
                    value={newQuestion.analysis}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, analysis: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 min-h-[80px] outline-none"
                    placeholder="分析错误原因或解题步骤..."
                  />
                </div>

                {/* 图片上传区域 */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <ImageIcon size={12} /> 图片（可选，多张）
                  </label>
                  
                  {/* 已上传图片预览 */}
                  {newQuestion.images && newQuestion.images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {newQuestion.images.map((img, index) => (
                        <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                          <img 
                            src={img} 
                            alt={`错题图片 ${index + 1}`} 
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedImage(img);
                            }}
                          />
                          <button
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 bg-rose-500 text-white p-0.5 rounded-full hover:bg-rose-600"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* 上传按钮 */}
                  <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:bg-slate-100 hover:border-slate-300 cursor-pointer transition-all">
                    <ImageIcon size={16} />
                    <span>点击添加图片</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[9px] text-slate-400">支持多张，自动压缩，节省空间</p>
                </div>

                {/* 错误原因（手动添加） */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">错误原因（手动添加，按知识点保存）</label>
                  {getCurrentErrorReasons().length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {getCurrentErrorReasons().map(reason => {
                        const isSelected = newQuestion.errorReason === reason;
                        return (
                          <button
                            key={reason}
                            onClick={() => setNewQuestion(prev => ({
                              ...prev,
                              errorReason: isSelected ? '' : reason
                            }))}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all border",
                              isSelected
                                ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                                : "bg-white text-slate-500 border-slate-100 hover:bg-rose-50 hover:border-rose-200"
                            )}
                          >
                            {reason}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic py-1">该知识点暂无已保存的错误原因，请在下方添加</p>
                  )}
                  
                  {/* 自定义错误原因输入 */}
                  <div className="flex gap-2 pt-2">
                    <input 
                      type="text"
                      value={customErrorReasonInput}
                      onChange={(e) => setCustomErrorReasonInput(e.target.value)}
                      placeholder="添加新的错误原因..."
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500/20 outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addCustomErrorReason();
                        }
                      }}
                    />
                    <button 
                      onClick={addCustomErrorReason}
                      className="px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-bold hover:bg-rose-600 transition-colors"
                    >
                      添加
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50/50 border-t border-slate-100 italic">
                <button 
                  onClick={saveQuestion}
                  disabled={!newQuestion.errorReason}
                  className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-bold shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  <Check size={18} /> {editingId ? '保存修改' : '保存错题卡'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 图片查看器 */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/95 flex flex-col"
            onClick={() => {
              setSelectedImage(null);
              resetViewerState();
            }}
          >
            {/* 顶部操作栏 */}
            <div className="flex justify-between items-center p-4 pt-10 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(null);
                  resetViewerState();
                }}
                className="bg-white/20 text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-colors"
              >
                关闭
              </button>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newScale = Math.max(1, viewerScale - 0.5);
                    setViewerScale(newScale);
                    if (newScale === 1) {
                      setViewerPosition({ x: 0, y: 0 });
                    }
                  }}
                  className="bg-white/20 text-white p-2 rounded-lg hover:bg-white/30 transition-colors"
                >
                  <ZoomOut size={20} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewerScale(Math.min(10, viewerScale + 0.5));
                  }}
                  className="bg-white/20 text-white p-2 rounded-lg hover:bg-white/30 transition-colors"
                >
                  <ZoomIn size={20} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    resetViewerState();
                  }}
                  className="bg-white/20 text-white p-2 rounded-lg hover:bg-white/30 transition-colors"
                >
                  <RefreshCw size={20} />
                </button>
              </div>
            </div>

            {/* 图片区域 */}
            <div 
              className="flex-1 flex items-center justify-center overflow-hidden select-none"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={viewerMouseDown}
              onMouseMove={viewerMouseMove}
              onMouseUp={viewerMouseUp}
              onMouseLeave={viewerMouseUp}
              onWheel={viewerWheel}
              onTouchStart={viewerTouchStart}
              onTouchMove={viewerTouchMove}
              onTouchEnd={viewerTouchEnd}
              style={{ cursor: viewerScale > 1 && viewerIsDragging ? 'grabbing' : viewerScale > 1 ? 'grab' : 'default' }}
            >
              <img
                src={selectedImage}
                alt="大图预览"
                className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg transition-transform"
                style={{
                  transform: `translate(${viewerPosition.x}px, ${viewerPosition.y}px) scale(${viewerScale})`,
                  transformOrigin: 'center center'
                }}
                draggable={false}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 图片裁剪弹层 */}
      <AnimatePresence>
        {cropperState && (
          <ImageCropper
            image={cropperState.image}
            onConfirm={(cropped) => {
              cropperState.callback(cropped);
              setCropperState(null);
            }}
            onCancel={() => setCropperState(null)}
          />
        )}
      </AnimatePresence>
    </div>

  );
}

// 简单的图片裁剪组件
function ImageCropper({ image, onConfirm, onCancel }: { image: string; onConfirm: (cropped: string) => void; onCancel: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scalingCorner, setScalingCorner] = useState<string | null>(null); // 'tl' | 'tr' | 'bl' | 'br'
  const [isPinching, setIsPinching] = useState(false);
  const pinchStartRef = useRef({ distance: 0, centerX: 0, centerY: 0, startBoxX: 0, startBoxY: 0, startBoxW: 0, startBoxH: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, startBoxX: 0, startBoxY: 0, startBoxW: 0, startBoxH: 0 });

  // 辅助函数
  const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const getCenter = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  };

  useEffect(() => {
    if (imgRef.current && containerRef.current) {
      const img = imgRef.current;
      const container = containerRef.current;
      
      // 图片加载完成后设置裁剪框（默认居中 80%）
      const setCrop = () => {
        // 等待一下让图片布局完成
        setTimeout(() => {
          if (!imgRef.current || !containerRef.current) return;
          
          const img = imgRef.current;
          const container = containerRef.current;
          const imgRect = img.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          // 计算图片在容器内的位置
          const imgX = imgRect.left - containerRect.left;
          const imgY = imgRect.top - containerRect.top;
          
          // 裁剪框大小（图片的 80%）
          const cropWidth = imgRect.width * 0.8;
          const cropHeight = imgRect.height * 0.8;
          
          setCropBox({
            x: imgX + (imgRect.width - cropWidth) / 2,
            y: imgY + (imgRect.height - cropHeight) / 2,
            width: cropWidth,
            height: cropHeight
          });
        }, 100);
      };
      
      if (img.complete) {
        setCrop();
      } else {
        img.onload = setCrop;
      }
    }
  }, [image]);

  // 处理角落缩放开始
  const handleCornerStart = (corner: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setScalingCorner(corner);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      startBoxX: cropBox.x,
      startBoxY: cropBox.y,
      startBoxW: cropBox.width,
      startBoxH: cropBox.height
    };
  };

  // 拖拽开始（移动整个框）
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    // 如果点击的是角落，不触发移动
    if ((e.target as HTMLElement).closest('.crop-corner')) return;
    
    e.preventDefault();
    setIsDragging(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      startBoxX: cropBox.x,
      startBoxY: cropBox.y,
      startBoxW: cropBox.width,
      startBoxH: cropBox.height
    };
  };

  // 拖拽/缩放中
  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!imgRef.current || !containerRef.current) return;
    
    // 检查是否是双指触摸
    if ('touches' in e && e.touches.length === 2) {
      e.preventDefault();
      
      const touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      const currentDistance = getDistance(touch1, touch2);
      const currentCenter = getCenter(touch1, touch2);
      
      if (!isPinching) {
        // 开始双指缩放
        setIsPinching(true);
        setIsDragging(false);
        setScalingCorner(null);
        pinchStartRef.current = {
          distance: currentDistance,
          centerX: currentCenter.x,
          centerY: currentCenter.y,
          startBoxX: cropBox.x,
          startBoxY: cropBox.y,
          startBoxW: cropBox.width,
          startBoxH: cropBox.height
        };
        return;
      }
      
      // 双指缩放中
      const img = imgRef.current;
      const container = containerRef.current;
      const imgRect = img.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const imgX = imgRect.left - containerRect.left;
      const imgY = imgRect.top - containerRect.top;
      
      // 计算缩放比例
      const scale = currentDistance / pinchStartRef.current.distance;
      
      // 计算新的宽高
      let newW = Math.max(50, pinchStartRef.current.startBoxW * scale);
      let newH = Math.max(50, pinchStartRef.current.startBoxH * scale);
      
      // 计算新的位置（保持中心点不变）
      const centerX = pinchStartRef.current.startBoxX + pinchStartRef.current.startBoxW / 2;
      const centerY = pinchStartRef.current.startBoxY + pinchStartRef.current.startBoxH / 2;
      
      let newX = centerX - newW / 2;
      let newY = centerY - newH / 2;
      
      // 限制边界
      newX = Math.max(imgX, newX);
      newY = Math.max(imgY, newY);
      newW = Math.min(newW, imgX + imgRect.width - newX);
      newH = Math.min(newH, imgY + imgRect.height - newY);
      
      setCropBox({ x: newX, y: newY, width: newW, height: newH });
      return;
    }
    
    // 单指操作
    if (!isDragging && !scalingCorner) return;
    
    e.preventDefault();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const img = imgRef.current;
    const container = containerRef.current;
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const imgX = imgRect.left - containerRect.left;
    const imgY = imgRect.top - containerRect.top;
    
    // 计算移动的距离
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    
    if (scalingCorner) {
      // 缩放模式
      let newX = dragStartRef.current.startBoxX;
      let newY = dragStartRef.current.startBoxY;
      let newW = dragStartRef.current.startBoxW;
      let newH = dragStartRef.current.startBoxH;
      
      // 根据不同角落计算
      if (scalingCorner === 'br') {
        // 右下角：只改宽高
        newW = Math.max(50, dragStartRef.current.startBoxW + deltaX);
        newH = Math.max(50, dragStartRef.current.startBoxH + deltaY);
      } else if (scalingCorner === 'tl') {
        // 左上角：改位置和宽高
        newX = dragStartRef.current.startBoxX + deltaX;
        newY = dragStartRef.current.startBoxY + deltaY;
        newW = Math.max(50, dragStartRef.current.startBoxW - deltaX);
        newH = Math.max(50, dragStartRef.current.startBoxH - deltaY);
      } else if (scalingCorner === 'tr') {
        // 右上角
        newY = dragStartRef.current.startBoxY + deltaY;
        newW = Math.max(50, dragStartRef.current.startBoxW + deltaX);
        newH = Math.max(50, dragStartRef.current.startBoxH - deltaY);
      } else if (scalingCorner === 'bl') {
        // 左下角
        newX = dragStartRef.current.startBoxX + deltaX;
        newW = Math.max(50, dragStartRef.current.startBoxW - deltaX);
        newH = Math.max(50, dragStartRef.current.startBoxH + deltaY);
      }
      
      // 限制边界
      newX = Math.max(imgX, newX);
      newY = Math.max(imgY, newY);
      newW = Math.min(newW, imgX + imgRect.width - newX);
      newH = Math.min(newH, imgY + imgRect.height - newY);
      
      setCropBox({ x: newX, y: newY, width: newW, height: newH });
    } else if (isDragging) {
      // 移动模式
      let newX = dragStartRef.current.startBoxX + deltaX;
      let newY = dragStartRef.current.startBoxY + deltaY;
      
      // 限制边界
      newX = Math.max(imgX, Math.min(newX, imgX + imgRect.width - cropBox.width));
      newY = Math.max(imgY, Math.min(newY, imgY + imgRect.height - cropBox.height));
      
      setCropBox({ ...cropBox, x: newX, y: newY });
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setScalingCorner(null);
    setIsPinching(false);
  };

  // 确认裁剪
  const handleConfirm = () => {
    if (!imgRef.current || !containerRef.current) return;

    const img = imgRef.current;
    const container = containerRef.current;
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // 计算裁剪区域相对于图片的比例
    const imgX = imgRect.left - containerRect.left;
    const imgY = imgRect.top - containerRect.top;

    const cropXRatio = (cropBox.x - imgX) / imgRect.width;
    const cropYRatio = (cropBox.y - imgY) / imgRect.height;
    const cropWRatio = cropBox.width / imgRect.width;
    const cropHRatio = cropBox.height / imgRect.height;

    // 使用 Canvas 裁剪
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 创建临时图片来获取原始尺寸
    const tempImg = new Image();
    tempImg.src = image;
    tempImg.onload = () => {
      const cropX = tempImg.width * cropXRatio;
      const cropY = tempImg.height * cropYRatio;
      const cropW = tempImg.width * cropWRatio;
      const cropH = tempImg.height * cropHRatio;

      canvas.width = cropW;
      canvas.height = cropH;

      ctx.drawImage(tempImg, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      onConfirm(canvas.toDataURL('image/jpeg', 0.9));
    };
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
    >
      {/* 顶部操作栏 */}
      <div className="flex justify-between items-center p-4 pt-10 z-20">
        <button
          onClick={onCancel}
          className="bg-white/20 text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleConfirm}
          className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-600 transition-colors"
        >
          确定裁剪
        </button>
      </div>

      {/* 裁剪区域 */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        <img
          ref={imgRef}
          src={image}
          alt="裁剪图片"
          className="max-w-[90vw] max-h-[70vh] object-contain select-none"
          draggable={false}
        />

        {/* 遮罩层 */}
        <div className="absolute inset-0 pointer-events-none">
          {/* 上 */}
          <div
            className="absolute bg-black/60"
            style={{
              left: 0,
              top: 0,
              right: 0,
              height: cropBox.y
            }}
          />
          {/* 下 */}
          <div
            className="absolute bg-black/60"
            style={{
              left: 0,
              top: cropBox.y + cropBox.height,
              right: 0,
              bottom: 0
            }}
          />
          {/* 左 */}
          <div
            className="absolute bg-black/60"
            style={{
              left: 0,
              top: cropBox.y,
              width: cropBox.x,
              height: cropBox.height
            }}
          />
          {/* 右 */}
          <div
            className="absolute bg-black/60"
            style={{
              left: cropBox.x + cropBox.width,
              top: cropBox.y,
              right: 0,
              height: cropBox.height
            }}
          />
        </div>

        {/* 裁剪框 */}
        <div
          className="absolute border-2 border-white cursor-move"
          style={{
            left: cropBox.x,
            top: cropBox.y,
            width: cropBox.width,
            height: cropBox.height
          }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          {/* 角落缩放手柄 */}
          <div
            className="crop-corner absolute -top-2 -left-2 w-6 h-6 bg-white rounded-full cursor-nwse-resize flex items-center justify-center"
            onMouseDown={(e) => handleCornerStart('tl', e)}
            onTouchStart={(e) => handleCornerStart('tl', e)}
          >
            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
          </div>
          <div
            className="crop-corner absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full cursor-nesw-resize flex items-center justify-center"
            onMouseDown={(e) => handleCornerStart('tr', e)}
            onTouchStart={(e) => handleCornerStart('tr', e)}
          >
            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
          </div>
          <div
            className="crop-corner absolute -bottom-2 -left-2 w-6 h-6 bg-white rounded-full cursor-nesw-resize flex items-center justify-center"
            onMouseDown={(e) => handleCornerStart('bl', e)}
            onTouchStart={(e) => handleCornerStart('bl', e)}
          >
            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
          </div>
          <div
            className="crop-corner absolute -bottom-2 -right-2 w-6 h-6 bg-white rounded-full cursor-nwse-resize flex items-center justify-center"
            onMouseDown={(e) => handleCornerStart('br', e)}
            onTouchStart={(e) => handleCornerStart('br', e)}
          >
            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
