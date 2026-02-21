/**
 * 苏格拉底式提问服务
 * Phase 1.2: Socratic Questioning Mode
 *
 * 功能：
 * 1. 六层递进问题链（What → Why → If → So → Meta）
 * 2. 澄清性问题、假设探究、原因证据、视角观点、推论后果、元问题
 * 3. 模式切换（"切换回乒乓球"）
 */

import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { chatCompletion } from './deepseek.service';

/**
 * 苏格拉底问题层级
 */
export type SocraticLevel =
  | 'clarification'   // 澄清：这是什么意思？
  | 'assumption'      // 假设：你的前提是什么？
  | 'evidence'        // 证据：为什么这样认为？
  | 'perspective'     // 视角：其他观点怎么看？
  | 'implication'     // 推论：如果这样，会怎样？
  | 'meta';           // 元问题：这个问题本身合理吗？

/**
 * 苏格拉底问题
 */
export interface SocraticQuestion {
  id: string;
  level: SocraticLevel;
  question: string;
  context: string;        // 生成这个问题的上下文
  depth: number;          // 当前深度（1-6）
  parentId?: string;      // 父问题ID（用于追踪问题链）
  answer?: string;        // 用户回答
  createdAt: string;
}

/**
 * 苏格拉底会话
 */
export interface SocraticSession {
  id: string;
  topic: string;          // 探讨主题
  currentDepth: number;   // 当前深度
  questions: SocraticQuestion[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 层级配置
 */
const LEVEL_CONFIG: Record<SocraticLevel, {
  name: string;
  description: string;
  promptTemplate: string;
}> = {
  clarification: {
    name: '澄清',
    description: '澄清概念和定义',
    promptTemplate: '请针对以下主题提出一个澄清性问题，帮助明确核心概念：\n\n主题：{topic}\n\n要求：\n1. 询问"这是什么意思？"\n2. 帮助明确核心概念\n3. 避免过于宽泛',
  },
  assumption: {
    name: '假设',
    description: '探究隐含前提',
    promptTemplate: '基于之前的回答，请提出一个关于隐含假设的问题：\n\n主题：{topic}\n上下文：{context}\n\n要求：\n1. 询问"你的前提是什么？"\n2. 揭示未明说的假设\n3. 挑战默认前提',
  },
  evidence: {
    name: '证据',
    description: '追问原因和证据',
    promptTemplate: '基于之前的回答，请提出一个关于证据和原因的问题：\n\n主题：{topic}\n上下文：{context}\n\n要求：\n1. 询问"为什么这样认为？"\n2. 要求提供证据或理由\n3. 质疑因果关系',
  },
  perspective: {
    name: '视角',
    description: '探索其他观点',
    promptTemplate: '基于之前的回答，请提出一个关于其他视角的问题：\n\n主题：{topic}\n上下文：{context}\n\n要求：\n1. 询问"其他观点怎么看？"\n2. 引入反对意见或替代视角\n3. 考虑不同立场',
  },
  implication: {
    name: '推论',
    description: '探讨后果和影响',
    promptTemplate: '基于之前的回答，请提出一个关于推论和后果的问题：\n\n主题：{topic}\n上下文：{context}\n\n要求：\n1. 询问"如果这样，会怎样？"\n2. 探索逻辑后果\n3. 考虑短期和长期影响',
  },
  meta: {
    name: '元问题',
    description: '反思问题本身',
    promptTemplate: '基于整个探讨过程，请提出一个元层面的问题：\n\n主题：{topic}\n探讨历史：{context}\n\n要求：\n1. 询问"这个问题本身合理吗？"\n2. 反思探讨框架\n3. 质疑基本假设',
  },
};

/**
 * 创建苏格拉底式提问会话
 * @param topic 探讨主题
 */
export async function createSocraticSession(topic: string): Promise<SocraticSession> {
  logger.info(`Creating Socratic session for topic: ${topic}`);

  const sessionId = `socratic-${Date.now()}`;
  const now = new Date().toISOString();

  // 生成第一个澄清性问题
  const firstQuestion = await generateQuestion(topic, 'clarification', 1);

  const session: SocraticSession = {
    id: sessionId,
    topic,
    currentDepth: 1,
    questions: [firstQuestion],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  // 保存到数据库
  try {
    await prisma.socraticSession.create({
      data: {
        id: sessionId,
        topic,
        current_depth: 1,
        questions_json: session.questions as any,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  } catch (error) {
    logger.error('Save Socratic session failed:', error);
  }

  return session;
}

/**
 * 生成苏格拉底式问题
 * @param topic 主题
 * @param level 问题层级
 * @param depth 深度
 * @param context 上下文（可选）
 */
async function generateQuestion(
  topic: string,
  level: SocraticLevel,
  depth: number,
  context?: string
): Promise<SocraticQuestion> {
  const config = LEVEL_CONFIG[level];
  const prompt = config.promptTemplate
    .replace('{topic}', topic)
    .replace('{context}', context || '刚开始探讨');

  try {
    const response = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是一个苏格拉底式的提问者，擅长通过层层递进的问题引导深入思考。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    return {
      id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level,
      question: response.content.trim(),
      context: context || topic,
      depth,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Generate Socratic question failed:', error);
    // 返回默认问题
    return {
      id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level,
      question: getDefaultQuestion(level, topic),
      context: context || topic,
      depth,
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * 获取默认问题（当AI生成失败时使用）
 */
function getDefaultQuestion(level: SocraticLevel, topic: string): string {
  const defaults: Record<SocraticLevel, string> = {
    clarification: `关于"${topic}"，你能更清楚地解释一下核心概念吗？`,
    assumption: `在讨论"${topic}"时，你隐含的前提假设是什么？`,
    evidence: `你为什么这样认为关于"${topic}"？有什么证据支持？`,
    perspective: `关于"${topic}"，持不同观点的人会怎么看？`,
    implication: `如果关于"${topic}"的观点成立，会有什么后果？`,
    meta: `我们关于"${topic}"的探讨方式本身有什么问题吗？`,
  };
  return defaults[level];
}

/**
 * 获取下一个问题层级
 */
function getNextLevel(currentLevel: SocraticLevel): SocraticLevel {
  const levels: SocraticLevel[] = [
    'clarification',
    'assumption',
    'evidence',
    'perspective',
    'implication',
    'meta',
  ];
  const currentIndex = levels.indexOf(currentLevel);
  return levels[Math.min(currentIndex + 1, levels.length - 1)];
}

/**
 * 回答当前问题并获取下一个问题
 * @param sessionId 会话ID
 * @param answer 用户回答
 */
export async function answerAndProgress(
  sessionId: string,
  answer: string
): Promise<{ session: SocraticSession | null; nextQuestion: SocraticQuestion | null }> {
  logger.info(`Processing answer for session: ${sessionId}`);

  try {
    // 获取会话
    const record = await prisma.socraticSession.findUnique({
      where: { id: sessionId },
    });

    if (!record || !record.is_active) {
      return { session: null, nextQuestion: null };
    }

    const questions = record.questions_json as unknown as SocraticQuestion[];
    const currentQuestion = questions[questions.length - 1];

    // 保存回答
    currentQuestion.answer = answer;

    // 确定下一个层级
    const nextLevel = getNextLevel(currentQuestion.level);
    const nextDepth = currentQuestion.depth + 1;

    // 如果已经达到最大深度，结束会话
    if (nextDepth > 6) {
      await prisma.socraticSession.update({
        where: { id: sessionId },
        data: {
          questions_json: questions as any,
          is_active: false,
          updated_at: new Date(),
        },
      });

      return {
        session: {
          id: record.id,
          topic: record.topic,
          currentDepth: nextDepth,
          questions,
          isActive: false,
          createdAt: record.created_at.toISOString(),
          updatedAt: new Date().toISOString(),
        },
        nextQuestion: null,
      };
    }

    // 生成下一个问题
    const context = questions.map(q => `Q: ${q.question}\nA: ${q.answer || '(未回答)'}`).join('\n\n');
    const nextQuestion = await generateQuestion(record.topic, nextLevel, nextDepth, context);
    nextQuestion.parentId = currentQuestion.id;

    questions.push(nextQuestion);

    // 更新会话
    await prisma.socraticSession.update({
      where: { id: sessionId },
      data: {
        current_depth: nextDepth,
        questions_json: questions as any,
        updated_at: new Date(),
      },
    });

    const session: SocraticSession = {
      id: record.id,
      topic: record.topic,
      currentDepth: nextDepth,
      questions,
      isActive: true,
      createdAt: record.created_at.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { session, nextQuestion };
  } catch (error) {
    logger.error('Answer and progress failed:', error);
    return { session: null, nextQuestion: null };
  }
}

/**
 * 获取当前问题
 * @param sessionId 会话ID
 */
export async function getCurrentQuestion(
  sessionId: string
): Promise<SocraticQuestion | null> {
  try {
    const record = await prisma.socraticSession.findUnique({
      where: { id: sessionId },
    });

    if (!record || !record.is_active) {
      return null;
    }

    const questions = record.questions_json as unknown as SocraticQuestion[];
    return questions[questions.length - 1] || null;
  } catch (error) {
    logger.error('Get current question failed:', error);
    return null;
  }
}

/**
 * 获取会话状态
 * @param sessionId 会话ID
 */
export async function getSession(sessionId: string): Promise<SocraticSession | null> {
  try {
    const record = await prisma.socraticSession.findUnique({
      where: { id: sessionId },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      topic: record.topic,
      currentDepth: record.current_depth,
      questions: record.questions_json as unknown as SocraticQuestion[],
      isActive: record.is_active,
      createdAt: record.created_at.toISOString(),
      updatedAt: record.updated_at.toISOString(),
    };
  } catch (error) {
    logger.error('Get session failed:', error);
    return null;
  }
}

/**
 * 结束苏格拉底会话
 * @param sessionId 会话ID
 */
export async function endSession(sessionId: string): Promise<boolean> {
  try {
    await prisma.socraticSession.update({
      where: { id: sessionId },
      data: {
        is_active: false,
        updated_at: new Date(),
      },
    });
    return true;
  } catch (error) {
    logger.error('End session failed:', error);
    return false;
  }
}

/**
 * 获取会话历史摘要
 * @param sessionId 会话ID
 */
export async function getSessionSummary(
  sessionId: string
): Promise<{
  topic: string;
  totalQuestions: number;
  answeredQuestions: number;
  depthReached: number;
  summary: string;
} | null> {
  try {
    const session = await getSession(sessionId);
    if (!session) {
      return null;
    }

    const answeredQuestions = session.questions.filter(q => q.answer).length;

    // 生成摘要
    const prompt = `请对以下苏格拉底式探讨进行简要总结：

主题：${session.topic}

问答记录：
${session.questions.map(q => `Q[${LEVEL_CONFIG[q.level].name}]: ${q.question}\nA: ${q.answer || '(未回答)'}`).join('\n\n')}

请总结：
1. 核心洞察（1-2句话）
2. 关键转折点（如果有）
3. 未解决的问题（如果有）`;

    const response = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是一个擅长总结对话的分析师。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });

    return {
      topic: session.topic,
      totalQuestions: session.questions.length,
      answeredQuestions,
      depthReached: session.currentDepth,
      summary: response.content.trim(),
    };
  } catch (error) {
    logger.error('Get session summary failed:', error);
    return null;
  }
}

/**
 * 切换到乒乓球模式
 * 结束苏格拉底会话，返回探讨总结
 * @param sessionId 会话ID
 */
export async function switchToPingPong(sessionId: string): Promise<{
  success: boolean;
  summary: string;
  insights: string[];
}> {
  logger.info(`Switching to ping-pong mode for session: ${sessionId}`);

  try {
    const session = await getSession(sessionId);
    if (!session) {
      return { success: false, summary: '会话不存在', insights: [] };
    }

    // 结束苏格拉底会话
    await endSession(sessionId);

    // 生成总结和洞察
    const prompt = `基于以下苏格拉底式探讨，提取关键洞察用于后续乒乓球式探讨：

主题：${session.topic}

问答记录：
${session.questions.map(q => `Q[${LEVEL_CONFIG[q.level].name}]: ${q.question}\nA: ${q.answer || '(未回答)'}`).join('\n\n')}

请输出JSON格式：
{
  "summary": "整体总结（1-2句话）",
  "insights": ["洞察1", "洞察2", "洞察3"]
}

洞察应该：
1. 可以直接用于后续探讨
2. 是具体的观点而非泛泛而谈
3. 最多3个核心洞察`;

    const response = await chatCompletion({
      messages: [
        {
          role: 'system',
          content: '你是一个擅长提炼关键洞察的分析师。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });

    const result = JSON.parse(extractJson(response.content));

    return {
      success: true,
      summary: result.summary || '已切换到乒乓球探讨模式',
      insights: result.insights || [],
    };
  } catch (error) {
    logger.error('Switch to ping-pong failed:', error);
    return {
      success: true,
      summary: '已切换到乒乓球探讨模式',
      insights: [],
    };
  }
}

/**
 * 提取 JSON 字符串
 */
function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  const genericBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
  if (genericBlockMatch) {
    return genericBlockMatch[1].trim();
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return text;
}

/**
 * 获取活跃会话列表
 * @param limit 数量限制
 */
export async function getActiveSessions(
  limit: number = 10
): Promise<Array<{ id: string; topic: string; currentDepth: number; createdAt: string }>> {
  try {
    const records = await prisma.socraticSession.findMany({
      where: { is_active: true },
      orderBy: { updated_at: 'desc' },
      take: limit,
      select: {
        id: true,
        topic: true,
        current_depth: true,
        created_at: true,
      },
    });

    return records.map((r: any) => ({
      id: r.id,
      topic: r.topic,
      currentDepth: r.current_depth,
      createdAt: r.created_at.toISOString(),
    }));
  } catch (error) {
    logger.error('Get active sessions failed:', error);
    return [];
  }
}
