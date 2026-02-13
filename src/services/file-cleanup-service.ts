/**
 * 文件自动清理服务
 * 
 * 功能：
 * - 自动清理过期的临时文件
 * - 支持配置化的清理策略
 * - 定时任务调度
 * - 清理日志记录
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { videoConfig } from '../config';

/**
 * 清理策略配置
 */
export interface CleanupPolicy {
  /** 目标目录（绝对路径） */
  directory: string;
  /** 文件最大保留天数 */
  maxAgeDays: number;
  /** 文件扩展名过滤（可选，如 ['.mp4', '.wav']） */
  extensions?: string[];
  /** 文件名模式（可选，正则表达式字符串） */
  pattern?: string;
  /** 最小文件大小（字节，可选，小于此大小的不清理） */
  minSize?: number;
  /** 是否递归扫描子目录 */
  recursive?: boolean;
}

/**
 * 清理结果
 */
export interface CleanupResult {
  /** 扫描的文件总数 */
  scannedCount: number;
  /** 删除的文件数 */
  deletedCount: number;
  /** 释放的磁盘空间（字节） */
  freedSpace: number;
  /** 删除的文件列表 */
  deletedFiles: string[];
  /** 错误列表 */
  errors: Array<{ file: string; error: string }>;
}

/**
 * 文件清理服务
 */
export class FileCleanupService {
  private policies: CleanupPolicy[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 默认清理策略
    this.addDefaultPolicies();
  }

  /**
   * 添加默认清理策略
   */
  private addDefaultPolicies(): void {
    // 1. 清理临时下载目录
    const tempDir = path.join(process.cwd(), 'temp', 'downloads');
    if (fs.existsSync(tempDir)) {
      this.addPolicy({
        directory: tempDir,
        maxAgeDays: 30, // 30天
        extensions: ['.mp4', '.mp3', '.m4a', '.wav', '.webm', '.flv'],
        recursive: true,
      });
    }

    // 2. 清理音频转换文件
    const audioDir = path.join(process.cwd(), 'temp', 'audio');
    if (fs.existsSync(audioDir)) {
      this.addPolicy({
        directory: audioDir,
        maxAgeDays: 30, // 30天
        extensions: ['.wav', '.mp3', '.m4a'],
        recursive: false,
      });
    }

    // 3. 清理关键帧目录
    const keyframeDir = path.join(process.cwd(), 'temp', 'keyframes');
    if (fs.existsSync(keyframeDir)) {
      this.addPolicy({
        directory: keyframeDir,
        maxAgeDays: 30, // 30天
        extensions: ['.jpg', '.png'],
        recursive: true,
      });
    }

    // 4. 清理视频处理临时文件
    const videoDir = path.join(process.cwd(), 'temp', 'videos');
    if (fs.existsSync(videoDir)) {
      this.addPolicy({
        directory: videoDir,
        maxAgeDays: 30, // 30天
        extensions: ['.mp4', '.webm', '.flv'],
        recursive: false,
      });
    }

    logger.info('[文件清理] 已加载默认清理策略', {
      policiesCount: this.policies.length,
    });
  }

  /**
   * 添加清理策略
   */
  addPolicy(policy: CleanupPolicy): void {
    this.policies.push(policy);
    logger.debug('[文件清理] 添加清理策略', { policy });
  }

  /**
   * 移除清理策略
   */
  removePolicy(directory: string): void {
    this.policies = this.policies.filter(p => p.directory !== directory);
    logger.debug('[文件清理] 移除清理策略', { directory });
  }

  /**
   * 获取所有清理策略
   */
  getPolicies(): CleanupPolicy[] {
    return [...this.policies];
  }

  /**
   * 执行单个策略的清理
   */
  async cleanupByPolicy(policy: CleanupPolicy): Promise<CleanupResult> {
    logger.info('[文件清理] 开始清理', {
      directory: policy.directory,
      maxAgeDays: policy.maxAgeDays,
    });

    const result: CleanupResult = {
      scannedCount: 0,
      deletedCount: 0,
      freedSpace: 0,
      deletedFiles: [],
      errors: [],
    };

    try {
      // 检查目录是否存在
      if (!fs.existsSync(policy.directory)) {
        logger.warn('[文件清理] 目录不存在', { directory: policy.directory });
        return result;
      }

      const files = this.scanFiles(policy.directory, policy);
      result.scannedCount = files.length;

      const now = Date.now();
      const maxAgeMs = policy.maxAgeDays * 24 * 60 * 60 * 1000;

      for (const filePath of files) {
        try {
          const stats = fs.statSync(filePath);
          const fileAge = now - stats.mtimeMs;

          // 检查文件年龄
          if (fileAge > maxAgeMs) {
            // 检查最小文件大小
            if (policy.minSize && stats.size < policy.minSize) {
              continue;
            }

            // 删除文件
            fs.unlinkSync(filePath);
            result.deletedCount++;
            result.freedSpace += stats.size;
            result.deletedFiles.push(filePath);

            logger.debug('[文件清理] 删除文件', {
              file: path.basename(filePath),
              size: stats.size,
              ageDays: Math.floor(fileAge / (24 * 60 * 60 * 1000)),
            });
          }
        } catch (error: any) {
          result.errors.push({
            file: filePath,
            error: error.message,
          });
          logger.error('[文件清理] 删除文件失败', {
            file: filePath,
            error: error.message,
          });
        }
      }

      logger.info('[文件清理] 清理完成', {
        directory: policy.directory,
        scanned: result.scannedCount,
        deleted: result.deletedCount,
        freedMB: (result.freedSpace / 1024 / 1024).toFixed(2),
      });
    } catch (error: any) {
      logger.error('[文件清理] 清理失败', {
        directory: policy.directory,
        error: error.message,
      });
    }

    return result;
  }

