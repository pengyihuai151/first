import { get, set, del, clear } from 'idb-keyval';
import { AppData, StudySession, WrongQuestion, ExamNote, ExamRecord } from '../types';

const STORAGE_KEY = 'public_exam_app_data';

export const storage = {
  async getData(): Promise<AppData> {
    const data = await get<AppData>(STORAGE_KEY);
    const defaultData: AppData = {
      sessions: [],
      wrongQuestions: [],
      notes: [],
      examRecords: [],
      settings: { 
        examDate: null,
        quotes: [
          "成功不是终点，失败也不是终结，唯有前进的勇气才是永恒。",
          "积跬步，以至千里；积小流，以成江海。",
          "功不唐捐，玉汝于成。",
          "乾坤未定，你我皆是黑马。",
          "种一棵树最好的时间是十年前，其次是现在。"
        ],
        studyReminderEnabled: false,
        studyReminderMinutes: 60,
        screenWakeLockEnabled: false,
      },
      config: {
        essayTypes: ['金句', '文章结构', '首尾段'],
        essayTags: ['政治', '社会', '生态', '文化', '经济'],
        noteTags: ['公式', '技巧', '反例', '易错点', '口诀']
      },
      readingCheckIns: {}
    };

    if (!data) return defaultData;
    
    // Initialize new fields for migration
    if (!data.examRecords) {
      data.examRecords = [];
    }

    if (!data.config) {
      data.config = defaultData.config;
    }

    // 迁移：旧错题详细知识点 → 新子模块
    const tagMigrationMap: Record<string, string> = {
      // 言语理解 → 逻辑填空
      '逻辑填空-成语辨析': '逻辑填空',
      '逻辑填空-实词搭配': '逻辑填空',
      '逻辑填空-语境对应': '逻辑填空',
      // 言语理解 → 篇章阅读
      '片段阅读-主旨概括': '篇章阅读',
      '片段阅读-意图判断': '篇章阅读',
      '片段阅读-细节理解': '篇章阅读',
      '片段阅读-标题填入': '篇章阅读',
      '语句表达-语句排序': '篇章阅读',
      '语句表达-语句填空': '篇章阅读',
      '语句表达-下文推断': '篇章阅读',
      // 判断推理 → 图形推理
      '图形推理-位置规律': '图形推理',
      '图形推理-样式规律': '图形推理',
      '图形推理-数量规律': '图形推理',
      '图形推理-属性规律': '图形推理',
      '图形推理-空间重构': '图形推理',
      '图形推理-黑白块': '图形推理',
      // 判断推理 → 定义判断
      '定义判断-单/多定义': '定义判断',
      '定义判断-关键词锁定': '定义判断',
      // 判断推理 → 类比推理
      '类比推理-语义关系': '类比推理',
      '类比推理-逻辑关系': '类比推理',
      '类比推理-语法关系': '类比推理',
      // 判断推理 → 逻辑推理
      '逻辑判断-翻译推理': '逻辑推理',
      '逻辑判断-削弱加强': '逻辑推理',
      '逻辑判断-组合排列': '逻辑推理',
      '逻辑判断-日常结论': '逻辑推理',
    };

    data.wrongQuestions = data.wrongQuestions.map(q => {
      if (!q.tags || q.tags.length === 0) return q;
      
      const newTags = q.tags.map(tag => {
        return tagMigrationMap[tag] || tag;
      });
      
      // 去重
      const uniqueTags = [...new Set(newTags)];
      
      return { ...q, tags: uniqueTags };
    });

    return data;
  },

  async saveData(data: AppData): Promise<void> {
    await set(STORAGE_KEY, data);
  },

  async addSession(session: StudySession) {
    const data = await this.getData();
    data.sessions.push(session);
    await this.saveData(data);
  },

  async addWrongQuestion(question: WrongQuestion) {
    const data = await this.getData();
    data.wrongQuestions.push(question);
    await this.saveData(data);
  },

  async updateWrongQuestion(updated: WrongQuestion) {
    const data = await this.getData();
    data.wrongQuestions = data.wrongQuestions.map(q => q.id === updated.id ? updated : q);
    await this.saveData(data);
  },

  async deleteWrongQuestion(id: string) {
    const data = await this.getData();
    data.wrongQuestions = data.wrongQuestions.filter(q => q.id !== id);
    await this.saveData(data);
  },

  async addNote(note: ExamNote) {
    const data = await this.getData();
    data.notes.push(note);
    await this.saveData(data);
  },

  async updateNote(updated: ExamNote) {
    const data = await this.getData();
    data.notes = data.notes.map(n => n.id === updated.id ? updated : n);
    await this.saveData(data);
  },

  async deleteNote(id: string) {
    const data = await this.getData();
    data.notes = data.notes.filter(n => n.id !== id);
    await this.saveData(data);
  },

  async addExamRecord(record: ExamRecord) {
    const data = await this.getData();
    if (!data.examRecords) data.examRecords = [];
    data.examRecords.push(record);
    await this.saveData(data);
  },

  async updateExamRecord(record: ExamRecord) {
    const data = await this.getData();
    if (!data.examRecords) data.examRecords = [];
    data.examRecords = data.examRecords.map(r => r.id === record.id ? record : r);
    await this.saveData(data);
  },

  async deleteExamRecord(id: string) {
    const data = await this.getData();
    if (!data.examRecords) data.examRecords = [];
    data.examRecords = data.examRecords.filter(r => r.id !== id);
    await this.saveData(data);
  },

  async updateSettings(settings: AppData['settings']) {
    const data = await this.getData();
    data.settings = settings;
    await this.saveData(data);
  },

  async resetAll() {
    await del(STORAGE_KEY); // 只删除本应用的数据，不影响其他网站
  },

  async importData(jsonString: string) {
    try {
      const data = JSON.parse(jsonString);
      await this.saveData(data);
    } catch (e) {
      throw new Error('Invalid data format');
    }
  },

  async exportData(): Promise<string> {
    const data = await this.getData();
    return JSON.stringify(data, null, 2);
  }
};
