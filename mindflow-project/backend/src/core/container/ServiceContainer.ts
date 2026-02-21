import { PhaseLoader } from '../config/PhaseLoader';
import { ModeRouter } from '../mode/ModeRouter';
import { ArtifactManager, MemoryArtifactStore } from '../artifact/ArtifactManager';
import { GatingRules, createDefaultGatingRules } from '../gating/GatingRules';
import { WorkflowEngine } from '../engine/WorkflowEngine';

export interface ServiceConfig {
  configPath: string;
  enableHotReload: boolean;
  hotReloadDebounceMs: number;
}

export class ServiceContainer {
  private static instance: ServiceContainer;
  private services: Map<string, any> = new Map();
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  async initialize(config: ServiceConfig): Promise<void> {
    if (this.initialized) {
      console.warn('ServiceContainer already initialized');
      return;
    }

    const phaseLoader = new PhaseLoader(
      config.configPath,
      config.enableHotReload,
      config.hotReloadDebounceMs
    );

    const modeRouter = new ModeRouter();

    const artifactStore = new MemoryArtifactStore();
    const artifactManager = new ArtifactManager(artifactStore);

    const gatingRules = createDefaultGatingRules();

    const workflowEngine = new WorkflowEngine(
      phaseLoader,
      modeRouter,
      artifactManager,
      gatingRules
    );

    this.services.set('phaseLoader', phaseLoader);
    this.services.set('modeRouter', modeRouter);
    this.services.set('artifactManager', artifactManager);
    this.services.set('gatingRules', gatingRules);
    this.services.set('workflowEngine', workflowEngine);

    await workflowEngine.initialize();

    this.setupEventListeners();

    this.initialized = true;

    console.log('✅ ServiceContainer initialized successfully');
  }

  private setupEventListeners(): void {
    const phaseLoader = this.getPhaseLoader();
    const workflowEngine = this.getWorkflowEngine();

    phaseLoader.on('hot_upgrade:started', () => {
      console.log('🔄 Hot upgrade started...');
    });

    phaseLoader.on('hot_upgrade:completed', ({ backupPath }) => {
      console.log('✅ Hot upgrade completed');
      if (backupPath) {
        console.log(`   Backup created at: ${backupPath}`);
      }
    });

    phaseLoader.on('hot_upgrade:failed', ({ error }) => {
      console.error('❌ Hot upgrade failed:', error);
    });

    workflowEngine.on('engine:hot_reloaded', () => {
      console.log('🔄 WorkflowEngine hot reloaded');
    });

    workflowEngine.on('workflow:created', ({ workflowId, mode }) => {
      console.log(`📝 Workflow created: ${workflowId} (${mode})`);
    });

    workflowEngine.on('phase:transitioned', ({ workflowId, fromPhase, toPhase }) => {
      console.log(`➡️  Phase transition: ${fromPhase} -> ${toPhase}`);
    });
  }

  getPhaseLoader(): PhaseLoader {
    return this.getService('phaseLoader');
  }

  getModeRouter(): ModeRouter {
    return this.getService('modeRouter');
  }

  getArtifactManager(): ArtifactManager {
    return this.getService('artifactManager');
  }

  getGatingRules(): GatingRules {
    return this.getService('gatingRules');
  }

  getWorkflowEngine(): WorkflowEngine {
    return this.getService('workflowEngine');
  }

  private getService<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found. Did you call initialize()?`);
    }
    return service as T;
  }

  async dispose(): Promise<void> {
    const phaseLoader = this.services.get('phaseLoader');
    if (phaseLoader) {
      phaseLoader.dispose();
    }

    this.services.clear();
    this.initialized = false;

    console.log('✅ ServiceContainer disposed');
  }

  getHealthStatus(): {
    initialized: boolean;
    services: string[];
  } {
    return {
      initialized: this.initialized,
      services: Array.from(this.services.keys())
    };
  }
}

export async function initializeServices(
  config: ServiceConfig
): Promise<ServiceContainer> {
  const container = ServiceContainer.getInstance();
  await container.initialize(config);
  return container;
}

export function getServices(): ServiceContainer {
  return ServiceContainer.getInstance();
}
