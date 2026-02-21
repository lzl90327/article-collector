import { EventEmitter } from 'events';

export interface WorkflowMetrics {
  workflowId: string;
  mode: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  phasesCompleted: string[];
  artifactsCreated: number;
  errors: string[];
}

export interface PhaseMetrics {
  phaseId: string;
  workflowId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  substatesCompleted: string[];
  actionsExecuted: string[];
  errors: string[];
}

export interface SystemMetrics {
  timestamp: Date;
  activeWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  averageWorkflowDuration: number;
  phaseCompletionRates: Record<string, number>;
}

export class MetricsCollector extends EventEmitter {
  private workflowMetrics: Map<string, WorkflowMetrics> = new Map();
  private phaseMetrics: Map<string, PhaseMetrics[]> = new Map();
  private systemMetrics: SystemMetrics[] = [];
  private maxHistorySize: number = 1000;

  startWorkflowTracking(workflowId: string, mode: string): void {
    const metrics: WorkflowMetrics = {
      workflowId,
      mode,
      startTime: new Date(),
      phasesCompleted: [],
      artifactsCreated: 0,
      errors: []
    };
    this.workflowMetrics.set(workflowId, metrics);
    this.emit('workflow:started', { workflowId, mode });
  }

  endWorkflowTracking(workflowId: string, success: boolean = true): void {
    const metrics = this.workflowMetrics.get(workflowId);
    if (!metrics) return;

    metrics.endTime = new Date();
    metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();

    this.emit('workflow:ended', {
      workflowId,
      duration: metrics.duration,
      success,
      phasesCompleted: metrics.phasesCompleted.length
    });

    this.updateSystemMetrics();
  }

  recordPhaseStart(workflowId: string, phaseId: string): void {
    const metrics: PhaseMetrics = {
      phaseId,
      workflowId,
      startTime: new Date(),
      substatesCompleted: [],
      actionsExecuted: [],
      errors: []
    };

    if (!this.phaseMetrics.has(workflowId)) {
      this.phaseMetrics.set(workflowId, []);
    }
    this.phaseMetrics.get(workflowId)!.push(metrics);

    this.emit('phase:started', { workflowId, phaseId });
  }

  recordPhaseEnd(workflowId: string, phaseId: string): void {
    const workflowPhases = this.phaseMetrics.get(workflowId);
    if (!workflowPhases) return;

    const phase = workflowPhases.find(p => p.phaseId === phaseId && !p.endTime);
    if (phase) {
      phase.endTime = new Date();
      phase.duration = phase.endTime.getTime() - phase.startTime.getTime();

      const workflow = this.workflowMetrics.get(workflowId);
      if (workflow) {
        workflow.phasesCompleted.push(phaseId);
      }

      this.emit('phase:ended', {
        workflowId,
        phaseId,
        duration: phase.duration
      });
    }
  }

  recordArtifactCreated(workflowId: string, artifactType: string): void {
    const workflow = this.workflowMetrics.get(workflowId);
    if (workflow) {
      workflow.artifactsCreated++;
    }
    this.emit('artifact:created', { workflowId, artifactType });
  }

  recordError(workflowId: string, phaseId: string, error: string): void {
    const workflow = this.workflowMetrics.get(workflowId);
    if (workflow) {
      workflow.errors.push(`${phaseId}: ${error}`);
    }

    const phases = this.phaseMetrics.get(workflowId);
    if (phases) {
      const phase = phases.find(p => p.phaseId === phaseId);
      if (phase) {
        phase.errors.push(error);
      }
    }

    this.emit('error:recorded', { workflowId, phaseId, error });
  }

  private updateSystemMetrics(): void {
    const workflows = Array.from(this.workflowMetrics.values());
    const completed = workflows.filter(w => w.endTime);
    const failed = workflows.filter(w => w.errors.length > 0);

    const avgDuration = completed.length > 0
      ? completed.reduce((sum, w) => sum + (w.duration || 0), 0) / completed.length
      : 0;

    const phaseRates: Record<string, number> = {};
    workflows.forEach(w => {
      w.phasesCompleted.forEach(phaseId => {
        phaseRates[phaseId] = (phaseRates[phaseId] || 0) + 1;
      });
    });

    const metrics: SystemMetrics = {
      timestamp: new Date(),
      activeWorkflows: workflows.filter(w => !w.endTime).length,
      completedWorkflows: completed.length,
      failedWorkflows: failed.length,
      averageWorkflowDuration: avgDuration,
      phaseCompletionRates: phaseRates
    };

    this.systemMetrics.push(metrics);

    // Keep only recent history
    if (this.systemMetrics.length > this.maxHistorySize) {
      this.systemMetrics = this.systemMetrics.slice(-this.maxHistorySize);
    }

    this.emit('system:metrics', metrics);
  }

  getWorkflowMetrics(workflowId: string): WorkflowMetrics | undefined {
    return this.workflowMetrics.get(workflowId);
  }

  getPhaseMetrics(workflowId: string): PhaseMetrics[] {
    return this.phaseMetrics.get(workflowId) || [];
  }

  getSystemMetrics(): SystemMetrics {
    const recent = this.systemMetrics[this.systemMetrics.length - 1];
    return recent || {
      timestamp: new Date(),
      activeWorkflows: 0,
      completedWorkflows: 0,
      failedWorkflows: 0,
      averageWorkflowDuration: 0,
      phaseCompletionRates: {}
    };
  }

  getAllWorkflowMetrics(): WorkflowMetrics[] {
    return Array.from(this.workflowMetrics.values());
  }

  clear(): void {
    this.workflowMetrics.clear();
    this.phaseMetrics.clear();
    this.systemMetrics = [];
    this.emit('metrics:cleared');
  }
}

export const metricsCollector = new MetricsCollector();
