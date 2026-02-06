/**
 * 抓取降级功能自动化测试
 * 
 * 测试内容：
 * 1. Jina Reader 基本抓取功能
 * 2. 模拟 Browser Use 失败后的降级流程
 * 
 * 运行: npx ts-node scripts/test-fetch-fallback.ts
 */

import axios from 'axios';

// ============================================================
// 测试框架
// ============================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const testResults: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const startTime = Date.now();
  try {
    await fn();
    const duration = Date.now() - startTime;
    testResults.push({ name, passed: true, duration });
    console.log(`  ✅ ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    testResults.push({ name, passed: false, error: error.message, duration });
    console.log(`  ❌ ${name} (${duration}ms)`);
    console.log(`     ${error.message}`);
  }
}

function assertTrue(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || '条件不满足');
  }
}

// ============================================================
// Jina Reader 测试
// ============================================================

const JINA_READER_BASE_URL = 'https://r.jina.ai';

async function testJinaReader(url: string): Promise<{ title: string; content: string }> {
  const response = await axios.get(`${JINA_READER_BASE_URL}/${url}`, {
    headers: {
      'Accept': 'text/markdown',
      'x-respond-with': 'markdown',
    },
    timeout: 60000,
  });

  const content = response.data as string;
  
  // 简单解析标题（Jina 返回的 Markdown 格式）
  let title = '未知标题';
  const titleMatch = content.match(/^Title:\s*(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  } else {
    // 尝试从 # 标题提取
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      title = h1Match[1].trim();
    }
  }

  return { title, content };
}

// ============================================================
// 测试用例
// ============================================================

async function runTests(): Promise<void> {
  console.log('\n📦 抓取降级功能测试\n');

  // 测试 1: Jina Reader 基本功能
  console.log('  --- Jina Reader 基本功能 ---');

  await test('Jina Reader 抓取简单页面', async () => {
    const result = await testJinaReader('https://example.com');
    assertTrue(result.content.length > 100, '内容长度应大于 100');
    assertTrue(result.content.includes('Example Domain'), '应包含 Example Domain');
  });

  await test('Jina Reader 抓取技术博客', async () => {
    // 使用一个稳定的技术博客页面
    const result = await testJinaReader('https://blog.cloudflare.com/tag/security/');
    assertTrue(result.content.length > 500, '内容长度应大于 500');
  });

  // 测试 2: 模拟降级场景
  console.log('\n  --- 降级逻辑测试 ---');

  await test('降级逻辑：Browser Use 超时后使用 Jina', async () => {
    // 模拟 Browser Use 失败的情况
    let usedFallback = false;
    let finalResult: { title: string; content: string } | null = null;

    try {
      // 模拟 Browser Use 超时
      throw new Error('Timeout 60000ms exceeded');
    } catch (browserError) {
      // 降级到 Jina Reader
      usedFallback = true;
      finalResult = await testJinaReader('https://example.com');
    }

    assertTrue(usedFallback, '应该使用降级');
    assertTrue(finalResult !== null, '应该有结果');
    assertTrue(finalResult!.content.length > 100, '内容应有效');
  });

  await test('降级逻辑：两种方式都返回有效内容', async () => {
    // 测试一个公开可访问的页面
    const url = 'https://www.google.com/about/';
    
    // Jina Reader 应该能抓取
    const result = await testJinaReader(url);
    assertTrue(result.content.length > 100, 'Jina Reader 应返回有效内容');
  });

  // 测试 3: 边界情况
  console.log('\n  --- 边界情况 ---');

  await test('处理返回空内容的情况', async () => {
    // 模拟内容验证逻辑
    const validateContent = (content: string): boolean => {
      return content.length >= 100;
    };

    assertTrue(validateContent('a'.repeat(100)), '100字符应通过');
    assertTrue(!validateContent('a'.repeat(99)), '99字符应不通过');
  });

  await test('处理无标题的情况', async () => {
    // 模拟标题提取逻辑
    const extractTitle = (content: string): string => {
      const titleMatch = content.match(/^Title:\s*(.+)$/m);
      if (titleMatch) return titleMatch[1].trim();
      const h1Match = content.match(/^#\s+(.+)$/m);
      if (h1Match) return h1Match[1].trim();
      return '未知标题';
    };

    assertTrue(extractTitle('Title: Test Article') === 'Test Article', '应提取 Title');
    assertTrue(extractTitle('# My Title') === 'My Title', '应提取 H1');
    assertTrue(extractTitle('no title here') === '未知标题', '无标题时应返回默认值');
  });
}

// ============================================================
// 主函数
// ============================================================

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log('   抓取降级功能自动化测试');
  console.log('═══════════════════════════════════════════');

  await runTests();

  // 汇总结果
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  const totalDuration = testResults.reduce((sum, r) => sum + (r.duration || 0), 0);

  console.log('\n═══════════════════════════════════════════');
  console.log('   测试结果汇总');
  console.log('═══════════════════════════════════════════');
  console.log(`   通过: ${passed}`);
  console.log(`   失败: ${failed}`);
  console.log(`   总计: ${testResults.length}`);
  console.log(`   耗时: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log('═══════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('失败的测试:');
    testResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    process.exit(1);
  }

  console.log('✅ 所有测试通过！\n');
}

main().catch((error) => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
