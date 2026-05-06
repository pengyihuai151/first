import React, { useState, useRef, useEffect } from 'react';
import { AppData } from '../types';
import { generateAnalysis, streamAnalysis, quickAsk, isAIEnabled, getAIConfig } from '../lib/ai';
import { cleanText } from '../lib/ai';
import { Brain, Send, Loader2, Sparkles, X, AlertCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface AIAssistantProps {
  data: AppData;
  compact?: boolean;
  onClose?: () => void;
}

export default function AIAssistant({ data, compact = false, onClose }: AIAssistantProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasHadConversation, setHasHadConversation] = useState(false); // 跟踪是否有过对话
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const enabled = isAIEnabled();
  const config = getAIConfig();

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 快速建议问题
  const quickQuestions = [
    { label: '分析薄弱点', question: '分析我的薄弱模块和知识点，给出针对性的复习建议' },
    { label: '制定计划', question: '根据我的学习数据，制定接下来一周的备考计划' },
    { label: '复盘指导', question: '如何高效复盘错题，有哪些技巧？' },
    { label: '时间分配', question: '五个模块如何分配学习时间最合理？' },
  ];

  // 发送消息
  const handleSend = async (question?: string) => {
    const text = question || input.trim();
    if (!text || isLoading) return;

    setInput('');
    setError(null);
    setIsLoading(true);

    // 添加用户消息
    const userMessage = { role: 'user' as const, content: text };
    setMessages(prev => [...prev, userMessage]);

    // 添加空白的 AI 消息用于流式更新
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      // 准备数据
      const aiData = {
        wrongQuestions: data.wrongQuestions || [],
        examRecords: data.examRecords || [],
        sessions: data.sessions || [],
        settings: data.settings,
        examNotes: (data as any).examNotes || []
      };
      
      // 有快捷问题或首次对话时传数据
      if (question || !hasHadConversation) {
        // 快捷问题或首次对话：传数据，使用累积器处理叠词
        let accumulatedText = '';
        
        await streamAnalysis(aiData, text, (chunk) => {
          accumulatedText += chunk;
          // 实时清理叠词
          let cleaned = cleanText(accumulatedText);
          // 更新显示
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].content = cleaned;
            return newMessages;
          });
        });
        
        setHasHadConversation(true);
      } else {
        // 后续对话：不传数据
        const result = await quickAsk(text);
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = cleanText(result.text);
          return newMessages;
        });
      }
    } catch (err: any) {
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].content = `出错了：${err.message}`;
        return newMessages;
      });
      setError(err.message);
    }

    setIsLoading(false);
  };

  // 键盘发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 未启用时显示配置提示
  if (!enabled) {
    return (
      <div className={cn(
        "bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white",
        compact ? "h-full" : ""
      )}>
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/20 p-2 rounded-xl">
            <Brain size={20} />
          </div>
          <div>
            <h3 className="font-bold">AI 备考助手</h3>
            <p className="text-xs text-white/70">智能分析你的学习数据</p>
          </div>
        </div>

        <div className="bg-white/10 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-300 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">需要配置 AI API</p>
              <p className="text-xs text-white/70 mt-1">
                请在 <code className="bg-white/20 px-1 rounded">.env.local</code> 中配置：
              </p>
            </div>
          </div>

          <div className="bg-white/10 rounded-xl p-3 text-xs font-mono space-y-1">
            <p>VITE_AI_API_KEY=sk-xxx</p>
            <p>VITE_AI_BASE_URL=https://api.siliconflow.cn/v1</p>
            <p>VITE_AI_MODEL=deepseek-ai/DeepSeek-V2.5</p>
          </div>

          <a
            href="https://cloud.siliconflow.cn"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center bg-white/20 hover:bg-white/30 transition-colors rounded-xl py-2 text-sm font-medium"
          >
            获取免费 API Key →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col overflow-hidden",
      compact ? "h-full" : "h-[500px] max-h-[70vh]"
    )}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-lg">
            <Brain size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm">AI 备考助手</h3>
            <p className="text-[10px] text-white/70">
              {config.model.split('/').pop()}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <>
            {/* 欢迎消息 */}
            <div className="text-center py-4 space-y-3">
              <div className="bg-indigo-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                <Sparkles size={20} className="text-indigo-500" />
              </div>
              <div>
                <p className="font-medium text-slate-700">你好！我是上岸小帮手</p>
                <p className="text-xs text-slate-500 mt-1">
                  我会分析你的学习数据，给出个性化建议
                </p>
              </div>
            </div>

            {/* 快速问题 */}
            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-medium">试试这样问我：</p>
              <div className="grid grid-cols-2 gap-2">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q.question)}
                    className="text-left p-2 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-colors"
                  >
                    <p className="text-xs font-medium text-slate-700">{q.label}</p>
                    <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{q.question}</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 消息列表 */}
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-2",
              msg.role === 'user' && "flex-row-reverse"
            )}
          >
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
              msg.role === 'user' ? "bg-indigo-500" : "bg-slate-100"
            )}>
              {msg.role === 'user' ? (
                <span className="text-white text-xs font-bold">我</span>
              ) : (
                <Brain size={14} className="text-slate-500" />
              )}
            </div>
            <div className={cn(
              "px-3 py-2 rounded-2xl max-w-[80%] text-sm",
              msg.role === 'user'
                ? "bg-indigo-500 text-white rounded-tr-sm"
                : "bg-slate-100 text-slate-700 rounded-tl-sm"
            )}>
              {msg.content}
              {isLoading && i === messages.length - 1 && (
                <span className="inline-flex ml-1 animate-pulse">...</span>
              )}
            </div>
          </motion.div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 p-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题..."
            className="flex-1 px-3 py-2 bg-slate-50 rounded-xl text-sm resize-none outline-none focus:ring-2 focus:ring-indigo-500/20"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className={cn(
              "px-4 py-2 rounded-xl font-medium transition-all",
              input.trim() && !isLoading
                ? "bg-indigo-500 text-white hover:bg-indigo-600"
                : "bg-slate-100 text-slate-400"
            )}
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// 简单的内联版本（用于 Dashboard）
export function AIAssistantInline({ data }: { data: AppData }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* 展开按钮 */}
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-indigo-100 hover:shadow-xl transition-shadow"
      >
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl">
            <Brain size={20} />
          </div>
          <div className="text-left">
            <p className="font-bold">AI 智能分析</p>
            <p className="text-xs text-white/70">点击获取个性化备考建议</p>
          </div>
        </div>
        <ChevronRight size={20} className="text-white/70" />
      </button>

      {/* 弹出层 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setIsExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <AIAssistant
                data={data}
                compact
                onClose={() => setIsExpanded(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
