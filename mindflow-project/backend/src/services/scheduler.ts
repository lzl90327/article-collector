import * as cron from 'node-cron';
import { sourceSync } from './sync.sources';
import { articleSync } from './sync.articles';
import { viewpointSync } from './sync.viewpoints';
import { logger } from '../utils/logger';

class SchedulerService {
  private tasks: Map<string, any> = new Map();

  start() {
    // 每 5 分钟同步素材
    this.tasks.set('sources', cron.schedule('*/5 * * * *', async () => {
      logger.info('开始定时同步素材...');
      try {
        await sourceSync.sync();
      } catch (error) {
        logger.error('定时同步素材失败', error);
      }
    }));

    // 每 10 分钟同步文章
    this.tasks.set('articles', cron.schedule('*/10 * * * *', async () => {
      logger.info('开始定时同步文章...');
      try {
        await articleSync.sync();
      } catch (error) {
        logger.error('定时同步文章失败', error);
      }
    }));

    // 每 15 分钟同步观点
    this.tasks.set('viewpoints', cron.schedule('*/15 * * * *', async () => {
      logger.info('开始定时同步观点...');
      try {
        await viewpointSync.sync();
      } catch (error) {
        logger.error('定时同步观点失败', error);
      }
    }));

    logger.info('定时任务调度器已启动');
  }

  stop() {
    for (const [name, task] of this.tasks) {
      task.stop();
      logger.info(`定时任务 ${name} 已停止`);
    }
    this.tasks.clear();
  }

  getStatus() {
    return {
      running: this.tasks.size > 0,
      tasks: Array.from(this.tasks.keys()),
    };
  }
}

export const scheduler = new SchedulerService();
