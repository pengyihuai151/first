/**
 * AI 服务层 - 支持多种国内 AI API
 * 
 * 推荐模型优先级：
 * 1. 智谱 GLM-4-Flash - 免费额度大，国内稳定
 * 2. 硅基流动 Qwen2.5-72B - 能力强
 * 3. DeepSeek-V2.5 - 性价比高
 */

/// <reference types="vite/client" />

// 从 localStorage 读取配置（优先级高于环境变量）
function getConfig() {
  const savedKey = localStorage.getItem('ai_api_key');
  const savedUrl = localStorage.getItem('ai_base_url');
  const savedModel = localStorage.getItem('ai_model');
  return {
    apiKey: savedKey || (import.meta.env.VITE_AI_API_KEY as string | undefined) || '',
    baseUrl: savedUrl || (import.meta.env.VITE_AI_BASE_URL as string | undefined) || 'https://open.bigmodel.cn/api/paas/v4',
    model: savedModel || (import.meta.env.VITE_AI_MODEL as string | undefined) || 'glm-4-flash'
  };
}

// 系统提示词
const SYSTEM_PROMPT = `你是公考备考助手，专门帮助用户高效备考。

要求：
1. 只基于用户提供的真实数据回答，不要编造数据
2. 回复简洁，100字以内
3. 不要重复词语或句子
4. 直接给出建议，不要客套话
5. 如果用户有部分数据（如错题、学习时长），先分析有数据的部分，不要只说"暂无相关数据"
6. 优先根据错题和学习时长给出建议，没有模考记录没关系
7. 如果模考记录中有"反思"内容，要结合反思分析用户自我认知到的优势和不足，给出针对性建议`;

// 构建用户画像
function buildUserProfilePrompt(data: {
  wrongQuestions: any[];
  examRecords: any[];
  sessions: any[];
  settings: any;
  notes?: any[]; // 实际笔记字段
  targetExams?: any[]; // 目标考试
}) {
  const { wrongQuestions = [], examRecords = [], sessions = [], settings, notes = [], targetExams = [] } = data;
  
  // 错题统计
  const totalWrong = wrongQuestions.length;
  const masteredWrong = wrongQuestions.filter((q: any) => q.mastered).length;
  const unMasteredWrong = totalWrong - masteredWrong;
  
  // 按模块统计
  const modules = ['言语理解', '判断推理', '数量关系', '资料分析', '常识判断', '政治'];
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
      rate: modQuestions.length > 0 ? parseFloat((mastered / modQuestions.length * 100).toFixed(1)) : 0,
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
  const avgScore = totalQuestions > 0 ? parseFloat((totalCorrect / totalQuestions * 100).toFixed(1)) : null;
  
  // 学习时长
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayTime = sessions
    .filter((s: any) => s.startTime >= todayStart)
    .reduce((acc: number, s: any) => acc + s.duration, 0);
  
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  const weekTime = sessions
    .filter((s: any) => s.startTime >= weekStart)
    .reduce((acc: number, s: any) => acc + s.duration, 0);
  
  const totalTime = sessions.reduce((acc: number, s: any) => acc + s.duration, 0);
  
  // 笔记统计
  const noteCount = notes?.length || 0;
  
  // 错误原因统计
  const errorReasons = wrongQuestions.filter((q: any) => q.errorReason).map((q: any) => q.errorReason);
  const reasonStats: Record<string, number> = {};
  errorReasons.forEach((r: string) => { reasonStats[r] = (reasonStats[r] || 0) + 1; });
  const topReasons = Object.entries(reasonStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
  
  // 学习天数
  const studyDays = new Set(sessions.map((s: any) => new Date(s.startTime).toDateString())).size;
  
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
  const modules = ['言语理解', '判断推理', '数量关系', '资料分析', '常识判断', '政治'];
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
  const pct = totalCount > 0 ? parseFloat(((totalCorrect / totalCount) * 100).toFixed(1)) : 0;
  const refl = r.reflection ? `\n  反思：${r.reflection}` : '';
  
  // 子模块详情
  const subDetails: string[] = [];
  (r.moduleScores || []).forEach((ms: any) => {
    const modPct = ms.totalCount > 0 ? parseFloat(((ms.correctCount / ms.totalCount) * 100).toFixed(1)) : 0;
    const modTime = ms.duration ? Math.round(ms.duration / 60000) : 0;
    subDetails.push(`  ${ms.moduleId}：${ms.correctCount}/${ms.totalCount}（${modPct}%），用时${modTime}分钟`);
    
    // 子模块详情
    (ms.subScores || []).forEach((ss: any) => {
      const subPct = ss.totalCount > 0 ? parseFloat(((ss.correctCount / ss.totalCount) * 100).toFixed(1)) : 0;
      const subTime = ss.duration ? Math.round(ss.duration / 60000) : 0;
      subDetails.push(`    - ${ss.subTopic}：${ss.correctCount}/${ss.totalCount}（${subPct}%），用时${subTime}分钟`);
    });
  });
  
  return `• 第${recentExams.length - i}次：${totalCorrect}/${totalCount}（${pct}%）${refl}${subDetails.length > 0 ? '\n' + subDetails.join('\n') : ''}`;
}).join('\n') : '- 暂无模考记录'}

