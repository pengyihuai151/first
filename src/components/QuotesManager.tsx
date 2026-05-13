import React from 'react';
import { AppData } from '../types';
import { storage } from '../lib/storage';
import { motion } from 'motion/react';
import { ChevronLeft, Plus, Trash2, Quote, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';

interface QuotesManagerProps {
  data: AppData;
  onUpdate: () => void;
  onBack: () => void;
}

export default function QuotesManager({ data, onUpdate, onBack }: QuotesManagerProps) {
  const [newQuote, setNewQuote] = React.useState('');
  const quotes = data.settings.quotes || [];

  const handleAdd = async () => {
    if (!newQuote.trim()) return;
    const newQuotes = [...quotes, newQuote.trim()];
    await storage.saveData({
      ...data,
      settings: { ...data.settings, quotes: newQuotes }
    });
    setNewQuote('');
    onUpdate();
  };

  const handleDelete = async (index: number) => {
    const newQuotes = quotes.filter((_, i) => i !== index);
    await storage.saveData({
      ...data,
      settings: { ...data.settings, quotes: newQuotes }
    });
    onUpdate();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="pb-24 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 text-slate-400 active:bg-slate-100 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-100">
          <MessageSquare size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">语录池管理</h1>
          <p className="text-xs text-slate-400">激励自己，随时调取</p>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl text-white shadow-xl shadow-indigo-200/50 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="relative flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-indigo-100 text-xs font-medium">当前储备</p>
            <div className="text-4xl font-black">{quotes.length}</div>
            <p className="text-indigo-200 text-xs">条语录</p>
          </div>
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
            <Quote size={32} className="text-white" />
          </div>
        </div>
      </div>

      {/* Add New */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">添加新语录</label>
        <div className="flex gap-3">
          <input 
            type="text" 
            value={newQuote}
            onChange={(e) => setNewQuote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="输入励志语录..."
            className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-4 text-sm outline-none focus:ring-2 ring-indigo-100 transition-all min-h-[52px]"
          />
          <button 
            onClick={handleAdd}
            disabled={!newQuote.trim()}
            className={cn(
              "text-white rounded-xl shadow-md transition-all min-w-[52px] min-h-[52px] flex items-center justify-center",
              newQuote.trim() 
                ? "bg-indigo-600 active:scale-95 shadow-indigo-200 hover:bg-indigo-700" 
                : "bg-slate-200 cursor-not-allowed"
            )}
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3 pt-2">
        {quotes.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto">
              <Quote size={28} className="text-slate-300" />
            </div>
            <p className="text-slate-400 text-sm">还没有语录</p>
            <p className="text-slate-300 text-xs">添加一些励志语录吧</p>
          </div>
        ) : (
          quotes.map((quote, index) => (
            <motion.div 
              layout
              key={index}
              className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm active:bg-slate-50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-indigo-500 shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap break-words">
                    "{quote}"
                  </p>
                </div>
                <button 
                  onClick={() => handleDelete(index)}
                  className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all shrink-0"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
