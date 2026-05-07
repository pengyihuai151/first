export enum StudyModule {
  VERBAL = '言语理解',
  REASONING = '判断推理',
  DATA = '资料分析',
  QUANT = '数量关系',
  COMMON_SENSE = '常识判断',
  POLITICS = '政治',
  ESSAY = '申论',
}

/**
 * 两层级结构：统计+计时用
 * 言语/判断 有子模块；其他只有一级
 */
export const MODULE_SUB_TOPICS: Record<string, string[]> = {
  [StudyModule.VERBAL]: ['逻辑填空', '篇章阅读'],
  [StudyModule.REASONING]: ['图形推理', '定义判断', '类比推理', '逻辑推理'],
};

export const MAIN_MODULES = [
  StudyModule.VERBAL,
  StudyModule.REASONING,
  StudyModule.DATA,
  StudyModule.QUANT,
  StudyModule.COMMON_SENSE,
  StudyModule.POLITICS,
];

/** 判断某模块是否有子模块 */
export function hasSubModules(moduleId: string): boolean {
  return moduleId in MODULE_SUB_TOPICS && (MODULE_SUB_TOPICS[moduleId]?.length ?? 0) > 0;
}

/** 获取某模块的子模块列表 */
export function getSubTopics(moduleId: string): string[] {
  return MODULE_SUB_TOPICS[moduleId] || [];
}

// ==================== 学习计时 ====================

export interface StudySession {
  id: string;
  moduleId: StudyModule;
  subTopic?: string; // 子模块名
  startTime: number;
  duration: number;
  date: string; // YYYY-MM-DD
}

// ==================== 错题（关联考试） ====================

export interface WrongQuestion {
  id: string;
  examId?: string; // 关联的考试ID
  moduleId: StudyModule;
  subTopic?: string; // 子模块
  tags?: string[]; // 细分知识点标签
  errorReason?: string;
  mastered?: boolean;
  reviewCount?: number;
  createdAt: number;
}

// ==================== 笔记 ====================

export interface ExamNote {
  id: string;
  moduleId: StudyModule;
  title: string;
  content: string;
  updatedAt: number;
  essayType?: string;
  essayTag?: string;
  tags?: string[];
}

// ==================== 应用配置 ====================

export interface AppConfig {
  essayTypes: string[];
  essayTags: string[];
  noteTags: string[];
}

// ==================== 考试录入（含子模块成绩） ====================

export interface ExamSubScore {
  subTopic: string;
  correctCount: number;
  totalCount: number;
  duration: number; // ms
}

export interface ExamModuleScore {
  moduleId: StudyModule;
  subScores?: ExamSubScore[]; // 子模块成绩（有子模块时）
  correctCount: number; // 汇总
  totalCount: number; // 汇总
  duration: number; // 汇总 ms
}

export interface ExamRecord {
  id: string;
  title: string;
  date: number;
  moduleScores: ExamModuleScore[];
  reflection?: string; // 反思
}

/** 目标考试（用于日历和倒计时） */
export interface TargetExam {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
}

// ==================== 全局数据 ====================

export interface AppData {
  sessions: StudySession[];
  wrongQuestions: WrongQuestion[];
  notes: ExamNote[];
  examRecords?: ExamRecord[];
  targetExams?: TargetExam[]; // 目标考试列表
  settings: {
    examDate: string | null;
    quotes: string[];
    moduleTargets?: Record<string, number>;
  };
  config?: AppConfig;
  /** 阅读打卡记录：日期 -> 已读笔记ID列表 */
  readingCheckIns?: Record<string, string[]>;
}
