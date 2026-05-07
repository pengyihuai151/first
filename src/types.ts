export enum StudyModule {
  VERBAL = '言语理解',
  REASONING = '判断推理',
  DATA = '资料分析',
  QUANT = '数量关系',
  COMMON_SENSE = '常识判断',
  POLITICS = '政治',
  ESSAY = '申论',
}

export const MODULE_SUB_TOPICS: Record<string, string[]> = {
  [StudyModule.VERBAL]: [
    '逻辑填空-成语辨析', '逻辑填空-实词搭配', '逻辑填空-语境对应', '逻辑填空-关联词', '逻辑填空-感情色彩',
    '片段阅读-主旨概括', '片段阅读-意图判断', '片段阅读-细节理解', '片段阅读-标题填入', '片段阅读-态度观点',
    '语句表达-语句排序', '语句表达-语句填空', '语句表达-下文推断'
  ],
  [StudyModule.REASONING]: [
    '图形推理-位置规律', '图形推理-样式规律', '图形推理-数量规律', '图形推理-属性规律', '图形推理-空间重构', '图形推理-黑白块', '图形推理-截面图',
    '定义判断-单/多定义', '定义判断-关键词锁定', 
    '类比推理-语义关系', '类比推理-逻辑关系', '类比推理-语法关系', '类比推理-常识类比',
    '逻辑判断-翻译推理', '逻辑判断-真假推理', '逻辑判断-削弱加强', '逻辑判断-组合排列', '逻辑判断-日常结论'
  ],
  [StudyModule.QUANT]: [
    '基础运算-和差倍比', '基础运算-工程问题', '基础运算-行程问题', '基础运算-利润问题', '基础运算-年龄问题', '基础运算-容斥原理',
    '排列组合-概率问题', '排列组合-抽屉原理',
    '几何问题-平面几何', '几何问题-立体几何',
    '特殊题型-极值问题', '特殊题型-周期问题', '特殊题型-植树牛吃草'
  ],
  [StudyModule.DATA]: [
    '材料类型-综合材料', '材料类型-图形统计', '材料类型-表格数据',
    '核心考点-基期现期', '核心考点-增长率量', '核心考点-比重平均数', '核心考点-倍数间隔混合',
    '速算能力-截位直除', '速算能力-分数比较', '速算能力-公式应用'
  ],
  [StudyModule.COMMON_SENSE]: ['科技常识', '人文历史', '法律法规', '地理常识', '经济常识'],
  [StudyModule.POLITICS]: ['时政要闻', '政治理论', '党史重要会议']
};

export const MAIN_MODULES = [
  StudyModule.VERBAL,
  StudyModule.REASONING,
  StudyModule.DATA,
  StudyModule.QUANT,
  StudyModule.COMMON_SENSE,
  StudyModule.POLITICS,
];

export interface StudySession {
  id: string;
  moduleId: StudyModule;
  startTime: number;
  duration: number; // in milliseconds
  date: string; // YYYY-MM-DD
}

export interface WrongQuestion {
  id: string;
  moduleId: StudyModule;
  content: string;
  analysis: string;
  tags?: string[];
  errorReason?: string;
  mastered?: boolean;
  reviewCount?: number;
  createdAt: number;
}

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

export interface AppConfig {
  essayTypes: string[];
  essayTags: string[];
  noteTags: string[];
}

export interface ExamModuleScore {
  moduleId: StudyModule;
  duration: number; // ms
  correctCount: number;
  totalCount: number;
}

export interface ExamRecord {
  id: string;
  title: string;
  date: number;
  moduleScores: ExamModuleScore[];
  reflection?: string;
}

export interface AppData {
  sessions: StudySession[];
  wrongQuestions: WrongQuestion[];
  notes: ExamNote[];
  examRecords?: ExamRecord[];
  settings: {
    examDate: string | null;
    quotes: string[];
    moduleTargets?: Record<string, number>; // moduleId -> target multiplier (0-1)
  };
  config?: AppConfig;
  /** 阅读打卡记录：日期 -> 已读笔记ID列表 */
  readingCheckIns?: Record<string, string[]>;
}
