/**
 * 测试文章抓取速度优化效果
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestResult {
  url: string;
  type: string;
  success: boolean;
  elapsed: number;
  imageCount: number;
  error?: string;
}

const TEST_URLS = [
  {
    url: 'https://mp.weixin.qq.com/s/Uq8rJaJBgLoyb0UAKn6wXA',
    type: '微信公众号文章（多图）',
  },
  // 可以添加更多测试 URL
];

async function testFetchSpeed(url: string): Promise<{ success: boolean; elapsed: number; imageCount: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    const { stdout, stderr } = await execAsync(
      `python3 scripts/browser_fetcher.py "${url}"`,
      { timeout: 120000 } // 2分钟超时
    );
    
    const elapsed = Date.now() - startTime;
    
    // 解析结果
    try {
      const result = JSON.parse(stdout);
      
      if (result.error) {
        return { success: false, elapsed, imageCount: 0, error: result.error };
      }
      
      // 统计图片数量
      const imageCount = result.images?.length || 0;
      
      return { success: true, elapsed, imageCount };
    } catch (e) {
      return { success: false, elapsed, imageCount: 0, error: '解析结果失败' };
    }
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    return { success: false, elapsed, imageCount: 0, error: error.message };
  }
}

async function main() {
  console.log('📊 开始测试文章抓取速度优化效果\n');
  console.log('优化内容:');
  console.log('  1. 并行图片下载（5并发）');
  console.log('  2. 微信文章使用 domcontentloaded 等待策略');
  console.log('  3. 移除冗余的固定延迟\n');
  
  const results: TestResult[] = [];
  
  for (const test of TEST_URLS) {
    console.log(`\n🔗 测试: ${test.type}`);
    console.log(`   URL: ${test.url}`);
    console.log('   开始抓取...');
    
    const result = await testFetchSpeed(test.url);
    
    const testResult: TestResult = {
      url: test.url,
      type: test.type,
      ...result,
    };
    
    results.push(testResult);
    
    if (result.success) {
      console.log(`   ✅ 成功 - 耗时: ${(result.elapsed / 1000).toFixed(1)}秒, 图片: ${result.imageCount}张`);
    } else {
      console.log(`   ❌ 失败 - 耗时: ${(result.elapsed / 1000).toFixed(1)}秒`);
      console.log(`   错误: ${result.error}`);
    }
  }
  
  // 输出总结
  console.log('\n' + '='.repeat(60));
  console.log('📈 测试总结\n');
  
  for (const result of results) {
    console.log(`${result.type}:`);
    console.log(`  状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  耗时: ${(result.elapsed / 1000).toFixed(1)}秒`);
    if (result.success) {
      console.log(`  图片: ${result.imageCount}张`);
    } else {
      console.log(`  错误: ${result.error}`);
    }
    console.log('');
  }
  
  // 评估
  const successResults = results.filter(r => r.success);
  if (successResults.length > 0) {
    const avgTime = successResults.reduce((sum, r) => sum + r.elapsed, 0) / successResults.length;
    console.log(`平均耗时: ${(avgTime / 1000).toFixed(1)}秒`);
    
    console.log('\n💡 预期优化效果:');
    console.log('  - 优化前: 60-120秒');
    console.log(`  - 优化后: ${(avgTime / 1000).toFixed(1)}秒`);
    
    if (avgTime < 60000) {
      console.log('  - ✅ 已达到优化目标（<60秒）');
    } else {
      console.log('  - ⚠️ 仍需进一步优化');
    }
  }
}

main().catch(console.error);
