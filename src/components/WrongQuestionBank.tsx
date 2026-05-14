import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppData, StudyModule, MAIN_MODULES, MODULE_SUB_TOPICS, WrongQuestion } from '../types';
import { storage } from '../lib/storage';
import { Plus, Search, Filter, X, Trash2, Edit2, Check, BookOpen, Tag, RotateCcw, ArrowLeft, Image as ImageIcon, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { cn, compressImage } from '../lib/utils';
import ImageCropper from './ImageCropper';

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
  const [reasonFilter, setReasonFilter] = useState<string | '全部'>('全部');
  
  // 收集所有已使用的错误原因
  const allErrorReasons = useMemo(() => {
    const reasons = new Set<string>();
    data.wrongQuestions.forEach(q => {
      if (q.errorReason) reasons.add(q.errorReason);
    });
    return Array.from(reasons).sort();
  }, [data.wrongQuestions]);
  
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<{ type: 'subModule' | 'errorReason'; value: string; newValue: string } | null>(null);
  
  // 图片相关状态
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // 大图预览
  const [viewerScale, setViewerScale] = useState(1); // 图片查看器缩放
  const [viewerPosition, setViewerPosition] = useState({ x: 0, y: 0 }); // 图片查看器位置
  const [viewerIsDragging, setViewerIsDragging] = useState(false); // 是否在拖拽
  const [viewerDragStart, setViewerDragStart] = useState({ x: 0, y: 0 }); // 拖拽起始位置
  const [viewerLastDistance, setViewerLastDistance] = useState(0); // 双指缩放上次距离
  const [cropperState, setCropperState] = useState<{ image: string; callback: (cropped: string) => void } | null>(null); // 裁剪状态

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

  // 判断模块是否有细化模块
  const hasSubModules = (moduleId: string): boolean => {
    if (!moduleId) return false;
    // 有默认细化模块或用户自定义细化模块
    const hasDefault = moduleId in MODULE_SUB_TOPICS && (MODULE_SUB_TOPICS[moduleId]?.length ?? 0) > 0;
    const hasCustom = data?.config?.errorReasons?.[moduleId]?.subModules?.length > 0;
    return hasDefault || hasCustom;
  };

  // 获取当前模块的所有细化模块（包括默认和自定义）
  const getAllSubModules = (): string[] => {
    const moduleId = newQuestion.moduleId || '';
    const defaultSubs = MODULE_SUB_TOPICS[moduleId] || [];
    const customSubs = data?.config?.errorReasons?.[moduleId]?.subModules || [];
    // 合并并去重
    return [...new Set([...defaultSubs, ...customSubs])];
  };

  // 删除图片
  const removeImage = (index: number) => {
    setNewQuestion(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index)
    }));
  };

  // 获取当前细化模块（用于错误原因 key）
  const getCurrentSubTopic = (): string => {
    // 直接使用 subTopic
    return newQuestion.subTopic || newQuestion.moduleId || 'default';
  };

  // 获取当前模块和细化模块的错误原因列表
  const getCurrentErrorReasons = (): string[] => {
    const moduleId = newQuestion.moduleId || '';
    const subTopic = newQuestion.subTopic || '';
    
    // 如果有细化模块但没选择，则返回空数组
    if (hasSubModules(moduleId) && !subTopic) {
      return [];
    }
    
    // 从 config 中获取该模块+细化模块的错误原因
    const customReasons = data.config?.errorReasons?.[moduleId]?.errorReasons?.[subTopic] || [];
    
    return customReasons;
  };

  // 保存新的自定义错误原因
  const addCustomErrorReason = async () => {
    if (!customErrorReasonInput.trim()) {
      alert('请输入错误原因');
      return;
    }

    const moduleId = newQuestion.moduleId || 'default';
    const subTopic = newQuestion.subTopic || '';
    const newReason = customErrorReasonInput.trim();

    // 更新 config（新的三级结构）
    const newConfig = { ...data.config } || {};
    if (!newConfig.errorReasons) {
      newConfig.errorReasons = {};
    }
    if (!newConfig.errorReasons[moduleId]) {
      newConfig.errorReasons[moduleId] = { subModules: [], errorReasons: {} };
    }
    if (!newConfig.errorReasons[moduleId].errorReasons[subTopic]) {
      newConfig.errorReasons[moduleId].errorReasons[subTopic] = [];
    }
    
    // 添加新原因，去重
    if (!newConfig.errorReasons[moduleId].errorReasons[subTopic].includes(newReason)) {
      newConfig.errorReasons[moduleId].errorReasons[subTopic].push(newReason);
    }

    // 保存到 storage
    await storage.saveData({ ...data, config: newConfig });
    onUpdate();

    setCustomErrorReasonInput('');
  };

  // 编辑错误原因
  const handleEditErrorReason = async (oldReason: string, newReason: string) => {
    if (!newQuestion.moduleId) return;
    
    const data = await storage.loadData();
    const newConfig = { ...data.config };
    const subTopic = newQuestion.subTopic || newQuestion.moduleId;
    
    // 更新错误原因
    const reasons = newConfig.errorReasons[newQuestion.moduleId]?.errorReasons?.[subTopic] || [];
    const index = reasons.indexOf(oldReason);
    if (index !== -1) {
      reasons[index] = newReason;
    }
    
    // 更新配置
    if (!newConfig.errorReasons[newQuestion.moduleId]) {
      newConfig.errorReasons[newQuestion.moduleId] = { subModules: [], errorReasons: {} };
    }
    if (!newConfig.errorReasons[newQuestion.moduleId].errorReasons) {
      newConfig.errorReasons[newQuestion.moduleId].errorReasons = {};
    }
    newConfig.errorReasons[newQuestion.moduleId].errorReasons[subTopic] = reasons;
    
    // 如果当前选中的就是这个原因，更新选中值
    if (newQuestion.errorReason === oldReason) {
      setNewQuestion(prev => ({ ...prev, errorReason: newReason }));
    }
    
    await storage.saveData({ ...data, config: newConfig });
    onUpdate();
    setEditingTag(null);
  };

  // 删除错误原因
  const handleDeleteErrorReason = async (reason: string) => {
    if (!newQuestion.moduleId) return;
    
    const data = await storage.loadData();
    const newConfig = { ...data.config };
    const subTopic = newQuestion.subTopic || newQuestion.moduleId;
    
    // 删除错误原因
    const reasons = newConfig.errorReasons[newQuestion.moduleId]?.errorReasons?.[subTopic] || [];
    newConfig.errorReasons[newQuestion.moduleId].errorReasons[subTopic] = reasons.filter(r => r !== reason);
    
    // 如果当前选中的就是这个原因，清除选中
    if (newQuestion.errorReason === reason) {
      setNewQuestion(prev => ({ ...prev, errorReason: '' }));
    }
    
    await storage.saveData({ ...data, config: newConfig });
    onUpdate();
    setShowDeleteConfirm(null);
  };

  // 编辑细化模块
  const handleEditSubModule = async (oldSubModule: string, newSubModule: string) => {
    if (!newQuestion.moduleId) return;
    
    const data = await storage.loadData();
    const newConfig = { ...data.config };
    
    // 更新细化模块列表
    const subModules = newConfig.errorReasons[newQuestion.moduleId]?.subModules || [];
    const index = subModules.indexOf(oldSubModule);
    if (index !== -1) {
      subModules[index] = newSubModule;
    }
    
    // 更新错误原因中的引用
    if (newConfig.errorReasons[newQuestion.moduleId]?.errorReasons?.[oldSubModule]) {
      newConfig.errorReasons[newQuestion.moduleId].errorReasons[newSubModule] = 
        newConfig.errorReasons[newQuestion.moduleId].errorReasons[oldSubModule];
      delete newConfig.errorReasons[newQuestion.moduleId].errorReasons[oldSubModule];
    }
    
    // 更新配置
    if (!newConfig.errorReasons[newQuestion.moduleId]) {
      newConfig.errorReasons[newQuestion.moduleId] = { subModules: [], errorReasons: {} };
    }
    newConfig.errorReasons[newQuestion.moduleId].subModules = subModules;
    
    // 如果当前选中的就是这个细化模块，更新选中值
    if (newQuestion.subTopic === oldSubModule) {
      setNewQuestion(prev => ({ ...prev, subTopic: newSubModule }));
    }
    
    await storage.saveData({ ...data, config: newConfig });
    onUpdate();
    setEditingTag(null);
  };

  // 删除细化模块
  const handleDeleteSubModule = async (subModule: string) => {
    if (!newQuestion.moduleId) return;
    
    const data = await storage.loadData();
    const newConfig = { ...data.config };
    
    // 删除细化模块
    const subModules = newConfig.errorReasons[newQuestion.moduleId]?.subModules || [];
    newConfig.errorReasons[newQuestion.moduleId].subModules = subModules.filter(s => s !== subModule);
    
    // 删除对应的错误原因
    if (newConfig.errorReasons[newQuestion.moduleId]?.errorReasons?.[subModule]) {
      delete newConfig.errorReasons[newQuestion.moduleId].errorReasons[subModule];
    }
    
    // 如果当前选中的就是这个细化模块，清除选中
    if (newQuestion.subTopic === subModule) {
      setNewQuestion(prev => ({ ...prev, subTopic: '', errorReason: '' }));
    }
    
    await storage.saveData({ ...data, config: newConfig });
    onUpdate();
    setShowDeleteConfirm(null);
  };

  const saveQuestion = async () => {
    // 验证：有细化模块的必须选择细化模块
    if (hasSubModules(newQuestion.moduleId || '') && !newQuestion.subTopic) {
      alert('请选择细化模块');
      return;
    }
    if (!newQuestion.errorReason) {
      alert('请选择错误原因');
      return;
    }
    if (!newQuestion.analysis || newQuestion.analysis.trim() === '') {
      alert('请填写个人复盘/思路');
      return;
    }

    try {
      if (editingId) {
        const existing = data.wrongQuestions.find(q => q.id === editingId);
        if (existing) {
          await storage.updateWrongQuestion({
            ...existing,
            moduleId: newQuestion.moduleId as StudyModule,
            subTopic: newQuestion.subTopic || undefined,
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
          subTopic: newQuestion.subTopic || undefined,
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
    .filter(q => tagFilter === '全部' || tagFilter === '全部细化模块' || q.subTopic === tagFilter)
    .filter(q => reasonFilter === '全部' || q.errorReason === reasonFilter)
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

          {/* 细化模块筛选 */}
          {filter !== '全部' && hasSubModules(filter) && (
            <div ref={tagScrollRef} className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                key="全部细化模块"
                ref={tagFilter === '全部细化模块' ? activeTagRef : null}
                onClick={() => setTagFilter('全部细化模块')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all border",
                  tagFilter === '全部细化模块' || tagFilter === '全部'
                    ? "bg-indigo-500 text-white border-indigo-500 shadow-sm" 
                    : "bg-white text-slate-400 border-slate-100"
                )}
              >
                全部
              </button>
              {(MODULE_SUB_TOPICS[filter as string] || []).map(tag => (
                <button
                  key={tag}
                  ref={tagFilter === tag ? activeTagRef : null}
                  onClick={() => setTagFilter(tag)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all border",
                    tagFilter === tag
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

        {/* Error Reason Filter */}
        {allErrorReasons.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <Filter size={12} />
              错误原因
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setReasonFilter('全部')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all border",
                  reasonFilter === '全部'
                    ? "bg-rose-500 text-white border-rose-500 shadow-sm" 
                    : "bg-white text-slate-400 border-slate-100"
                )}
              >
                全部
              </button>
              {allErrorReasons.map(reason => (
                <button
                  key={reason}
                  onClick={() => setReasonFilter(reason)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all border",
                    reasonFilter === reason
                      ? "bg-rose-500 text-white border-rose-500 shadow-sm" 
                      : "bg-white text-slate-400 border-slate-100"
                  )}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        )}
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
                      className="p-2 min-w-[44px] min-h-[44px] text-indigo-400 md:text-slate-300 hover:text-indigo-500 md:hover:text-indigo-500 active:bg-indigo-50 active:text-indigo-500 rounded-full transition-all flex items-center justify-center"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => deleteQuestion(q.id)}
                      className="p-2 min-w-[44px] min-h-[44px] text-rose-400 md:text-slate-300 hover:text-rose-500 md:hover:text-rose-500 active:bg-rose-50 active:text-rose-500 rounded-full transition-all flex items-center justify-center"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {q.subTopic && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded-md text-[9px] font-bold">
                        @ {q.subTopic}
                      </span>
                    </div>
                  )}
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
                  {/* 细化模块 */}
                  {viewingQuestion.subTopic && (
                    <section>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                         <div className="w-1 h-3 bg-indigo-500 rounded-full" /> 细化模块
                      </h4>
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-500 rounded-full text-xs font-bold">
                        @ {viewingQuestion.subTopic}
                      </span>
                    </section>
                  )}

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

                {/* 细化模块选择（如果有） */}
                {hasSubModules(newQuestion.moduleId || '') && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                      <Tag size={10} /> 细化模块
                    </label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {getAllSubModules().map(sub => {
                        const isSelected = newQuestion.subTopic === sub;
                        const isDefault = (MODULE_SUB_TOPICS[newQuestion.moduleId as string] || []).includes(sub);
                        const isEditing = editingTag?.type === 'subModule' && editingTag?.value === sub;
                        
                        return (
                          <div key={sub} className="relative group">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  defaultValue={sub}
                                  className="w-20 px-2 py-1 text-[10px] border border-indigo-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleEditSubModule(sub, (e.target as HTMLInputElement).value);
                                    } else if (e.key === 'Escape') {
                                      setEditingTag(null);
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => handleEditSubModule(sub, (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement)?.value || sub)}
                                  className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingTag(null)}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => setNewQuestion(prev => ({ ...prev, subTopic: sub, errorReason: '' }))}
                                  className={cn(
                                    "pr-7 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border min-h-[28px]",
                                    isSelected 
                                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                                      : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                                  )}
                                >
                                  {sub}
                                </button>
                                {/* 编辑和删除按钮 - 仅对自定义标签显示 */}
                                {!isDefault && (
                                  <div className="absolute top-0 right-0 flex items-center gap-0.5">
                                    <button
                                      onClick={() => setEditingTag({ type: 'subModule', value: sub, newValue: sub })}
                                      className="p-1 text-blue-400 bg-white/90 hover:bg-blue-50 rounded-l-lg min-w-[24px] min-h-[24px] flex items-center justify-center"
                                    >
                                      <Edit2 size={10} />
                                    </button>
                                    <button
                                      onClick={() => setShowDeleteConfirm(`subModule:${sub}`)}
                                      className="p-1 text-rose-400 bg-white/90 hover:bg-rose-50 rounded-r-lg min-w-[24px] min-h-[24px] flex items-center justify-center"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                  <label className="text-[10px] font-bold text-slate-400 uppercase">
                    错误原因 {newQuestion.subTopic ? `@${newQuestion.subTopic}` : `@${newQuestion.moduleId}`}
                  </label>
                  {getCurrentErrorReasons().length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {getCurrentErrorReasons().map(reason => {
                        const isSelected = newQuestion.errorReason === reason;
                        const isEditing = editingTag?.type === 'errorReason' && editingTag?.value === reason;
                        
                        return (
                          <div key={reason} className="relative group">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  defaultValue={reason}
                                  className="w-20 px-2 py-1 text-[10px] border border-rose-300 rounded-lg outline-none focus:ring-1 focus:ring-rose-500"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleEditErrorReason(reason, (e.target as HTMLInputElement).value);
                                    } else if (e.key === 'Escape') {
                                      setEditingTag(null);
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => handleEditErrorReason(reason, (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement)?.value || reason)}
                                  className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingTag(null)}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => setNewQuestion(prev => ({
                                    ...prev,
                                    errorReason: isSelected ? '' : reason
                                  }))}
                                  className={cn(
                                    "pr-7 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border min-h-[28px]",
                                    isSelected
                                      ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                                      : "bg-white text-slate-500 border-slate-100 hover:bg-rose-50 hover:border-rose-200"
                                  )}
                                >
                                  {reason}
                                </button>
                                {/* 编辑和删除按钮 - 移动端默认显示 */}
                                <div className="absolute top-0 right-0 flex items-center gap-0.5">
                                  <button
                                    onClick={() => setEditingTag({ type: 'errorReason', value: reason, newValue: reason })}
                                    className="p-1 text-blue-400 bg-white/90 hover:bg-blue-50 rounded-l-lg min-w-[24px] min-h-[24px] flex items-center justify-center"
                                  >
                                    <Edit2 size={10} />
                                  </button>
                                  <button
                                    onClick={() => setShowDeleteConfirm(reason)}
                                    className="p-1 text-rose-400 bg-white/90 hover:bg-rose-50 rounded-r-lg min-w-[24px] min-h-[24px] flex items-center justify-center"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic py-1">
                      {newQuestion.moduleId
                        ? '该模块暂无已保存的错误原因，请在下方添加'
                        : '请先选择模块'}
                    </p>
                  )}
                  
                  {/* 自定义错误原因输入 */}
                  {newQuestion.moduleId ? (
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
                        disabled={!customErrorReasonInput.trim()}
                        className="px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-bold hover:bg-rose-600 transition-colors disabled:opacity-50"
                      >
                        添加
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* 删除确认弹窗 */}
                {showDeleteConfirm && (
                  <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-[280px] shadow-2xl">
                      <h3 className="text-lg font-bold text-slate-800 mb-2">确认删除</h3>
                      <p className="text-sm text-slate-500 mb-4">
                        确定要删除
                        {showDeleteConfirm.startsWith('subModule:') 
                          ? `细化模块"${showDeleteConfirm.replace('subModule:', '')}"` 
                          : `错误原因"${showDeleteConfirm}"`}
                        吗？
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                        >
                          取消
                        </button>
                        <button
                          onClick={() => {
                            if (showDeleteConfirm.startsWith('subModule:')) {
                              handleDeleteSubModule(showDeleteConfirm.replace('subModule:', ''));
                            } else {
                              handleDeleteErrorReason(showDeleteConfirm);
                            }
                          }}
                          className="flex-1 px-4 py-2.5 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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

