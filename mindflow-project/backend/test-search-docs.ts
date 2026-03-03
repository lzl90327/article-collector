import { feishuMCP } from './src/services/feishu.mcp';
import { feishuAuth } from './src/services/feishu.auth';

async function testSearch() {
  console.log('======================================');
  console.log('搜索云文档');
  console.log('======================================\n');

  try {
    const token = await feishuAuth.getAccessToken();
    console.log('✅ Token 获取成功\n');

    // 尝试搜索该知识库相关的文档
    console.log('搜索包含 "E8jHwM9kIip9lnkyLWRcNxGjndb" 的文档...\n');
    
    // 注意：search-doc 需要 User Access Token，这里用 TAT 会失败
    // 但我们先测试一下错误信息
    try {
      const results = await feishuMCP.searchDocuments(token, 'E8jHwM9kIip9lnkyLWRcNxGjndb', 20);
      console.log(`找到 ${results.length} 个结果`);
      results.forEach((doc, i) => {
        console.log(`${i + 1}. ${doc.title}`);
      });
    } catch (e: any) {
      console.log('搜索失败（预期）:', e.message);
      console.log('\n说明: search-doc 需要 User Access Token');
    }

    console.log('\n======================================');
    console.log('💡 建议');
    console.log('======================================');
    console.log('1. 使用 User Access Token (UAT) 可以搜索文档');
    console.log('2. 需要用户先完成 OAuth 授权');
    console.log('3. 或者使用文档的 doc_token 直接访问');

  } catch (error: any) {
    console.log('❌ 测试失败:', error.message);
  }
}

testSearch();
