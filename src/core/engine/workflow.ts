import { WorkflowState, Phase, ChatMessage, ModelProvider, AgentRole, AuditReport } from './types';
import { LLMService } from '../services/llm';
import { logger } from '../../utils/logger';
import { PromptManager } from '../prompts/manager';
import { MODEL_CONFIG } from '../../config/models';
import { repository } from '../services/repository';

const AUDITORS = [
  { role: AgentRole.LOGIC_JUDGE, focus: '逻辑漏洞与推演严密性', model: MODEL_CONFIG.auditors.logic, provider: ModelProvider.DEEPSEEK },
  { role: AgentRole.FACT_CHECKER, focus: '事实准确性与数据来源', model: MODEL_CONFIG.auditors.fact, provider: ModelProvider.PERPLEXITY },
  { role: AgentRole.EMOTION_HACKER, focus: '情感共鸣与情绪曲线', model: MODEL_CONFIG.auditors.emotion, provider: ModelProvider.CLAUDE },
  { role: AgentRole.DISSENTER, focus: '批判性思维与反面论证', model: MODEL_CONFIG.auditors.dissenter, provider: ModelProvider.DEEPSEEK },
  { role: AgentRole.STRUCTURE_ARCHITECT, focus: '文章结构与节奏', model: MODEL_CONFIG.writer, provider: ModelProvider.DEEPSEEK },
  { role: AgentRole.GRAMMAR_POLICE, focus: '语言表达与修辞', model: MODEL_CONFIG.writer, provider: ModelProvider.DEEPSEEK },
  { role: AgentRole.VIRAL_MARKETER, focus: '传播属性与标题吸引力', model: MODEL_CONFIG.writer, provider: ModelProvider.DEEPSEEK }
];

export class WorkflowEngine {
  private state: WorkflowState;
  private initialized: boolean = false;

  constructor(workflowId: string) {
    this.state = {
      workflowId,
      currentPhase: Phase.BRIEF, // Start at Brief
      context: {},
      history: []
    };
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    
    // Try load from DB
    const persistedState = await repository.loadState(this.state.workflowId);
    if (persistedState) {
        this.state = persistedState;
        logger.info(`Loaded workflow ${this.state.workflowId} from DB`);
    } else {
        // New workflow, save initial state
        await repository.saveState(this.state);
    }
    this.initialized = true;
  }

  public async processInputStream(input: string, onChunk: (chunk: string) => void): Promise<string> {
    if (!this.initialized) await this.init();

    // Add user message to history
    const userMsg: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    };
    this.state.history.push(userMsg);
    await repository.appendMessage(this.state.workflowId, userMsg);

    try {
      let response = "";

      if (this.state.currentPhase === Phase.DISCUSSION) {
        // Stream Logic for Discussion Phase
        response = await this.handleDiscussionPhaseStream(input, onChunk);
      } else {
        // Fallback to normal logic for other phases
        response = await this.executePhaseLogic(input);
        onChunk(response);
      }

      // Add assistant message to history (after stream completes)
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };
      this.state.history.push(assistantMsg);
      await repository.appendMessage(this.state.workflowId, assistantMsg);
      
      // Save full state
      await repository.saveState(this.state);

