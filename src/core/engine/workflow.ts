import { WorkflowState, Phase, ChatMessage } from './types';
import { LLMService } from '../services/llm';
import { logger } from '../../utils/logger';

export class WorkflowEngine {
  private state: WorkflowState;

  constructor(workflowId: string) {
    this.state = {
      workflowId,
      currentPhase: Phase.BRIEF, // Start at Brief
      context: {},
      history: []
    };
  }

  public async processInput(input: string): Promise<string> {
    // Add user message to history
    this.state.history.push({
      role: 'user',
      content: input,
      timestamp: Date.now()
    });

    try {
      // 1. Determine current phase logic
      const response = await this.executePhaseLogic(input);

      // Add assistant message to history
      this.state.history.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      });

      return response;
    } catch (error) {
      logger.error('Workflow execution failed', error);
      return "抱歉，MindFlow 遇到了一些内部乱流，请稍后再试。";
    }
  }

  private async executePhaseLogic(input: string): Promise<string> {
    switch (this.state.currentPhase) {
      case Phase.BRIEF:
        return this.handleBriefPhase(input);
      case Phase.BREAKTHROUGH:
        return this.handleBreakthroughPhase(input);
      // ... handle other phases
      default:
        return "当前阶段尚未实现。";
    }
  }

  private async handleBriefPhase(input: string): Promise<string> {
    // Logic for Phase -1 (Brief Contract)
    // Call LLM to extract/confirm brief
    return "正在为您生成写作 Brief，请稍候..."; 
  }

  private async handleBreakthroughPhase(input: string): Promise<string> {
    // Logic for Phase 1.5 (DeepSeek R1 Debate)
    return "正在进行对抗式破题...";
  }

  // State Management
  public getState(): WorkflowState {
    return this.state;
  }
}
