/**
 * 同步功能测试
 * 用于验证 syncFromFeishu 方法是否能正确添加测试数据
 */

import { sourceSync } from '../src/services/sync.sources';
import { prisma } from '../src/lib/prisma';

async function testSync() {
  console.log('=== 开始测试同步功能 ===\n');

  try {
    // 1. 测试前清理测试数据
    console.log('1. 清理现有测试数据...');
    await prisma.source.deleteMany({
      where: {
        id: {
          startsWith: 'test-',
        },
      },
    });
    console.log('   ✓ 清理完成\n');

    // 2. 调用同步方法
    console.log('2. 调用 syncFromFeishu...');
    const result = await sourceSync.syncFromFeishu();
    console.log('   结果:', JSON.stringify(result, null, 2));
    console.log('   ✓ 同步调用完成\n');

    // 3. 验证数据库中是否有数据
    console.log('3. 验证数据库中的数据...');
    const sources = await prisma.source.findMany({
      where: {
        id: {
          startsWith: 'test-',
        },
      },
    });
    console.log(`   找到 ${sources.length} 条测试数据`);
    sources.forEach((source, index) => {
      console.log(`   ${index + 1}. ${source.title} (${source.type})`);
    });
    console.log('   ✓ 数据验证完成\n');

    // 4. 断言检查结果
    console.log('4. 测试结果断言...');
    if (result.count === 0) {
      console.error('   ✗ 失败: 同步返回 count 为 0');
      process.exit(1);
    }

    if (sources.length === 0) {
      console.error('   ✗ 失败: 数据库中没有测试数据');
      process.exit(1);
    }

    if (result.count !== sources.length) {
      console.error(`   ✗ 失败: 返回的 count (${result.count}) 与数据库中的数量 (${sources.length}) 不匹配`);
      process.exit(1);
    }

    console.log('   ✓ 所有断言通过\n');
    console.log('=== 测试通过 ===');
    process.exit(0);
  } catch (error: any) {
    console.error('测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testSync();
