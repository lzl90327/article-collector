import { WorkflowEngine } from '../../engine/WorkflowEngine';
import { PhaseLoader } from '../../config/PhaseLoader';
import { ModeRouter } from '../../mode/ModeRouter';
import { MemoryArtifactManager } from '../../artifact/ArtifactManager.memory';
import { GatingRules, createDefaultGatingRules } from '../../gating/GatingRules';
import { registerAllPhaseHandlers } from '../../phases';
import * as path from 'path';

describe('Workflow Integration Tests', () => {
  const configPath = path.join(__dirname, '../../../../config');
  let engine: WorkflowEngine;

  beforeEach(async () => {
    const phaseLoader = new PhaseLoader(configPath, false, 1000);
    const modeRouter = new ModeRouter();
    const artifactManager = new MemoryArtifactManager();
    const gatingRules = createDefaultGatingRules();

    engine = new WorkflowEngine(phaseLoader, modeRouter, artifactManager, gatingRules);
    await engine.initialize();
    registerAllPhaseHandlers();
  });

  describe('Argument Mode Workflow', () => {
    test('should complete full argument mode workflow', async () => {
      // Create workflow with strong argument signals (need 2 matches)
      const state = await engine.createWorkflow('我认为AI的本质是提升认知效率，问题在于如何论证');
      expect(state.mode).toBe('argument_mode');

      // Phase -1: Brief
      let result = await engine.executePhase(state.id, {
        target_audience: '职场人士',
        existing_belief: 'AI只是噱头',
        change_goal: '认识到AI的价值',
        thesis: 'AI工具的真正价值是降低思考启动成本',
        evidence_strategy: '个人体验+案例'
      });
      expect(result.success).toBe(true);

      // Confirm brief
      result = await engine.executePhase(state.id, { revision_choice: 'confirm' });
      expect(result.success).toBe(true);

      // Phase 1.5: Breakthrough
      result = await engine.executePhase(state.id, { angle_selection: '1' });
      expect(result.success).toBe(true);

      // Phase 2: Discussion (multiple rounds)
      result = await engine.executePhase(state.id, { discussion_input: '我认为这个观点很有道理' });
      expect(result.success).toBe(true);

      // Continue discussion
      result = await engine.executePhase(state.id, { continue_choice: '继续第二轮' });
      expect(result.success).toBe(true);

      // Phase 3: Convergence
      result = await engine.executePhase(state.id, { convergence_review: 'confirm' });
      expect(result.success).toBe(true);

      // Phase 4: Drafting
      result = await engine.executePhase(state.id, { draft_review: 'confirm' });
      expect(result.success).toBe(true);

      // Verify workflow stats
      const stats = engine.getWorkflowStats(state.id);
      expect(stats).toBeDefined();
      expect(stats?.completedPhases).toBeGreaterThan(0);
    });
  });

  describe('Observation Mode Workflow', () => {
    test('should complete observation journal workflow', async () => {
      // Create workflow in observation mode
      const state = await engine.createWorkflow('今天在路上看到一件有趣的事，想记录一下');
      expect(['observation_mode', 'observation_journal_mode']).toContain(state.mode);

      // Phase -1: Brief
      let result = await engine.executePhase(state.id, {
        target_audience: '自己',
        existing_belief: '无',
        change_goal: '记录生活',
        thesis: '记录日常观察',
        evidence_strategy: '个人观察'
      });
      expect(result.success).toBe(true);

      // Confirm brief
      result = await engine.executePhase(state.id, { revision_choice: 'confirm' });
      expect(result.success).toBe(true);

      // Phase 2-C: Observation Collection
      result = await engine.executePhase(state.id, { observation_content: '看到一只猫在晒太阳' });
      expect(result.success).toBe(true);

      result = await engine.executePhase(state.id, { observation_content: '听到路人讨论AI' });
      expect(result.success).toBe(true);

      result = await engine.executePhase(state.id, { observation_content: '整理' });
      expect(result.success).toBe(true);

      // Phase 2-D: Observation Journal
      result = await engine.executePhase(state.id, { journal_theme: '城市观察' });
      expect(result.success).toBe(true);

      result = await engine.executePhase(state.id, { journal_content: '今天的观察让我想到...' });
      expect(result.success).toBe(true);

      result = await engine.executePhase(state.id, { journal_confirm: 'confirm' });
      expect(result.success).toBe(true);
    });
  });

  describe('Mode Switching', () => {
    test('should detect and handle mode switching', async () => {
      // Use strong journal signals for observation_journal_mode
      const state = await engine.createWorkflow('今天不想讲道理，只想记录一下生活，更日记感');
      expect(['observation_mode', 'observation_journal_mode']).toContain(state.mode);

      // Verify correct phase sequence for observation mode
      const phases = engine['modeRouter'].getModePhases(state.mode);
      expect(phases).toContain('2-C');
      expect(phases).toContain('2-D');
    });
  });

  describe('Gating Rules', () => {
    test('should enforce gating rules between phases', async () => {
      const state = await engine.createWorkflow('测试写作');

      // Try to skip ahead without completing required phases
      // This should be blocked by gating rules
      const gatingContext = {
        currentPhaseId: '2',
        targetPhaseId: '3',
        artifacts: new Map(),
        fields: new Map(),
        completedActions: new Set<string>(),
        metadata: {}
      };

      const gatingRules = createDefaultGatingRules();
      const result = await gatingRules.validateTransition('2', '3', gatingContext);

      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });
});
