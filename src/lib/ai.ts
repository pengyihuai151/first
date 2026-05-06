/**
 * AI 服务层 - 支持多种国内 AI API
 * 
 * 支持的提供商：
 * 1. 硅基流动 (SiliconFlow) - 默认，免费额度充足
 * 2. DeepSeek - 高性价比
 * 3. 智谱 AI - 国内稳定
 * 4. 自定义 OpenAI 兼容 API
 * 
 * 使用方式：
 * - 设置 VITE_AI_API_KEY 环境变量
 * - 选择对应的 VITE_AI_PROVIDER
 */

/// <reference types="vite/client" />

// 环境变量配置
const API_KEY = (import.meta.env.VITE_AI_API_KEY as string | undefined) || '';
const BASE_URL = (import.meta.env.VITE_AI_BASE_URL as string | undefined) || 'https://api.siliconflow.cn/v1';
const MODEL = (import.meta.env.VITE_AI_MODEL as string | undefined) || 'deepseek-ai/DeepSeek-V2.5';

// 系统提示词
const SYSTEM_PROMPT = `你是公考备考助手「上岸小帮手」，帮助用户高效备考。

重要规则：
1. 回复简洁，控制在 150 字以内
2. 不要重复相同的词语或句子
3. 不要使用 Markdown 格式
4. 直接回答，不要说"好的"或"我来帮你分析"之类的废话
5. 结合用户数据给出具体建议`;

// 用户画像提示词
function buildUserProfilePrompt(data: {
  wrongQuestions: any[];
  examRecords: any[];
  sessions: any[];
  settings: any;
}) {
  const { wrongQuestions, examRecords, sessions, settings } = data;
  
  // 统计各模块错题
  const moduleStats = [...new Set(wrongQuestions.map(q => q.moduleId))].map(moduleId => {
    const moduleQs = wrongQuestions.filter(q => q.moduleId === moduleId);
    const masteredCount = moduleQs.filter(q => q.mastered).length;
    const tags = moduleQs.flatMap(q => q.tags || []).reduce((acc: Record<string, number>, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});
    const topTags = Object.entries(tags).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 3);
    
    return {
      moduleId,
      total: moduleQs.length,
      mastered: masteredCount,
      masteryRate: moduleQs.length > 0 ? (masteredCount / moduleQs.length * 100).toFixed(1) : 0,
      topTags
    };
  });

  // 统计学习时长
  const totalStudyTime = sessions.reduce((acc: number, s) => acc + s.duration, 0);
  const todayTime = sessions
    .filter(s => {
      const today = new Date();
      const sessionDate = new Date(s.createdAt);
      return sessionDate.toDateString() === today.toDateString();
    })
    .reduce((acc: number, s) => acc + s.duration, 0);

  // 模考统计
  const examStats = (examRecords || []).slice(-5).map(r => ({
    date: new Date(r.createdAt).toLocaleDateString(),
    score: r.score,
    total: r.total,
    rate: ((r.score / r.total) * 100).toFixed(1)
  }));

  return `
【用户学习画像】

📊 错题统计：
${moduleStats.length > 0 ? moduleStats.map(m => `- ${m.moduleId}：共 ${m.total} 题，掌握 ${m.masteryRate}%${
  m.topTags.length > 0 ? `\n  薄弱点：${m.topTags.map(t => `${t[0]}(${t[1]}次)`).join('、')}` : ''
}`).join('\n') : '暂无错题记录'}

📈 模考最近5次：
${examStats.length > 0 
  ? examStats.map(e => `- ${e.date}：${e.score}/${e.total} (${e.rate}%)`).join('\n')
  : '暂无模考记录'}

⏱️ 学习时长：
- 今日：${(todayTime / 60000).toFixed(0)} 分钟
- 累计：${(totalStudyTime / 3600000).toFixed(1)} 小时

🎯 目标：每日 ${settings?.dailyTarget || 30} 分钟
`;
}

// 通用 API 调用
async function callAI(messages: Array<{ role: string; content: string }>, maxTokens = 500): Promise<{ text: string; error?: boolean }> {
  if (!API_KEY) {
    return { text: '请先配置 AI API Key', error: true };
  }

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      let errorMessage = `API 请求失败: ${response.status}`;
      try {
        const errorData = JSON.parse(await response.text());
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // 解析失败，使用原始状态码
      }
      return { text: errorMessage, error: true };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '无回复';
    return { text: cleanText(content) };
  } catch (error: any) {
    console.error('AI 调用失败:', error);
    return { text: `网络错误: ${error.message}`, error: true };
  }
}

// 流式 API 调用
async function callAIStream(
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
  maxTokens = 500
): Promise<{ text: string; error?: boolean }> {
  if (!API_KEY) {
    return { text: '请先配置 AI API Key', error: true };
  }

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        stream: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { text: `API 请求失败: ${response.status}`, error: true };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return { text: '无法读取响应流', error: true };
    }

    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              onChunk(content);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    return { text: cleanText(fullText) };
  } catch (error: any) {
    console.error('AI 流式调用失败:', error);
    return { text: `网络错误: ${error.message}`, error: true };
  }
}

// 生成分析
export async function generateAnalysis(
  data: {
    wrongQuestions: any[];
    examRecords: any[];
    sessions: any[];
    settings: any;
  },
  question?: string
) {
  const userProfile = buildUserProfilePrompt(data);
  
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userProfile }
  ];

  if (question) {
    messages.push({ role: 'user', content: question });
  }

  return callAI(messages, 500);
}

// 流式生成分析
export async function streamAnalysis(
  data: {
    wrongQuestions: any[];
    examRecords: any[];
    sessions: any[];
    settings: any;
  },
  question?: string,
  onChunk?: (text: string) => void
) {
  const userProfile = buildUserProfilePrompt(data);
  
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userProfile }
  ];

  if (question) {
    messages.push({ role: 'user', content: question });
  }

  return callAIStream(messages, onChunk || (() => {}), 500);
}

// 快速问答（不传入用户数据）
export async function quickAsk(question: string) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: question }
  ];

  return callAI(messages, 300);
}

// 过滤重复词和叠词（增强版）
export function cleanText(text: string): string {
  // 多次迭代清理，确保彻底
  for (let i = 0; i < 3; i++) {
    // 移除连续3个及以上相同字符（如 "好好好" → "好"）
    text = text.replace(/(.)\1{2,}/g, '$1');
    
    // 移除无空格连续重复词（如 "建议建议" → "建议"）
    text = text.replace(/(.{2,})\1+/g, '$1');
    
    // 移除有空格连续重复词（如 "建议 建议" → "建议"）
    text = text.replace(/(\S+)( \1)+/g, '$1');
    
    // 移除句内重复（如 "建议建议你" 可能需要更复杂的处理，这里简化）
    text = text.replace(/([\u4e00-\u9fa5]{2,})\1+/g, '$1');
  }
  
  // 移除多余的空格和标点
  text = text.replace(/([，。！？、])\1+/g, '$1'); // 连续标点
  text = text.replace(/\s+/g, ' ').trim();
  
  // 移除开头和结尾的重复
  text = text.replace(/^(.+)\1+$/g, '$1');
  
  return text;
}

// 检查 API 是否可用
export function isAIEnabled(): boolean {
  return !!API_KEY;
}

// 获取当前配置信息
export function getAIConfig() {
  return {
    enabled: isAIEnabled(),
    provider: import.meta.env.VITE_AI_PROVIDER || 'siliconflow',
    model: MODEL,
    baseUrl: BASE_URL
  };
}
