/**
 * 配置热重载模块
 * 支持配置文件变更监听和动态重载
 * 无需重启服务即可更新配置
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { logger } from './logger';

interface ConfigReloaderOptions {
  configPath: string;
  reloadDelayMs?: number;
  enableHotReload?: boolean;
}

type ConfigChangeCallback = (newConfig: Record<string, string>) => void;

class ConfigReloader extends EventEmitter {
  private configPath: string;
  private options: Required<ConfigReloaderOptions>;
  private currentConfig: Record<string, string> = {};
  private fileWatcher: fs.FSWatcher | null = null;
  private reloadTimer: NodeJS.Timeout | null = null;
  private lastModifiedTime: number = 0;
  private isReloading: boolean = false;

  constructor(options: ConfigReloaderOptions) {
    super();
    this.configPath = path.resolve(options.configPath);
    this.options = {
      configPath: options.configPath,
      reloadDelayMs: options.reloadDelayMs || 1000,
      enableHotReload: options.enableHotReload ?? true,
    };
  }

  /**
   * 启动配置热重载
   */
  start(): void {
    if (!this.options.enableHotReload) {
      logger.info('配置热重载已禁用');
      return;
    }

    if (!fs.existsSync(this.configPath)) {
      logger.warn(`配置文件不存在: ${this.configPath}`);
      return;
    }

    // 加载初始配置
    this.loadConfig();

    // 启动文件监听
    this.startWatching();

    logger.info(`配置热重载已启动，监听文件: ${this.configPath}`);
  }

  /**
   * 停止配置热重载
   */
  stop(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }

    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }

    logger.info('配置热重载已停止');
  }

  /**
   * 启动文件监听
   */
  private startWatching(): void {
    try {
      this.fileWatcher = fs.watch(this.configPath, (eventType) => {
        if (eventType === 'change') {
          this.handleFileChange();
        }
      });

      this.fileWatcher.on('error', (error) => {
        logger.error('配置文件监听错误:', error);
        this.emit('error', error);
      });
    } catch (error) {
      logger.error('启动配置文件监听失败:', error);
    }
  }

  /**
   * 处理文件变更
   */
  private handleFileChange(): void {
    // 防抖处理，避免频繁重载
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }

    this.reloadTimer = setTimeout(() => {
      this.reloadConfig();
    }, this.options.reloadDelayMs);
  }

  /**
   * 重新加载配置
   */
  private reloadConfig(): void {
    if (this.isReloading) {
      logger.debug('配置正在重载中，跳过本次请求');
      return;
    }

    this.isReloading = true;

    try {
      // 检查文件修改时间，避免重复加载同一版本
      const stats = fs.statSync(this.configPath);
      if (stats.mtimeMs === this.lastModifiedTime) {
        this.isReloading = false;
        return;
      }

      const oldConfig = { ...this.currentConfig };
      this.loadConfig();

      // 对比配置变化
      const changes = this.detectChanges(oldConfig, this.currentConfig);

      if (changes.length > 0) {
        logger.info(`配置已重载，变更项: ${changes.length} 个`);
        changes.forEach(change => {
          logger.debug(`  ${change.key}: ${change.oldValue} -> ${change.newValue}`);
        });

        this.emit('reload', {
          config: this.currentConfig,
          changes,
        });
      }

      this.lastModifiedTime = stats.mtimeMs;
    } catch (error) {
      logger.error('配置重载失败:', error);
      this.emit('error', error);
    } finally {
      this.isReloading = false;
    }
  }

  /**
   * 加载配置文件
   */
  private loadConfig(): void {
    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      this.currentConfig = this.parseEnvContent(content);
    } catch (error) {
      logger.error('加载配置文件失败:', error);
      throw error;
    }
  }

  /**
   * 解析 .env 文件内容
   */
  private parseEnvContent(content: string): Record<string, string> {
    const config: Record<string, string> = {};

    content.split('\n').forEach((line) => {
      // 跳过注释和空行
      line = line.trim();
      if (!line || line.startsWith('#')) return;

      // 解析 KEY=VALUE
      const equalIndex = line.indexOf('=');
      if (equalIndex > 0) {
        const key = line.substring(0, equalIndex).trim();
        let value = line.substring(equalIndex + 1).trim();

        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        config[key] = value;
      }
    });

    return config;
  }

  /**
   * 检测配置变化
   */
  private detectChanges(
    oldConfig: Record<string, string>,
    newConfig: Record<string, string>
  ): Array<{ key: string; oldValue: string; newValue: string }> {
    const changes: Array<{ key: string; oldValue: string; newValue: string }> = [];
    const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);

    allKeys.forEach(key => {
      const oldValue = oldConfig[key];
      const newValue = newConfig[key];

      if (oldValue !== newValue) {
        changes.push({
          key,
          oldValue: oldValue || '(未设置)',
          newValue: newValue || '(未设置)',
        });
      }
    });

    return changes;
  }

  /**
   * 获取当前配置
   */
  getConfig(): Record<string, string> {
    return { ...this.currentConfig };
  }

  /**
   * 获取特定配置项
   */
  get(key: string, defaultValue?: string): string | undefined {
    return this.currentConfig[key] ?? defaultValue;
  }

  /**
   * 手动触发重载
   */
  forceReload(): boolean {
    try {
      this.reloadConfig();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 注册配置变更回调
   */
  onChange(callback: ConfigChangeCallback): () => void {
    this.on('reload', (event: { config: Record<string, string> }) => {
      callback(event.config);
    });

    // 返回取消订阅函数
    return () => {
      this.off('reload', callback);
    };
  }
}

// 可热重载的配置管理器
class HotReloadableConfig {
  private reloader: ConfigReloader | null = null;
  private listeners: Map<string, Set<(value: string) => void>> = new Map();

  /**
   * 初始化热重载
   */
  initialize(configPath: string = '.env'): void {
    this.reloader = new ConfigReloader({
      configPath,
      enableHotReload: process.env.ENABLE_CONFIG_HOT_RELOAD === 'true',
      reloadDelayMs: 1000,
    });

    this.reloader.on('reload', (event) => {
      // 通知所有监听器
      event.changes.forEach((change: { key: string; newValue: string }) => {
        const listeners = this.listeners.get(change.key);
        if (listeners) {
          listeners.forEach(callback => callback(change.newValue));
        }
      });
    });

    this.reloader.start();
  }

  /**
   * 监听配置项变化
   */
  watch(key: string, callback: (value: string) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    // 返回取消订阅函数
    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  /**
   * 获取配置值
   */
  get(key: string, defaultValue?: string): string | undefined {
    return this.reloader?.get(key, defaultValue) ?? process.env[key] ?? defaultValue;
  }

  /**
   * 停止热重载
   */
  stop(): void {
    this.reloader?.stop();
    this.listeners.clear();
  }
}

// 导出单例
export const hotConfig = new HotReloadableConfig();

export { ConfigReloader, HotReloadableConfig };
export type { ConfigReloaderOptions, ConfigChangeCallback };