  /**
   * 扫描目录中的文件
   */
  private scanFiles(directory: string, policy: CleanupPolicy): string[] {
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          // 递归扫描子目录
          if (policy.recursive) {
            files.push(...this.scanFiles(fullPath, policy));
          }
        } else if (entry.isFile()) {
          // 检查文件扩展名
          if (policy.extensions && policy.extensions.length > 0) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!policy.extensions.includes(ext)) {
              continue;
            }
          }

          // 检查文件名模式
          if (policy.pattern) {
            const regex = new RegExp(policy.pattern);
            if (!regex.test(entry.name)) {
              continue;
            }
          }

          files.push(fullPath);
        }
      }
    } catch (error: any) {
      logger.error('[文件清理] 扫描目录失败', {
        directory,
        error: error.message,
      });
    }

    return files;
  }

  /**
   * 执行所有策略的清理
   */
  async cleanupAll(): Promise<CleanupResult[]> {
    logger.info('[文件清理] 开始执行所有清理策略', {
      policiesCount: this.policies.length,
    });

    const results: CleanupResult[] = [];

    for (const policy of this.policies) {
      const result = await this.cleanupByPolicy(policy);
      results.push(result);
    }

    // 汇总结果
    const totalScanned = results.reduce((sum, r) => sum + r.scannedCount, 0);
    const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
    const totalFreed = results.reduce((sum, r) => sum + r.freedSpace, 0);

    logger.info('[文件清理] 所有清理任务完成', {
      policiesExecuted: results.length,
      totalScanned,
      totalDeleted,
      totalFreedMB: (totalFreed / 1024 / 1024).toFixed(2),
    });

    return results;
  }

  /**
   * 启动定时清理任务
   * @param intervalHours 清理间隔（小时），默认24小时
   */
  startScheduledCleanup(intervalHours: number = 24): void {
    if (this.cleanupInterval) {
      logger.warn('[文件清理] 定时任务已在运行');
      return;
    }

    logger.info('[文件清理] 启动定时清理任务', {
      intervalHours,
      nextRunTime: new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString(),
    });

    // 立即执行一次
    this.cleanupAll().catch(error => {
      logger.error('[文件清理] 定时任务执行失败', { error: error.message });
    });

    // 设置定时器
    this.cleanupInterval = setInterval(() => {
      logger.info('[文件清理] 定时任务触发');
      this.cleanupAll().catch(error => {
        logger.error('[文件清理] 定时任务执行失败', { error: error.message });
      });
    }, intervalHours * 60 * 60 * 1000);

    logger.info('[文件清理] 定时任务已启动');
  }

  /**
   * 停止定时清理任务
   */
  stopScheduledCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('[文件清理] 定时清理任务已停止');
    }
  }

  /**
   * 获取目录统计信息
   */
  async getDirectoryStats(directory: string): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestFile?: { name: string; age: number };
    newestFile?: { name: string; age: number };
  }> {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      oldestFile: undefined as { name: string; age: number } | undefined,
      newestFile: undefined as { name: string; age: number } | undefined,
    };

    if (!fs.existsSync(directory)) {
      return stats;
    }

    try {
      const files = this.scanFiles(directory, { directory, maxAgeDays: 0, recursive: true });
      stats.totalFiles = files.length;

      const now = Date.now();
      let oldestAge = 0;
      let newestAge = Infinity;

      for (const filePath of files) {
        const fileStats = fs.statSync(filePath);
        stats.totalSize += fileStats.size;

        const age = now - fileStats.mtimeMs;
        if (age > oldestAge) {
          oldestAge = age;
          stats.oldestFile = {
            name: path.basename(filePath),
            age: Math.floor(age / (24 * 60 * 60 * 1000)),
          };
        }
        if (age < newestAge) {
          newestAge = age;
          stats.newestFile = {
            name: path.basename(filePath),
            age: Math.floor(age / (24 * 60 * 60 * 1000)),
          };
        }
      }
    } catch (error: any) {
      logger.error('[文件清理] 获取目录统计失败', {
        directory,
        error: error.message,
      });
    }

    return stats;
  }

  /**
   * 手动清理指定目录
   */
  async cleanupDirectory(
    directory: string,
    maxAgeDays: number,
    options?: {
      extensions?: string[];
      pattern?: string;
      dryRun?: boolean;
    }
  ): Promise<CleanupResult> {
    const policy: CleanupPolicy = {
      directory,
      maxAgeDays,
      extensions: options?.extensions,
      pattern: options?.pattern,
      recursive: true,
    };

    if (options?.dryRun) {
      logger.info('[文件清理] 预演模式（不实际删除文件）');
      // TODO: 实现预演模式
    }

    return this.cleanupByPolicy(policy);
  }
}

/**
 * 全局清理服务实例
 */
export const fileCleanupService = new FileCleanupService();

/**
 * 默认导出
 */
export default fileCleanupService;
