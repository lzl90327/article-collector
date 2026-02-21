import { EventEmitter } from 'events';

export interface GatingRule {
  fromPhase: string;
  toPhase: string;
  conditions: GatingCondition[];
  logic: 'AND' | 'OR';
  errorMessage: string;
  severity: 'error' | 'warning';
}

export type GatingCondition =
  | { type: 'artifact_exists'; artifactType: string; minVersion?: number }
  | { type: 'field_filled'; field: string; value?: any }
  | { type: 'action_completed'; action: string }
  | { type: 'custom'; check: (context: GatingContext) => boolean | Promise<boolean>; description: string };

export interface GatingContext {
  currentPhaseId: string;
  targetPhaseId: string;
  artifacts: Map<string, any>;
  fields: Map<string, any>;
  completedActions: Set<string>;
  metadata: Record<string, any>;
}

export interface GatingResult {
  allowed: boolean;
  violations: GatingViolation[];
  warnings: GatingWarning[];
}

export interface GatingViolation {
  rule: string;
  condition: GatingCondition;
  message: string;
}

export interface GatingWarning {
  rule: string;
  message: string;
}

export class GatingRules extends EventEmitter {
  private rules: Map<string, GatingRule> = new Map();

  registerRule(rule: GatingRule): void {
    const key = `${rule.fromPhase}->${rule.toPhase}`;
    this.rules.set(key, rule);
    this.emit('rule:registered', { key, rule });
  }

  unregisterRule(fromPhase: string, toPhase: string): void {
    const key = `${fromPhase}->${toPhase}`;
    this.rules.delete(key);
    this.emit('rule:unregistered', { key });
  }

  async validateTransition(
    fromPhase: string,
    toPhase: string,
    context: GatingContext
  ): Promise<GatingResult> {
    const key = `${fromPhase}->${toPhase}`;
    const rule = this.rules.get(key);

    if (!rule) {
      return {
        allowed: true,
        violations: [],
        warnings: []
      };
    }

    const violations: GatingViolation[] = [];
    const warnings: GatingWarning[] = [];

    const conditionResults = await Promise.all(
      rule.conditions.map(async (condition) => {
        const result = await this.evaluateCondition(condition, context);
        return { condition, result };
      })
    );

    const passedConditions = conditionResults.filter(r => r.result);
    const failedConditions = conditionResults.filter(r => !r.result);

    const isAllowed = rule.logic === 'AND'
      ? failedConditions.length === 0
      : passedConditions.length > 0;

    if (!isAllowed) {
      for (const { condition } of failedConditions) {
        violations.push({
          rule: key,
          condition,
          message: this.getConditionErrorMessage(condition)
        });
      }
    } else if (rule.severity === 'warning' && failedConditions.length > 0) {
      for (const { condition } of failedConditions) {
        warnings.push({
          rule: key,
          message: this.getConditionErrorMessage(condition)
        });
      }
    }

    const result: GatingResult = {
      allowed: isAllowed && violations.length === 0,
      violations,
      warnings
    };

    this.emit('transition:validated', {
      fromPhase,
      toPhase,
      result
    });

    return result;
  }

  private async evaluateCondition(
    condition: GatingCondition,
    context: GatingContext
  ): Promise<boolean> {
    switch (condition.type) {
      case 'artifact_exists': {
        const artifact = context.artifacts.get(condition.artifactType);
        if (!artifact) return false;
        if (condition.minVersion !== undefined) {
          return artifact.version >= condition.minVersion;
        }
        return true;
      }

      case 'field_filled': {
        const value = context.fields.get(condition.field);
        if (value === undefined || value === null) return false;
        if (condition.value !== undefined) {
          return value === condition.value;
        }
        if (typeof value === 'string') {
          return value.trim().length > 0;
        }
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return true;
      }

      case 'action_completed': {
        return context.completedActions.has(condition.action);
      }

      case 'custom': {
        try {
          const result = await condition.check(context);
          return result;
        } catch (error) {
          console.error('Custom gating condition failed:', error);
          return false;
        }
      }

      default:
        return false;
    }
  }

  private getConditionErrorMessage(condition: GatingCondition): string {
    switch (condition.type) {
      case 'artifact_exists':
        return `需要 ${condition.artifactType} 类型的产物`;
      case 'field_filled':
        return `需要填写 ${condition.field} 字段`;
      case 'action_completed':
        return `需要完成 ${condition.action} 动作`;
      case 'custom':
        return condition.description || '自定义条件未满足';
      default:
        return '条件未满足';
    }
  }

  getRulesForPhase(phaseId: string): GatingRule[] {
    return Array.from(this.rules.values()).filter(
      rule => rule.fromPhase === phaseId || rule.toPhase === phaseId
    );
  }

  getAllRules(): GatingRule[] {
    return Array.from(this.rules.values());
  }

  clearRules(): void {
    this.rules.clear();
    this.emit('rules:cleared');
  }

  loadFromConfig(configs: Array<{
    from: string;
    to: string;
    conditions: any[];
    logic?: 'AND' | 'OR';
    errorMessage: string;
    severity?: 'error' | 'warning';
  }>): void {
    this.clearRules();

    for (const config of configs) {
      this.registerRule({
        fromPhase: config.from,
        toPhase: config.to,
        conditions: config.conditions,
        logic: config.logic || 'AND',
        errorMessage: config.errorMessage,
        severity: config.severity || 'error'
      });
    }

    this.emit('rules:loaded', { count: configs.length });
  }
}

export function createDefaultGatingRules(): GatingRules {
  const gating = new GatingRules();

  gating.registerRule({
    fromPhase: '2',
    toPhase: '3',
    conditions: [
      { type: 'artifact_exists', artifactType: 'discussion_record', minVersion: 1 }
    ],
    logic: 'AND',
    errorMessage: 'DISCUSSION阶段必须至少完成一轮对话才能进入CONVERGENCE',
    severity: 'error'
  });

  gating.registerRule({
    fromPhase: '3',
    toPhase: '4',
    conditions: [
      { type: 'artifact_exists', artifactType: 'convergence_summary', minVersion: 1 }
    ],
    logic: 'AND',
    errorMessage: 'CONVERGENCE阶段必须生成收敛摘要才能进入DRAFTING',
    severity: 'error'
  });

  gating.registerRule({
    fromPhase: '4',
    toPhase: '4.5',
    conditions: [
      { type: 'artifact_exists', artifactType: 'draft_v1', minVersion: 1 }
    ],
    logic: 'AND',
    errorMessage: 'DRAFTING阶段必须生成初稿才能进入AUDIT',
    severity: 'error'
  });

  gating.registerRule({
    fromPhase: '4.5',
    toPhase: '5',
    conditions: [
      { type: 'artifact_exists', artifactType: 'audit_report', minVersion: 1 },
      { type: 'field_filled', field: 'auditPassed' }
    ],
    logic: 'AND',
    errorMessage: 'AUDIT阶段必须通过审核才能进入PUBLISH',
    severity: 'error'
  });

  return gating;
}
