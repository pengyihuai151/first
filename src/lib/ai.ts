/**
 * AI 服务层 - 支持多种国内 AI API
 * 
 * 推荐模型优先级：
 * 1. 智谱 GLM-4-Flash - 免费额度大，国内稳定
 * 2. 硅基流动 Qwen2.5-72B - 能力强
 * 3. DeepSeek-V2.5 - 性价比高
 */

/// <reference types="vite/client" />

// 环境变量配置
const API_KEY = (import.meta.env.VITE_AI_API_KEY as string | undefined) || '';
const BASE_URL = (import.meta.env.VITE_AI_BASE_URL as string | undefined) || 'https://open.bigmodel.cn/api/paas/v4';
const MODEL = (import.meta.env.VITE_AI_MODEL as string | undefined) || 'glm-4-flash';

// 系统提示词
const SYSTEM_PROMPT = `你是公考备考助手，专门帮助用户高效备考。

要求：
1. 只基于用户提供的真实数据回答，不要编造数据
2. 回复简洁，100字以内
3. 不要重复词语或句子
4. 直接给出建议，不要客套话
5. 如果用户有部分数据（如错题、学习时长），先分析有数据的部分，不要只说"暂无相关数据"
6. 优先根据错题和学习时长给出建议，没有模考记录没关系`;