⏱️ 学习时长：
- 今日：${Math.round(todayTime / 60000)} 分钟
- 本周：${Math.round(weekTime / 3600000 * 10) / 10} 小时
- 累计：${Math.round(totalTime / 3600000 * 10) / 10} 小时
- 学习天数：${studyDays} 天

📊 学习时间趋势：
${(() => {
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
  
  const lastWeekSessions = sessions.filter((s: any) => s.startTime > oneWeekAgo);
  const prevWeekSessions = sessions.filter((s: any) => s.startTime > twoWeeksAgo && s.startTime <= oneWeekAgo);
  
  const lastWeekTime = lastWeekSessions.reduce((acc: number, s: any) => acc + s.duration, 0);
  const prevWeekTime = prevWeekSessions.reduce((acc: number, s: any) => acc + s.duration, 0);
  
  const lastWeekHours = Math.round(lastWeekTime / 3600000 * 10) / 10;
  const prevWeekHours = Math.round(prevWeekTime / 3600000 * 10) / 10;
  
  const trend = prevWeekHours > 0 ? Math.round((lastWeekHours - prevWeekHours) / prevWeekHours * 100) : 0;
  const trendText = trend > 0 ? `上升 ${trend}%` : trend < 0 ? `下降 ${Math.abs(trend)}%` : '持平';
  
  return `- 近7天：${lastWeekHours} 小时
- 前7天：${prevWeekHours} 小时
- 趋势：${trendText}`;
})()}

🎯 目标考试：
${(() => {
  if (targetExams.length === 0) return '- 暂无目标考试';
  
  const now = new Date();
  const upcomingExams = targetExams
    .map((e: any) => ({
      ...e,
      dateObj: new Date(e.date),
      daysLeft: Math.ceil((new Date(e.date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    }))
    .filter((e: any) => e.daysLeft >= 0)
    .sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  
  if (upcomingExams.length === 0) return '- 无即将到来的考试';
  
  const nearest = upcomingExams[0];
  return `- 最近：${nearest.name}（${nearest.date}）
- 倒计时：${nearest.daysLeft} 天
${upcomingExams.length > 1 ? `- 共 ${upcomingExams.length} 场目标考试` : ''}`;
})()}

📚 笔记数量：${noteCount} 篇

🎯 每日目标：${settings?.dailyTarget || 30} 分钟`;
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
  const config = getConfig();
  if (!config.apiKey) {
    return { text: '请先配置 AI API Key', error: true };
  }

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
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
  const config = getConfig();
  if (!config.apiKey) {
    return { text: '请先配置 AI API Key', error: true };
  }

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
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
  return !!getConfig().apiKey;
}

export function getAIConfig() {
  const config = getConfig();
  return {
    enabled: !!config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl
  };
}
