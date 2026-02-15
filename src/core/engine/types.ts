export enum Phase {
  BRIEF = -1,
  MATERIAL = 0,
  INSIGHT = 1,
  BREAKTHROUGH = 1.5,
  DISCUSSION = 2,
  CONVERGENCE = 3,
  DRAFTING = 4,
  AUDIT = 4.5,
  PUBLISH = 5,
  RETRO = 6
}

export enum AgentRole {
  WRITER = 'writer',
  LOGIC_JUDGE = 'logic_judge',
  FACT_CHECKER = 'fact_checker',
  EMOTION_HACKER = 'emotion_hacker',
  DISSENTER = 'dissenter'
}

export enum ModelProvider {
  DEEPSEEK = 'deepseek',
  CLAUDE = 'claude',
  PERPLEXITY = 'perplexity',
  OPENAI = 'openai'
}

export interface AgentConfig {
  role: AgentRole;
  model: string; // e.g., 'deepseek-reasoner'
  provider: ModelProvider;
  temperature: number;
  systemPrompt?: string;
}

export interface PhaseConfig {
  phase: Phase;
  name: string;
  agents: AgentConfig[];
  nextPhases: Phase[];
}

export interface WorkflowState {
  workflowId: string;
  currentPhase: Phase;
  context: Record<string, any>; // Stores Brief, Angles, Evidence, Draft, etc.
  history: ChatMessage[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: any;
}

export interface ExecutionResult {
  success: boolean;
  output: any;
  error?: string;
  usage?: {
    tokens: number;
    cost?: number;
  };
}
