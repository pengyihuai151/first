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
        moduleTargets: {
          '言语理解': 0.8,
          '判断推理': 0.8,
          '资料分析': 0.8,
          '数量关系': 0.5,
          '政治': 0.5,
          '常识判断': 0, // No specific limit
        }
      },
      config: {
        essayTypes: ['金句', '文章结构', '首尾段'],
        essayTags: ['政治', '社会', '生态', '文化', '经济'],
        noteTags: ['公式', '技巧', '反例', '易错点', '口诀'],
        reasonTags: {
          '言语理解': ['语境提示漏看', '词义辨析模糊', '偷换概念', '忽视作者态度'],
          '判断推理': ['图形特征没找准', '限定条件漏看', '逻辑推导断层', '定义要点不全'],
          '数量关系': ['公式记错', '计算失误', '题目陷阱没发现', '思路错误'],
          '资料分析': ['找数找错', '计算粗心', '公式应用错误', '单位换算错误'],
          '常识判断': ['知识盲区', '考向偏移', '关键词漏读', '过于主观'],
          '政治': ['考点遗忘', '时政了解不够', '概念对比混淆', '细节陷阱'],
          '申论': ['材料找不齐', '逻辑不通顺', '字数超限', '卷面不整洁']
        },
        hierarchicalReasons: {
          '言语理解': [
            { id: '1', name: '逻辑填空', children: [{ id: '1-1', name: '成语辨析', children: [] }, { id: '1-2', name: '实词搭配', children: [] }] },
            { id: '2', name: '片段阅读', children: [{ id: '2-1', name: '主旨概括', children: [] }, { id: '2-2', name: '意图判断', children: [] }] }
          ]
        }
      }
    };

    if (!data) return defaultData;
    
    // Initialize new fields for migration
    if (!data.examRecords) {
      data.examRecords = [];
    }

    if (!data.settings.moduleTargets) {
      data.settings.moduleTargets = defaultData.settings.moduleTargets;
    }
    
    // Merge if config is missing in existing data
    if (!data.config) {
      data.config = defaultData.config;
    } else {
      // Migrate reasonTags if it's still an array
      if (Array.isArray((data.config as any).reasonTags)) {
        data.config.reasonTags = defaultData.config!.reasonTags;
      }
      if (!data.config.hierarchicalReasons) {
        data.config.hierarchicalReasons = defaultData.config!.hierarchicalReasons;
      }
    }
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
    await clear();
  },

  async importData(jsonString: string) {
    try {
      const data = JSON.parse(jsonString);
      await this.saveData(data);
    } catch (e) {
      throw new Error('Invalid data format');
    }
  }
};
