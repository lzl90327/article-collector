import { BriefPhaseHandler } from '../handlers/BriefPhaseHandler';
import { BreakthroughPhaseHandler } from '../handlers/BreakthroughPhaseHandler';
import { DiscussionPhaseHandler } from '../handlers/DiscussionPhaseHandler';
import { MemoryArtifactManager, MemoryArtifactStore } from '../../artifact/ArtifactManager.memory';
import { WorkflowState } from '../../engine/WorkflowEngine';
import { PhaseConfig } from '../../config/PhaseLoader';

describe('Phase Handlers', () => {
  let artifactManager: MemoryArtifactManager;
  let mockState: WorkflowState;
  let mockPhaseConfig: PhaseConfig;
  let mockStore: MemoryArtifactStore;

  beforeEach(() => {
    mockStore = { artifacts: new Map() };
    artifactManager = new MemoryArtifactManager(mockStore);

    mockState = {
      id: 'test-workflow',
      currentPhaseId: '-1',
      mode: 'argument_mode',
      fields: new Map(),
      artifacts: new Map(),
      completedActions: new Set(),
      pendingInput: null,
      metadata: { version: 1 },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockPhaseConfig = {
      phase: {
        id: -1,
        name: 'Brief',
        name_cn: '写作简报',
        description: 'Test',
        type: 'mandatory'
      },
      entry: { triggers: [], condition: 'any' },
      exit: { condition: 'confirmed', next_phase: 1.5 },
      fields: {
        target_audience: { name: '目标读者', description: 'Test', type: 'text', required: true },
        existing_belief: { name: '既有信念', description: 'Test', type: 'text', required: true },
        change_goal: { name: '改变目标', description: 'Test', type: 'text', required: true },
        thesis: { name: '核心主张', description: 'Test', type: 'text', required: true },
        evidence_strategy: { name: '证据策略', description: 'Test', type: 'text', required: true }
      },
      interaction: {
        pending_input: null,
        prompt_template: 'test',
        actions: []
      },
      model_config: {
        provider: 'deepseek',
        model: 'deepseek-reasoner',
        temperature: 0.7,
        json_mode: true
      }
    };
  });

  afterEach(async () => {
    await artifactManager.cleanup();
  });

  describe('BriefPhaseHandler', () => {
    let handler: BriefPhaseHandler;

    beforeEach(() => {
      handler = new BriefPhaseHandler();
      handler.setConfig(mockPhaseConfig);
    });

    test('should request input on first call', async () => {
      const result = await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any
      });

      expect(result.success).toBe(true);
      expect(result.pendingInput).toBeDefined();
      expect(result.pendingInput?.field).toBe('briefData');
    });

    test('should create brief card with valid input', async () => {
      const result = await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any,
        input: {
          target_audience: '职场新人',
          existing_belief: 'AI只是噱头',
          change_goal: '认识到AI的价值',
          thesis: 'AI工具的真正价值是降低思考启动成本',
          evidence_strategy: '个人体验+案例'
        }
      });

      expect(result.success).toBe(true);
      expect(result.artifacts.length).toBe(1);
      expect(result.pendingInput?.field).toBe('revision_choice');
    });

    test('should handle confirm action', async () => {
      // First, create the brief
      await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any,
        input: {
          target_audience: '职场新人',
          existing_belief: 'AI只是噱头',
          change_goal: '认识到AI的价值',
          thesis: 'AI工具的真正价值是降低思考启动成本',
          evidence_strategy: '个人体验+案例'
        }
      });

      // Then confirm
      const result = await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any,
        input: { revision_choice: 'confirm' }
      });

      expect(result.success).toBe(true);
      expect(result.nextPhaseId).toBe('1.5');
    });
  });

  describe('BreakthroughPhaseHandler', () => {
    let handler: BreakthroughPhaseHandler;

    beforeEach(() => {
      handler = new BreakthroughPhaseHandler();
      mockState.currentPhaseId = '1.5';
      mockState.fields.set('thesis', 'AI工具的真正价值是降低思考启动成本');
      mockState.fields.set('existing_belief', 'AI只是噱头');
    });

    test('should generate angles on first call', async () => {
      const result = await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any
      });

      expect(result.success).toBe(true);
      expect(result.artifacts.length).toBe(1);
      expect(result.pendingInput?.field).toBe('angle_selection');
    });

    test('should handle angle selection', async () => {
      // First generate angles
      await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any
      });

      // Then select an angle
      const result = await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any,
        input: { angle_selection: '1' }
      });

      expect(result.success).toBe(true);
      expect(result.artifacts.length).toBe(1);
      expect(result.nextPhaseId).toBe('2');
    });
  });

  describe('DiscussionPhaseHandler', () => {
    let handler: DiscussionPhaseHandler;

    beforeEach(() => {
      handler = new DiscussionPhaseHandler();
      mockState.currentPhaseId = '2';
      mockState.fields.set('thesis', 'AI工具的真正价值是降低思考启动成本');
      mockState.fields.set('selected_angle', { title: '从痛点切入', hook: '你有没有想过...' });
    });

    test('should start discussion with initial prompt', async () => {
      const result = await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any
      });

      expect(result.success).toBe(true);
      expect(result.pendingInput?.field).toBe('discussion_input');
    });

    test('should record user message and wait for AI response', async () => {
      const result = await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any,
        input: { discussion_input: '我认为这个观点很有道理，因为...' }
      });

      expect(result.success).toBe(true);
      expect(result.pendingInput?.field).toBe('ai_discussion_response');
    });
  });
});
