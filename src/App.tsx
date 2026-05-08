import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Clock, FileText, BarChart3, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppData } from './types';
import { storage } from './lib/storage';

// Pages
import Dashboard from './components/Dashboard';
import StudyRoom from './components/StudyRoom';
import AnalysisPage from './components/AnalysisPage';
import SettingsPage from './components/SettingsPage';
import ExamBank from './components/ExamBank';
import NotesSection from './components/NotesSection';
import WrongQuestionBank from './components/WrongQuestionBank';

type Tab = 'home' | 'study' | 'analysis' | 'settings' | 'exam' | 'notes' | 'wrong';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [data, setData] = useState<AppData | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const initialLoadRef = useRef(false);
  const wakeLockRef = useRef<any>(null);

  // 保持屏幕常亮（仅当用户开启时）
  const requestWakeLock = async () => {
    if (!data?.settings.screenWakeLockEnabled) return;
    if (!('wakeLock' in navigator)) return;
    if (wakeLockRef.current) return;

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      wakeLockRef.current.addEventListener('release', () => {
        wakeLockRef.current = null;
      });
    } catch (err) {
      wakeLockRef.current = null;
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  // 统一的 Wake Lock 处理函数
  const syncWakeLock = async () => {
    if (!data) return;
    
    if (data.settings.screenWakeLockEnabled && document.visibilityState === 'visible') {
      await requestWakeLock();
    } else {
      await releaseWakeLock();
    }
  };

  useEffect(() => {
    // 1. 页面可见性变化时处理
    const handleVisibilityChange = () => {
      syncWakeLock();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, []);

  // 2. 当 data 加载完成或变化时处理
  useEffect(() => {
    syncWakeLock();
  }, [data?.settings.screenWakeLockEnabled]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const appData = await storage.getData();
    // 只有第一次加载时才自动关闭屏幕常亮，避免用户点击开关后被重置
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      appData.settings.screenWakeLockEnabled = false;
      await storage.saveData(appData);
    }
    setData(appData);
  };

  const handleNavigate = (tab: string, extra?: string) => {
    if (tab === 'wrong' && extra) {
      setSelectedExamId(extra);
      setActiveTab('wrong');
      return;
    }
    setActiveTab(tab as Tab);
    if (tab !== 'wrong') setSelectedExamId(null);
  };

  const renderContent = () => {
    if (!data) return null;

    switch (activeTab) {
      case 'home': return <Dashboard data={data} onUpdate={loadData} onNavigate={handleNavigate} />;
      case 'study': return <StudyRoom data={data} onUpdate={loadData} />;
      case 'wrong':
        return selectedExamId
          ? <WrongQuestionBank data={data} onUpdate={loadData} examId={selectedExamId} onBack={() => handleNavigate('analysis')} />
          : <AnalysisPage data={data} onUpdate={loadData} onNavigate={handleNavigate} />;
      case 'analysis': return <AnalysisPage data={data} onUpdate={loadData} onNavigate={handleNavigate} />;
      case 'settings': return <SettingsPage data={data} onUpdate={loadData} onNavigate={handleNavigate} />;
      case 'exam': return <ExamBank data={data} onUpdate={loadData} onNavigate={handleNavigate} />;
      case 'notes': return <NotesSection data={data} onUpdate={loadData} />;
      default: return <Dashboard data={data} onUpdate={loadData} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans selection:bg-indigo-100">
      <main className="max-w-md mx-auto px-4 pt-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}-${selectedExamId || ''}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 主导航：5个Tab */}
      {!selectedExamId && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 px-4 py-1.5 pb-6 md:pb-3 flex justify-between items-center z-50">
          <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<LayoutDashboard size={18} />} label="总览" />
          <NavButton active={activeTab === 'study'} onClick={() => setActiveTab('study')} icon={<Clock size={18} />} label="计划" />
          <NavButton active={activeTab === 'exam'} onClick={() => setActiveTab('exam')} icon={<FileText size={18} />} label="考试" />
          <NavButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={<BarChart3 size={18} />} label="分析" />
          <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={18} />} label="设置" />
        </nav>
      )}
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-0.5 transition-all active:scale-90 touch-manipulation ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
      <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-indigo-50' : ''}`}>{icon}</div>
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}