// 构建用户画像
function buildUserProfilePrompt(data: {
  wrongQuestions: any[];
  examRecords: any[];
  sessions: any[];
  settings: any;
  examNotes?: any[];
}) {
  const { wrongQuestions = [], examRecords = [], sessions = [], settings, examNotes = [] } = data;
  
  // 错题统计
  const totalWrong = wrongQuestions.length;
  const masteredWrong = wrongQuestions.filter((q: any) => q.mastered).length;
  const unMasteredWrong = totalWrong - masteredWrong;
  
  // 按模块统计
  const modules = ['言语理解', '判断推理', '数量关系', '资料分析', '常识判断', '政治理论'];
  const moduleStats = modules.map(mod => {
    const modQuestions = wrongQuestions.filter((q: any) => q.moduleId === mod);
    const mastered = modQuestions.filter((q: any) => q.mastered).length;
    const tags = modQuestions.flatMap((q: any) => q.tags || []);
    const tagCount: Record<string, number> = {};
    tags.forEach((t: string) => { tagCount[t] = (tagCount[t] || 0) + 1; });
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return {
      name: mod,
      total: modQuestions.length,
      mastered,
      rate: modQuestions.length > 0 ? Math.round(mastered / modQuestions.length * 100) : 0,
      topTags
    };
  }).filter(m => m.total > 0);
  
  // 模考统计
  const recentExams = examRecords.slice(-5);
  let totalCorrect = 0;
  let totalQuestions = 0;
  recentExams.forEach((r: any) => {
    (r.moduleScores || []).forEach((ms: any) => {
      if (ms.totalCount > 0) {
        totalCorrect += ms.correctCount || 0;
        totalQuestions += ms.totalCount || 0;
      }
    });
  });
  const avgScore = totalQuestions > 0 ? Math.round(totalCorrect / totalQuestions * 100) : null;
  
  // 学习时长
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayTime = sessions
    .filter((s: any) => s.createdAt >= todayStart)
    .reduce((acc: number, s: any) => acc + s.duration, 0);
  
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  const weekTime = sessions
    .filter((s: any) => s.createdAt >= weekStart)
    .reduce((acc: number, s: any) => acc + s.duration, 0);
  
  const totalTime = sessions.reduce((acc: number, s: any) => acc + s.duration, 0);
  
  // 笔记统计
  const noteCount = (data as any).examNotes?.length || 0;
  
  // 错误原因统计
  const errorReasons = wrongQuestions.filter((q: any) => q.errorReason).map((q: any) => q.errorReason);
  const reasonStats: Record<string, number> = {};
  errorReasons.forEach((r: string) => { reasonStats[r] = (reasonStats[r] || 0) + 1; });
  const topReasons = Object.entries(reasonStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
  
  // 学习天数
  const studyDays = new Set(sessions.map((s: any) => new Date(s.createdAt).toDateString())).size;
  
  return `【学习数据】

📌 错题情况：
- 总错题：${totalWrong} 题
- 已掌握：${masteredWrong} 题
- 待复习：${unMasteredWrong} 题

${moduleStats.length > 0 ? moduleStats.map(m => 
  `• ${m.name}：${m.total}题（掌握${m.rate}%）${m.topTags.length > 0 ? ` | 高频错点：${m.topTags.map(t => `${t[0]}(${t[1]}次)`).join('、')}` : ''}`
).join('\n') : '- 各模块暂无错题'}

🔍 错误原因分析：
${topReasons.length > 0 ? topReasons.map(r => `• ${r[0]}：${r[1]}次`).join('\n') : '- 暂无错误原因记录'}

📊 知识点细分排行（按模块）：
${(() => {
  const modules = ['言语理解', '判断推理', '数量关系', '资料分析', '常识判断', '政治理论'];
  const lines: string[] = [];
  modules.forEach(mod => {
    const modQuestions = wrongQuestions.filter((q: any) => q.moduleId === mod);
    if (modQuestions.length === 0) return;
    
    // 统计每个知识点的错题
    const pointCount: Record<string, number> = {};
    modQuestions.forEach((q: any) => {
      const tags = q.tags || [];
      if (tags.length === 0) {
        pointCount['未分类'] = (pointCount['未分类'] || 0) + 1;
      } else {
        tags.forEach((t: string) => { pointCount[t] = (pointCount[t] || 0) + 1; });
      }
    });
    const sortedPoints = Object.entries(pointCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    if (sortedPoints.length > 0) {
      lines.push(`• ${mod}（共${modQuestions.length}题）：`);
      sortedPoints.forEach(([p, c]) => {
        lines.push(`  - ${p}：${c}题`);
      });
    }
  });
  return lines.length > 0 ? lines.join('\n') : '- 暂无知识点数据';
})()}

📝 模考记录：
${recentExams.length > 0 ? recentExams.map((r: any, i: number) => {
  const totalCorrect = (r.moduleScores || []).reduce((s: number, ms: any) => s + (ms.correctCount || 0), 0);
  const totalCount = (r.moduleScores || []).reduce((s: number, ms: any) => s + (ms.totalCount || 0), 0);
  const pct = totalCount > 0 ? Math.round(totalCorrect / totalCount * 100) : 0;
  return `• 第${recentExams.length - i}次：${totalCorrect}/${totalCount}（${pct}%）`;
}).join('\n') : '- 暂无模考记录'}

⏱️ 学习时长：
- 今日：${Math.round(todayTime / 60000)} 分钟
- 本周：${Math.round(weekTime / 3600000 * 10) / 10} 小时
- 累计：${Math.round(totalTime / 3600000 * 10) / 10} 小时
- 学习天数：${studyDays} 天

📚 笔记数量：${noteCount} 篇

🎯 目标：每日 ${settings?.dailyTarget || 30} 分钟`;
}

// 过滤重复词
export function cleanText(text: string): string {
  let prev = '';
  let maxIterations = 10;
  
  while (prev !== text && maxIterations-- > 0) {
    prev = text;
    text = text.replace(/(.)\1+/g, '$1');
    text = text.replace(/([\u4e00-\u9fa5]{2,4})\1+/g, '$1');
  }
  
  return text.trim();
}

// API 调用
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
        temperature: 0.5,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = JSON.parse(await response.text()).error || JSON.parse(await response.text());
      const message = errorData.message || `请求失败: ${response.status}`;
      return { text: message, error: true };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '无回复';
    return { text: cleanText(content) };
  } catch (error: any) {
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
        temperature: 0.5,
        stream: true
      })
    });

    if (!response.ok) {
      const errorData = JSON.parse(await response.text()).error || JSON.parse(await response.text());
      const message = errorData.message || `请求失败: ${response.status}`;
      return { text: message, error: true };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return { text: '无法读取响应', error: true };
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
          } catch (e) {}
        }
      }
    }

    return { text: cleanText(fullText) };
  } catch (error: any) {
    return { text: `网络错误: ${error.message}`, error: true };
  }
}

// 生成分析
export async function generateAnalysis(
  data: any,
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
  data: any,
  question: string,
  onChunk: (text: string) => void
) {
  const userProfile = buildUserProfilePrompt(data);
  
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userProfile }
  ];

  if (question) {
    messages.push({ role: 'user', content: question });
  }

  return callAIStream(messages, onChunk, 500);
}

// 快速问答
export async function quickAsk(question: string) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: question }
  ];

  return callAI(messages, 300);
}

// 检查配置
export function isAIEnabled(): boolean {
  return !!API_KEY;
}

export function getAIConfig() {
  return {
    enabled: isAIEnabled(),
    model: MODEL,
    baseUrl: BASE_URL
  };
}
