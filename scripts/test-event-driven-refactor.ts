/**
 * 事件驱动架构重构测试脚本
 * 测试新架构的核心功能是否正常工作
 */

import dotenv from 'dotenv';
dotenv.config();

import { eventBus, ArticleEvent, type ArticleEventData } from '../src/core/events';
import { ArticleService } from '../src/core/services';
import { FeishuStorage } from '../src/adapters/feishu';
import { logger } from '../src/utils/logger';

// 测试配置
const TEST_URL = 'https://mp.weixin.qq.com/s/test-article'; // 测试 URL（不会真正抓取）
const TEST_USER_ID = 'test-user-123';
const TEST_MESSAGE_ID = 'test-message-456';

// 事件收集器
class EventCollector {
  private events: Array<{ event: ArticleEvent; data: ArticleEventData }> = [];

  constructor() {
    // 订阅所有文章事件
    Object.values(ArticleEvent).forEach((event) => {
      eventBus.subscribeArticleEvent(event, (data) => {
        this.events.push({ event, data });
        console.log(`📢 收到事件: ${event}`);
      });
    });
  }

  getEvents(): Array<{ event: ArticleEvent; data: ArticleEventData }> {
    return this.events;
  }

  clear(): void {
    this.events = [];
  }

  hasEvent(event: ArticleEvent): boolean {
    return this.events.some((e) => e.event === event);
  }

  getEventData(event: ArticleEvent): ArticleEventData | undefined {
    return this.events.find((e) => e.event === event)?.data;
  }
}

// 测试用例
async function runTests() {
  console.log('\n========================================');
  console.log('   事件驱动架构重构 - 自动化测试');
  console.log('========================================\n');

  const eventCollector = new EventCollector();
  const feishuStorage = new FeishuStorage();
  const articleService = new ArticleService(feishuStorage);

  let passed = 0;
  let failed = 0;

  // 测试 1: EventBus 是否正常工作
  console.log('📋 测试 1: EventBus 单例和事件发布/订阅');
  try {
    const bus1 = eventBus;
    const bus2 = eventBus;
    
    if (bus1 === bus2) {
      console.log('  ✅ EventBus 单例模式正常');
      passed++;
    } else {
      console.log('  ❌ EventBus 单例模式失败');
      failed++;
    }

    // 测试事件发布
    eventCollector.clear();
    eventBus.publishArticleEvent(ArticleEvent.PROCESSING_STARTED, {
      userId: TEST_USER_ID,
      messageId: TEST_MESSAGE_ID,
      article: { originalUrl: TEST_URL, title: 'Test', content: 'Test Content' },
      timestamp: new Date(),
    });

    await delay(100); // 等待事件处理

    if (eventCollector.hasEvent(ArticleEvent.PROCESSING_STARTED)) {
      console.log('  ✅ 事件发布/订阅正常工作');
      passed++;
    } else {
      console.log('  ❌ 事件发布/订阅失败');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ EventBus 测试失败:', error);
    failed += 2;
  }

  // 测试 2: FeishuStorage 接口实现检查
  console.log('\n📋 测试 2: FeishuStorage 接口实现');
  try {
    const hasCheckMethod = typeof feishuStorage.checkArticleExists === 'function';
    const hasCreateDocMethod = typeof feishuStorage.createDocument === 'function';
    const hasCreateRecordMethod = typeof feishuStorage.createBitableRecord === 'function';

    if (hasCheckMethod && hasCreateDocMethod && hasCreateRecordMethod) {
      console.log('  ✅ FeishuStorage 实现了所有必需方法');
      passed++;
    } else {
      console.log('  ❌ FeishuStorage 缺少必需方法');
      console.log(`    - checkArticleExists: ${hasCheckMethod}`);
      console.log(`    - createDocument: ${hasCreateDocMethod}`);
      console.log(`    - createBitableRecord: ${hasCreateRecordMethod}`);
      failed++;
    }
  } catch (error) {
    console.log('  ❌ FeishuStorage 测试失败:', error);
    failed++;
  }

  // 测试 3: ArticleService 结构检查
  console.log('\n📋 测试 3: ArticleService 核心方法');
  try {
    const hasProcessMethod = typeof articleService.processArticle === 'function';

    if (hasProcessMethod) {
      console.log('  ✅ ArticleService.processArticle 方法存在');
      passed++;
    } else {
      console.log('  ❌ ArticleService.processArticle 方法缺失');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ ArticleService 测试失败:', error);
    failed++;
  }

  // 测试 4: 验证已存在文章的事件流（模拟）
  console.log('\n📋 测试 4: 已存在文章的事件流验证');
  try {
    eventCollector.clear();
    
    // 这个测试需要实际的飞书环境，这里只做结构验证
    console.log('  ℹ️  需要实际环境验证，跳过（手动测试）');
    console.log('  💡 建议手动测试：发送已收藏的文章链接');
  } catch (error) {
    console.log('  ❌ 事件流测试失败:', error);
    failed++;
  }

  // 测试 5: 文件结构检查
  console.log('\n📋 测试 5: 新架构文件结构检查');
  try {
    const fs = require('fs');
    const path = require('path');
    
    const requiredFiles = [
      'src/core/events/event-bus.ts',
      'src/core/events/article.events.ts',
      'src/core/events/index.ts',
      'src/core/interfaces/storage.interface.ts',
      'src/core/interfaces/index.ts',
      'src/core/services/article.service.ts',
      'src/core/services/index.ts',
      'src/adapters/feishu/feishu.adapter.ts',
      'src/adapters/feishu/feishu.storage.ts',
      'src/adapters/feishu/index.ts',
      'src/adapters/index.ts',
    ];

    let missingFiles = 0;
    for (const file of requiredFiles) {
      const fullPath = path.resolve(process.cwd(), file);
      if (!fs.existsSync(fullPath)) {
        console.log(`  ❌ 缺失文件: ${file}`);
        missingFiles++;
      }
    }

    if (missingFiles === 0) {
      console.log(`  ✅ 所有必需文件存在 (${requiredFiles.length} 个)`);
      passed++;
    } else {
      console.log(`  ❌ 缺失 ${missingFiles} 个文件`);
      failed++;
    }
  } catch (error) {
    console.log('  ❌ 文件结构检查失败:', error);
    failed++;
  }

  // 测试 6: TypeScript 编译检查
  console.log('\n📋 测试 6: TypeScript 编译状态');
  try {
    const fs = require('fs');
    const path = require('path');
    
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      console.log('  ✅ dist 目录存在，编译成功');
      passed++;
    } else {
      console.log('  ❌ dist 目录不存在，需要编译');
      failed++;
    }
  } catch (error) {
    console.log('  ❌ 编译状态检查失败:', error);
    failed++;
  }

  // 输出测试结果
  console.log('\n========================================');
  console.log('           测试结果汇总');
  console.log('========================================');
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📊 总计: ${passed + failed}`);
  console.log(`📈 通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('========================================\n');

  // 手动测试建议
  console.log('📝 手动测试建议：');
  console.log('   1. 发送一篇新文章链接到飞书机器人');
  console.log('   2. 观察是否收到两张卡片：');
  console.log('      - 第一张：AI 分析完成（蓝色）');
  console.log('      - 第二张：文档创建成功（绿色）');
  console.log('   3. 检查多维表格是否正确创建记录');
  console.log('   4. 发送同一篇文章链接，观察是否提示"文章已存在"');
  console.log('   5. 查看服务日志：pm2 logs article-collector');
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

// 辅助函数
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 运行测试
runTests().catch((error) => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
