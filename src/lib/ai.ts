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
const SYSTEM_PROMPT = `你是公考备考助手「上岸小帮手」，专注于帮助用户高效备考公务员/事业单位考试。

你的职责：
1. 分析用户的错题数据，发现薄弱知识点
2. 根据学习数据给出针对性的备考建议
3. 帮助制定合理的复习计划
4. 解答备考过程中的疑问

回复要求：
- 简洁明了，突出重点
- 结合用户实际数据给出建议
- 使用友好的语气，像朋友一样交流
- 如有数据支撑，请引用具体数字
- 控制在 200 字以内
- 不要使用 Markdown 格式，纯文本回复`;

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
    return { text: data.choices?.[0]?.message?.content || '无回复' };
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

    return { text: fullText };
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
