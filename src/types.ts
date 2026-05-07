export enum StudyModule {
  VERBAL = '言语理解',
  REASONING = '判断推理',
  DATA = '资料分析',
  QUANT = '数量关系',
  COMMON_SENSE = '常识判断',
  POLITICS = '政治',
}

/**
 * 两层级结构：统计+计时用
 * 言语/判断 有子模块；其他只有一级
 */
export const MODULE_SUB_TOPICS: Record<string, string[]> = {
  [StudyModule.VERBAL]: ['逻辑填空', '篇章阅读'],
  [StudyModule.REASONING]: ['图形推理', '定义判断', '类比推理', '逻辑推理'],
};

/** 错题标签（细分知识点），供 AI 分析用 */
export const MODULE_KNOWLEDGE_TAGS: Record<string, string[]> = {
  [StudyModule.VERBAL]: [
    '逻辑填空-成语辨析', '逻辑填空-实词搭配', '逻辑填空-语境对应',
    '片段阅读-主旨概括', '片段阅读-意图判断', '片段阅读-细节理解',
    '片段阅读-标题填入', '语句表达-语句排序', '语句表达-语句填空', '语句表达-下文推断',
  ],
  [StudyModule.REASONING]: [
    '图形推理-位置规律', '图形推理-样式规律', '图形推理-数量规律',
    '图形推理-属性规律', '图形推理-空间重构', '图形推理-黑白块',
    '定义判断-单/多定义', '定义判断-关键词锁定',
    '类比推理-语义关系', '类比推理-逻辑关系', '类比推理-语法关系',
    '逻辑判断-翻译推理', '逻辑判断-削弱加强', '逻辑判断-组合排列', '逻辑判断-日常结论',
  ],
  [StudyModule.DATA]: [
    '材料类型-综合材料', '材料类型-图形统计', '材料类型-表格数据',
    '核心考点-基期现期', '核心考点-增长率量', '核心考点-比重平均数',
    '速算能力-截位直除', '速算能力-分数比较', '速算能力-公式应用',
  ],
  [StudyModule.QUANT]: [
    '基础运算-和差倍比', '基础运算-工程问题', '基础运算-行程问题', '基础运算-利润问题',
    '排列组合-概率问题', '排列组合-抽屉原理',
    '几何问题-平面几何', '几何问题-立体几何',
    '特殊题型-极值问题', '特殊题型-周期问题',
  ],
  [StudyModule.COMMON_SENSE]: ['科技常识', '人文历史', '法律法规', '地理常识'],
  [StudyModule.POLITICS]: ['时政要闻', '政治理论', '党史重要会议'],
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

/** 获取某模块的完整知识点标签列表 */
export function getKnowledgeTags(moduleId: string): string[] {
  return MODULE_KNOWLEDGE_TAGS[moduleId] || [];
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
