import { EventEmitter } from 'events';
import { PhaseConfig } from '../config/PhaseLoader';
import { artifactManager } from '../artifact/ArtifactManager';

export interface GatingCheck {
  phaseId: string;
  workflowId: string;
  direction: 'entry' | 'exit';
}

export interface GatingResult {
  allowed: boolean;
  violations: GatingViolation[];
  warnings: GatingWarning[];
}

export interface GatingViolation {
  rule: string;
  message: string;
  severity: 'blocking' | 'critical';
}

export interface GatingWarning {
  rule: string;
  message: string;
  suggestion?: string;
}

export interface GatingContext {
  workflowId: string;
  currentPhase: string;
  targetPhase: string;
  artifacts: Map<string, any>;
  history: string[];
}

export class GatingEnforcer extends EventEmitter {
  private rules: Map<string, Function> = new Map();

  constructor() {
    super();
    this.registerDefaultRules();
  }

  async checkEntry(
    phaseConfig: PhaseConfig,
    workflowId: string,
    fromPhase?: string
  ): Promise<GatingResult> {
    const violations: GatingViolation[] = [];
    const warnings: GatingWarning[] = [];

    const context = await this.buildContext(workflowId, fromPhase || '', String(phaseConfig.phase.id));

    // Check entry condition from config
    const entryCondition = phaseConfig.entry.condition;
    if (entryCondition && entryCondition !== 'any' && entryCondition !== 'manual') {
      // For now, simplified check - in real implementation would evaluate the condition
      const result = await this.evaluateCondition({ type: entryCondition }, context, 'entry');
      
      if (!result.satisfied) {
        violations.push({
          rule: 'entry_condition',
          message: result.message || `Entry condition not met: ${entryCondition}`,
          severity: 'blocking'
        });
      }
    }

    const result: GatingResult = {
      allowed: violations.length === 0,
      violations,
      warnings
    };

    this.emit('gating:check', {
      phaseId: phaseConfig.phase.id,
      workflowId,
      direction: 'entry',
      result
    });

    return result;
  }

  async checkExit(
    phaseConfig: PhaseConfig,
    workflowId: string,
    toPhase?: string
  ): Promise<GatingResult> {
    const violations: GatingViolation[] = [];
    const warnings: GatingWarning[] = [];

    const context = await this.buildContext(workflowId, String(phaseConfig.phase.id), toPhase || '');

    // Check exit condition from config
    const exitCondition = phaseConfig.exit.condition;
    if (exitCondition && exitCondition !== 'any' && exitCondition !== 'manual') {
      // For now, simplified check
      const result = await this.evaluateCondition({ type: exitCondition }, context, 'exit');
      
      if (!result.satisfied) {
        violations.push({
          rule: 'exit_condition',
          message: result.message || `Exit condition not met: ${exitCondition}`,
          severity: 'blocking'
        });
      }
    }

    const result: GatingResult = {
      allowed: violations.length === 0,
      violations,
      warnings
    };

    this.emit('gating:check', {
      phaseId: phaseConfig.phase.id,
      workflowId,
      direction: 'exit',
      result
    });

    return result;
  }

  private async buildContext(
    workflowId: string,
    currentPhase: string,
    targetPhase: string
  ): Promise<GatingContext> {
    const artifacts = new Map<string, any>();
    
    const allArtifacts = await artifactManager.listArtifacts(workflowId);
    for (const artifact of allArtifacts) {
      const latest = artifact.versions[artifact.versions.length - 1];
      if (latest) {
        artifacts.set(artifact.type, latest.content);
      }
    }

    return {
      workflowId,
      currentPhase,
      targetPhase,
      artifacts,
      history: []
    };
  }

  private async evaluateCondition(
    condition: any,
    context: GatingContext,
    direction: 'entry' | 'exit'
  ): Promise<{ satisfied: boolean; message?: string; suggestion?: string }> {
    const evaluator = this.rules.get(condition.type);
    
    if (!evaluator) {
      // If no specific evaluator, assume condition is satisfied
      return { satisfied: true };
    }

    try {
      return await evaluator(condition, context, direction);
    } catch (error) {
      return {
        satisfied: false,
        message: `Error evaluating condition: ${error}`,
        suggestion: 'Check condition configuration'
      };
    }
  }

