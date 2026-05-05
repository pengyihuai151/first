import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Clock, BookOpen, PenTool, Settings, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppData } from './types';
import { storage } from './lib/storage';

// Pages
import Dashboard from './components/Dashboard';
import StudyRoom from './components/StudyRoom';
import WrongQuestionBank from './components/WrongQuestionBank';
import NotesSection from './components/NotesSection';
import SettingsPage from './components/SettingsPage';
import QuotesManager from './components/QuotesManager';

import ExamBank from './components/ExamBank';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'study' | 'wrong' | 'exam' | 'notes' | 'settings' | 'quotes'>('home');
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const appData = await storage.getData();
    setData(appData);
  };

  const renderContent = () => {
    if (!data) return null;

    switch (activeTab) {
      case 'home': return <Dashboard data={data} onUpdate={loadData} />;
      case 'study': return <StudyRoom data={data} onUpdate={loadData} />;
      case 'wrong': return <WrongQuestionBank data={data} onUpdate={loadData} />;
      case 'exam': return <ExamBank data={data} onUpdate={loadData} />;
      case 'notes': return <NotesSection data={data} onUpdate={loadData} />;
      case 'settings': return <SettingsPage data={data} onUpdate={loadData} onNavigate={setActiveTab} />;
      case 'quotes': return <QuotesManager data={data} onUpdate={loadData} onBack={() => setActiveTab('settings')} />;
      default: return <Dashboard data={data} onUpdate={loadData} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans selection:bg-indigo-100">
      <main className="max-w-md mx-auto px-4 pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 px-3 py-1.5 pb-6 md:pb-3 flex justify-between items-center z-50">
        <NavButton
          active={activeTab === 'home'}
          onClick={() => setActiveTab('home')}
          icon={<LayoutDashboard size={18} />}
          label="总览"
        />
        <NavButton
          active={activeTab === 'study'}
          onClick={() => setActiveTab('study')}
          icon={<Clock size={18} />}
          label="计划"
        />
        <NavButton
          active={activeTab === 'wrong'}
          onClick={() => setActiveTab('wrong')}
          icon={<BookOpen size={18} />}
          label="错题"
        />
        <NavButton
          active={activeTab === 'exam'}
          onClick={() => setActiveTab('exam')}
          icon={<Trophy size={18} />}
          label="考试"
        />
        <NavButton
          active={activeTab === 'notes'}
          onClick={() => setActiveTab('notes')}
          icon={<PenTool size={18} />}
          label="笔记"
        />
        <NavButton
          active={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
          icon={<Settings size={18} />}
          label="设置"
        />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 transition-all active:scale-90 touch-manipulation ${
        active ? 'text-indigo-600' : 'text-slate-400'
      }`}
    >
      <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-indigo-50' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}
