import { ConvergencePhaseHandler } from '../handlers/ConvergencePhaseHandler';
import { DraftingPhaseHandler } from '../handlers/DraftingPhaseHandler';
import { MemoryArtifactManager, MemoryArtifactStore } from '../../artifact/ArtifactManager.memory';
import { WorkflowState } from '../../engine/WorkflowEngine';
import { PhaseConfig } from '../../config/PhaseLoader';

describe('Additional Phase Handlers', () => {
  let artifactManager: MemoryArtifactManager;
  let mockState: WorkflowState;
  let mockPhaseConfig: PhaseConfig;
  let mockStore: MemoryArtifactStore;

  beforeEach(() => {
    mockStore = { artifacts: new Map() };
    artifactManager = new MemoryArtifactManager(mockStore);

    mockState = {
      id: 'test-workflow',
      currentPhaseId: '3',
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
        id: 3,
        name: 'Convergence',
        name_cn: '观点收敛',
        description: 'Test',
        type: 'standard'
      },
      entry: { triggers: [], condition: 'any' },
      exit: { condition: 'confirmed', next_phase: 4 },
      fields: {},
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

  describe('ConvergencePhaseHandler', () => {
    let handler: ConvergencePhaseHandler;

    beforeEach(() => {
      handler = new ConvergencePhaseHandler();
      handler.setConfig(mockPhaseConfig);
      // Setup discussion messages
      mockState.fields.set('discussion_messages', [
        { role: 'user', content: 'AI很有用', timestamp: new Date().toISOString() },
        { role: 'ai', content: '为什么？', timestamp: new Date().toISOString() },
        { role: 'user', content: '因为能提高效率', timestamp: new Date().toISOString() }
      ]);
    });

    test('should extract points from discussion', async () => {
      const result = await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any
      });

      expect(result.success).toBe(true);
      expect(result.artifacts.length).toBe(1);
      expect(result.pendingInput?.field).toBe('convergence_review');
    });

    test('should handle confirm action', async () => {
      // First extract points
      await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any
      });

      // Then confirm
      const result = await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any,
        input: { convergence_review: 'confirm' }
      });

      expect(result.success).toBe(true);
      expect(result.nextPhaseId).toBe('4');
    });

    test('should handle add point action', async () => {
      // First extract points
      await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any
      });

      // Request to add
      const result = await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any,
        input: { convergence_review: 'add' }
      });

      expect(result.success).toBe(true);
      expect(result.pendingInput?.field).toBe('new_point');
    });
  });

  describe('DraftingPhaseHandler', () => {
    let handler: DraftingPhaseHandler;

    beforeEach(() => {
      handler = new DraftingPhaseHandler();
      mockState.currentPhaseId = '4';
      mockPhaseConfig.phase.id = 4;
      mockPhaseConfig.phase.name = 'Drafting';
      mockPhaseConfig.phase.name_cn = '草稿生成';

      // Setup required fields
      mockState.fields.set('target_audience', '职场人士');
      mockState.fields.set('thesis', 'AI工具提升写作效率');
      mockState.fields.set('evidence_strategy', '案例分析');
      mockState.fields.set('convergence_points', [
        { id: '1', content: 'AI降低写作门槛', priority: 1 },
        { id: '2', content: 'AI辅助思考', priority: 1 }
      ]);
      mockState.fields.set('selected_angle', { title: '效率角度', hook: '你有没有觉得...' });
    });

    test('should generate draft on first call', async () => {
      const result = await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any
      });

      expect(result.success).toBe(true);
      expect(result.artifacts.length).toBe(1);
      expect(result.pendingInput?.field).toBe('draft_review');
    });

    test('should handle draft confirmation', async () => {
      // Generate draft
      await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any
      });

      // Confirm
      const result = await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any,
        input: { draft_review: 'confirm' }
      });

      expect(result.success).toBe(true);
      expect(result.nextPhaseId).toBe('4.3');
    });

    test('should handle revision request', async () => {
      // Generate draft
      await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any
      });

      // Request revision
      const result = await handler.execute({
        state: mockState,
        phaseConfig: mockPhaseConfig,
        artifactManager: artifactManager as any,
        input: { draft_review: 'revise' }
      });

      expect(result.success).toBe(true);
      expect(result.pendingInput?.field).toBe('revision_request');
    });
  });
});
