import { ModeRouter } from '../mode/ModeRouter';
import { PhaseLoader } from '../config/PhaseLoader';
import { WorkflowEngine } from '../engine/WorkflowEngine';
import { MemoryArtifactManager } from '../artifact/ArtifactManager.memory';
import { GatingRules, createDefaultGatingRules } from '../gating/GatingRules';
import * as path from 'path';

describe('Dual-Core Mode Implementation', () => {
  const configPath = path.join(__dirname, '../../../config');

  describe('ModeRouter', () => {
    let modeRouter: ModeRouter;

    beforeEach(() => {
      modeRouter = new ModeRouter();
    });

    test('should detect argument_mode with thesis statement', () => {
      const result = modeRouter.detectMode('我认为AI的本质是提升认知效率，需要结构化论证');
      expect(result.mode).toBe('argument_mode');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.signals).toContain('argument:判断表达');
    });

    test('should detect observation_mode with scene markers', () => {
      const result = modeRouter.detectMode('今天在路上看到一件有趣的事');
      expect(result.mode).toBe('observation_mode');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should detect observation_journal_mode with journal intent', () => {
      const result = modeRouter.detectMode('润成可回看的记录，观察随想，不要论证');
      expect(result.mode).toBe('observation_journal_mode');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should return correct phase sequences for argument_mode', () => {
      const phases = modeRouter.getModePhases('argument_mode');
      expect(phases).toEqual([-1, 0, 0.5, 0.8, 1, 1.5, 2, 3, 4, 4.3, 4.5, 4.8, 5, 5.5, 6]);
    });

    test('should return correct phase sequences for observation_mode', () => {
      const phases = modeRouter.getModePhases('observation_mode');
      expect(phases).toContain('2-C');
      expect(phases).toContain('2-D');
      expect(phases).toContain(4.3); // Light Review
      expect(phases).not.toContain(3); // No Convergence
    });

    test('should return correct phase sequences for observation_journal_mode', () => {
      const phases = modeRouter.getModePhases('observation_journal_mode');
      expect(phases).toContain('2-C');
      expect(phases).toContain('2-D');
      expect(phases).not.toContain(1.5); // No Breakthrough
      expect(phases).not.toContain(3); // No Convergence
    });

    test('should suggest mode switch when pattern changes', () => {
      const currentMode: any = 'argument_mode';
      const newInput = '今天不想讲道理，只想记录一下生活';
      const shouldSwitch = modeRouter.shouldPromptModeSwitch(currentMode, newInput);
      expect(shouldSwitch).toBe(true);
    });
  });

  describe('Observation Mode Flow', () => {
    let engine: WorkflowEngine;

    beforeEach(async () => {
      const phaseLoader = new PhaseLoader(configPath, false, 1000);
      const modeRouter = new ModeRouter();
      const artifactManager = new MemoryArtifactManager();
      const gatingRules = createDefaultGatingRules();

      engine = new WorkflowEngine(phaseLoader, modeRouter, artifactManager, gatingRules);
      await engine.initialize();
    });

    test('should create workflow in observation_mode', async () => {
      const state = await engine.createWorkflow('今天在路上看到一只猫，想记录一下');
      // ModeRouter detects observation_mode first, then can be refined to observation_journal_mode
      expect(['observation_mode', 'observation_journal_mode']).toContain(state.mode);
      expect(state.currentPhaseId).toBe('-1'); // Starts with Brief
    });

    test('should progress through observation mode phases', async () => {
      // Create workflow in observation mode
      const state = await engine.createWorkflow('记录一下今天的生活片段');

      // Complete Brief phase
      await engine.executePhase(state.id, {
        target_audience: '自己',
        existing_belief: '无',
        change_goal: '记录生活',
        thesis: '记录日常观察',
        evidence_strategy: '个人观察'
      });

      // Confirm Brief
      await engine.executePhase(state.id, { revision_choice: 'confirm' });

      // Should be at phase 1.5 (Breakthrough) or skip to 2-C based on mode
      const updatedState = engine.getState(state.id);
      expect(updatedState).toBeDefined();
    });
  });

  describe('Mode Switching', () => {
    let modeRouter: ModeRouter;

    beforeEach(() => {
      modeRouter = new ModeRouter();
    });

    test('should generate appropriate switch suggestions', () => {
      const suggestion = modeRouter.generateModeSwitchSuggestion(
        'argument_mode',
        'observation_mode'
      );
      expect(suggestion).toContain('观察模式');
    });

    test('should allow explicit mode switch', () => {
      const result = modeRouter.switchMode('observation_journal_mode', 'argument_mode');
      expect(result.mode).toBe('observation_journal_mode');
      expect(result.confidence).toBe(1.0);
      expect(result.override).toBe(true);
    });
  });

  describe('Phase Configuration', () => {
    let phaseLoader: PhaseLoader;

    beforeEach(async () => {
      phaseLoader = new PhaseLoader(configPath, false, 1000);
      await phaseLoader.initialize();
    });

    test('should have observation-specific phases configured', () => {
      const phase2C = phaseLoader.getPhase('2-C');
      expect(phase2C).toBeDefined();
      expect(phase2C?.phase.name).toBe('Observation');

      const phase2D = phaseLoader.getPhase('2-D');
      expect(phase2D).toBeDefined();
      expect(phase2D?.phase.name).toBe('Journal');
    });

    test('should have correct mode-specific fields in observation phases', () => {
      const phase2C = phaseLoader.getPhase('2-C');
      expect(phase2C?.fields).toBeDefined();
      // Phase 2-C has observation_note field (not observation_fragments which is used in handler)
      expect(Object.keys(phase2C?.fields || {})).toContain('observation_note');
    });
  });
});
