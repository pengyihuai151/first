import React from 'react';
import { AppData } from '../types';
import { storage } from '../lib/storage';
import { motion } from 'motion/react';
import { ChevronLeft, Plus, Trash2, Quote } from 'lucide-react';

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
      className="pb-24 space-y-6"
    >
      <header className="flex items-center gap-4 mb-2">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 text-slate-400 active:bg-slate-100 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-800">语录池管理</h1>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Quotes Library</p>
        </div>
      </header>

      {/* Stats */}
      <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-indigo-100 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-indigo-100 text-xs font-bold uppercase">当前储备</p>
          <div className="text-3xl font-black">{quotes.length} <span className="text-sm font-normal opacity-80">条语录</span></div>
        </div>
        <div className="bg-white/20 p-3 rounded-2xl">
          <Quote size={32} className="text-white" />
        </div>
      </div>

      {/* Add New */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex gap-2">
        <input 
          type="text" 
          value={newQuote}
          onChange={(e) => setNewQuote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="输入励志语录..."
          className="flex-1 bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 ring-indigo-100 transition-all"
        />
        <button 
          onClick={handleAdd}
          className="bg-indigo-600 text-white p-3 rounded-2xl shadow-md shadow-indigo-100 active:scale-90 transition-transform"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {quotes.map((quote, index) => (
          <motion.div 
            layout
            key={index}
            className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-start gap-4 active:bg-slate-50 transition-colors"
          >
            <div className="bg-slate-50 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
              {index + 1}
            </div>
            <p className="flex-1 text-sm text-slate-600 leading-relaxed pt-1.5">
              "{quote}"
            </p>
            <button 
              onClick={() => handleDelete(index)}
              className="p-2 text-slate-300 active:text-rose-500 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
