/**
 * Mode Router - 双核模式路由
 * argument_mode: 观点文模式
 * observation_mode: 观察文模式
 */

import { logger } from '../utils/logger';
import { PhaseRegistry, PhaseContext } from '../phases';
import type { Session } from '@prisma/client';

/**
 * 写作模式
 */
export type WritingMode = 'argument' | 'observation';

/**
 * 模式配置
 */
interface ModeConfig {
  name: string;
  description: string;
  phases: string[];
  phaseFlow: Record<string, {
    next: string | null;
    conditions?: Record<string, string>;
  }>;
}

/**
 * 模式配置映射
 */
const MODE_CONFIGS: Record<WritingMode, ModeConfig> = {
  argument: {
    name: '观点文模式',
    description: '适合撰写有明确论点的论述性文章',
    phases: ['-1', '2', '3', '4', '4.5', '5'],
    phaseFlow: {
      '-1': { next: '2', conditions: { brief_confirmed: 'true' } },
      '2': { next: '3', conditions: { discussions_completed: 'true' } },
      '3': { next: '4', conditions: { outline_confirmed: 'true' } },
      '4': { next: '4.5', conditions: { draft_generated: 'true' } },
      '4.5': { next: '5', conditions: { audit_passed: 'true' } },
      '5': { next: null },
    },
  },
  observation: {
    name: '观察文模式',
    description: '适合撰写基于观察和分析的描述性文章',
    phases: ['-1', '2', '3', '4', '5'],
    phaseFlow: {
      '-1': { next: '2', conditions: { brief_confirmed: 'true' } },
      '2': { next: '3', conditions: { discussions_completed: 'true' } },
      '3': { next: '4', conditions: { outline_confirmed: 'true' } },
      '4': { next: '5', conditions: { draft_generated: 'true' } },
      '5': { next: null },
    },
  },
};

/**
 * 获取模式配置
 */
export function getModeConfig(mode: WritingMode): ModeConfig {
  return MODE_CONFIGS[mode];
}

/**
 * 获取所有模式
 */
export function getAllModes(): Array<{ id: WritingMode; name: string; description: string }> {
  return Object.entries(MODE_CONFIGS).map(([id, config]) => ({
    id: id as WritingMode,
    name: config.name,
    description: config.description,
  }));
}

/**
 * 获取下一个 Phase
 */
export function getNextPhase(
  mode: WritingMode,
  currentPhase: string,
  state: Record<string, any>
): string | null {
  const config = MODE_CONFIGS[mode];
  const flow = config.phaseFlow[currentPhase];

  if (!flow) {
    return null;
  }

  // 检查条件
  if (flow.conditions) {
    for (const [key, expectedValue] of Object.entries(flow.conditions)) {
      const actualValue = String(state[key] ?? '');
      if (actualValue !== expectedValue) {
        return null; // 条件不满足，停留在当前阶段
      }
    }
  }

  return flow.next;
}

/**
 * 执行模式路由
 */
export async function routePhase(
  mode: WritingMode,
  context: PhaseContext
): Promise<{
  success: boolean;
  nextPhase: string | null;
  result?: any;
  error?: string;
}> {
  const currentPhase = context.session.phase;
  const phase = PhaseRegistry.get(currentPhase);

  if (!phase) {
    return {
      success: false,
      nextPhase: null,
      error: `Phase not found: ${currentPhase}`,
    };
  }

  try {
    // 执行当前 Phase
    const result = await phase.execute(context);

    if (!result.success) {
      return {
        success: false,
        nextPhase: currentPhase,
        error: result.error,
      };
    }

    // 确定下一个 Phase
    const state = context.session.state_json as Record<string, any> || {};
    const nextPhase = result.nextPhase || getNextPhase(mode, currentPhase, state);

    return {
      success: true,
      nextPhase,
      result,
    };
  } catch (error) {
    logger.error('Phase routing failed:', error);
    return {
      success: false,
      nextPhase: currentPhase,
      error: (error as Error).message,
    };
  }
}

/**
 * 获取模式进度
 */
export function getModeProgress(
  mode: WritingMode,
  currentPhase: string,
  state: Record<string, any>
): {
  currentStep: number;
  totalSteps: number;
  percentage: number;
  phaseName: string;
} {
  const config = MODE_CONFIGS[mode];
  const phases = config.phases;
  const currentIndex = phases.indexOf(currentPhase);

  // 获取当前 Phase 名称
  const phase = PhaseRegistry.get(currentPhase);
  const phaseName = phase?.getName() || currentPhase;

  return {
    currentStep: currentIndex + 1,
    totalSteps: phases.length,
    percentage: Math.round(((currentIndex + 1) / phases.length) * 100),
    phaseName,
  };
}

/**
 * 验证模式选择
 */
export function validateModeSelection(
  mode: WritingMode,
  topic: string,
  context?: string
): { valid: boolean; suggestion?: string; reason?: string } {
  // 观点文模式验证
  if (mode === 'argument') {
    // 检查是否有明确的论点倾向
    const argumentIndicators = ['应该', '需要', '必须', '重要的是', '关键在于'];
    const hasArgumentIndicator = argumentIndicators.some(indicator =>
      topic.includes(indicator) || (context && context.includes(indicator))
    );

    if (!hasArgumentIndicator) {
      return {
        valid: true,
        suggestion: '当前话题可能没有明确的论点，建议考虑使用观察文模式',
        reason: '未检测到明确的论点关键词',
      };
    }
  }

  // 观察文模式验证
  if (mode === 'observation') {
    // 检查是否更适合观察描述
    const observationIndicators = ['现象', '趋势', '变化', '发现', '观察到'];
    const hasObservationIndicator = observationIndicators.some(indicator =>
      topic.includes(indicator) || (context && context.includes(indicator))
    );

    if (!hasObservationIndicator) {
      return {
        valid: true,
        suggestion: '当前话题可能包含论证要素，建议考虑使用观点文模式',
        reason: '未检测到明显的观察描述关键词',
      };
    }
  }

  return { valid: true };
}

/**
 * 推荐写作模式
 */
export function recommendMode(topic: string, context?: string): WritingMode {
  const argumentScore = calculateArgumentScore(topic, context);
  const observationScore = calculateObservationScore(topic, context);

  return argumentScore >= observationScore ? 'argument' : 'observation';
}

/**
 * 计算观点文匹配度
 */
function calculateArgumentScore(topic: string, context?: string): number {
  const indicators = [
    '应该', '需要', '必须', '重要的是', '关键在于',
    '我认为', '我们相信', '由此可见', '因此',
    '论证', '论据', '论点', '反驳', '批判',
  ];

  let score = 0;
  const text = `${topic} ${context || ''}`;

  indicators.forEach(indicator => {
    if (text.includes(indicator)) {
      score += 1;
    }
  });

  return score;
}

/**
 * 计算观察文匹配度
 */
function calculateObservationScore(topic: string, context?: string): number {
  const indicators = [
    '现象', '趋势', '变化', '发现', '观察到',
    '数据显示', '研究表明', '调查发现', '注意到',
    '描述', '记录', '呈现', '展示', '分析',
  ];

  let score = 0;
  const text = `${topic} ${context || ''}`;

  indicators.forEach(indicator => {
    if (text.includes(indicator)) {
      score += 1;
    }
  });

  return score;
}
