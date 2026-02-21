/**
 * ModeRouter - 双核模式路由
 * 支持 argument_mode / observation_mode / observation_journal_mode
 */

export type WritingMode = 'argument_mode' | 'observation_mode' | 'observation_journal_mode';

export interface ModeDetectionResult {
  mode: WritingMode;
  confidence: number;
  signals: string[];
  override?: boolean;
}

export class ModeRouter {
  /**
   * 自动检测写作模式
   */
  detectMode(input: string, context?: any): ModeDetectionResult {
    const signals: string[] = [];
    let argumentScore = 0;
    let observationScore = 0;
    let journalScore = 0;

    const input_lower = input.toLowerCase();

    // Argument Mode 信号（命中任意 2 项）
    const argumentSignals = [
      { pattern: /我认为|本质是|问题在于|应该|不应该/, weight: 1, name: '判断表达' },
      { pattern: /论证|反驳|结构化输出|成文|发布|提炼观点/, weight: 1, name: '写作意图' }
    ];

    for (const signal of argumentSignals) {
      if (signal.pattern.test(input_lower)) {
        argumentScore += signal.weight;
        signals.push(`argument:${signal.name}`);
      }
    }

    // Observation Mode 信号（命中任意 1 项优先）
    const observationSignals = [
      { pattern: /今天|刚刚|在路上|回家|过年|看到|听到/, weight: 2, name: '场景描述' },
      { pattern: /记录一下|随便写写|不想讲道理|先记个片段/, weight: 2, name: '记录意图' }
    ];

    for (const signal of observationSignals) {
      if (signal.pattern.test(input_lower)) {
        observationScore += signal.weight;
        signals.push(`observation:${signal.name}`);
      }
    }

    // Observation Journal Mode 信号
    const journalSignals = [
      { pattern: /润成可回看的记录|观察随想|记录随想/, weight: 3, name: '日记意图' },
      { pattern: /更日记感|不要论证|先保留现场/, weight: 3, name: '风格要求' }
    ];

    for (const signal of journalSignals) {
      if (signal.pattern.test(input_lower)) {
        journalScore += signal.weight;
        signals.push(`journal:${signal.name}`);
      }
    }

    // 决策逻辑
    // 优先级：journal > observation > argument
    let detectedMode: WritingMode = 'argument_mode';
    let confidence = 0;

    if (journalScore > 0) {
      detectedMode = 'observation_journal_mode';
      confidence = Math.min(journalScore / 3, 1.0);
    } else if (observationScore > 0) {
      detectedMode = 'observation_mode';
      confidence = Math.min(observationScore / 2, 1.0);
    } else if (argumentScore >= 2) {
      detectedMode = 'argument_mode';
      confidence = Math.min(argumentScore / 2, 1.0);
    } else {
      // 默认回落到 observation_mode（降低记录门槛）
      detectedMode = 'observation_mode';
      confidence = 0.5;
      signals.push('default:observation_mode');
    }

    return {
      mode: detectedMode,
      confidence,
      signals
    };
  }

  /**
   * 显式切换模式
   */
  switchMode(targetMode: WritingMode, currentMode?: WritingMode): ModeDetectionResult {
    return {
      mode: targetMode,
      confidence: 1.0,
      signals: [`explicit_switch:from_${currentMode || 'unknown'}_to_${targetMode}`],
      override: true
    };
  }

  /**
   * 获取模式对应的 Phase 流程
   */
  getModePhases(mode: WritingMode): (number | string)[] {
    switch (mode) {
      case 'argument_mode':
        return [-1, 0, 0.5, 0.8, 1, 1.5, 2, 3, 4, 4.3, 4.5, 4.8, 5, 5.5, 6];
      case 'observation_mode':
        return [-1, 0, 0.5, 0.8, 1, 1.5, 2, '2-C', '2-D', 4.3, 4.8, 5, 5.5, 6];
      case 'observation_journal_mode':
        return [-1, 0, 0.5, 0.8, 1, '2-C', '2-D', 4.3, 4.8, 5, 5.5, 6];
      default:
        return [-1, 1.5, 2, 3, 4, 4.5, 5];
    }
  }

  /**
   * 检查是否需要模式切换提示
   */
  shouldPromptModeSwitch(currentMode: WritingMode, input: string): boolean {
    const detection = this.detectMode(input);
    
    // 如果检测到的模式与当前模式不同，且置信度较高
    if (detection.mode !== currentMode && detection.confidence > 0.7) {
      return true;
    }
    
    return false;
  }

  /**
   * 生成模式切换建议
   */
  generateModeSwitchSuggestion(currentMode: WritingMode, detectedMode: WritingMode): string {
    const suggestions: Record<string, Record<string, string>> = {
      'argument_mode': {
        'observation_mode': '看起来您想记录一些生活片段，是否切换到观察模式？',
        'observation_journal_mode': '看起来您想写日记式的记录，是否切换到观察随想模式？'
      },
      'observation_mode': {
        'argument_mode': '看起来您想进行观点论证，是否切换到论证写作模式？',
        'observation_journal_mode': '看起来您想整理成日记式文章，是否切换到观察随想成文模式？'
      },
      'observation_journal_mode': {
        'argument_mode': '看起来您想进行观点论证，是否切换到论证写作模式？',
        'observation_mode': '看起来您想自由记录，是否切换到观察日志模式？'
      }
    };

    return suggestions[currentMode]?.[detectedMode] || '是否切换写作模式？';
  }
}

// 导出单例
export const modeRouter = new ModeRouter();
