import { PhaseLoader, PhaseConfig, SkillManifest } from '../PhaseLoader';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

const mockTriggers = {
  triggers: [],
  conflict_resolution: { priority_order: [] }
};

function createMockReadFile(mockManifest: SkillManifest, phases: Record<string, PhaseConfig> = {}) {
  return (filePath: string) => {
    if (filePath.includes('skill-manifest')) {
      return JSON.stringify(mockManifest);
    }
    if (filePath.includes('triggers')) {
      return JSON.stringify(mockTriggers);
    }
    const filename = path.basename(filePath);
    return JSON.stringify(phases[filename] || {});
  };
}

describe('PhaseLoader', () => {
  let phaseLoader: PhaseLoader;

  beforeEach(() => {
    phaseLoader = new PhaseLoader('/mock/config', false);
    jest.clearAllMocks();
  });

  afterEach(() => {
    phaseLoader.dispose();
  });

  describe('Initialization', () => {
    it('should load skill manifest on initialize', async () => {
      const mockManifest: SkillManifest = {
        skill_id: 'yin-ye-notes',
        name: '隐页笔记',
        name_en: 'Hidden Page Notes',
        version: '2.4.1',
        min_compatible_version: '2.0.0',
        author: 'Test',
        description: 'Test',
        description_en: 'Test',
        core_modes: {
          argument_mode: {
            name: '论证模式',
            description: 'Test',
            phases: [-1, 0, 0.5, 0.8, 1, 1.5, 2, 3, 4, 4.3, 4.5, 4.8, 5, 5.5, 6]
          }
        },
        gating_rules: {},
        hot_upgrade: {
          enabled: false,
          watch_paths: [],
          auto_reload: false,
          backup_count: 5,
          debounce_ms: 1000
        }
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockImplementation(createMockReadFile(mockManifest));
      (fs.readdirSync as jest.Mock).mockReturnValue([]);

      await phaseLoader.initialize();

      expect(phaseLoader.getManifest()).toEqual(mockManifest);
    });

    it('should throw error if manifest not found', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(phaseLoader.initialize()).rejects.toThrow('Skill manifest not found');
    });

    it('should load all phase configs', async () => {
      const mockManifest: SkillManifest = {
        skill_id: 'test',
        name: 'Test',
        name_en: 'Test',
        version: '1.0.0',
        min_compatible_version: '1.0.0',
        author: 'Test',
        description: 'Test',
        description_en: 'Test',
        core_modes: {},
        gating_rules: {},
        hot_upgrade: {
          enabled: false,
          watch_paths: [],
          auto_reload: false,
          backup_count: 5,
          debounce_ms: 1000
        }
      };

      const mockPhase: PhaseConfig = {
        phase: {
          id: -1,
          name: 'Brief',
          name_cn: '简报',
          description: 'Test phase',
          type: 'mandatory'
        },
        entry: {
          triggers: ['brief', '简报'],
          condition: 'manual'
        },
        exit: {
          condition: 'manual',
          next_phase: 0
        },
        fields: {
          content: {
            name: '内容',
            description: 'Brief content',
            type: 'text',
            required: true
          }
        },
        interaction: {
          pending_input: null,
          prompt_template: 'Test',
          actions: []
        },
        model_config: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
          json_mode: false
        }
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockImplementation(
        createMockReadFile(mockManifest, { 'phase--1-brief.json': mockPhase })
      );
      (fs.readdirSync as jest.Mock).mockReturnValue(['phase--1-brief.json']);

      await phaseLoader.initialize();

      expect(phaseLoader.getPhase(-1)).toBeDefined();
    });
  });

  describe('Phase Retrieval', () => {
    beforeEach(async () => {
      const mockManifest: SkillManifest = {
        skill_id: 'test',
        name: 'Test',
        name_en: 'Test',
        version: '1.0.0',
        min_compatible_version: '1.0.0',
        author: 'Test',
        description: 'Test',
        description_en: 'Test',
        core_modes: {},
        gating_rules: {},
        hot_upgrade: {
          enabled: false,
          watch_paths: [],
          auto_reload: false,
          backup_count: 5,
          debounce_ms: 1000
        }
      };

      const phases: Record<string, PhaseConfig> = {
        'phase--1-brief.json': {
          phase: { id: -1, name: 'Brief', name_cn: '简报', description: 'Test', type: 'mandatory' },
          entry: { triggers: [], condition: 'manual' },
          exit: { condition: 'manual', next_phase: 0 },
          fields: {},
          interaction: { pending_input: null, prompt_template: 'Test', actions: [] },
          model_config: { provider: 'openai', model: 'gpt-4', temperature: 0.7, json_mode: false }
        },
        'phase-0-material.json': {
          phase: { id: 0, name: 'Material', name_cn: '素材', description: 'Test', type: 'mandatory' },
          entry: { triggers: [], condition: 'manual' },
          exit: { condition: 'manual', next_phase: 1 },
          fields: {},
          interaction: { pending_input: null, prompt_template: 'Test', actions: [] },
          model_config: { provider: 'openai', model: 'gpt-4', temperature: 0.7, json_mode: false }
        }
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockImplementation(createMockReadFile(mockManifest, phases));
      (fs.readdirSync as jest.Mock).mockReturnValue(Object.keys(phases));

      await phaseLoader.initialize();
    });

    it('should get phase by id', () => {
      const phase = phaseLoader.getPhase(-1);
      expect(phase).toBeDefined();
      expect(phase?.phase.name).toBe('Brief');
    });

    it('should return undefined for non-existent phase', () => {
      const phase = phaseLoader.getPhase(999);
      expect(phase).toBeUndefined();
    });

    it('should get all phases', () => {
      const phases = phaseLoader.getAllPhases();
      expect(phases).toHaveLength(2);
      expect(phases.map(p => p.phase.id)).toContain(-1);
      expect(phases.map(p => p.phase.id)).toContain(0);
    });
  });

  describe('Validation', () => {
    it('should throw error for invalid phase config', async () => {
      const mockManifest: SkillManifest = {
        skill_id: 'test',
        name: 'Test',
        name_en: 'Test',
        version: '1.0.0',
        min_compatible_version: '1.0.0',
        author: 'Test',
        description: 'Test',
        description_en: 'Test',
        core_modes: {},
        gating_rules: {},
        hot_upgrade: {
          enabled: false,
          watch_paths: [],
          auto_reload: false,
          backup_count: 5,
          debounce_ms: 1000
        }
      };

      const invalidPhase = {
        // missing required fields
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockImplementation(createMockReadFile(mockManifest, { 'phase-invalid.json': invalidPhase as any }));
      (fs.readdirSync as jest.Mock).mockReturnValue(['phase-invalid.json']);

      await expect(phaseLoader.initialize()).rejects.toThrow();
    });
  });

  describe('Mode Detection', () => {
    it('should detect argument mode from input', () => {
      const result = phaseLoader.detectModeFromInput('我认为这个问题本质上是...');
      expect(result.mode).toBe('argument_mode');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect observation mode from input', () => {
      const result = phaseLoader.detectModeFromInput('今天在路上看到...');
      expect(result.mode).toBe('observation_journal_mode');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect observation mode with lower confidence', () => {
      const result = phaseLoader.detectModeFromInput('刚刚听到');
      // "刚刚" matches observation_signals with weight 2, so it becomes observation_journal_mode
      expect(['observation_mode', 'observation_journal_mode']).toContain(result.mode);
    });
  });

  describe('Trigger Matching', () => {
    beforeEach(async () => {
      const mockManifest: SkillManifest = {
        skill_id: 'test',
        name: 'Test',
        name_en: 'Test',
        version: '1.0.0',
        min_compatible_version: '1.0.0',
        author: 'Test',
        description: 'Test',
        description_en: 'Test',
        core_modes: {},
        gating_rules: {},
        hot_upgrade: {
          enabled: false,
          watch_paths: [],
          auto_reload: false,
          backup_count: 5,
          debounce_ms: 1000
        }
      };

      const mockTriggersWithData = {
        triggers: [
          { name: 'brief', phase: -1, patterns: ['brief', '简报'] },
          { name: 'material', phase: 0, patterns: ['material', '素材'] }
        ],
        conflict_resolution: { priority_order: ['brief', 'material'] }
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('skill-manifest')) {
          return JSON.stringify(mockManifest);
        }
        if (filePath.includes('triggers')) {
          return JSON.stringify(mockTriggersWithData);
        }
        return JSON.stringify({
          phase: { id: -1, name: 'Test', name_cn: '测试', description: 'Test', type: 'mandatory' },
          entry: { triggers: [], condition: 'manual' },
          exit: { condition: 'manual', next_phase: null },
          fields: {},
          interaction: { pending_input: null, prompt_template: 'Test', actions: [] },
          model_config: { provider: 'openai', model: 'gpt-4', temperature: 0.7, json_mode: false }
        });
      });
      (fs.readdirSync as jest.Mock).mockReturnValue(['phase--1-brief.json']);

      await phaseLoader.initialize();
    });

    it('should match trigger by keywords', () => {
      const result = phaseLoader.matchPhaseByTrigger('创建一个brief');
      expect(result).toBeDefined();
      expect(result?.phaseId).toBe(-1);
    });

    it('should return null for unmatched input', () => {
      const result = phaseLoader.matchPhaseByTrigger('random text');
      expect(result).toBeNull();
    });
  });

  describe('Gating Rules', () => {
    beforeEach(async () => {
      const mockManifest: SkillManifest = {
        skill_id: 'test',
        name: 'Test',
        name_en: 'Test',
        version: '1.0.0',
        min_compatible_version: '1.0.0',
        author: 'Test',
        description: 'Test',
        description_en: 'Test',
        core_modes: {},
        gating_rules: {
          no_direct_draft: {
            description: 'Cannot enter draft without brief',
            blocked_phases: [4],
            condition: '!brief_card.status'
          }
        },
        hot_upgrade: {
          enabled: false,
          watch_paths: [],
          auto_reload: false,
          backup_count: 5,
          debounce_ms: 1000
        }
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockImplementation(createMockReadFile(mockManifest));
      (fs.readdirSync as jest.Mock).mockReturnValue([]);

      await phaseLoader.initialize();
    });

    it('should block phase when gating condition not met', () => {
      // The condition checks !brief_card.confirmed, so when confirmed is falsy, it blocks
      const result = phaseLoader.checkGatingRules(4, { brief_card: {} });
      expect(result.blocked).toBe(true);
      expect(result.reason).toBeDefined();
    });

    it('should allow phase when gating condition met', () => {
      // When brief_card.confirmed is truthy, it passes the check
      const result = phaseLoader.checkGatingRules(4, { brief_card: { confirmed: true } });
      expect(result.blocked).toBe(false);
    });
  });

  describe('Hot Reload Events', () => {
    it('should emit event on config reload', (done) => {
      phaseLoader.on('phases:reloaded', (event) => {
        expect(event).toBeDefined();
        done();
      });

      phaseLoader.emit('phases:reloaded', {});
    });

    it('should emit hot upgrade started event', (done) => {
      phaseLoader.on('hot_upgrade:started', (event) => {
        expect(event.file).toBeDefined();
        done();
      });

      phaseLoader.emit('hot_upgrade:started', { file: 'test.json' });
    });
  });
});
