import { feishuMCP } from './src/services/feishu.mcp';
import { feishuAuth } from './src/services/feishu.auth';

async function test() {
  console.log('测试 search-doc 功能...\n');
  
  // 由于数据库连接问题，直接使用 TAT 测试 search-doc
  // 实际上 search-doc 需要 UAT，但我们先测试一下错误信息
  console.log('使用 Tenant Access Token 测试...');
  const token = await feishuAuth.getAccessToken();
  console.log('TAT 获取成功:', token.substring(0, 20) + '...\n');
  
  console.log('搜索文档...');
  try {
    const results = await feishuMCP.searchDocuments(
      token,
      '测试',
      10
    );
    console.log('✅ 搜索成功！');
    console.log('找到', results.length, '个结果');
    
    if (results.length > 0) {
      console.log('\n前 3 个结果:');
      results.slice(0, 3).forEach((doc: any, i: number) => {
        console.log(`  [${i + 1}] ${doc.title}`);
      });
    }
  } catch (e: any) {
    console.log('❌ 搜索失败:', e.message);
    console.log('\n这是预期的错误，因为 search-doc 需要 User Access Token');
    console.log('Tenant Access Token 不能用于 search-doc');
  }
}

test();
