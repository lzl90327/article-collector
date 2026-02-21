/**
 * PhaseLoader - 动态 Phase 配置加载器
 * 支持热升级，无需重启服务
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface PhaseTransition {
  to: string;
  condition?: {
    type: string;
    field?: string;
    value?: any;
    action?: string;
    artifactType?: string;
  };
}

export interface PhaseConfig {
  phase: {
    id: number | string;
    name: string;
    name_cn: string;
    description: string;
    type: 'mandatory' | 'standard' | 'optional' | 'mode_specific' | 'final';
    gating?: boolean;
  };
  entry: {
    triggers: string[];
    condition: string;
  };
  exit: {
    condition: string;
    next_phase: number | string | null;
    alternative?: {
      condition: string;
      next_phase: number | string;
    };
    next_phase_options?: Record<string, number | string | null>;
  };
  fields: Record<string, {
    name: string;
    description: string;
    type: string;
    required: boolean;
    options?: string[];
    item_schema?: any;
    schema?: any;
  }>;
  interaction: {
    substates?: Array<{
      id: string;
      name: string;
      prompt: string;
      required_field: string;
    }> | string[];
    pending_input: string | null;
    prompt_template: string;
    auto_progress?: boolean;
    constraints?: Record<string, any>;
    actions: Array<{
      key: string;
      label: string;
      description: string;
      condition?: string;
      confirm?: boolean;
      next_phase?: number | string;
      next_substate?: string;
    }>;
    input_field?: string;
  };
  mcp_services?: Array<{
    name: string;
    mode?: string;
    description: string;
  }>;
  integrations?: Record<string, any>;
  artifacts?: Array<{
    type: string;
    fields: string[];
    versioned: boolean;
    aiGenerated?: boolean;
  }>;
  artifact?: {
    type: string;
    fields: string[];
    versioned: boolean;
  };
  model_config: {
    provider: string;
    model: string;
    temperature: number;
    json_mode: boolean;
    size?: string;
  };
  transitions?: PhaseTransition[];
}

export interface SkillManifest {
  skill_id: string;
  name: string;
  name_en: string;
  version: string;
  min_compatible_version: string;
  author: string;
  description: string;
  description_en: string;
  core_modes: Record<string, {
    name: string;
    description: string;
    phases: (number | string)[];
  }>;
  gating_rules: Record<string, {
    description: string;
    blocked_phases: (number | string)[];
    condition: string;
  }>;
  hot_upgrade: {
    enabled: boolean;
    watch_paths: string[];
    auto_reload: boolean;
    backup_count: number;
    debounce_ms: number;
  };
}

export interface TriggerConfig {
  triggers: Array<{
    name: string;
    phase?: number | string;
    action?: string;
    priority?: number;
    patterns: string[];
  }>;
  conflict_resolution: {
    priority_order: string[];
  };
}

export interface ModeDetectionResult {
  mode: 'argument_mode' | 'observation_mode' | 'observation_journal_mode';
  confidence: number;
  signals: string[];
}

export class PhaseLoader extends EventEmitter {
  private configDir: string;
  private phases: Map<string, PhaseConfig> = new Map();
  private manifest: SkillManifest | null = null;
  private triggers: TriggerConfig | null = null;
  private watchers: fs.FSWatcher[] = [];
  private isWatching = false;
  private enableHotReload: boolean;
  private debounceMs: number;
  private reloadTimer: NodeJS.Timeout | null = null;

  constructor(
    configDir: string = path.join(__dirname, '../../../config'),
    enableHotReload: boolean = true,
    debounceMs: number = 1000
  ) {
    super();
    this.configDir = configDir;
    this.enableHotReload = enableHotReload;
    this.debounceMs = debounceMs;
  }

  /**
   * 初始化加载所有配置
   */
  async initialize(): Promise<void> {
    console.log('[PhaseLoader] Initializing...');
    
    // 加载 Skill Manifest
    await this.loadManifest();
    
    // 加载所有 Phase 配置
    await this.loadAllPhases();
    
    // 加载触发词配置
    await this.loadTriggers();
    
    // 如果启用了热升级，开始监听文件变化
    if (this.enableHotReload && this.manifest?.hot_upgrade?.enabled) {
      this.startWatching();
    }
    
    console.log('[PhaseLoader] Initialized successfully');
    console.log(`[PhaseLoader] Loaded ${this.phases.size} phases`);
  }

  /**
   * 加载 Skill Manifest
   */
  private async loadManifest(): Promise<void> {
    const manifestPath = path.join(this.configDir, 'skill-manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Skill manifest not found: ${manifestPath}`);
    }
    
    const content = fs.readFileSync(manifestPath, 'utf-8');
    this.manifest = JSON.parse(content);
    
    console.log(`[PhaseLoader] Loaded manifest: ${this.manifest!.name} v${this.manifest!.version}`);
  }

  /**
   * 加载所有 Phase 配置
   */
  private async loadAllPhases(): Promise<void> {
    const phasesDir = path.join(this.configDir, 'phases');
    
    if (!fs.existsSync(phasesDir)) {
      throw new Error(`Phases directory not found: ${phasesDir}`);
    }
    
    const files = fs.readdirSync(phasesDir)
      .filter(f => f.endsWith('.json'))
      .sort();
    
    for (const file of files) {
      await this.loadPhase(path.join(phasesDir, file));
    }
  }

  /**
   * 加载单个 Phase 配置
   */
  private async loadPhase(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const config: PhaseConfig = JSON.parse(content);
      const phaseId = String(config.phase.id);

      // 验证配置
      this.validatePhaseConfig(config);

      // 存储配置
      this.phases.set(phaseId, config);

      console.log(`[PhaseLoader] Loaded phase ${phaseId}: ${config.phase.name_cn}`);
    } catch (error) {
      console.error(`[PhaseLoader] Failed to load phase from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 加载触发词配置
   */
  private async loadTriggers(): Promise<void> {
    const triggersPath = path.join(this.configDir, 'triggers', 'triggers.json');
    
    if (!fs.existsSync(triggersPath)) {
      console.warn(`[PhaseLoader] Triggers config not found: ${triggersPath}`);
      return;
    }
    
    const content = fs.readFileSync(triggersPath, 'utf-8');
    this.triggers = JSON.parse(content);
    
    console.log(`[PhaseLoader] Loaded triggers: ${this.triggers!.triggers.length} patterns`);
  }

  /**
   * 验证 Phase 配置
   */
  private validatePhaseConfig(config: PhaseConfig): void {
    const required = ['phase', 'entry', 'exit', 'fields', 'interaction', 'model_config'];

    for (const key of required) {
      if (!(key in config)) {
        throw new Error(`Missing required field: ${key}`);
      }
    }

    // 验证 phase.id
    if (config.phase.id === undefined || config.phase.id === null) {
      throw new Error('Phase ID is required');
    }
  }

  /**
   * 开始监听配置文件变化
   */
  private startWatching(): void {
    if (this.isWatching) return;
    
    console.log('[PhaseLoader] Starting file watchers...');
    
    const watchPaths = this.manifest!.hot_upgrade.watch_paths.map(p => 
      path.join(this.configDir, p)
    );
    
    for (const watchPath of watchPaths) {
      if (!fs.existsSync(watchPath)) continue;
      
      const watcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
          console.log(`[PhaseLoader] Config file changed: ${filename}`);
          this.handleConfigChange(eventType, path.join(watchPath, filename));
        }
      });
      
      this.watchers.push(watcher);
    }
    
    this.isWatching = true;
    console.log(`[PhaseLoader] Watching ${this.watchers.length} paths`);
  }

  /**
   * 处理配置文件变化
   */
  private async handleConfigChange(eventType: string, filePath: string): Promise<void> {
    // 防抖处理
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }

    this.reloadTimer = setTimeout(async () => {
      try {
        this.emit('hot_upgrade:started', { file: filePath });
        
        // 备份当前配置
        const backupPath = this.backupConfig(filePath);
        
        // 重新加载配置
        if (filePath.includes('skill-manifest.json')) {
          await this.loadManifest();
        } else if (filePath.includes('phases/')) {
          await this.loadPhase(filePath);
        } else if (filePath.includes('triggers/')) {
          await this.loadTriggers();
        }
        
        // 发送热升级完成事件
        this.emit('hot_upgrade:completed', {
          file: filePath,
          backupPath,
          timestamp: new Date().toISOString()
        });
        
        this.emit('phases:reloaded', { file: filePath });
        
        console.log(`[PhaseLoader] Hot upgrade completed: ${filePath}`);
      } catch (error) {
        console.error(`[PhaseLoader] Hot upgrade failed:`, error);
        this.emit('hot_upgrade:failed', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          file: filePath 
        });
      }
    }, this.debounceMs);
  }

  /**
   * 备份配置
   */
  private backupConfig(filePath: string): string | null {
    const backupCount = this.manifest?.hot_upgrade.backup_count || 5;
    const backupDir = path.join(this.configDir, '.backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const filename = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${filename}.${timestamp}.bak`);
    
    try {
      fs.copyFileSync(filePath, backupPath);
      
      // 清理旧备份
      this.cleanupOldBackups(backupDir, filename, backupCount);
      
      return backupPath;
    } catch (error) {
      console.error('[PhaseLoader] Failed to create backup:', error);
      return null;
    }
  }

  /**
   * 清理旧备份
   */
  private cleanupOldBackups(backupDir: string, filename: string, keepCount: number): void {
    try {
      const backups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith(filename))
        .sort()
        .reverse();
      
      for (let i = keepCount; i < backups.length; i++) {
        fs.unlinkSync(path.join(backupDir, backups[i]));
      }
    } catch (error) {
      console.error('[PhaseLoader] Failed to cleanup old backups:', error);
    }
  }

  /**
   * 获取 Phase 配置
   */
  getPhase(phaseId: number | string): PhaseConfig | undefined {
    return this.phases.get(String(phaseId));
  }

  /**
   * 获取所有 Phase 配置
   */
  getAllPhases(): PhaseConfig[] {
    return Array.from(this.phases.values());
  }

  /**
   * 获取 Skill Manifest
   */
  getManifest(): SkillManifest | null {
    return this.manifest;
  }

  /**
   * 获取触发词配置
   */
  getTriggers(): TriggerConfig | null {
    return this.triggers;
  }

  /**
   * 根据输入检测模式
   */
  detectModeFromInput(input: string): ModeDetectionResult {
    // Argument Mode signals (need 2 matches)
    const argumentSignals = [
      { pattern: /我认为|本质是|问题在于|应该|不应该/, weight: 1, name: 'argument_claim' },
      { pattern: /论证|反驳|结构化输出|成文|发布|提炼观点/, weight: 1, name: 'argument_intent' }
    ];

    // Observation Mode signals (1 match prioritized)
    const observationSignals = [
      { pattern: /今天|刚刚|在路上|回家|过年|看到|听到/, weight: 2, name: 'temporal_marker' },
      { pattern: /记录一下|随便写写|不想讲道理|先记个片段/, weight: 2, name: 'casual_intent' }
    ];

    let argumentScore = 0;
    let observationScore = 0;
    const matchedSignals: string[] = [];

    for (const signal of argumentSignals) {
      if (signal.pattern.test(input)) {
        argumentScore += signal.weight;
        matchedSignals.push(signal.name);
      }
    }

    for (const signal of observationSignals) {
      if (signal.pattern.test(input)) {
        observationScore += signal.weight;
        matchedSignals.push(signal.name);
      }
    }

    // Priority: journal > observation > argument
    if (observationScore >= 2) {
      return {
        mode: 'observation_journal_mode',
        confidence: Math.min(observationScore / 2, 1),
        signals: matchedSignals
      };
    }

    if (observationScore >= 1) {
      return {
        mode: 'observation_mode',
        confidence: observationScore / 2,
        signals: matchedSignals
      };
    }

    return {
      mode: 'argument_mode',
      confidence: Math.min(argumentScore / 2, 1),
      signals: matchedSignals
    };
  }

  /**
   * 根据触发词匹配 Phase
   */
  matchPhaseByTrigger(input: string): { phaseId: string | number; confidence: number } | null {
    if (!this.triggers) return null;
    
    const input_lower = input.toLowerCase();
    
    for (const trigger of this.triggers.triggers) {
      for (const pattern of trigger.patterns) {
        if (input_lower.includes(pattern.toLowerCase())) {
          return {
            phaseId: trigger.phase!,
            confidence: 1.0
          };
        }
      }
    }
    
    return null;
  }

  /**
   * 检查 Gating 规则
   */
  checkGatingRules(currentPhase: string | number, context: any): { blocked: boolean; reason?: string } {
    if (!this.manifest?.gating_rules) return { blocked: false };
    
    for (const [ruleName, rule] of Object.entries(this.manifest.gating_rules)) {
      if (rule.blocked_phases.includes(currentPhase)) {
        // 简单的条件评估（实际应用中可能需要更复杂的表达式引擎）
        const condition = rule.condition;
        
        // 检查 Brief 确认
        if (condition.includes('brief_card.status') && !context.brief_card?.confirmed) {
          return {
            blocked: true,
            reason: rule.description
          };
        }
        
        // 检查观察模式审阅
        if (condition.includes('observation_journal_mode') && !context.has_passed_phase_4_3) {
          return {
            blocked: true,
            reason: rule.description
          };
        }
      }
    }
    
    return { blocked: false };
  }

  /**
   * 重新加载所有配置
   */
  async reloadAll(): Promise<void> {
    console.log('[PhaseLoader] Reloading all configurations...');
    this.phases.clear();
    await this.loadManifest();
    await this.loadAllPhases();
    await this.loadTriggers();
    this.emit('phases:reloaded', {});
    console.log('[PhaseLoader] All configurations reloaded');
  }

  /**
   * 停止监听
   */
  stopWatching(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    this.isWatching = false;
    console.log('[PhaseLoader] Stopped file watchers');
  }

  /**
   * 释放资源
   */
  dispose(): void {
    this.stopWatching();
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }
    this.removeAllListeners();
  }
}

// 导出单例
export const phaseLoader = new PhaseLoader();