      return response;
    } catch (error) {
      logger.error('Workflow execution failed', error);
      const errMsg = "抱歉，MindFlow 遇到了一些内部乱流，请稍后再试。";
      onChunk(errMsg);
      return errMsg;
    }
  }

  private async handleDiscussionPhaseStream(input: string, onChunk: (chunk: string) => void): Promise<string> {
    // Check if user selected an angle (first input in this phase)
    if (!this.state.context.selectedAngle) {
        // Extract pure angle from input if possible
        // Input format: "Selected Angles: A, B\nSupplemental Thoughts: ..."
        let cleanAngle = input;
        const match = input.match(/Selected Angles: (.*?)(?:\n|$)/);
        if (match && match[1]) {
            cleanAngle = match[1];
        }
        
        this.state.context.selectedAngle = cleanAngle; 
        const msg = `好的，我们锁定切入点：【${cleanAngle}】。请告诉我您对这个方向的初步想法。`;
        onChunk(msg);
        return msg;
    }

    const brief = this.state.context.brief;
    const history = this.state.history.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n');

    const prompt = PromptManager.getPrompt('DISCUSSION_SOCRATIC', {
      angle: this.state.context.selectedAngle,
      thesis: brief.thesis,
      target_audience: brief.target_audience,
      chatHistory: history
    });

    try {
        const response = await LLMService.streamChatCompletion({
            provider: ModelProvider.DEEPSEEK,
            model: 'deepseek-reasoner',
            messages: [{ role: 'user', content: prompt }]
        }, onChunk);

        if (response.includes('[DONE]')) {
            this.state.currentPhase = Phase.DRAFTING;
            // Notify frontend about transition (optional, maybe frontend detects [DONE])
        }

        return response;
    } catch (err) {
        logger.error('Discussion stream failed', err);
        const errMsg = "讨论遇到问题，请重试。";
        onChunk(errMsg);
        return errMsg;
    }
  }

  public async processInput(input: string): Promise<string> {
    if (!this.initialized) await this.init();

    // Add user message to history
    const userMsg: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    };
    this.state.history.push(userMsg);
    await repository.appendMessage(this.state.workflowId, userMsg);

    try {
      // 1. Determine current phase logic
      const response = await this.executePhaseLogic(input);

      // Add assistant message to history
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      };
      this.state.history.push(assistantMsg);
      await repository.appendMessage(this.state.workflowId, assistantMsg);
      
      // Save full state (context, phase, etc.)
      await repository.saveState(this.state);

      return response;
    } catch (error) {
      logger.error('Workflow execution failed', error);
      return "抱歉，MindFlow 遇到了一些内部乱流，请稍后再试。";
    }
  }

  private async executePhaseLogic(input: string): Promise<string> {
    const previousPhase = this.state.currentPhase;
    let response = "";

    switch (this.state.currentPhase) {
      case Phase.BRIEF:
        response = await this.handleBriefPhase(input);
        break;
      case Phase.BREAKTHROUGH:
        response = await this.handleBreakthroughPhase(input);
        break;
      case Phase.DISCUSSION:
        response = await this.handleDiscussionPhase(input);
        break;
      case Phase.DRAFTING:
        response = await this.handleDraftingPhase();
        break;
      case Phase.AUDIT:
        response = await this.handleAuditPhase();
        break;
      case Phase.PUBLISH:
        response = await this.handleFinalPolishPhase();
        break;
      default:
        response = "当前阶段尚未实现。";
    }

    if (previousPhase !== this.state.currentPhase) {
        await repository.saveState(this.state);
    }
    return response;
  }

  private async handleBriefPhase(input: string): Promise<string> {
    // If brief exists, and we are called again (e.g. by triggerPhase), 
    // it means user confirmed it. So move to next phase.
    if (this.state.context.brief) {
        this.state.currentPhase = Phase.BREAKTHROUGH;
        return this.handleBreakthroughPhase(input);
    }

    logger.info(`[Phase -1] Generating Brief for: ${input}`);
    
    // MOCK FALLBACK for Brief Phase
    // In production, this should only activate if LLM fails or is in dev mode
    try {
        /* 
        // Real LLM Call (Commented out for initial dev testing without keys)
        const prompt = PromptManager.getPrompt('BRIEF_GENERATION', { userInput: input });
        const result = await LLMService.chatCompletion({
            provider: ModelProvider.DEEPSEEK,
            model: MODEL_CONFIG.writer,
            messages: [{ role: 'user', content: prompt }],
            jsonMode: true
        });
        const brief = JSON.parse(result);
        */
       
       // Mock Data
       const brief = {
           thesis: `关于 "${input}" 的核心论点：焦虑本质上是对失控的恐惧，AI 只是放大镜。`,
           target_audience: "关注个人成长的知识工作者",
           existing_belief: "认为AI会取代自己，必须疯狂学习技术细节才能生存",
           change_goal: "从对抗心态转变为驾驭心态，关注'道'而非'术'",
           core_conflict: "技术进步的指数级速度 vs 人类适应的线性速度",
           emotional_tone: "理性但带有同理心"
       };

      // Store brief in context
      this.state.context.brief = brief;
      
      // Do NOT auto-transition. Wait for user confirmation.
      // this.state.currentPhase = Phase.BREAKTHROUGH;

      return JSON.stringify({
        type: 'BRIEF_CARD',
        data: brief,
        message: "这是为您生成的 Brief，请确认。"
      });
    } catch (err) {
      logger.error('Failed to generate brief', err);
      return "生成 Brief 失败，请重试。";
    }
  }

  private async handleBreakthroughPhase(input: string): Promise<string> {
    const brief = this.state.context.brief;
    if (!brief) {
      return "错误：缺少 Brief 信息，请先完成上一阶段。";
    }

    // If angles exist, and input is provided (user selection), move to Discussion
    if (this.state.context.angles && input && input.trim() !== '') {
        this.state.context.selectedAngle = input;
        this.state.currentPhase = Phase.DISCUSSION;
        return this.handleDiscussionPhase(input);
    }

    logger.info(`[Phase 1.5] Generating Breakthrough Angles...`);
    
    // FORCE MOCK MODE: Bypass LLM for debugging
    const mockAngles = {
        mainstream: [
            { title: '技术进步论', argument: 'AI 是生产力工具，焦虑源于不适应', score: { R: 4, N: 2, C: 5 } },
            { title: '替代不可避免', argument: '低端脑力劳动将被取代，需提升核心竞争力', score: { R: 5, N: 3, C: 4 } },
            { title: '人机协作', argument: '未来不是 AI 取代人，而是会用 AI 的人取代不会用的', score: { R: 4, N: 2, C: 5 } }
        ],
        contrarian: [
            { title: '创造力陷阱', argument: 'AI 生成的内容越多，人类的原始创造力越稀缺且珍贵', score: { R: 5, N: 5, C: 4 } },
            { title: '情感护城河', argument: 'AI 无法模拟真实的人类情感连接和脆弱性', score: { R: 4, N: 5, C: 3 } },
            { title: '数据枯竭论', argument: 'AI 正在吞噬自己的尾巴，高质量人类数据将成为硬通货', score: { R: 5, N: 4, C: 4 } }
        ]
    };
    this.state.context.angles = mockAngles;
    
    // Do NOT auto-advance. Wait for user selection.
    // this.state.currentPhase = Phase.DISCUSSION;
    
    // Save state immediately
    await repository.saveState(this.state);
    
    return JSON.stringify({
        type: 'ANGLE_SELECTION',
        data: mockAngles,
        message: "（调试模式：强制Mock数据）请选择一个切入点："
    });
  }

  private async handleDiscussionPhase(input: string): Promise<string> {
    // Check if user selected an angle (first input in this phase)
    if (!this.state.context.selectedAngle) {
        // Extract pure angle from input if possible
        // Input format: "Selected Angles: A, B\nSupplemental Thoughts: ..."
        let cleanAngle = input;
        const match = input.match(/Selected Angles: (.*?)(?:\n|$)/);
        if (match && match[1]) {
            cleanAngle = match[1];
        }
        
        this.state.context.selectedAngle = cleanAngle; 
        return `好的，我们锁定切入点：【${cleanAngle}】。请告诉我您对这个方向的初步想法。`;
    }

    const brief = this.state.context.brief;
    const history = this.state.history.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n'); // Last 10 messages

    const prompt = PromptManager.getPrompt('DISCUSSION_SOCRATIC', {
      angle: this.state.context.selectedAngle,
      thesis: brief.thesis,
      target_audience: brief.target_audience,
      chatHistory: history
    });

    try {
        const response = await LLMService.chatCompletion({
            provider: ModelProvider.DEEPSEEK,
            model: 'deepseek-reasoner', // Switch to R1 for depth
            messages: [{ role: 'user', content: prompt }]
        });

        if (response.includes('[DONE]')) {
            this.state.currentPhase = Phase.DRAFTING;
            // Save the discussion response first
            const discussionResponse = response.replace('[DONE]', '') + "\n\n(讨论结束，正在生成初稿...)";
            
            // Immediately trigger drafting phase
            const draftResponse = await this.handleDraftingPhase();
            
            return discussionResponse + "\n\n" + draftResponse;
        }

        return response;
    } catch (err) {
        logger.error('Discussion failed', err);
        return "讨论遇到问题，请重试。";
    }
  }

  private async handleDraftingPhase(): Promise<string> {
    const brief = this.state.context.brief;
    const history = this.state.history.filter(m => m.role !== 'system').map(m => `${m.role}: ${m.content}`).join('\n');

    logger.info(`[Phase 3] Generating Draft...`);

    const prompt = PromptManager.getPrompt('DRAFTING_GENERATION', {
        thesis: brief.thesis,
        target_audience: brief.target_audience,
        angle: this.state.context.selectedAngle,
        chatContext: history
    });

    try {
        const draft = await LLMService.chatCompletion({
            provider: ModelProvider.DEEPSEEK,
            model: MODEL_CONFIG.writer,
            messages: [{ role: 'user', content: prompt }]
        });

        this.state.context.draft = draft;
        this.state.currentPhase = Phase.AUDIT;

        return JSON.stringify({
            type: 'DRAFT_GENERATED',
            data: draft,
            message: "初稿已生成，即将进入审计阶段。"
        });
    } catch (err) {
        logger.error('Drafting failed', err);
        return "初稿生成失败，请重试。";
    }
  }

  private async handleAuditPhase(): Promise<string> {
    const draft = this.state.context.draft;
    if (!draft) return "错误：未找到初稿。";

    logger.info(`[Phase 4.5] Auditing Draft with ${AUDITORS.length} agents...`);

    const auditPromises = AUDITORS.map(async (auditor) => {
        const prompt = PromptManager.getPrompt('AUDIT_TEMPLATE', {
            persona: auditor.role,
            focus: auditor.focus,
            draft: draft
        });

        try {
            const result = await LLMService.chatCompletion({
                provider: auditor.provider,
                model: auditor.model,
                messages: [{ role: 'user', content: prompt }],
                jsonMode: true
            });
            return JSON.parse(result) as AuditReport;
        } catch (err) {
            logger.error(`Audit failed for ${auditor.role}`, err);
            return null;
        }
    });

    const results = await Promise.all(auditPromises);
    const validReports = results.filter(r => r !== null) as AuditReport[];
    this.state.context.auditReports = validReports;
    
    this.state.currentPhase = Phase.PUBLISH;

    return JSON.stringify({
        type: 'AUDIT_REPORT',
        data: validReports,
        message: "审计完成，共收到 " + validReports.length + " 份报告。正在进行最终润色..."
    });
  }

  private async handleFinalPolishPhase(): Promise<string> {
    const draft = this.state.context.draft;
    const reports = this.state.context.auditReports as AuditReport[];

    if (!draft || !reports) return "错误：缺少初稿或审计报告。";

    logger.info(`[Phase 5] Final Polishing...`);

    const reportsSummary = reports.map(r => 
        `[${r.auditor_role}] 评分: ${r.score}\n批评: ${r.criticisms.join('; ')}\n建议: ${r.suggestions.join('; ')}`
    ).join('\n\n');

    const prompt = PromptManager.getPrompt('FINAL_POLISH', {
        draft: draft,
        auditReports: reportsSummary
    });

    try {
        const result = await LLMService.chatCompletion({
            provider: ModelProvider.DEEPSEEK,
            model: MODEL_CONFIG.writer,
            messages: [{ role: 'user', content: prompt }],
            jsonMode: true
        });

        const finalOutput = JSON.parse(result);
        this.state.context.finalContent = finalOutput;

        return JSON.stringify({
            type: 'FINAL_CONTENT',
            data: finalOutput,
            message: "最终定稿已生成！"
        });
    } catch (err) {
        logger.error('Final polish failed', err);
        return "最终润色失败，请重试。";
    }
  }

  // State Management
  public getState(): WorkflowState {
    return this.state;
  }
}
