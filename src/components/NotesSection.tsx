import React, { useState, useEffect, useRef } from 'react';
import { AppData, StudyModule, MAIN_MODULES, ExamNote } from '../types';
import { storage } from '../lib/storage';
import { Plus, Search, X, Trash2, Edit2, FileText, ChevronRight, Eye, BookOpen, Image as ImageIcon, ZoomIn, ZoomOut, RefreshCw, Bold, Highlighter } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { cn, compressImage } from '../lib/utils';

const ALL_NOTE_MODULES = [...MAIN_MODULES, StudyModule.ESSAY];

export default function NotesSection({ data, onUpdate }: { data: AppData; onUpdate: () => void }) {
  const config = data.config || {
    essayTypes: ['金句', '文章结构', '首尾段'],
    essayTags: ['政治', '社会', '生态', '文化', '经济'],
    noteTags: ['公式', '技巧', '反例', '易错点', '口诀']
  };

  const [category, setCategory] = useState<'行测' | '申论'>('行测');
  const [editingNote, setEditingNote] = useState<ExamNote | null>(null);
  const [newNote, setNewNote] = useState<Partial<ExamNote>>({
    moduleId: StudyModule.VERBAL,
    title: '',
    content: '',
    tags: [],
    images: [],
    essayTags: []
  });
  const [selectedNote, setSelectedNote] = useState<ExamNote | null>(null);
  const [filter, setFilter] = useState<StudyModule | '全部'>('全部');
  // 行测笔记细分筛选
  const [subModuleFilter, setSubModuleFilter] = useState<string>('全部');
  const [knowledgePointFilter, setKnowledgePointFilter] = useState<string>('全部');
  
  // Essay specific filters
  const [essayTypeFilter, setEssayTypeFilter] = useState<string>('全部');
  const [essayTagFilter, setEssayTagFilter] = useState<string>('全部');
  
  const [isAdding, setIsAdding] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // 大图预览
  const [viewerScale, setViewerScale] = useState(1); // 图片查看器缩放
  const [viewerPosition, setViewerPosition] = useState({ x: 0, y: 0 }); // 图片查看器位置
  const [viewerIsDragging, setViewerIsDragging] = useState(false); // 是否在拖拽
  const [viewerDragStart, setViewerDragStart] = useState({ x: 0, y: 0 }); // 拖拽起始位置
  const [viewerLastDistance, setViewerLastDistance] = useState(0); // 双指缩放上次距离
  const [searchQuery, setSearchQuery] = useState(''); // 搜索关键词
  const [cropperState, setCropperState] = useState<{ image: string; callback: (cropped: string) => void } | null>(null); // 裁剪状态

  // Refs for scrolling
  const scrollModuleRef = useRef<HTMLDivElement>(null);
  const activeModuleRef = useRef<HTMLButtonElement>(null);
  const scrollSubModuleRef = useRef<HTMLDivElement>(null);
  const activeSubModuleRef = useRef<HTMLButtonElement>(null);
  const scrollKnowledgeRef = useRef<HTMLDivElement>(null);
  const activeKnowledgeRef = useRef<HTMLButtonElement>(null);
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
    } else if (e.touches.length === 2 && viewerLastDistance > 0) {
      const p1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const p2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      const currentDistance = viewerGetDistance(p1, p2);
      const delta = currentDistance / viewerLastDistance;
      const newScale = Math.max(1, Math.min(10, viewerScale * delta));
      setViewerScale(newScale);
      setViewerLastDistance(currentDistance);
      if (newScale === 1) {
        setViewerPosition({ x: 0, y: 0 });
      }
    }
  };

  const viewerTouchEnd = () => {
    setViewerIsDragging(false);
    setViewerLastDistance(0);
  };

  useEffect(() => scrollIntoView(scrollModuleRef.current, activeModuleRef.current), [filter]);
  useEffect(() => scrollIntoView(scrollTypeRef.current, activeTypeRef.current), [essayTypeFilter]);
  useEffect(() => scrollIntoView(scrollTagRef.current, activeTagRef.current), [essayTagFilter]);

  // 获取当前模块的标签配置
  const getCurrentNoteTags = () => {
    if (!newNote.moduleId || newNote.moduleId === StudyModule.ESSAY) {
      return { subModules: [] as string[], knowledgePoints: {} as Record<string, string[]> };
    }
    return data.config?.noteTags?.[newNote.moduleId] || { subModules: [], knowledgePoints: {} };
  };

  // 添加细化模块
  const handleAddSubModule = async (moduleId: string, subModule: string) => {
    if (!subModule.trim()) return;
    const trimmed = subModule.trim();
    const noteTags = { ...(data.config?.noteTags || {}) };
    if (!noteTags[moduleId]) {
      noteTags[moduleId] = { subModules: [], knowledgePoints: {} };
    }
    if (!noteTags[moduleId].subModules.includes(trimmed)) {
      noteTags[moduleId].subModules.push(trimmed);
      noteTags[moduleId].knowledgePoints[trimmed] = [];
    }
    await storage.saveData({
      ...data,
      config: { ...data.config, noteTags }
    });
    onUpdate();
  };

  // 修改细化模块名称
  const handleEditSubModule = async (moduleId: string, oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName.trim()) return;
    const trimmed = newName.trim();
    const noteTags = { ...(data.config?.noteTags || {}) };
    if (!noteTags[moduleId]) return;
    
    const index = noteTags[moduleId].subModules.indexOf(oldName);
    if (index === -1) return;
    
    // 更新 subModules
    noteTags[moduleId].subModules[index] = trimmed;
    
    // 更新 knowledgePoints 中的 key
    if (noteTags[moduleId].knowledgePoints[oldName]) {
      noteTags[moduleId].knowledgePoints[trimmed] = [...noteTags[moduleId].knowledgePoints[oldName]];
      delete noteTags[moduleId].knowledgePoints[oldName];
    }
    
    await storage.saveData({
      ...data,
      config: { ...data.config, noteTags }
    });
    onUpdate();
  };

  // 删除细化模块
  const handleDeleteSubModule = async (moduleId: string, subModule: string) => {
    if (!confirm(`确定要删除细化模块"${subModule}"及其下的所有知识点吗？`)) return;
    const noteTags = { ...(data.config?.noteTags || {}) };
    if (!noteTags[moduleId]) return;
    
    // 删除 subModule
    noteTags[moduleId].subModules = noteTags[moduleId].subModules.filter(s => s !== subModule);
    
    // 删除对应的知识点
    delete noteTags[moduleId].knowledgePoints[subModule];
    
    await storage.saveData({
      ...data,
      config: { ...data.config, noteTags }
    });
    onUpdate();
  };

  // 添加知识点（属于当前细化模块）
  const handleAddKnowledgePoint = async (moduleId: string, subModule: string, kp: string) => {
    if (!kp.trim()) return;
    const trimmed = kp.trim();
    const noteTags = { ...(data.config?.noteTags || {}) };
    if (!noteTags[moduleId]) {
      noteTags[moduleId] = { subModules: [], knowledgePoints: {} };
    }
    if (!noteTags[moduleId].knowledgePoints[subModule]) {
      noteTags[moduleId].knowledgePoints[subModule] = [];
    }
    if (!noteTags[moduleId].knowledgePoints[subModule].includes(trimmed)) {
      noteTags[moduleId].knowledgePoints[subModule].push(trimmed);
    }
    await storage.saveData({
      ...data,
      config: { ...data.config, noteTags }
    });
    onUpdate();
  };

  // 修改知识点名称
  const handleEditKnowledgePoint = async (moduleId: string, subModule: string, oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName.trim()) return;
    const trimmed = newName.trim();
    const noteTags = { ...(data.config?.noteTags || {}) };
    if (!noteTags[moduleId]?.knowledgePoints[subModule]) return;
    
    const index = noteTags[moduleId].knowledgePoints[subModule].indexOf(oldName);
    if (index === -1) return;
    
    noteTags[moduleId].knowledgePoints[subModule][index] = trimmed;
    
    await storage.saveData({
      ...data,
      config: { ...data.config, noteTags }
    });
    onUpdate();
  };

  // 删除知识点
  const handleDeleteKnowledgePoint = async (moduleId: string, subModule: string, kp: string) => {
    if (!confirm(`确定要删除知识点"${kp}"吗？`)) return;
    const noteTags = { ...(data.config?.noteTags || {}) };
    if (!noteTags[moduleId]?.knowledgePoints[subModule]) return;
    
    noteTags[moduleId].knowledgePoints[subModule] = noteTags[moduleId].knowledgePoints[subModule].filter(k => k !== kp);
    
    await storage.saveData({
      ...data,
      config: { ...data.config, noteTags }
    });
    onUpdate();
  };

  const [newSubModule, setNewSubModule] = useState('');
  const [newKnowledgePoint, setNewKnowledgePoint] = useState('');
  
  // 编辑状态
  const [editingSubModule, setEditingSubModule] = useState<string | null>(null);
  const [editingKnowledgePoint, setEditingKnowledgePoint] = useState<{ subModule: string; name: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // 行测笔记标签
  const [selectedSubModule, setSelectedSubModule] = useState<string | null>(null);
  const [selectedKnowledgePoints, setSelectedKnowledgePoints] = useState<string[]>([]);

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
      if (!newNote.essayType) {
        alert('请选择类型');
        return;
      }
      if (!newNote.essayTags || newNote.essayTags.length === 0) {
        alert('请至少选择一个标签');
        return;
      }
    }
    
    // 行测笔记验证：有细化模块则必选，知识点多选必选
    if (newNote.moduleId !== StudyModule.ESSAY) {
      const currentNoteTags = data.config?.noteTags?.[newNote.moduleId || ''];
      const hasSubModules = currentNoteTags?.subModules && currentNoteTags.subModules.length > 0;
      const hasKnowledgePoints = currentNoteTags?.knowledgePoints?.[selectedSubModule || ''] && 
                                currentNoteTags.knowledgePoints[selectedSubModule || ''].length > 0;
      
      // 如果有细化模块，则必选
      if (hasSubModules && !selectedSubModule) {
        alert('请选择细化模块');
        return;
      }
      
      // 如果有知识点，则必选至少一个
      if (hasKnowledgePoints && selectedKnowledgePoints.length === 0) {
        alert('请至少选择一个知识点');
        return;
      }
    }
    
    // 行测笔记：将细化模块和知识点合并到 tags
    const noteTags: string[] = [];
    if (selectedSubModule) noteTags.push(selectedSubModule);
    noteTags.push(...selectedKnowledgePoints);
    
    try {
      if (editingNote) {
        await storage.updateNote({
          ...editingNote,
          moduleId: newNote.moduleId as StudyModule,
          title: newNote.title,
          content: newNote.content || '',
          essayType: newNote.essayType,
          essayTags: newNote.essayTags || [],
          tags: noteTags,
          images: newNote.images || [],
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
          essayTags: newNote.essayTags || [],
          tags: noteTags,
          images: newNote.images || []
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
    setNewNote({ moduleId: category === '行测' ? StudyModule.VERBAL : StudyModule.ESSAY, title: '', content: '', tags: [], images: [], essayTags: [] });
    setSelectedSubModule(null);
    setSelectedKnowledgePoints([]);
    setNewSubModule('');
    setNewKnowledgePoint('');
  };

  const handleEdit = (note: ExamNote) => {
    setEditingNote(note);
    setCategory(note.moduleId === StudyModule.ESSAY ? '申论' : '行测');
    // 兼容旧数据：如果是 essayTag 单个字符串，转换成 essayTags 数组
    let convertedEssayTags: string[] = [];
    if (note.essayTags && Array.isArray(note.essayTags)) {
      convertedEssayTags = note.essayTags;
    } else if (note.essayTag) {
      convertedEssayTags = [note.essayTag];
    }
    // 解析 tags：第一个是细化模块，后续都是知识点（数组）
    const tags = note.tags || [];
    setSelectedSubModule(tags[0] || null);
    setSelectedKnowledgePoints(tags.slice(1)); // 知识点是多选，取除第一个外的所有
    setNewNote({
      moduleId: note.moduleId,
      title: note.title,
      content: note.content,
      essayType: note.essayType,
      essayTags: convertedEssayTags,
      tags: note.tags || [],
      images: note.images || []
    });
    setIsAdding(true);
  };

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 处理第一个文件（多个文件先不支持裁剪，后续可扩展）
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
            setNewNote(prev => ({
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
    
    // 清空 input
    e.target.value = '';
  };

  // 删除图片
  const removeImage = (index: number) => {
    setNewNote(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index)
    }));
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
    setSubModuleFilter('全部');
    setKnowledgePointFilter('全部');
    setEssayTypeFilter('全部');
    setEssayTagFilter('全部');
  };

  // 获取当前模块的细化模块列表
  const getCurrentSubModules = (): string[] => {
    if (filter === '全部' || filter === StudyModule.ESSAY) return [];
    const config = data.config.noteTags[filter];
    return config?.subModules || [];
  };

  // 获取当前细化模块的知识点列表
  const getCurrentKnowledgePoints = (): string[] => {
    if (filter === '全部' || filter === StudyModule.ESSAY || subModuleFilter === '全部') return [];
    const config = data.config.noteTags[filter];
    return config?.knowledgePoints?.[subModuleFilter] || [];
  };

  const filteredNotes = data.notes
    .filter(n => {
      // First filter by category
      const isEssay = n.moduleId === StudyModule.ESSAY;
      if (category === '行测' && isEssay) return false;
      if (category === '申论' && !isEssay) return false;
      
      // Then filter by specific module (for 行测)
      let passModuleFilter = true;
      if (category === '行测') {
        passModuleFilter = filter === '全部' || n.moduleId === filter;
        
        // 细化模块筛选
        if (passModuleFilter && subModuleFilter !== '全部') {
          passModuleFilter = (n.tags || []).includes(subModuleFilter);
        }
        
        // 知识点筛选
        if (passModuleFilter && knowledgePointFilter !== '全部') {
          passModuleFilter = (n.tags || []).includes(knowledgePointFilter);
        }
      }
      
      // For 申论, filter by type and tag
      let passTypeTagFilter = true;
      if (category === '申论') {
        const typeMatch = essayTypeFilter === '全部' || n.essayType === essayTypeFilter;
        const tagMatch = essayTagFilter === '全部' || (n.essayTags || []).includes(essayTagFilter);
        passTypeTagFilter = typeMatch && tagMatch;
      }
      
      // 搜索过滤
      let passSearchFilter = true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        passSearchFilter = (
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          (n.tags || []).some(tag => tag.toLowerCase().includes(q)) ||
          (n.essayType && n.essayType.toLowerCase().includes(q)) ||
          (n.essayTags || []).some(tag => tag.toLowerCase().includes(q))
        );
      }
      
      return passModuleFilter && passTypeTagFilter && passSearchFilter;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="space-y-6 pb-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-slate-50 pt-2 -mx-4 px-4 pb-4 space-y-4">
        <header className="flex justify-between items-end">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800">知识笔记</h1>
            <p className="text-xs text-slate-500">
              {category === '行测' ? '行测考点：积少成多' : '申论金句：妙笔生花'}
            </p>
          </div>
          
          {/* 搜索框 */}
          <div className="flex-1 max-w-xs relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索笔记..."
              className="w-full pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
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
              "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
              category === '行测' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
            )}
          >
            行测笔记
          </button>
          <button
            onClick={() => handleCategorySwitch('申论')}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
              category === '申论' ? "bg-white text-amber-600 shadow-sm" : "text-slate-500"
            )}
          >
            申论专属
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {category === '行测' && (
            <>
              {/* 模块筛选 */}
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
              
              {/* 细化模块筛选 */}
              {filter !== '全部' && getCurrentSubModules().length > 0 && (
                <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
                  <div className="flex gap-2 pb-1 min-w-max">
                    <button
                      onClick={() => setSubModuleFilter('全部')}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                        subModuleFilter === '全部'
                          ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                          : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                      )}
                    >
                      全部细化
                    </button>
                    {getCurrentSubModules().map(sm => (
                      <button
                        key={sm}
                        onClick={() => {
                          setSubModuleFilter(sm);
                          setKnowledgePointFilter('全部');
                        }}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                          subModuleFilter === sm
                            ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                            : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                        )}
                      >
                        {sm}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 知识点筛选 */}
              {filter !== '全部' && getCurrentKnowledgePoints().length > 0 && (
                <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
                  <div className="flex gap-2 pb-1 min-w-max">
                    <button
                      onClick={() => setKnowledgePointFilter('全部')}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                        knowledgePointFilter === '全部'
                          ? "bg-teal-100 text-teal-700 border-teal-200"
                          : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                      )}
                    >
                      全部知识点
                    </button>
                    {getCurrentKnowledgePoints().map(kp => (
                      <button
                        key={kp}
                        onClick={() => setKnowledgePointFilter(kp)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                          knowledgePointFilter === kp
                            ? "bg-teal-100 text-teal-700 border-teal-200"
                            : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                        )}
                      >
                        {kp}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {category === '申论' && (
            <>
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
            </>
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
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative active:bg-slate-50 transition-colors group cursor-pointer"
              onClick={() => setSelectedNote(n)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex flex-wrap gap-1.5 items-center">
                    <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        n.moduleId === StudyModule.ESSAY ? "bg-amber-100 text-amber-700" : "bg-indigo-50 text-indigo-600"
                    )}>
                    {n.moduleId}
                    </span>
                    {/* 有图图标 */}
                    {n.moduleId !== StudyModule.ESSAY && n.images && n.images.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-600 flex items-center gap-0.5">
                            <ImageIcon size={10} /> {n.images.length}
                        </span>
                    )}
                    {n.essayType && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500">
                            {n.essayType}
                        </span>
                    )}
                    {(n.essayTags || []).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600">
                            #{tag}
                        </span>
                    ))}
                    {n.tags && n.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500">
                            #{tag}
                        </span>
                    ))}
                </div>
                <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(n); }} className="text-slate-400 p-2 active:bg-indigo-50 active:text-indigo-600 rounded-full">
                        <Edit2 size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteNote(n.id); }} className="text-slate-400 p-2 active:bg-rose-50 active:text-rose-500 rounded-full">
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
            <p className="text-slate-400 text-xs italic">空空如也，点右上角开始记录吧。</p>
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
                                "px-4 py-2 rounded-xl text-xs font-bold transition-all border min-h-[44px]",
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
                                                "px-4 py-2 rounded-xl text-xs font-bold transition-all border min-h-[44px]",
                                                newNote.essayType === t ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-100"
                                            )}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">
                                    专题标签 (多选)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {config.essayTags.map(t => (
                                        <button
                                            key={t}
                                            onClick={() => {
                                                const current = newNote.essayTags || [];
                                                setNewNote(prev => ({
                                                    ...prev,
                                                    essayTags: current.includes(t)
                                                        ? current.filter(tag => tag !== t)
                                                        : [...current, t]
                                                }));
                                            }}
                                            className={cn(
                                                "px-4 py-2 rounded-xl text-xs font-bold transition-all border min-h-[44px]",
                                                (newNote.essayTags || []).includes(t) ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-500 border-slate-100"
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
                      <div className="space-y-4">
                        {/* 细化模块 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-500">细化模块</label>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {getCurrentNoteTags().subModules.map(t => (
                              <div key={t} className="relative group">
                                {editingSubModule === t ? (
                                  <div className="flex items-center gap-1 bg-white rounded-xl border-2 border-indigo-400 overflow-hidden shadow-sm">
                                    <input
                                      type="text"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleEditSubModule(newNote.moduleId!, t, editValue);
                                          setEditingSubModule(null);
                                        }
                                      }}
                                      className="px-3 py-2 text-sm outline-none w-28 bg-transparent"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => {
                                        handleEditSubModule(newNote.moduleId!, t, editValue);
                                        setEditingSubModule(null);
                                      }}
                                      className="px-3 py-2 text-indigo-600 hover:bg-indigo-50 font-bold"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      onClick={() => setEditingSubModule(null)}
                                      className="px-3 py-2 text-slate-400 hover:bg-slate-50 font-bold"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setSelectedSubModule(selectedSubModule === t ? null : t)}
                                    className={cn(
                                      "px-4 py-2.5 rounded-xl text-sm font-medium transition-all border shadow-sm",
                                      selectedSubModule === t 
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-200" 
                                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                                    )}
                                  >
                                    {t}
                                  </button>
                                )}
                                {/* 悬停显示编辑删除图标 */}
                                {!editingSubModule && (
                                  <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 opacity-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => { setEditingSubModule(t); setEditValue(t); }}
                                      className="w-6 h-6 bg-slate-100 hover:bg-indigo-100 rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 shadow-sm"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSubModule(newNote.moduleId!, t)}
                                      className="w-6 h-6 bg-slate-100 hover:bg-rose-100 rounded-full flex items-center justify-center text-slate-500 hover:text-rose-600 shadow-sm"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                            {/* 新增细化模块输入框 */}
                            <div className="flex items-center bg-white rounded-xl border-2 border-dashed border-slate-300 overflow-hidden shadow-sm focus-within:border-indigo-400 transition-colors">
                              <input
                                type="text"
                                value={newSubModule}
                                onChange={(e) => setNewSubModule(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newSubModule.trim()) {
                                    handleAddSubModule(newNote.moduleId!, newSubModule.trim());
                                    setSelectedSubModule(newSubModule.trim());
                                    setNewSubModule('');
                                  }
                                }}
                                placeholder="+ 添加"
                                className="px-3 py-2.5 text-sm outline-none w-24 placeholder:text-slate-400 bg-transparent"
                              />
                              {newSubModule.trim() && (
                                <button
                                  onClick={() => {
                                    handleAddSubModule(newNote.moduleId!, newSubModule.trim());
                                    setSelectedSubModule(newSubModule.trim());
                                    setNewSubModule('');
                                  }}
                                  className="px-2 py-2 text-indigo-600 hover:bg-indigo-50 font-bold"
                                >
                                  ✓
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 知识点（属于当前细化模块，可多选） */}
                        {selectedSubModule && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-500">知识点</label>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(getCurrentNoteTags().knowledgePoints[selectedSubModule] || []).map(t => (
                                <div key={t} className="relative group">
                                  {editingKnowledgePoint?.name === t ? (
                                    <div className="flex items-center gap-1 bg-white rounded-xl border-2 border-amber-400 overflow-hidden shadow-sm">
                                      <input
                                        type="text"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleEditKnowledgePoint(newNote.moduleId!, selectedSubModule!, t, editValue);
                                            setEditingKnowledgePoint(null);
                                          }
                                        }}
                                        className="px-3 py-2 text-sm outline-none w-28 bg-transparent"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => {
                                          handleEditKnowledgePoint(newNote.moduleId!, selectedSubModule!, t, editValue);
                                          setEditingKnowledgePoint(null);
                                        }}
                                        className="px-3 py-2 text-amber-600 hover:bg-amber-50 font-bold"
                                      >
                                        ✓
                                      </button>
                                      <button
                                        onClick={() => setEditingKnowledgePoint(null)}
                                        className="px-3 py-2 text-slate-400 hover:bg-slate-50 font-bold"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        if (selectedKnowledgePoints.includes(t)) {
                                          setSelectedKnowledgePoints(selectedKnowledgePoints.filter(k => k !== t));
                                        } else {
                                          setSelectedKnowledgePoints([...selectedKnowledgePoints, t]);
                                        }
                                      }}
                                      className={cn(
                                        "px-4 py-2.5 rounded-xl text-sm font-medium transition-all border shadow-sm",
                                        selectedKnowledgePoints.includes(t) 
                                          ? "bg-amber-500 text-white border-amber-500 shadow-amber-200" 
                                          : "bg-white text-slate-600 border-slate-200 hover:border-amber-300"
                                      )}
                                    >
                                      {t}
                                    </button>
                                  )}
                                  {/* 悬停显示编辑删除图标 */}
                                  {!editingKnowledgePoint && (
                                    <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 opacity-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => { setEditingKnowledgePoint({ subModule: selectedSubModule!, name: t }); setEditValue(t); }}
                                        className="w-6 h-6 bg-slate-100 hover:bg-amber-100 rounded-full flex items-center justify-center text-slate-500 hover:text-amber-600 shadow-sm"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteKnowledgePoint(newNote.moduleId!, selectedSubModule!, t)}
                                        className="w-6 h-6 bg-slate-100 hover:bg-rose-100 rounded-full flex items-center justify-center text-slate-500 hover:text-rose-600 shadow-sm"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {/* 新增知识点输入框 */}
                              <div className="flex items-center bg-white rounded-xl border-2 border-dashed border-slate-300 overflow-hidden shadow-sm focus-within:border-amber-400 transition-colors">
                                <input
                                  type="text"
                                  value={newKnowledgePoint}
                                  onChange={(e) => setNewKnowledgePoint(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newKnowledgePoint.trim()) {
                                      handleAddKnowledgePoint(newNote.moduleId!, selectedSubModule, newKnowledgePoint.trim());
                                      setSelectedKnowledgePoints([...selectedKnowledgePoints, newKnowledgePoint.trim()]);
                                      setNewKnowledgePoint('');
                                    }
                                  }}
                                  placeholder="+ 添加"
                                  className="px-3 py-2.5 text-sm outline-none w-24 placeholder:text-slate-400 bg-transparent"
                                />
                                {newKnowledgePoint.trim() && (
                                  <button
                                    onClick={() => {
                                      handleAddKnowledgePoint(newNote.moduleId!, selectedSubModule, newKnowledgePoint.trim());
                                      setSelectedKnowledgePoints([...selectedKnowledgePoints, newKnowledgePoint.trim()]);
                                      setNewKnowledgePoint('');
                                    }}
                                    className="px-2 py-2 text-amber-600 hover:bg-amber-50 font-bold"
                                  >
                                    ✓
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">标题</label>
                        <input 
                            type="text"
                            value={newNote.title}
                            onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none font-bold"
                            placeholder="核心考点名称/金句主题..."
                        />
                    </div>

                    {/* 图片上传区域 */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <ImageIcon size={12} /> 图片（可选，多张）
                        </label>
                        
                        {/* 已上传图片预览 */}
                        {newNote.images && newNote.images.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                                {newNote.images.map((img, index) => (
                                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                                        <img src={img} alt={`笔记图片 ${index + 1}`} className="w-full h-full object-cover" />
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
                        <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-500 hover:bg-slate-100 hover:border-slate-300 cursor-pointer transition-all">
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

                    <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-xl">
                        <button
                            onClick={() => {
                                const textarea = document.querySelector('textarea[placeholder="在此输入公考要点、口诀或写作框架..."]') as HTMLTextAreaElement;
                                if (textarea) {
                                    const start = textarea.selectionStart;
                                    const end = textarea.selectionEnd;
                                    const selectedText = newNote.content.substring(start, end);
                                    if (selectedText) {
                                        const newContent = newNote.content.substring(0, start) + `**${selectedText}**` + newNote.content.substring(end);
                                        setNewNote(prev => ({ ...prev, content: newContent }));
                                    }
                                }
                            }}
                            className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
                            title="加粗"
                        >
                            <Bold size={16} className="text-slate-600" />
                        </button>
                        <button
                            onClick={() => {
                                const textarea = document.querySelector('textarea[placeholder="在此输入公考要点、口诀或写作框架..."]') as HTMLTextAreaElement;
                                if (textarea) {
                                    const start = textarea.selectionStart;
                                    const end = textarea.selectionEnd;
                                    const selectedText = newNote.content.substring(start, end);
                                    if (selectedText) {
                                        const newContent = newNote.content.substring(0, start) + `==${selectedText}==` + newNote.content.substring(end);
                                        setNewNote(prev => ({ ...prev, content: newContent }));
                                    }
                                }
                            }}
                            className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
                            title="高亮"
                        >
                            <Highlighter size={16} className="text-slate-600" />
                        </button>
                        <span className="text-[9px] text-slate-400 ml-2">先选中文字，再点击按钮</span>
                    </div>
                    <div className="space-y-2 flex-1 flex flex-col min-h-[200px]">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">笔记正文</label>
                        <textarea 
                            value={newNote.content}
                            onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                            className="w-full flex-1 px-4 py-4 bg-slate-50 border-none rounded-2xl text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none leading-relaxed"
                            placeholder="在此输入公考要点、口诀或写作框架..."
                        />
                    </div>
                </div>
                <div className="p-6 bg-slate-50/50 border-t border-slate-100">
                    <button 
                        onClick={saveNote}
                        className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-bold shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                    >
                        保存笔记
                    </button>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              {/* 头部 */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen size={16} className={cn(
                    "shrink-0",
                    selectedNote.moduleId === StudyModule.ESSAY ? "text-amber-500" : "text-indigo-500"
                  )} />
                  <h3 className="font-bold text-slate-800 truncate">{selectedNote.title}</h3>
                </div>
                <button onClick={() => setSelectedNote(null)} className="text-slate-400 hover:text-slate-600 shrink-0 ml-2 p-1">
                  <X size={20} />
                </button>
              </div>

              {/* 内容区 */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
                {/* 标签 */}
                <div className="flex flex-wrap gap-1.5">
                  <span className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold",
                    selectedNote.moduleId === StudyModule.ESSAY
                      ? "bg-amber-100 text-amber-700"
                      : "bg-indigo-50 text-indigo-600"
                  )}>
                    {selectedNote.moduleId}
                  </span>
                  {selectedNote.essayType && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-500">
                      {selectedNote.essayType}
                    </span>
                  )}
                  {(selectedNote.essayTags || []).map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-600">
                      #{tag}
                    </span>
                  ))}
                  {(selectedNote.tags || []).map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-50 text-slate-400">
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* 图片显示 */}
                {selectedNote.images && selectedNote.images.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">笔记图片</div>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedNote.images.map((img, index) => (
                        <div 
                          key={index} 
                          className="aspect-square rounded-xl overflow-hidden bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedImage(img)}
                        >
                          <img src={img} alt={`笔记图片 ${index + 1}`} className="w-full h-full object-contain" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 正文 */}
                <div className="bg-slate-50 rounded-2xl p-5 min-h-[120px]">
                  <div 
                    className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere font-sans"
                    dangerouslySetInnerHTML={{
                      __html: selectedNote.content
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
                        .replace(/==(.*?)==/g, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>')
                    }}
                  />
                </div>

                {/* 元信息 */}
                <div className="text-[10px] text-slate-300 font-medium font-mono space-y-1 pt-2 border-t border-slate-100">
                  <div>创建时间：{new Date(selectedNote.updatedAt).toLocaleString()}</div>
                  {selectedNote.content && (
                    <div>字数约：{selectedNote.content.length}</div>
                  )}
                </div>
              </div>

              {/* 底部操作栏 */}
              <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
                <button
                  onClick={() => {
                    handleEdit(selectedNote);
                    setSelectedNote(null);
                  }}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 active:bg-slate-50 transition-colors"
                >
                  <Edit2 size={15} /> 编辑
                </button>
                <button
                  onClick={() => deleteNote(selectedNote.id)}
                  className="py-3 px-5 rounded-2xl border border-rose-200 text-rose-500 text-xs font-bold flex items-center justify-center gap-2 active:bg-rose-50 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 大图预览弹层 */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/95 flex flex-col"
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
      const minX = imgX;
      const minY = imgY;
      const maxX = imgX + imgRect.width - cropBox.width;
      const maxY = imgY + imgRect.height - cropBox.height;
      
      newX = Math.max(minX, Math.min(maxX, newX));
      newY = Math.max(minY, Math.min(maxY, newY));
      
      setCropBox(prev => ({ ...prev, x: newX, y: newY }));
    }
  };

  // 拖拽/缩放结束
  const handleDragEnd = () => {
    setIsDragging(false);
    setScalingCorner(null);
    setIsPinching(false);
  };

  // 计算两点之间的距离
  const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  // 计算两点的中心点
  const getCenter = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  };

  const handleConfirm = () => {
    if (!imgRef.current || !containerRef.current) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = imgRef.current;
    const container = containerRef.current;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    const displayWidth = img.clientWidth;
    const displayHeight = img.clientHeight;
    
    // 计算显示比例
    const scaleX = displayWidth / imgWidth;
    const scaleY = displayHeight / imgHeight;
    const scale = Math.min(scaleX, scaleY);
    
    // 计算实际裁剪坐标（转换为原图尺寸）
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const relativeX = cropBox.x - (imgRect.left - containerRect.left);
    const relativeY = cropBox.y - (imgRect.top - containerRect.top);
    
    const realX = relativeX / scale;
    const realY = relativeY / scale;
    const realWidth = cropBox.width / scale;
    const realHeight = cropBox.height / scale;
    
    // 设置画布大小
    canvas.width = realWidth;
    canvas.height = realHeight;
    
    // 绘制裁剪区域
    ctx.drawImage(
      img,
      Math.max(0, realX), Math.max(0, realY), realWidth, realHeight,
      0, 0, realWidth, realHeight
    );
    
    // 导出为 base64
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onConfirm(croppedDataUrl);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-black flex flex-col"
    >
      {/* 顶部操作栏 */}
      <div className="flex justify-between items-center p-4 pt-10 bg-black/50">
        <button
          onClick={onCancel}
          className="text-white px-4 py-2 rounded-xl hover:bg-white/10 transition-colors"
        >
          取消
        </button>
        <div className="text-white font-bold">裁剪图片</div>
        <button
          onClick={handleConfirm}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors font-bold"
        >
          确认
        </button>
      </div>
      
      {/* 裁剪区域 */}
      <div 
        ref={containerRef}
        className="flex-1 flex items-center justify-center relative overflow-hidden"
      >
        <img
          ref={imgRef}
          src={image}
          alt="裁剪"
          className="max-w-full max-h-full object-contain"
        />
        
        {/* 裁剪框 */}
        <div
          className="absolute border-2 border-white rounded-lg shadow-lg"
          style={{
            left: cropBox.x,
            top: cropBox.y,
            width: cropBox.width,
            height: cropBox.height
          }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onMouseMove={handleDragMove}
          onTouchMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchEnd={handleDragEnd}
        >
          {/* 裁剪框角落手柄 - 可拖拽缩放 */}
          {/* 左上角 */}
          <div 
            className="crop-corner absolute -top-2 -left-2 w-6 h-6 cursor-nwse-resize z-10 flex items-center justify-center"
            onMouseDown={(e) => handleCornerStart('tl', e)}
            onTouchStart={(e) => handleCornerStart('tl', e)}
          >
            <div className="w-3 h-3 bg-white rounded-full shadow-lg" />
          </div>
          {/* 右上角 */}
          <div 
            className="crop-corner absolute -top-2 -right-2 w-6 h-6 cursor-nesw-resize z-10 flex items-center justify-center"
            onMouseDown={(e) => handleCornerStart('tr', e)}
            onTouchStart={(e) => handleCornerStart('tr', e)}
          >
            <div className="w-3 h-3 bg-white rounded-full shadow-lg" />
          </div>
          {/* 左下角 */}
          <div 
            className="crop-corner absolute -bottom-2 -left-2 w-6 h-6 cursor-nesw-resize z-10 flex items-center justify-center"
            onMouseDown={(e) => handleCornerStart('bl', e)}
            onTouchStart={(e) => handleCornerStart('bl', e)}
          >
            <div className="w-3 h-3 bg-white rounded-full shadow-lg" />
          </div>
          {/* 右下角 */}
          <div 
            className="crop-corner absolute -bottom-2 -right-2 w-6 h-6 cursor-nwse-resize z-10 flex items-center justify-center"
            onMouseDown={(e) => handleCornerStart('br', e)}
            onTouchStart={(e) => handleCornerStart('br', e)}
          >
            <div className="w-3 h-3 bg-white rounded-full shadow-lg" />
          </div>
        </div>
        
        {/* 遮罩层（除裁剪框外变暗） */}
        <div className="absolute inset-0 pointer-events-none">
          {/* 顶部 */}
          <div 
            className="absolute bg-black/60"
            style={{ top: 0, left: 0, right: 0, height: cropBox.y }}
          />
          {/* 底部 */}
          <div 
            className="absolute bg-black/60"
            style={{ bottom: 0, left: 0, right: 0, top: cropBox.y + cropBox.height }}
          />
          {/* 左侧 */}
          <div 
            className="absolute bg-black/60"
            style={{ top: cropBox.y, left: 0, width: cropBox.x, height: cropBox.height }}
          />
          {/* 右侧 */}
          <div 
            className="absolute bg-black/60"
            style={{ top: cropBox.y, right: 0, left: cropBox.x + cropBox.width, height: cropBox.height }}
          />
        </div>
      </div>
    </motion.div>
  );
}
