import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Plus, X, Folder, FileText, Trash2, Edit2, Check } from 'lucide-react';
import { HierarchicalTag } from '../types';
import { cn } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';

interface HierarchicalReasonSelectorProps {
  options: HierarchicalTag[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  onConfigChange?: (newOptions: HierarchicalTag[]) => void;
  isEditingConfig?: boolean;
}

export default function HierarchicalReasonSelector({ 
  options, 
  selectedTags, 
  onChange,
  onConfigChange,
  isEditingConfig = false
}: HierarchicalReasonSelectorProps) {
  const [currentLevelTags, setCurrentLevelTags] = useState<HierarchicalTag[]>(options);
  const [navigationStack, setNavigationStack] = useState<{ name: string; options: HierarchicalTag[] }[]>([]);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [schemaMode, setSchemaMode] = useState<'flow' | 'tree'>(isEditingConfig ? 'tree' : 'flow');

  useEffect(() => {
    if (navigationStack.length === 0) {
      setCurrentLevelTags(options);
    }
  }, [options, navigationStack.length]);

  const handleSelect = (tag: HierarchicalTag) => {
    if (isEditingConfig) return;

    if (tag.children && tag.children.length > 0) {
      setNavigationStack([...navigationStack, { name: tag.name, options: currentLevelTags }]);
      setCurrentLevelTags(tag.children);
    } else {
      const fullPath = [...navigationStack.map(s => s.name), tag.name].join('-');
      if (!selectedTags.includes(fullPath)) {
        onChange([...selectedTags, fullPath]);
      }
    }
  };

  const goBack = () => {
    if (navigationStack.length === 0) return;
    const prev = navigationStack[navigationStack.length - 1];
    setCurrentLevelTags(prev.options);
    setNavigationStack(navigationStack.slice(0, -1));
  };

  const removeTag = (tag: string) => {
    onChange(selectedTags.filter(t => t !== tag));
  };

  const addTag = () => {
    const newTag: HierarchicalTag = { id: uuidv4(), name: '新项目', children: [] };
    const updated = [...currentLevelTags, newTag];
    updateHierarchicalAtLevel(updated, navigationStack.map(s => s.name));
  };

  const deleteTag = (id: string) => {
    const updated = currentLevelTags.filter(t => t.id !== id);
    updateHierarchicalAtLevel(updated, navigationStack.map(s => s.name));
  };

  const startEdit = (tag: HierarchicalTag) => {
    setEditingTagId(tag.id);
    setEditingName(tag.name);
  };

  const saveEdit = (id: string) => {
    const updated = currentLevelTags.map(t => t.id === id ? { ...t, name: editingName } : t);
    updateHierarchicalAtLevel(updated, navigationStack.map(s => s.name));
    setEditingTagId(null);
  };

  const updateHierarchicalAtLevel = (newItems: HierarchicalTag[], path: string[]) => {
    if (path.length === 0) {
      if (onConfigChange) onConfigChange(newItems);
      setCurrentLevelTags(newItems);
    } else {
      const walk = (items: HierarchicalTag[], pathIdx: number): HierarchicalTag[] => {
        return items.map(item => {
          if (item.name === path[pathIdx]) {
            if (pathIdx === path.length - 1) {
              return { ...item, children: newItems };
            }
            return { ...item, children: walk(item.children, pathIdx + 1) };
          }
          return item;
        });
      };
      const full = walk(options, 0);
      if (onConfigChange) onConfigChange(full);
      setCurrentLevelTags(newItems);
    }
  };

  const renderTreeView = (items: HierarchicalTag[], level = 0, path: string[] = []) => {
    return (
      <div className={cn("space-y-1", level > 0 && "ml-4 pl-4 border-l border-slate-100 mt-1")}>
        {items.map(item => (
          <div key={item.id} className="group">
            <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-50 rounded-lg transition-colors">
              <div className="flex items-center gap-2 flex-1">
                {item.children.length > 0 ? <Folder size={12} className="text-indigo-400" /> : <FileText size={12} className="text-emerald-400" />}
                <span className="text-xs font-bold text-slate-700">{item.name}</span>
              </div>
              
              {isEditingConfig && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                   <button 
                     onClick={() => {
                       const child: HierarchicalTag = { id: uuidv4(), name: '新子项', children: [] };
                       const updatedItems = items.map(it => it.id === item.id ? { ...it, children: [...it.children, child] } : it);
                       updateHierarchicalAtLevel(updatedItems, path);
                     }} 
                     className="p-1 hover:text-indigo-500" 
                     title="添加子项"
                   >
                    <Plus size={10} />
                   </button>
                   <button onClick={() => startEdit(item)} className="p-1 hover:text-amber-500"><Edit2 size={10} /></button>
                   <button 
                    onClick={() => {
                      const updatedItems = items.filter(it => it.id !== item.id);
                      updateHierarchicalAtLevel(updatedItems, path);
                    }} 
                    className="p-1 hover:text-rose-500"
                   >
                    <Trash2 size={10} />
                   </button>
                </div>
              )}
            </div>
            {item.children.length > 0 && renderTreeView(item.children, level + 1, [...path, item.name])}
          </div>
        ))}
        {isEditingConfig && (
          <button 
            onClick={() => {
              const root: HierarchicalTag = { id: uuidv4(), name: '新项目', children: [] };
              updateHierarchicalAtLevel([...items, root], path);
            }}
            className="flex items-center gap-1.5 py-1 px-2 text-[10px] text-slate-400 hover:text-indigo-500 font-bold"
          >
            <Plus size={10} /> 在此层级添加
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {isEditingConfig && (
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setSchemaMode('flow')}
            className={cn("px-3 py-1 rounded-lg text-[10px] font-bold transition-all", schemaMode === 'flow' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}
          >
            分步管理
          </button>
          <button 
            onClick={() => setSchemaMode('tree')}
            className={cn("px-3 py-1 rounded-lg text-[10px] font-bold transition-all", schemaMode === 'tree' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}
          >
             全景树图
          </button>
        </div>
      )}

      {schemaMode === 'tree' ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 min-h-[100px]">
          {options.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">暂无数据结构</p>
              <button 
                onClick={addTag}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-[10px] font-black"
              >
                <Plus size={14} /> 创建根节点
              </button>
            </div>
          ) : renderTreeView(options)}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 items-center min-h-[32px]">
            {navigationStack.length > 0 && (
              <button 
                onClick={goBack}
                className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg flex items-center gap-1"
              >
                返回
              </button>
            )}
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
              <span>根目录</span>
              {navigationStack.map((s, i) => (
                <React.Fragment key={i}>
                  <ChevronRight size={10} />
                  <span className="text-slate-600">{s.name}</span>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {currentLevelTags.map(tag => (
              <div 
                key={tag.id}
                className={cn(
                  "relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1",
                  tag.children.length > 0 ? "bg-slate-50 border-slate-100" : "bg-white border-slate-200 hover:border-indigo-300"
                )}
                onClick={() => handleSelect(tag)}
              >
                {editingTagId === tag.id ? (
                  <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                    <input 
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full text-xs font-bold border-b border-indigo-500 bg-transparent focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(tag.id)}
                    />
                    <button onClick={() => saveEdit(tag.id)} className="text-emerald-500"><Check size={14} /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {tag.children.length > 0 ? <Folder size={14} className="text-indigo-400" /> : <FileText size={14} className="text-emerald-400" />}
                      <span className="text-xs font-bold text-slate-700">{tag.name}</span>
                    </div>
                    {tag.children.length > 0 && <span className="text-[8px] text-slate-400 uppercase font-black">{tag.children.length} 子项</span>}
                    
                    {isEditingConfig && (
                      <div className="absolute top-1 right-1 flex gap-1 group-hover:opacity-100 opacity-0 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button onClick={() => startEdit(tag)} className="p-1 hover:bg-slate-100 rounded text-slate-400"><Edit2 size={10} /></button>
                        <button onClick={() => deleteTag(tag.id)} className="p-1 hover:bg-rose-100 rounded text-rose-400"><Trash2 size={10} /></button>
                      </div>
                    )}
                  </>
                )}
                
                {tag.children.length > 0 && !isEditingConfig && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300">
                    <ChevronRight size={14} />
                  </div>
                )}
              </div>
            ))}

            {isEditingConfig && (
              <button 
                onClick={addTag}
                className="p-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 flex flex-col items-center justify-center gap-1 hover:border-indigo-300 hover:text-indigo-500 transition-all"
              >
                <Plus size={16} />
                <span className="text-[10px] font-bold">添加项目</span>
              </button>
            )}
          </div>

          {!isEditingConfig && selectedTags.length > 0 && (
            <div className="pt-2">
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">已选择错误诱因</label>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map(tag => (
                  <span 
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold border border-indigo-100"
                  >
                    {tag}
                    <button onClick={() => removeTag(tag)} className="text-indigo-300 hover:text-indigo-600">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
