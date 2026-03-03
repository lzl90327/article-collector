import { feishuMCP } from './src/services/feishu.mcp';
import { feishuAuth } from './src/services/feishu.auth';

async function testMCP() {
  console.log('======================================');
  console.log('飞书 MCP 功能测试');
  console.log('======================================\n');

  try {
    // 1. 获取 Tenant Access Token
    console.log('1️⃣ 获取 Tenant Access Token...');
    const token = await feishuAuth.getAccessToken();
    console.log('✅ Token 获取成功');
    console.log(`   Token 前缀: ${token.substring(0, 20)}...\n`);

    // 2. 初始化 MCP 连接
    console.log('2️⃣ 初始化 MCP 连接...');
    const initResult = await feishuMCP.initialize(token);
    console.log('✅ MCP 连接初始化成功');
    console.log(`   服务器: ${initResult.serverInfo?.name}\n`);

    // 3. 列出可用工具
    console.log('3️⃣ 列出可用工具...');
    const tools = await feishuMCP.listTools(token, [
      'create-doc',
      'fetch-doc',
      'update-doc',
      'list-docs',
      'search-doc',
    ]);
    console.log('✅ 可用工具列表:');
    tools.forEach((tool: any) => {
      console.log(`   - ${tool.name}: ${tool.description?.substring(0, 50)}...`);
    });
    console.log('');

    // 4. 创建测试文档
    console.log('4️⃣ 创建测试文档...');
    const testTitle = `MCP 测试文档 - ${new Date().toLocaleString()}`;
    const testContent = `# 测试文档

这是通过 MCP 创建的测试文档。

## 测试内容

- 创建时间: ${new Date().toISOString()}
- 测试目的: 验证 MCP 功能

## 结论

如果看到这段文字，说明 MCP 文档创建功能正常工作！
`;

    const createResult = await feishuMCP.createDocument(token, {
      title: testTitle,
      content: testContent,
    });
    console.log('✅ 文档创建成功！');
    console.log(`   文档 ID: ${createResult.docToken}`);
    console.log(`   文档 URL: ${createResult.url}\n`);

    // 5. 获取文档内容
    console.log('5️⃣ 获取文档内容...');
    const fetchResult = await feishuMCP.fetchDocument(token, createResult.docToken);
    console.log('✅ 文档内容获取成功');
    console.log(`   标题: ${fetchResult.title}`);
    console.log(`   内容长度: ${fetchResult.content?.length || 0} 字符\n`);

    // 6. 更新文档
    console.log('6️⃣ 更新文档...');
    await feishuMCP.updateDocument(token, {
      docId: createResult.docToken,
      content: '\n\n## 更新内容\n\n文档已通过 MCP 更新！',
      mode: 'append',
    });
    console.log('✅ 文档更新成功\n');

    // 7. 搜索文档
    console.log('7️⃣ 搜索文档...');
    const searchResults = await feishuMCP.searchDocuments(token, 'MCP 测试', 10);
    console.log('✅ 搜索完成');
    console.log(`   找到 ${searchResults.length} 个结果`);
    searchResults.slice(0, 3).forEach((doc: any, index: number) => {
      console.log(`   [${index + 1}] ${doc.title}`);
    });
    console.log('');

    console.log('======================================');
    console.log('🎉 所有 MCP 测试通过！');
    console.log('======================================');

  } catch (error: any) {
    console.log('❌ 测试失败:', error.message);
    if (error.response?.data) {
      console.log('错误详情:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testMCP();