  registerRule(name: string, evaluator: Function): void {
    this.rules.set(name, evaluator);
    this.emit('rule:registered', { name });
  }

  private registerDefaultRules(): void {
    this.rules.set('artifact_exists', async (condition: any, context: GatingContext) => {
      const artifactType = condition.artifact_type;
      const exists = context.artifacts.has(artifactType);
      
      return {
        satisfied: exists,
        message: exists ? undefined : `Required artifact '${artifactType}' not found`,
        suggestion: exists ? undefined : `Create ${artifactType} before proceeding`
      };
    });

    this.rules.set('field_filled', async (condition: any, context: GatingContext) => {
      const { artifact_type, field, min_length = 1 } = condition;
      const artifact = context.artifacts.get(artifact_type);
      
      if (!artifact) {
        return {
          satisfied: false,
          message: `Artifact '${artifact_type}' not found`,
          suggestion: `Create ${artifact_type} first`
        };
      }

      const value = artifact[field];
      const isFilled = value && 
        (typeof value === 'string' ? value.length >= min_length : true);
      
      return {
        satisfied: isFilled,
        message: isFilled ? undefined : `Field '${field}' in '${artifact_type}' must have at least ${min_length} characters`,
        suggestion: `Fill in the ${field} field`
      };
    });

    this.rules.set('phase_completed', async (condition: any, context: GatingContext) => {
      const { phase_id } = condition;
      const completed = context.history.includes(phase_id);
      
      return {
        satisfied: completed,
        message: completed ? undefined : `Phase '${phase_id}' must be completed first`,
        suggestion: `Complete phase ${phase_id} before proceeding`
      };
    });

    this.rules.set('word_count', async (condition: any, context: GatingContext) => {
      const { artifact_type, field, min } = condition;
      const artifact = context.artifacts.get(artifact_type);
      
      if (!artifact) {
        return {
          satisfied: false,
          message: `Artifact '${artifact_type}' not found`,
          suggestion: `Create ${artifact_type} first`
        };
      }

      const value = artifact[field];
      if (typeof value !== 'string') {
        return {
          satisfied: false,
          message: `Field '${field}' is not a string`,
          suggestion: 'Check field type'
        };
      }

      const wordCount = value.split(/\s+/).length;
      const meetsRequirement = wordCount >= min;
      
      return {
        satisfied: meetsRequirement,
        message: meetsRequirement ? undefined : `Field '${field}' needs at least ${min} words (current: ${wordCount})`,
        suggestion: `Add more content to reach ${min} words`
      };
    });

    this.rules.set('convergence_complete', async (condition: any, context: GatingContext) => {
      const convergence = context.artifacts.get('convergence');
      
      if (!convergence) {
        return {
          satisfied: false,
          message: 'Convergence artifact not found',
          suggestion: 'Complete convergence phase first'
        };
      }

      const hasSelectedAngle = convergence.selected_angle !== undefined;
      const hasStructure = convergence.structure && Object.keys(convergence.structure).length > 0;
      
      return {
        satisfied: hasSelectedAngle && hasStructure,
        message: (hasSelectedAngle && hasStructure) ? undefined : 'Convergence incomplete: need selected angle and structure',
        suggestion: hasSelectedAngle ? 'Define the article structure' : 'Select a writing angle'
      };
    });

    this.rules.set('audit_passed', async (condition: any, context: GatingContext) => {
      const audit = context.artifacts.get('audit_report');
      
      if (!audit) {
        return {
          satisfied: false,
          message: 'Audit report not found',
          suggestion: 'Complete audit phase first'
        };
      }

      const passed = audit.overall_pass === true;
      
      return {
        satisfied: passed,
        message: passed ? undefined : 'Audit did not pass - fix issues before proceeding',
        suggestion: 'Address the audit findings'
      };
    });
  }

  getRegisteredRules(): string[] {
    return Array.from(this.rules.keys());
  }
}

export const gatingEnforcer = new GatingEnforcer();
