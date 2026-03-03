import { feishuWiki } from './src/services/feishu.wiki';
import { feishuAuth } from './src/services/feishu.auth';

async function testSyncWithMCP() {
  console.log('======================================');
  console.log('飞书同步功能测试 (使用 MCP)');
  console.log('======================================\n');

  try {
    // 1. 获取 Token
    console.log('1️⃣ 获取 Access Token...');
    const token = await feishuAuth.getAccessToken();
    console.log('✅ Token 获取成功\n');

    // 2. 测试同步文章到飞书
    console.log('2️⃣ 测试同步文章到飞书...');
    const syncResult = await feishuWiki.syncArticleToFeishu({
      title: 'MCP 同步测试文章 - ' + new Date().toLocaleString(),
      content: `# 测试文章

这是通过 MCP 同步的测试文章。

## 文章内容

- 标题: MCP 同步测试
- 时间: ${new Date().toISOString()}
- 来源: MindFlow 小程序

## 总结

飞书 MCP 同步功能测试成功！
`,
    });
    console.log('✅ 文章同步成功！');
    console.log(`   文档 ID: ${syncResult.wikiToken}`);
    console.log(`   文档 URL: ${syncResult.url}\n`);

    // 3. 测试获取文档内容
    console.log('3️⃣ 测试获取文档内容...');
    const content = await feishuWiki.getDocumentContent(syncResult.wikiToken);
    console.log('✅ 文档内容获取成功');
    console.log(`   内容长度: ${content.length} 字符\n`);

    // 4. 测试更新文档
    console.log('4️⃣ 测试更新文档...');
    await feishuWiki.syncArticleToFeishu({
      title: 'MCP 同步测试文章（已更新）',
      content: '\n\n## 更新内容\n\n这篇文章已通过 MCP 更新！',
      wikiToken: syncResult.wikiToken,
    });
    console.log('✅ 文档更新成功\n');

    console.log('======================================');
    console.log('🎉 所有同步测试通过！');
    console.log('======================================');
    console.log('\n📋 测试总结:');
    console.log('   ✅ Access Token 获取');
    console.log('   ✅ 文档创建同步');
    console.log('   ✅ 文档内容获取');
    console.log('   ✅ 文档更新');
    console.log('\n飞书 MCP 同步功能已可用！');
    console.log('\n📎 测试文档链接:');
    console.log(`   ${syncResult.url}`);

  } catch (error: any) {
    console.log('❌ 测试失败:', error.message);
    if (error.response?.data) {
      console.log('错误详情:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testSyncWithMCP();
