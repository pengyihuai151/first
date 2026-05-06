import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, ArrowRight, Brain, RotateCcw, HelpCircle, Trophy, AlertTriangle } from 'lucide-react';
import { AppData, WrongQuestion, StudyModule } from '../types';
import { storage } from '../lib/storage';
import { cn } from '../lib/utils';

interface ReviewSessionProps {
  data: AppData;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ReviewSession({ data, onClose, onUpdate }: ReviewSessionProps) {
  const [sessionQuestions, setSessionQuestions] = useState<WrongQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [results, setResults] = useState<{ mastered: string[], unclear: string[] }>({ mastered: [], unclear: [] });
  const [isFinished, setIsFinished] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  useEffect(() => {
    // Generate a daily review set
    // Logic: Pick up to 10 questions that are NOT mastered, preferentially older ones or highly tagged ones
    const unmastered = data.wrongQuestions.filter(q => !q.mastered);
    const sorted = [...unmastered].sort((a, b) => (a.reviewCount || 0) - (b.reviewCount || 0));
    const selection = sorted.slice(0, 10);
    
    // Shuffle the selection
    setSessionQuestions(selection.sort(() => Math.random() - 0.5));
  }, [data.wrongQuestions]);

  const handleMark = async (type: 'mastered' | 'unclear') => {
    const question = sessionQuestions[currentIndex];
    const newResults = { ...results };
    
    if (type === 'mastered') {
      newResults.mastered.push(question.id);
      // Update storage immediately
      await storage.updateWrongQuestion({
        ...question,
        mastered: true,
        reviewCount: (question.reviewCount || 0) + 1
      });
    } else {
      newResults.unclear.push(question.id);
      await storage.updateWrongQuestion({
        ...question,
        mastered: false,
        reviewCount: (question.reviewCount || 0) + 1
      });
    }

    setResults(newResults);
    onUpdate(); // Background update

    if (currentIndex < sessionQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnalysis(false);
    } else {
      setIsFinished(true);
    }
  };

  const currentQ = sessionQuestions[currentIndex];

  if (sessionQuestions.length === 0 && !isFinished) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900/90 flex items-center justify-center p-6 text-center">
        <div className="bg-white rounded-[40px] p-8 max-w-sm w-full space-y-6">
          <div className="bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-emerald-500">
            <Check size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800">全部掌握！</h2>
            <p className="text-sm text-slate-500">目前没有需要复盘的错题了。继续保持，去开启新的模考吧。</p>
          </div>
          <button 
            onClick={onClose}
            className="w-full bg-slate-100 text-slate-600 py-4 rounded-3xl font-bold active:scale-95 transition-all"
          >
            返回主页
          </button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="bg-indigo-500/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-indigo-400">
            <Brain size={48} className="animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white">复盘完成</h2>
            <p className="text-indigo-200/60 font-medium">今天的复盘任务已达成，你是最棒的！</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 text-center">
              <div className="text-emerald-400 text-2xl font-black mb-1">{results.mastered.length}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">掌握</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 text-center">
              <div className="text-rose-400 text-2xl font-black mb-1">{results.unclear.length}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">仍需努力</div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <button 
              onClick={() => {
                setIsFinished(false);
                setCurrentIndex(0);
                setResults({ mastered: [], unclear: [] });
                // Re-shuffle/refresh
                onUpdate();
              }}
              className="w-full bg-indigo-600 text-white py-4 rounded-3xl font-black shadow-xl shadow-indigo-900/40 active:scale-95 transition-all"
            >
              再来一组
            </button>
            <button 
              onClick={onClose}
              className="w-full bg-white/5 text-slate-300 py-4 rounded-3xl font-bold hover:bg-white/10 transition-all"
            >
              完成并返回
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl">
            <Brain size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">错题复盘中</h2>
            <div className="flex gap-1 mt-0.5">
              {sessionQuestions.map((_, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "w-3 h-1 rounded-full transition-all",
                    idx === currentIndex ? "w-6 bg-indigo-500" : 
                    idx < currentIndex ? (results.mastered.includes(sessionQuestions[idx].id) ? "bg-emerald-400" : "bg-rose-400") : "bg-slate-100"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black bg-slate-800 text-white px-2 py-0.5 rounded uppercase tracking-wider">
               {currentQ.moduleId}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">
               {currentIndex + 1} / {sessionQuestions.length}
            </span>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 min-h-[200px] flex flex-col justify-center">
            <p className="text-slate-700 font-medium leading-relaxed">
              {currentQ.content}
            </p>
            {((currentQ.imageUrls && currentQ.imageUrls.length > 0) || currentQ.imageUrl) && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                 {(currentQ.imageUrls || (currentQ.imageUrl ? [currentQ.imageUrl] : [])).map((url, idx) => (
                   <img 
                    key={idx} 
                    src={url} 
                    className="h-32 rounded-xl border border-slate-100 object-contain cursor-zoom-in" 
                    onClick={() => setActiveImage(url)}
                   />
                 ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {currentQ.tags?.map(t => <span key={t} className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded tracking-tight">#{t}</span>)}
          </div>
        </div>

        <AnimatePresence>
          {showAnalysis ? (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="space-y-4 overflow-hidden"
            >
               <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100">
                  <h3 className="text-[10px] font-black text-emerald-800 uppercase mb-2 flex items-center gap-2">
                    <Check size={12} /> 正确解析与总结
                  </h3>
                  <p className="text-sm text-emerald-900 leading-relaxed font-medium">
                    {currentQ.analysis || "（暂无详细解析，请回顾相关教材考点）"}
                  </p>
               </div>
               
               <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100">
                  <h3 className="text-[10px] font-black text-amber-800 uppercase mb-2 flex items-center gap-2">
                    <AlertTriangle size={12} /> 个人复盘/思路
                  </h3>
                  <div className="text-sm text-amber-800 whitespace-pre-wrap leading-relaxed">
                    {currentQ.analysis || <span className="italic text-amber-600/60">暂无复盘记录</span>}
                  </div>
               </div>
            </motion.div>
          ) : (
            <button 
              onClick={() => setShowAnalysis(true)}
              className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-bold flex items-center justify-center gap-2 hover:bg-white hover:border-indigo-300 hover:text-indigo-500 transition-all"
            >
              <RotateCcw size={16} /> 点击查看解析
            </button>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Actions */}
      <div className="bg-white border-t border-slate-100 p-6 pb-12 flex gap-4">
        <button 
          onClick={() => handleMark('unclear')}
          className="flex-1 bg-rose-50 text-rose-600 py-4 rounded-3xl font-black flex items-center justify-center gap-2 active:scale-95 transition-all border border-rose-100"
        >
          <HelpCircle size={20} /> 未清楚
        </button>
        <button 
          onClick={() => handleMark('mastered')}
          className="flex-1 bg-emerald-600 text-white py-4 rounded-3xl font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 transition-all"
        >
          <Check size={20} /> 已掌握
        </button>
      </div>

      {/* Full Screen Image Preview */}
      <AnimatePresence>
        {activeImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4"
            onClick={() => setActiveImage(null)}
          >
            <button className="absolute top-6 right-6 p-3 text-white">
              <X size={24} />
            </button>
            <motion.img 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              src={activeImage} 
              className="max-w-full max-h-full object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
